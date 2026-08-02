# ARCHITECTURE.md

This file is the source of truth for how tabletopmaprenderer's code is organized.
**Any change to the system — even a small one — should start by re-reading the
relevant section here first.** File boundaries, shared state, and cross-file
call paths are easy to get wrong in this codebase because there is no bundler
and no build step: every dependency is a plain `<script>` tag, order matters,
and modules talk to each other through a global `window.RPG` namespace instead
of `import`/`export`.

## No build, no bundler

- Plain `<script src="...">` tags, loaded in document order, blocking.
- No `defer`, no `async`, no `type="module"`. Whatever a file needs from an
  earlier file must already exist by the time its own top-level code runs —
  there is no lazy resolution.
- Cross-file communication happens through `window.RPG.<name>` — a file that
  wants to expose something to files loaded after it assigns
  `window.RPG.thing = thing` near the end of its own script; a file that wants
  to consume it reads `window.RPG.thing`, and can only safely do so once its
  own code runs *after* the producing script tag.
- There are two independent apps sharing the same `js/shared/*` modules:
  `index.html` (the GM/master window) and `player.html` (the read-only player
  window, opened via `window.open` and kept in sync over `postMessage`).

## Two-window system

- **`index.html` + `js/gm/*`** — the GM's full editing interface: map import,
  token CRUD, fog/wall drawing tools, scene switching, combat tracker, party
  panel, glossary, bar editor, photo crop editor.
- **`player.html` + `js/player/*`** — a read-only render target. It never
  mutates shared game state on its own; it only receives a `'rpg-state'`
  `postMessage` from the GM window and redraws. Its one genuinely original
  subsystem is the vision/fog-of-war raycasting + exploration-memory engine,
  which has no counterpart on the GM side (see "Vision & fog of war" below).
- The two windows are **not** iframes or tabs in the same document — the GM
  opens the player window with `window.open('player.html', 'rpg-player', ...)`
  and the two communicate purely through `postMessage`. Nothing but the
  synced state crosses the boundary.

## Directory layout

```
index.html            GM window shell — loads js/shared/*, js/gm/*, js/features/measure.js
player.html           Player window shell — loads js/shared/*, js/player/*
css/                  theme.css, crt-effects.css, layout.css, components.css, modals.css

js/shared/            Used by BOTH windows — loaded first, before js/gm or js/player
  camera.js             cam object, screenToWorld/eventScreenPos/zoomAt/centerView
  photo-cache.js        getTokenPhotoImg (dataURL → cached <img>), contrastColor
  object-cache.js       createObjectImgCache → getObjectImg (dataURL → cached <img>, keyed off o.dataUrl not t.photoDataUrl) — used by js/gm/draw.js and js/player/draw.js to render state.objects
  bars.js               drawTokenBars + drawHorizontalBar/drawVerticalBar/drawRadialBar/tokenBarExtents
  scene-render.js       drawMapAndGrid, drawTokenBasic (photo/color+ring+initials+name — no bars/effects)
  vision-math.js        tokenVisionReach(t) — the reach formula both windows need
  fx-trail.js           cosmetic FX trail (explosion/fire/smoke/heal): FX_TYPES defs, spawnFx/drawFx/hasActiveFx, self-driven rAF loop that keeps calling window.RPG.draw() while any effect is animating. Never touches tokens/walls/fog/state — purely visual, drawn on top of everything in both draw() loops

js/gm/                 GM-only — index.html
  state.js              allTokens, state (current-scene view), constants, DOM canvas/viewport refs
  history.js            undo/redo: snapshot-based, scoped to current scene's tokens/fog/walls — captureBeforeChange/undo/redo
  scenes.js             scenes[], currentSceneId, switchScene/createScene/bringTokenToCurrentScene, bringCarry, scene folders[] + multi-select (see "Scenes" below)
  sync.js               sendState/sendStateForced, sceneSyncPending gate, postMessage to the player window
  draw.js               draw() — the GM canvas render loop (map, grid, tokens, fog tint, walls, cones, handles)
  vision-preview.js      GM-only cosmetic vision-cone glow (NOT occluded by walls — preview only)
  hit-test.js           tokenAt/fogRectAt/wallAt/effectDotAt/distToSegment/snapToCardinal/snapWallEndpoint
  mouse.js              canvas mouse/keyboard interaction dispatch (pan/drag/rotate/fog/wall/bring-carry/measure)
  tools.js              fog/wall/move/measure tool-mode toggles + top toolbar (import/sliders panel), token resize buttons
  hotkeys.js            global keyboard shortcuts: Ctrl+C/V (copy/paste tokens), Delete/Backspace (delete token/wall/fog under cursor), Ctrl+Z/Ctrl+Y (undo/redo via history.js)
  map-grid-lighting.js  map import/scale, grid controls, global lighting slider, wall-occlusion-method select
  token-modal.js        create/edit token modal
  context-menu.js       generic right-click popup (Windows-style) — openContextMenu(x,y,items)/closeContextMenu
  note-modal.js         shared annotation textarea modal — token.note (per-token) + state.notes[] (per-scene, background pins, GM-only)
  note-postit.js        floating sticky-note alternative to note-modal.js — anchored to a world point, tracks pan/zoom, auto-saves
  token-list.js         sidebar token list + delete confirmation
  objects.js             map objects (props/scenery, NOT tokens): "Objetos" sidebar section, add/edit modal (image upload, no crop), resize buttons, remove. Per-scene like fog/walls/notes. See "Map objects" below
  party.js              Party panel (universal bars, per-member values, cross-scene "bring here")
  combat.js             combat tracker (start/stop/next-turn, draggable reorder bar)
  glossary.js           GM effects glossary modal (reference notes, not applied automatically)
  dice-roller.js        Dice roller modal (d4-d100, quantity/modifier, in-memory roll history — self-contained, no shared state dependency)
  effects-picker.js     apply/remove glossary effects on a specific token
  bar-editor.js         universal-bar-definition editor + per-member value editor
  crop-editor.js        circular photo crop modal (self-contained, minimal coupling)
  fx-settings.js         "🎆 Efeitos" tool's right-click popup: size %/duration % sliders, exposed as getFxSettings() → { scale, durationMult }, read by js/gm/mouse.js's FX click handler and passed into spawnFx/sendFx
  session-io.js         quicksave: export/import the whole session (all scenes, tokens, maps/photos as embedded dataURLs, party bars, glossary, settings) as one downloadable .json backup file; wires Settings modal's export/import buttons. Also autosaves the same payload to localStorage (debounced off logEvent, plus a 30s interval + beforeunload) and restores it automatically on page load, so a refresh/crash doesn't lose progress. Every exported/imported .json is additionally kept in an IndexedDB "version history" (last 10, oldest evicted), browsable/restorable from the "Histórico de Versões" tab in the event-log modal (tab UI wired in js/gm/tools.js's openEventLog)
  init.js               window.RPG exports + final init calls (resizeCanvas/centerView/renderParty/renderSceneList)

js/player/              Player-only — player.html
  state.js              state (received-from-GM view), cam, drag, exploredCells
  sync.js               postMessage receiver ('rpg-state'), 'rpg-player-ready' handshake, status banner, init
  draw.js               draw() — the player canvas render loop (live scene + fog compositing)
  vision-fog.js         wall-occlusion raycasting engine (segmentsIntersect, punchVisionCone, occludeConeMaskBy{Cell,Raycast})
  memory.js             frozen exploration-memory canvas (world-space, grows/re-anchors, per-cell snapshot freeze)
  fullscreen.js         removes the browser navigation bar: click-to-enter fullscreen overlay (#fsPrompt) shown on load + persistent ⛶ toggle (#fsBtn) + F key. Fullscreen needs a user gesture *in the player window*, so the GM can't trigger it over postMessage — hence the overlay. Self-contained; only calls window.RPG.resizeCanvas on fullscreenchange
  combat.js             read-only combat bar display (no drag-reorder — player can't reorder initiative)

js/features/
  measure.js            GM-only distance measuring tool — self-contained, exports via window.RPG (measureState/measureClick/measureUpdate/measureRelease/measureEnd/drawMeasure). Template for how a feature module SHOULD integrate.

js/core/, js/render/    STALE, UNUSED, KEPT ON DISK ONLY — see "Dead files" below. Do not import from here.
bckp/                   Pre-refactor monolith snapshots (index.html/player.html). Rollback safety net — do not delete without asking, do not treat as active code.
```

## Dead files — do not use, do not assume they're wired up

`js/core/state.js`, `js/core/camera.js`, `js/core/sync.js`,
`js/render/photo-cache.js`, `js/render/bars.js`, `js/render/draw.js`, and
`js/features/map.js` were an earlier, abandoned attempt at the same
modularization this file now describes. **Neither `index.html` nor
`player.html`'s actual logic reads from them** — `main.js`/`player-main.js`
(pre-split) each had their own richer local copies that drifted ahead (walls,
scenes, lighting, wall-occlusion method, scene-sync gating — none of which
exist in the stale versions). They are left on disk as historical artifacts,
not deleted, but **the real implementations now live in `js/shared/`,
`js/gm/`, and `js/player/` as described above.** If you find yourself editing
something in `js/core/*` or `js/render/*` and the change doesn't seem to do
anything when you test it, that's why — you're editing dead code. Check
`js/shared/`, `js/gm/`, or `js/player/` for the live version instead.

## Load order (must match script tags exactly)

`index.html`:
```
js/shared/camera.js → js/shared/photo-cache.js → js/shared/object-cache.js → js/shared/bars.js
→ js/shared/scene-render.js → js/shared/vision-math.js → js/shared/fx-trail.js
→ js/gm/state.js → js/gm/history.js → js/gm/scenes.js → js/gm/sync.js
→ js/gm/hit-test.js → js/gm/vision-preview.js → js/gm/draw.js
→ js/gm/map-grid-lighting.js → js/gm/token-modal.js → js/gm/crop-editor.js
→ js/gm/context-menu.js → js/gm/note-modal.js → js/gm/note-postit.js
→ js/gm/token-list.js → js/gm/objects.js → js/gm/effects-picker.js → js/gm/glossary.js
→ js/gm/dice-roller.js → js/gm/bar-editor.js → js/gm/party.js → js/gm/combat.js
→ js/gm/tools.js → js/gm/fx-settings.js → js/gm/session-io.js → js/gm/mouse.js → js/gm/hotkeys.js
→ js/features/measure.js
→ js/gm/init.js
```

`player.html`:
```
js/shared/camera.js → js/shared/photo-cache.js → js/shared/object-cache.js → js/shared/bars.js
→ js/shared/scene-render.js → js/shared/vision-math.js → js/shared/fx-trail.js
→ js/player/state.js → js/player/memory.js → js/player/vision-fog.js
→ js/player/combat.js → js/player/draw.js → js/player/fullscreen.js → js/player/sync.js
```

**Why this order:** `js/shared/*` has zero dependencies on anything else and
must load first. Within `js/gm/*`, `state.js`/`scenes.js`/`sync.js` declare
the mutable state every other GM file reads or mutates, so they load first;
`draw.js` depends on `hit-test.js` and `vision-preview.js` having already
defined the functions it calls; UI modules (modals, party, combat, tools,
mouse) come after `draw.js` since they call `draw()`/`sendState()` but aren't
called by it; `mouse.js` loads last among interaction code because it's the
one file that reaches into nearly every other module (scenes, hit-test, tools,
token CRUD) to dispatch on click; `init.js` loads absolute last because it
calls functions from every other file to kick off the first render.

If you add a new file, ask: *what does it read, and what reads it?* — put it
after everything it reads, before everything that reads it. When both
directions have forward references (rare, but see "Known forward-reference
hazards" below), the two files must be merged or the shared bit hoisted into
`js/gm/state.js`/`js/player/state.js`.

## Known forward-reference hazards

These exist because the original single-file `main.js`/`player-main.js`
tolerated forward references (a single IIFE closure resolves names at
call-time, not declaration-time, so define-after-use was harmless). Splitting
into separate script tags makes load order matter for real. If you touch any
of these, re-verify the load order still satisfies both directions:

- `js/gm/scenes.js`'s `switchScene()` touches `combatBar` (a DOM ref that
  conceptually belongs to `js/gm/combat.js`) and calls `sendState()`
  (`js/gm/sync.js`) and `renderTokenList()`/`renderParty()`
  (`js/gm/token-list.js`/`js/gm/party.js`). All of those must already be
  defined by the time a user action actually *calls* `switchScene` (i.e. by
  the time `js/gm/init.js` runs) — but `scenes.js` itself can load before or
  after them, since JS doesn't evaluate the *body* of a function until it's
  called.
- `js/gm/mouse.js` calls into almost every other GM module (scenes, hit-test,
  tools, token-modal's `removeToken`, crop-editor's `openCropEditor`) — it
  must be one of the last GM files loaded, after everything it dispatches to.
- `js/gm/party.js`'s "bring token to scene" button calls
  `js/gm/scenes.js`'s `startBringToken`/`bringTokenToCurrentScene`.

## Coordinate system

World-space camera model, identical convention in both windows:
- World origin `(0, 0)` is the center; the map image is drawn centered on it.
- Camera state: `cam.x`, `cam.y` (world point at the screen's top-left
  corner), `cam.zoom`.
- All drawing happens on a single `<canvas>` via `ctx.setTransform()` — no CSS
  transforms.
- Conversion: `screenX = (worldX - cam.x) * cam.zoom * dpr` (device pixel
  ratio folded into the transform, not applied per-draw-call).

## State management

### GM side (`js/gm/state.js`, `js/gm/scenes.js`)

`allTokens` is the master list across **every** scene — never filtered
directly. `state` (the shape below) always reflects the **currently open
scene** — switching scenes snapshots the mutable fields out to `scenes[]` and
loads the target scene's copies back in (see `js/gm/scenes.js`'s
`switchScene`/`commitSceneFields`). `state.tokens` is a recomputed *view*:
only the tokens present in the open scene (see `refreshVisibleTokens()`).

```js
state = {
  grid: { show, size, color },              // per-scene
  map: { img, scalePct, dataUrl, name, bgColor },  // per-scene; bgColor fills the canvas behind/around the map image (default '#03140a'), configurable in Ajustes, synced to the player
  tokens: [...],                             // VIEW — filtered by refreshVisibleTokens(), not a source of truth
  fog: [ { id, x, y, w, h }, ... ],          // per-scene
  walls: [ { id, x1, y1, x2, y2 }, ... ],    // per-scene, GM-only visually
  notes: [ { id, x, y, text }, ... ],        // per-scene, GM-only background annotations, never sent to player
  objects: [ { id, x, y, w, h, rotation, dataUrl, name }, ... ],  // per-scene map props/scenery — x/y = CENTER, w/h = world px, rotation in radians. Sent to player (unlike walls/notes)
  nextNoteId,
  nextObjectId,
  partyBars: [ { id, name, color, defaultMax, active, display, side, direction }, ... ],  // GLOBAL (all scenes)
  glossary: [ { id, name, desc, color, icon }, ... ],  // GLOBAL
  lighting,                // GLOBAL — reach(px) = BASE_VISION_RANGE * lighting * token.visionMult
  wallOcclusionMethod,     // GLOBAL — 'cell' | 'raycast', controls the PLAYER window's occlusion rendering
  nextId, nextFogId, nextWallId, nextBarId, nextEffectId,
  selectedTokenId,         // also doubles as "active vision token" sent to the player
  selectedObjectId,
  fogMode, wallMode, moveMode,
  combat: { active, order },  // per-scene
}

allTokens = [
  { id, x, y, r, color, name, photoDataUrl, isPlayer, barValues, effects,
    facing, visionAngle, visionMult, createdAt, note,   // note: GM-only free-text annotation
    scenes: { [sceneId]: { x, y } } },  // PRESENCE + per-scene position map
]
// A token with no entry for a scene's id in `scenes` simply doesn't appear
// there. bringTokenToCurrentScene() REPLACES the whole `scenes` map with a
// single entry — a token migrates fully, it does not leave a duplicate
// behind in its old scene.

scenes = [
  { id, name, map, fog, walls, notes, objects, grid, combat, nextFogId, nextWallId, nextNoteId, nextObjectId }
]
currentSceneId
```

### Player side (`js/player/state.js`)

Read-only mirror of whatever the GM last sent — never mutated locally except
by the incoming `'rpg-state'` message handler in `js/player/sync.js`:

```js
state = {
  grid, map: { img, scalePct, bgColor }, tokens, fog, walls, objects, combat, partyBars,
  lighting, wallOcclusionMethod, activeVisionTokenId,
}
```

`activeVisionTokenId` (mirrors the GM's `state.selectedTokenId`) — **only this
one token's** vision cone reveals/updates fog on the player window, even if
several tokens are marked `isPlayer`. This lets the GM control which party
member is "active" instead of every player token revealing fog at once.

## Photo handling

Token photos are optional, processed through `js/gm/crop-editor.js`:
1. Upload → circular crop modal opens (`openCropEditor(srcDataUrl, onDone)`).
2. Pan (drag) and zoom (1–4×, clamped to always cover the circle).
3. Apply → 256×256 PNG dataURL written back onto the token via `onDone`.
4. GM window displays the cropped photo immediately; the dataURL is only sent
   to the player window when `sendState(true)` runs (map/token changes), not
   on every render — `includeMap` gates the heavy payload.

`js/shared/photo-cache.js`'s `getTokenPhotoImg(t)` decodes each dataURL into
an `<Image>` once and caches it keyed by the dataURL string itself — if a
token's `photoDataUrl` changes, the old cache entry is simply orphaned (freed
on reload), never explicitly evicted.

## Scenes

Each scene owns its own `map`, `fog`, `walls`, `grid`, and `combat` — tokens
are the one thing that's global, with per-scene presence/position (see
"State management" above). `js/gm/scenes.js` is the only file that touches
`scenes[]`/`currentSceneId` directly; everything else reads the *current*
scene's data through the flattened `state` object as if there were only ever
one scene, which is deliberate — it means most of `js/gm/*` doesn't need to
know scenes exist at all.

- **Switching scenes** (`switchScene(sceneId)`): commits the open scene's
  mutable fields + every visible token's `x`/`y` back into `scenes[]`, loads
  the target scene's fields onto `state`, restores each of *its* tokens'
  cached `x`/`y` from their per-scene position, and — critically — **does
  NOT immediately sync the player window**. It sets `sceneSyncPending = true`
  instead (see "Player sync gate" below).
- **Scene sidebar** (right-hand panel, GM only): one card per scene with a
  mini-map thumbnail (`drawSceneThumb`) and a colored dot per token present
  in that scene, positioned via `sceneWorldToThumbPx`/`thumbPxToSceneWorld`
  (world coords ↔ thumbnail pixel coords, independent of the live camera).
  Dragging a dot repositions that token within *that* scene (no migration);
  double-clicking it calls `bringTokenToCurrentScene` (full migration).
- **Scene folders** (`js/gm/scenes.js`'s `folders[]` + each scene's optional
  `folderId`): a flat (non-nested), sibling grouping to `scenes[]`, owned by
  the same file. `folders[]` entries are `{ id, name, collapsed }`; a scene
  with `folderId: null` (the default) is ungrouped. `renderSceneList()`
  buckets scenes by `folderId` and renders collapsible folder headers before
  the ungrouped cards, via a shared `buildSceneCard(sc)` helper so per-card
  behavior (thumbnail, token dots, active/multi-select state, click-to-switch,
  click-to-rename) isn't duplicated between the folder and top-level branches.
  `createFolder(name, sceneIds)` groups a multi-selection into a new folder
  (opened for inline-rename right after, no blocking prompt);
  `deleteFolder(folderId)` ungroups its members (`folderId = null`) rather
  than deleting them; `moveSceneToFolder(sceneId, folderId|null)` backs both
  drag-and-drop and is the single mutation point for folder membership.
  Dragging a scene card into/out of a folder uses the same raw
  `mousedown`/`mousemove`/`mouseup` pattern as `attachSceneDotHandlers`
  above and `js/gm/note-postit.js` (not HTML5 Drag-and-Drop, to avoid a
  second drag paradigm in the same file) — see
  `attachSceneCardDragHandlers`. Folders are **not undoable** (consistent
  with scene creation/deletion already being outside `js/gm/history.js`'s
  scope) and **not per-scene state** — don't confuse with "Add a new
  per-scene field" in Common tasks. `folders`/`nextFolderId` round-trip
  through `js/gm/session-io.js`'s `buildSessionPayload`/`applySessionPayload`
  the same way `scenes[]` does, defaulting to `[]` for older saves that
  predate this field.
- **Scene multi-select** (`js/gm/scenes.js`'s `multiSelectedSceneIds`, a
  `Set`): Ctrl+left-click on a scene card toggles its membership
  (`toggleSceneMultiSelect`) **without** switching the open scene; a plain
  click still calls `switchScene` immediately, unchanged. Transient UI state
  only — not persisted, not synced to the player, not undoable; cleared on
  folder creation from the selection and on session import/clear. Feeds the
  "📁 Agrupar em pasta" button (`#groupScenesBtn`, enabled only at 2+
  selected).
- **Renaming** scenes and folders (`renameScene`/`renameFolder`) both go
  through one shared inline-edit helper, `startInlineRename(labelEl,
  currentValue, onCommit)` — click the name, it becomes a text input,
  Enter/blur commits, Escape cancels. This is the first rename affordance in
  the app; there's no modal or `prompt()` convention for a single text field,
  so don't introduce one for future single-field edits — reuse this helper.
- **"Bring to scene" carry** (`js/gm/scenes.js`'s `bringCarry` +
  `startBringToken`): clicking the 🎯 button in the Party panel (only party
  members show this — NPCs have no cross-scene UI today, though the data
  model doesn't prevent it) puts a semi-transparent ghost token under the
  cursor; the next left-click on the map drops it into the open scene at that
  spot (full migration, via `bringTokenToCurrentScene`); Escape or any other
  click cancels.

## Player sync protocol

GM sends `postMessage` type `'rpg-state'` (see `js/gm/sync.js`):
```js
{
  type: 'rpg-state',
  grid, tokens, fog, walls, objects, combat, partyBars, lighting, wallOcclusionMethod,
  activeVisionTokenId,        // = state.selectedTokenId
  map: { scalePct, dataUrl? } // dataUrl: string = new, null = removed, absent = unchanged
}
```
Player sends `postMessage` type `'rpg-player-ready'` once on open, to request
the full current state (handled via `sendStateForced`, bypassing any pending
gate — a freshly-opened window has never seen ANY scene, so there's nothing
to hold back).

**Only `js/gm/sync.js`'s `sendState()` sends updates; the player window is
read-only** and never calls back except for that one initial handshake.

GM also sends `postMessage` type `'rpg-fx'` (see `js/gm/sync.js`'s `sendFx`)
to trigger a cosmetic FX trail (explosion/fire/smoke/heal) on the player
window: `{ type: 'rpg-fx', fxType, x, y, opts: { scale, durationMult } }` —
`opts` comes from `js/gm/fx-settings.js`'s right-click size/duration popup.
Deliberately separate from `sendState`/the `sceneSyncPending` gate — it's a
one-shot animation trigger, not persistent state, so it always fires
immediately. `js/player/sync.js` handles it by calling
`window.RPG.spawnFx(fxType, x, y, opts)` (see `js/shared/fx-trail.js`) and
returns early, before the `'rpg-state'` check.

### Player sync gate (`sceneSyncPending`)

Switching scenes does not push the change to the player immediately — the GM
may need to set up fog, reposition tokens, or otherwise prepare the new scene
before the players see it. `sceneSyncPending = true` after `switchScene()`
makes `sendState()` a no-op (every call site elsewhere in `js/gm/*` keeps
calling it as normal; they just don't have an effect while the gate is up).
The **"🔄 Atualizar tela do jogador"** button (`js/gm/sync.js`'s
`sendStateForced`) clears the gate and force-sends. The player window keeps
rendering the previous scene, unchanged, for as long as the gate is up.

## Canvas rendering

- **GM view** (`js/gm/draw.js`): fog rects rendered semi-transparent
  (`rgba(3,20,10,0.32)`, GM sees the map underneath); walls drawn as solid
  red lines (GM-only, never sent to the player visually); vision-cone
  *preview* glow drawn on top for every `isPlayer` token (soft, NOT occluded
  by walls — see "Vision & fog of war" below); facing-direction indicators
  and the yellow rotation handle for the selected token; in-progress fog/wall
  drag previews; the "bring carry" ghost token.
- **Player view** (`js/player/draw.js`): fog rects fully opaque black by
  default; the currently-active vision token's cone is the only thing that
  reveals the live scene; previously-explored-but-not-currently-visible
  ground shows a *frozen* memory snapshot instead (see "Vision & fog of war").
- CRT effects (scanlines, RGB mask, vignette, flicker) are pure CSS via
  `body::before`/`body::after` — unrelated to the canvas, unaffected by any of
  this split.

## Token management

- Tokens drawn as circles: clipped photo if present, else solid `color` fill.
- GM: selected token gets a white 3px ring; combat's current-turn token gets
  a 4px orange ring (takes priority over selection); others get a 2px ring
  (matching photo color, or `rgba(0,0,0,0.5)` if no photo).
- Name label below the token (black-stroked white text for contrast against
  any background); if no photo, the token's first two initials are drawn
  centered inside the circle.
- **Hit testing** (`js/gm/hit-test.js`'s `tokenAt`): iterate `state.tokens`
  **backwards** so the topmost-drawn (last in array) token wins ties.
- `js/shared/scene-render.js`'s `drawTokenBasic` draws ONLY the
  circle/ring/initials/name — no bars, no effect dots. This is deliberately
  the subset the player's frozen exploration-memory snapshot uses (see
  below) — HP bars and applied effects are live combat state and shouldn't
  linger stale in a memory snapshot.

## Vision & fog of war

This is the most asymmetric subsystem in the codebase — the GM side and
player side do genuinely different things, on purpose:

- **GM side** (`js/gm/vision-preview.js`): draws a soft, non-occluded glow
  for every `isPlayer` token's cone, purely so the GM can see at a glance
  where each token's vision reaches. **Walls do NOT block this preview** —
  it's cosmetic reference only, not the real occlusion calculation.
- **Player side** (`js/player/vision-fog.js` + `js/player/memory.js`) does
  the real work:
  - Only the token matching `state.activeVisionTokenId` projects a cone that
    reveals/updates fog (see "Player side" state above).
  - **Vision cone shape**: `facing` (radians) + `visionAngle` (degrees, 20
    up to 360 = full circle) + `visionMult` (per-token range multiplier).
    Reach = `t.r + BASE_VISION_RANGE * state.lighting * visionMult`
    (`js/shared/vision-math.js`'s `tokenVisionReach`).
  - **Wall occlusion**: `state.wallOcclusionMethod` (GM-controlled, in the
    Ajustes panel) picks between two occlusion strategies:
    - `'cell'` (default): snaps occlusion to the same 48px grid used by
      exploration memory — a cell is blocked if a straight line from the
      token to its center crosses any wall segment. Cheap, blocky.
    - `'raycast'`: casts a precise shadow polygon behind each wall segment
      (quad from the two endpoints projected out past the cone's reach).
      Sharper silhouette, costs more per frame.
  - **Wall endpoint snapping**: when the GM draws a new wall
    (`js/gm/hit-test.js`'s `snapWallEndpoint`, 2px world-space tolerance),
    its endpoints snap onto any existing wall endpoint within range — this
    closes sub-pixel gaps between wall segments drawn in separate strokes
    (e.g. a room corner drawn as two lines) so the raycast occlusion can't
    leak light through a sliver too thin to see.
  - **Frozen exploration memory** (`js/player/memory.js`): a world-space
    canvas (fixed scale `MEMORY_SCALE`, independent of the live camera,
    grows/re-anchors its origin on demand) records the last-seen appearance
    of every explored 48px cell. Ground the party has explored before stays
    **dimmed but visible** (`EXPLORED_DIM_ALPHA`) once the active token moves
    away — it shows the FROZEN snapshot (map + `drawTokenBasic`-only tokens,
    no bars/effects) from the moment it was last actually inside the cone,
    not the live scene. Only the current cone shows the live, up-to-date
    scene. The observing token itself is excluded from its own snapshot (a
    token can't see itself standing in a room from outside it), and the
    cell the token's own body stands on is always freshly visited regardless
    of facing/angle (plus a small always-visible circle around its body in
    the live cone, so a narrow cone never leaves the token's own square dark).
  - Exploration memory resets (`resetExplorationMemory()`) whenever the map
    changes or is removed — old world coordinates no longer mean anything.
- **Only player (Party) tokens** ever reveal fog; enemy/NPC tokens' cones and
  facing indicators show only on the GM's `vision-preview.js` glow, never
  occlude or reveal anything on the player side.
- **Rotation**: select a token → drag the yellow handle around it, or press
  ←/→ (Shift = 15° steps) to rotate `facing` 360° — the token's image itself
  never rotates, only the cone direction.
- Fog rectangles: drawn via toggle button + drag; a drag under 4px screen
  distance is discarded (accidental click, not a real rectangle). Right-click
  a rect to remove it.

## Walls (line-of-sight blockers)

- GM-only tool (`js/gm/tools.js` toggle + `js/gm/mouse.js` drag handling):
  click-drag draws a segment; **Shift** snaps the drag angle to the nearest
  45° (cardinal/diagonal) for straight walls; right-click removes one.
  New endpoints snap onto existing wall endpoints within 2px world-space
  (see "Vision & fog of war" above).
- Rendered as solid red lines on the GM canvas only — **never sent to the
  player window visually**; the player only ever sees their *effect*
  (occluding vision cones), via `state.walls` being used purely as
  raycasting input in `js/player/vision-fog.js`.
- Per-scene (`scenes[].walls`), like fog.

## Map objects (props/scenery — distinct from tokens)

- **`js/gm/objects.js`**: "Objetos" sidebar section (parallel to the Tokens/Party
  sections), add/edit modal (`#objectOverlay` in `index.html` — image upload
  only, no color/vision/isPlayer fields, no crop editor), resize buttons
  (`topObjectShrinkBtn`/`topObjectGrowBtn` in `js/gm/tools.js`, same
  ×1.15/÷1.15 factor pattern as token resize), `removeObject`.
- **The key difference from tokens**: an object's *whole uploaded image is its
  shape* — drawn as an unclipped rectangle (`ctx.drawImage` inside a
  `translate`+`rotate`, no circular clip), not cropped into a circle. No
  vision cone, no bars, no effects, no `isPlayer` — objects are pure scenery.
- **Data shape** (`state.objects`, per-scene like fog/walls/notes — see
  `js/gm/scenes.js`): `{ id, x, y, w, h, rotation, dataUrl, name }`. `x`/`y`
  are the CENTER (unlike fog rects, which are top-left + w/h); `w`/`h` are
  world px; `rotation` is radians, same convention as `token.facing`.
- **Hit-testing** (`js/gm/hit-test.js`'s `objectAt`): rotates the click point
  into the object's local (unrotated) space around its center, then a plain
  AABB check against `±w/2`/`±h/2` — needed because, unlike a token's circle,
  an object's hitbox rotates with it.
- **Interaction** (`js/gm/mouse.js`): left-click-drag moves an object (reuses
  the shared `drag` object with `drag.mode = 'object'` / `drag.objectId`,
  parallel to `drag.mode = 'token'`); a dedicated rotate handle
  (`js/gm/hit-test.js`'s `objectRotateHandlePos`/`objectRotateHandleAt`,
  drawn/hit-tested the same way as a token's yellow rotation handle, but
  anchored above the object's top edge instead of at a fixed radius) sets
  `drag.mode = 'object-rotate'`. Right-click opens a context menu (Editar /
  Excluir) via the same `js/gm/context-menu.js` used by tokens/notes. No
  multi-select, no box-select participation, no "bring to scene" — objects
  are scenery, not party-roster entries.
- **Image cache**: `js/shared/object-cache.js`'s `createObjectImgCache` —
  the same orphan-on-change dataURL→`<Image>` cache pattern as
  `js/shared/photo-cache.js`'s `getTokenPhotoImg`, but keyed off `o.dataUrl`
  instead of `t.photoDataUrl` (different field, so it's a separate cache
  instance, not a reuse of the token one). Instantiated once per window
  (`js/gm/state.js` and `js/player/state.js`) and exposed as
  `window.RPG.getObjectImg`, used by both `js/gm/draw.js` and
  `js/player/draw.js`.
- **Rendered on the player window too** (unlike walls/notes, which are
  GM-only) — see `js/player/draw.js`, drawn right after the map/grid and
  before tokens, same unclipped rotated-rect approach, no selection ring.
  Included in the `sendState()` payload (`js/gm/sync.js`) and mirrored in
  `js/player/state.js`/`js/player/sync.js` as `state.objects`.
- **Undo/redo, session export/import**: captured by `js/gm/history.js`'s
  snapshot (`state.objects`/`nextObjectId` alongside fog/walls/notes) and
  round-tripped through `js/gm/session-io.js` the same way — `objects`/
  `nextObjectId` pass through `sceneForExport`'s `{ ...sc }` spread for free
  since they're plain per-scene fields, but `applySessionPayload`'s explicit
  `state.* = target.*` copy-back list needed an explicit line added (see
  "Common tasks" > "Add a new per-scene field" below for why).

## Annotations (GM-only, never sent to the player)

- **Token annotations** (`token.note`, plain string): opened via the 📝 button
  in the sidebar token list, "📝 Anotação" in the token's right-click context
  menu (`js/gm/mouse.js`, centered `note-modal.js` dialog), or
  **double-clicking the token on the canvas** (opens the floating post-it —
  see below). Not synced to the player window — it's GM reference text, like
  the effects glossary.
- **Background annotations** (`state.notes[]`, per-scene like fog/walls):
  right-clicking empty map space (no token, no existing note marker) opens a
  context menu with "📝 Criar anotação" — confirms into a new
  `{id, x, y, text}` pinned at that world point. Rendered on the GM canvas
  (`js/gm/draw.js`) as a small amber 📝 marker; right-clicking an existing
  marker offers "Abrir anotação" / "Excluir anotação" (centered modal);
  **left-clicking it** opens the floating post-it instead. Hit-tested via
  `js/gm/hit-test.js`'s `noteAt` (same circle-hit pattern as `tokenAt`).
- **Annotation post-it** (`js/gm/note-postit.js`): a small floating note
  anchored to a world point (`#notePostit`, styled like the app's other
  panels/modals — panel background, accent border/glow — not a literal paper
  note), opened by left-clicking a background note marker or double-clicking
  a token — an alternative to the centered `note-modal.js` dialog for quick
  in-place editing. Draggable by its header (`#notePostitHeader`); the drag
  offset from the anchor is stored in WORLD units (`offsetWX`/`offsetWY`) so
  it stays visually consistent across pan/zoom rather than drifting. A thin
  dashed connector line (`drawNotePostitConnector`, drawn from `js/gm/draw.js`
  right after `repositionNotePostit()` each frame) links the anchor's world
  point to the post-it's current on-screen corner, so it's still clear which
  token/marker a dragged-away post-it belongs to. Auto-saves on every
  keystroke (no explicit save button) and on close; closed via its own ✕ or
  Escape. Only one post-it is open at a time — opening a second target
  auto-saves and retargets the same element rather than stacking multiple
  post-its.
- **Context menu** (`js/gm/context-menu.js`): a single reusable Windows-style
  popup (`openContextMenu(screenX, screenY, items)`) — `js/gm/mouse.js`
  builds the item list per right-click target (token / note marker / empty
  map) rather than each target owning its own menu markup.
- Both annotation types are captured by `js/gm/history.js`'s undo/redo
  snapshot (`state.notes`/`nextNoteId` alongside fog/walls) and trigger
  `sendState()`, but the player-side payload (`js/gm/sync.js`) does not
  include `notes` or `token.note` — see "Player sync protocol": this is
  intentionally asymmetric, matching how walls are GM-only visually.

## Camera & zoom

- Scroll wheel or the ±/reset buttons zoom, always anchored to the cursor
  (the world point under the cursor before zooming stays under it after).
- Min/max zoom: 0.1×–6× (`js/shared/camera.js`'s `MIN_ZOOM`/`MAX_ZOOM`).
- Middle-mouse drag pans (both windows). On the GM window: left-drag moves
  tokens (or draws fog/walls/pans the carried "bring" ghost, depending on
  active tool mode); right-click removes a token/fog rect/wall depending on
  what's under the cursor.

## Combat turn order

- GM (`js/gm/combat.js`): tokens draggable left-right on the combat bar
  (bottom timeline); snaps to grid slots (40% magnetic threshold); "Next
  turn" rotates `state.combat.order` and animates the first token sliding to
  the end.
- Player (`js/player/combat.js`): same visual timeline, **read-only** — no
  drag-reorder, since the player can't act on initiative order.
- `state.combat` is per-scene — switching scenes pauses/resumes whatever
  combat was running in each one independently.

## Scene-independent (global) systems

These are NOT per-scene — they apply across the whole game regardless of
which scene is open:
- `state.partyBars` — universal bar *definitions* (Vida, Mana, etc.); every
  party member across every scene shares the same definitions, with their own
  `barValues` per bar id.
- `state.glossary` — GM reference notes on status effects (name/desc/
  color/icon); applying one to a token (`js/gm/effects-picker.js`) just adds
  its id to that token's `effects` array — deleting a glossary entry strips
  it from every token across every scene (`js/gm/glossary.js`'s delete
  handler iterates `allTokens`, not the current scene's view).
- `state.lighting`, `state.wallOcclusionMethod` — both affect how the player
  window renders vision, regardless of scene.

## Development notes

### No build, no dependencies
- Open in browser: double-click `index.html`, or serve locally
  (`python -m http.server`) if `file://` popup/window restrictions get in the
  way of opening the player window.
- All assets inline; only Google Fonts (VT323) is an external load.
- No `package.json`, no tooling required, ever.

### Styling & theme
- All colors resolve from `:root` CSS variables — `css/theme.css`. Every
  accent glow/shadow uses `rgba(var(--accent-rgb), a)` / `rgba(var(--danger-rgb), a)`
  (not literal `rgba(69,255,120,…)`), and input/panel fills use
  `var(--input-bg)` / `var(--input-panel)`, so a theme is defined entirely by
  redefining the variable set — no per-rule color edits.
- **Table themes** (Ajustes > "Tema de Mesa"): whole-app CSS skins selected by
  `data-theme` on `<html>` — they reskin **color + typography + shape**, not
  just color. Five ship: `cyberpunk` (default green CRT / VT323 / hard corners,
  also the bare `:root`), `dnd` (amber parchment, MedievalSharp + Crimson Text
  serif, soft corners), `cthulhu` (sickly teal, Special Elite typewriter),
  `black` (neutral greyscale, Inter sans, flat), `cream` (light — dark ink on
  paper, EB Garamond + Cinzel serif, no CRT). Each is a `:root[data-theme="…"]`
  block in `css/theme.css` overriding the full variable set:
  - **color/glow**: `--bg`/`--panel`/`--accent`/`--danger`/… + the
    `rgba(var(--accent-rgb), a)` / `rgba(var(--danger-rgb), a)` glows, plus
    `--input-bg`/`--input-panel`/`--float-bg` (input, inset-panel, and
    floating-over-canvas backgrounds respectively — so light themes don't get
    dark input fields / toolbars).
  - **typography**: `--font-body`, `--font-head` (webfonts `@import`ed at the
    top of `css/theme.css`), `--font-scale` (base size multiplier),
    `--text-transform`/`--head-transform`, `--letter-spacing`/
    `--head-letter-spacing`. The generic `h1..h4`/`.top-panel-title` rule in
    `theme.css` applies the heading font/casing; body elements inherit
    `--font-body` from `<body>`.
  - **shape/texture**: `--radius` (every former `border-radius: 0` now reads
    this), `--border-width`/`--border-style`, `--crt-opacity`, and the themed
    title glyphs `--head-marker`/`--h2-marker`/`--h1-cursor` (the `█`/`▓▒░`/`_`
    terminal decorations become `✦`/`❧`, `†`/`≈`, etc. per theme; consumed by
    `::before`/`::after` rules in `layout.css`/`modals.css` which load after
    `theme.css` so they win the cascade).
  - CRT intensity is `--crt-opacity` plus per-theme toggles in
    `css/crt-effects.css` (the light `cream` theme hides the scanline/vignette
    overlay entirely).
  - **Canvas token text stays VT323** (`js/shared/scene-render.js`,
    `js/gm/draw.js`) regardless of theme — it's drawn on `<canvas>` (doesn't
    inherit CSS) and kept pixel-legible at tiny sizes on purpose, not an
    oversight.
  `js/gm/theme.js` owns the picker: sets `data-theme`, persists to
  `localStorage` (`rpg-table-theme`), restores on load, and mirrors the choice
  to the player window via `js/gm/sync.js`'s `sendTheme` → the `'rpg-theme'`
  message handled in `js/player/sync.js` (which sets the same `data-theme`).
  The GM also re-pushes the theme on the `'rpg-player-ready'` handshake so a
  freshly-opened player window matches immediately.
- The per-scene canvas background (`state.map.bgColor`) is independent of the
  theme — it's a GM-set fill for the map area (see "map objects"/Ajustes),
  while the theme variables skin the surrounding UI chrome. In CSS, the
  scene-thumbnail and any map-area fills use `var(--map-bg)` as the default.
- VT323 pixel font, 17px base, scaled per-element for readability.
- Modal overlay z-index layering: canvas = 0, modals = 100, crop editor = 200,
  CRT effect pseudo-elements = 9998–9999.

### Common tasks
- **Add a new token control**: update `state`/`allTokens` in the relevant
  `js/gm/*` file, call `sendState()`, re-render the affected UI list.
- **Change UI color**: edit the CSS variable in `:root` (`css/theme.css`) —
  applies everywhere via `var()`.
- **Add a feature affecting players**: modify `js/player/*` and/or add a new
  field to the `sendState()` payload in `js/gm/sync.js` AND the receiver in
  `js/player/sync.js`'s message handler — both sides must agree on the shape.
- **Add a new per-scene field**: add it to the scene object shape in
  `js/gm/scenes.js` (`createScene`, the initial `scenes[]` entry) AND to
  `commitSceneFields`/`switchScene`'s copy-in/copy-out lists, or it'll leak
  across scenes instead of staying isolated.
- **Add a new cross-window shared helper**: put it in `js/shared/*`, loaded
  before both `js/gm/*` and `js/player/*` — don't duplicate it into both
  windows' local files (that's exactly the drift this split fixed once).

### Debugging tips
- **Player window won't open?** Check browser popup settings; `file://`
  origins sometimes block `window.open` — serve over `http://localhost`
  instead.
- **State out of sync?** First check `sceneSyncPending` — if a scene switch
  happened, the GM must click "🔄 Atualizar tela do jogador" before anything
  propagates. If that's not it, check `sendState()` is called after the
  mutation in question.
- **Photo not showing?** `getTokenPhotoImg`'s cache is keyed by the dataURL
  string; if `photoDataUrl` changed, the old cache entry is simply orphaned
  (reload clears it) — not a bug, just not actively evicted.
- **Combat bar layout wrong?** Check `TOKEN_SIZE`/`TOKEN_SPACING`/
  `TOKEN_PADDING_LEFT` in `js/gm/combat.js` (or `js/player/combat.js` for the
  read-only version) — positions are `idx * (TOKEN_SIZE + TOKEN_SPACING) +
  padding`.
- **A function seems to not exist / change has no effect?** Check you're not
  editing `js/core/*` or `js/render/*` — those are dead stale files (see
  "Dead files" above). Check `js/shared/`, `js/gm/`, `js/player/` instead.
- **Wall/fog changes on the GM don't show up on the player?** That's by
  design if a scene switch is pending (see "Player sync gate"). Otherwise,
  confirm the mutation site calls `sendState()`.
- **A new module's functions are `undefined` when called?** Check the
  `<script>` load order in `index.html`/`player.html` against "Load order"
  above — a file can only call something defined in a file that loaded
  *before* it (or that's called later than both finish loading, per "Known
  forward-reference hazards").

- **NO YAPPING** Never write unnecessary explications, UNLESS the user asks for it.
