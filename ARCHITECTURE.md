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
- **`login.html`** is the real entry point (what GitHub Pages/the .bat script
  opens first): a role picker ("Sou o Mestre" / "Sou Jogador") that just
  redirects to `master.html` or `player.html` — no shared state, no
  `window.RPG`, plain `<script>` inline in the file itself. Visiting
  `master.html`/`player.html` directly still works (no guard/redirect back to
  `login.html`), it's just no longer the advertised link.
- There are two independent apps sharing the same `js/shared/*` modules:
  `master.html` (the GM/master window) and `player.html` (the read-only
  player window). They are separate page loads on potentially separate
  machines now, paired via WebRTC (see "Player sync protocol" below) —
  not `window.open`/`postMessage` between two windows in one browser.

## Two-window system

- **`master.html` + `js/gm/*`** — the GM's full editing interface: map import,
  token CRUD, fog drawing tool, scene switching, combat tracker, party
  panel, glossary, bar editor, photo crop editor.
- **`player.html` + `js/player/*`** — a read-only render target. It never
  mutates shared game state on its own; it only receives `'rpg-state'`
  messages from the GM and redraws. Fog of war is GM-manual only (see
  "Fog of war (GM-manual)" below) — the player side has no vision logic of
  its own beyond painting `state.fog[]` opaque.
- The two windows are **not** iframes or tabs in the same document, and are
  no longer required to be on the same machine/browser. Each player opens
  `player.html` independently (their own device) and joins the GM's short
  room code via PeerJS (`js/shared/webrtc.js`); once paired, GM → player
  traffic flows over a WebRTC data connection instead of `postMessage`.
  Nothing but the synced state crosses the boundary. See "Player sync
  protocol" below.

## Directory layout

```
master.html            GM window shell — loads js/shared/*, js/gm/*, js/features/measure.js
player.html           Player window shell — loads js/shared/*, js/player/*
css/                  theme.css, crt-effects.css, layout.css, components.css, modals.css

js/shared/            Used by BOTH windows — loaded first, before js/gm or js/player
  camera.js             cam object, screenToWorld/eventScreenPos/zoomAt/centerView
  photo-cache.js        getTokenPhotoImg (dataURL → cached <img>), contrastColor
  object-cache.js       createObjectImgCache → getObjectImg (dataURL → cached <img>, keyed off o.dataUrl not t.photoDataUrl) — used by js/gm/draw.js and js/player/draw.js to render state.objects
  bars.js               drawTokenBars + drawHorizontalBar/drawVerticalBar/drawRadialBar/tokenBarExtents
  scene-render.js       drawMapAndGrid, drawTokenBasic (photo/color+ring+initials+name — no bars/effects)
  fx-trail.js           cosmetic FX trail (explosion/fire/smoke/heal): FX_TYPES defs, spawnFx/drawFx/hasActiveFx, self-driven rAF loop that keeps calling window.RPG.draw() while any effect is animating. Never touches tokens/fog/state — purely visual, drawn on top of everything in both draw() loops
  webrtc.js             createHost (GM) / joinHost (player) — thin wrapper over PeerJS: short room-code generation, code<->peer-id mapping, STUN config, describePeerError. Pure plumbing, no state/allTokens dependency — see "Player sync protocol"

js/vendor/              third-party code vendored on disk (no CDN, no bundler/npm)
  peerjs.min.js          PeerJS 1.5.4 — WebRTC + public signaling broker; exposes window.Peer. Wrapped by js/shared/webrtc.js
  qrcode.min.js          davidshimjs/qrcodejs — renders the join URL as a QR <canvas> in js/gm/sync.js's invite modal
  jsQR.js                cozmo/jsQR — decodes QR from camera frames in js/player/sync.js. NOTE: webpack UMD bundle with an ESM default export, so window.jsQR is the module object; the callable is window.jsQR.default

js/gm/                 GM-only — master.html
  state.js              allTokens, state (current-scene view), constants, DOM canvas/viewport refs
  history.js            undo/redo: snapshot-based, scoped to current scene's tokens/fog — captureBeforeChange/undo/redo
  scenes.js             scenes[], currentSceneId, switchScene/createScene/bringTokenToCurrentScene, bringCarry, scene folders[] + multi-select (see "Scenes" below)
  sync.js               sendState/sendStateForced, sceneSyncPending gate, "🔗 Convidar jogador" modal (room code + QR), broadcasts state to every connected PeerJS DataConnection — see "Player sync protocol"
  draw.js               draw() — the GM canvas render loop (map, grid, tokens, fog tint, object rotate handle)
  hit-test.js           tokenAt/fogRectAt/effectDotAt/noteAt/objectAt/objectRotateHandlePos/objectRotateHandleAt
  mouse.js              canvas mouse/keyboard interaction dispatch (pan/drag/fog/bring-carry/measure)
  tools.js              fog/move/measure tool-mode toggles + top toolbar (import/sliders panel), token resize buttons
  hotkeys.js            global keyboard shortcuts: Ctrl+C/V (copy/paste tokens), Delete/Backspace (delete token/fog under cursor), Ctrl+Z/Ctrl+Y (undo/redo via history.js)
  map-grid-lighting.js  map import/scale, grid controls
  token-modal.js        create/edit token modal
  context-menu.js       generic right-click popup (Windows-style) — openContextMenu(x,y,items)/closeContextMenu
  note-modal.js         shared annotation textarea modal — token.note (per-token) + state.notes[] (per-scene, background pins, GM-only)
  note-postit.js        floating sticky-note alternative to note-modal.js — anchored to a world point, tracks pan/zoom, auto-saves
  token-list.js         sidebar token list + delete confirmation
  objects.js             map objects (props/scenery, NOT tokens): "Objetos" sidebar section, add/edit modal (image upload, no crop), resize buttons, remove. Per-scene like fog/notes. See "Map objects" below
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
  state.js              state (received-from-GM view), cam, drag
  sync.js               entry screen (#entryOverlay: name + room code, typed or camera-scanned; ?mesa=CODE auto-joins), PeerJS message receiver ('rpg-state'/'rpg-fx'/'rpg-theme'), status banner, init
  draw.js               draw() — the player canvas render loop (live scene + fog compositing)
  fullscreen.js         removes the browser navigation bar: click-to-enter fullscreen overlay (#fsPrompt) shown on load + persistent ⛶ toggle (#fsBtn) + F key. Fullscreen needs a user gesture *in the player window*, so the GM can't trigger it over postMessage — hence the overlay. Self-contained; only calls window.RPG.resizeCanvas on fullscreenchange
  combat.js             read-only combat bar display (no drag-reorder — player can't reorder initiative)

js/features/
  measure.js            GM-only distance measuring tool — self-contained, exports via window.RPG (measureState/measureClick/measureUpdate/measureRelease/measureEnd/drawMeasure). Template for how a feature module SHOULD integrate.

js/core/, js/render/    STALE, UNUSED, KEPT ON DISK ONLY — see "Dead files" below. Do not import from here.
bckp/                   Pre-refactor monolith snapshots (master.html/player.html). Rollback safety net — do not delete without asking, do not treat as active code.
```

## Dead files — do not use, do not assume they're wired up

`js/core/state.js`, `js/core/camera.js`, `js/core/sync.js`,
`js/render/photo-cache.js`, `js/render/bars.js`, `js/render/draw.js`, and
`js/features/map.js` were an earlier, abandoned attempt at the same
modularization this file now describes. **Neither `master.html` nor
`player.html`'s actual logic reads from them** — `main.js`/`player-main.js`
(pre-split) each had their own richer local copies that drifted ahead (walls,
scenes, lighting, wall-occlusion method, scene-sync gating — all since removed
again along with the vision-cone system, but the drift is why none of it
exist in the stale versions). They are left on disk as historical artifacts,
not deleted, but **the real implementations now live in `js/shared/`,
`js/gm/`, and `js/player/` as described above.** If you find yourself editing
something in `js/core/*` or `js/render/*` and the change doesn't seem to do
anything when you test it, that's why — you're editing dead code. Check
`js/shared/`, `js/gm/`, or `js/player/` for the live version instead.

## Load order (must match script tags exactly)

`master.html`:
```
js/vendor/qrcode.min.js → js/vendor/peerjs.min.js → js/shared/webrtc.js
→ js/shared/camera.js → js/shared/photo-cache.js → js/shared/object-cache.js → js/shared/bars.js
→ js/shared/scene-render.js → js/shared/fx-trail.js
→ js/gm/state.js → js/gm/history.js → js/gm/scenes.js → js/gm/sync.js
→ js/gm/hit-test.js → js/gm/draw.js
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
js/vendor/qrcode.min.js → js/vendor/peerjs.min.js → js/shared/webrtc.js
→ js/shared/camera.js → js/shared/photo-cache.js → js/shared/object-cache.js → js/shared/bars.js
→ js/shared/scene-render.js → js/shared/fx-trail.js
→ js/player/state.js
→ js/player/combat.js → js/player/draw.js → js/player/fullscreen.js → js/player/sync.js
```

**Why this order:** `js/shared/*` has zero dependencies on anything else and
must load first. Within `js/gm/*`, `state.js`/`scenes.js`/`sync.js` declare
the mutable state every other GM file reads or mutates, so they load first;
`draw.js` depends on `hit-test.js` having already
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
  fog: [ { id, x, y, w, h }, ... ],          // per-scene, GM-manual — see "Fog of war (GM-manual)"
  notes: [ { id, x, y, text }, ... ],        // per-scene, GM-only background annotations, never sent to player
  objects: [ { id, x, y, w, h, rotation, dataUrl, name }, ... ],  // per-scene map props/scenery — x/y = CENTER, w/h = world px, rotation in radians. Sent to player (unlike notes)
  nextNoteId,
  nextObjectId,
  partyBars: [ { id, name, color, defaultMax, active, display, side, direction }, ... ],  // GLOBAL (all scenes)
  glossary: [ { id, name, desc, color, icon, narrative, duration, barMods }, ... ],  // GLOBAL
    // narrative: bool, tag-only (still counts down duration, no other effect)
    // duration: turns remaining when freshly applied (0/null = no auto countdown)
    // barMods: [ { barId, delta } ], applied to the token's own barValues[barId].current each nextTurn()
    // delta is a string: plain signed number ("-2") or signed dice notation ("-1d4", "+2d6"),
    // rolled fresh each turn by rollDeltaExpr() in js/gm/combat.js
  nextId, nextFogId, nextBarId, nextEffectId,
  selectedTokenId,
  selectedObjectId,
  fogMode, moveMode,
  combat: { active, order },  // per-scene
}

allTokens = [
  { id, x, y, r, color, name, photoDataUrl, isPlayer, barValues, effects,  // effects: [ { id, remaining }, ... ] glossary applications on this token
    createdAt, note,   // note: GM-only free-text annotation
    scenes: { [sceneId]: { x, y } } },  // PRESENCE + per-scene position map
]
// A token with no entry for a scene's id in `scenes` simply doesn't appear
// there. bringTokenToCurrentScene() REPLACES the whole `scenes` map with a
// single entry — a token migrates fully, it does not leave a duplicate
// behind in its old scene.

scenes = [
  { id, name, map, fog, notes, objects, grid, combat, nextFogId, nextNoteId, nextObjectId }
]
currentSceneId
```

### Player side (`js/player/state.js`)

Read-only mirror of whatever the GM last sent — never mutated locally except
by the incoming `'rpg-state'` message handler in `js/player/sync.js`:

```js
state = {
  grid, map: { img, scalePct, bgColor }, tokens, fog, objects, combat, partyBars,
}
```

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

Each scene owns its own `map`, `fog`, `grid`, and `combat` — tokens
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

**Transport**: **PeerJS** (`js/vendor/peerjs.min.js`, wrapped by
`js/shared/webrtc.js`'s `createHost`/`joinHost`). The GM claims one short
room code (5 chars from an unambiguous alphabet — no 0/O/1/I/L — namespaced
as `rpgmesa-<CODE>` on the broker) and every player joins that same code.
Game data still travels peer-to-peer over WebRTC; the public PeerJS broker
carries only the handshake. STUN-only (Google), no TURN — so symmetric-NAT
to symmetric-NAT can still fail, which would need a relay we don't host.

**Why not raw `RTCPeerConnection`:** a manual offer/answer handshake has to
move the whole SDP in **both** directions — and a 32-byte random DTLS
fingerprint is incompressible, flooring each code near ~100 chars even after
stripping SDP to its essential fields and deflating. That produced QR codes
too dense for a phone camera to read off a monitor, plus forced the player to
hand a second code back to the GM. Trading the "zero servers" purity for a
signaling-only broker is what buys the one-way, 5-character flow.

The GM's "🔗 Convidar jogador" modal (`js/gm/sync.js`) shows the room code
big, the current access PIN, and a QR of
`player.html?mesa=<CODE>&pin=<PIN>` (via `js/vendor/qrcode.min.js`) —
scanning it lands the player straight in the game, no typing. The player's
entry screen (`player.html`'s `#entryOverlay`, handled in
`js/player/sync.js`) takes a name + the code + the PIN, typed or read from
the camera (`js/vendor/jsQR.js`). The room is opened lazily on first invite
and kept alive for the session — closing the dialog does not tear it down,
or codes already handed out would break.

**Access PIN vs. room code** — deliberately two different things:
- **Room code** = the PeerJS peer id the GM claims. Fixed for the whole
  session; changing it would mean creating a new `Peer`, which drops every
  already-open `DataConnection` (P2P connections can't be "renamed" — this
  is a hard WebRTC constraint, not a design choice).
- **Access PIN** (`js/gm/sync.js`'s `accessPin`, 4 digits, `randomPin()`) =
  a GM-rotatable gate checked only at the `'rpg-hello'` handshake below.
  The "🔄 Trocar PIN" button in the invite modal generates a new one — this
  only blocks *new* joiners still holding the old code/QR (e.g. it leaked);
  peers already connected were validated once at their own `'rpg-hello'`
  and are never re-checked, so nobody currently at the table gets dropped.

The GM can have **N simultaneous connections** (`js/gm/sync.js`'s `peers[]`),
one per player device. This replaced the old single
`window.open('player.html', ...)` same-browser model entirely; there is no
`openPlayerBtn`/child window anymore.

**The WebRTC connection opening is not the same as being let into the
game.** `attachPeer()` wires up the `DataConnection` and waits — nothing is
sent until `'rpg-hello'` arrives with a name **and a matching PIN**:
```js
{ type: 'rpg-hello', name, pin }   // name = the CHARACTER name; pin = current 4-digit access PIN
```
- **PIN matches**: `peer.admitted = true`, then (and only then) the GM does
  a forced full sync (`sendStateForced(true)`) and runs
  `ensurePlayerToken(peer)` (see below). The player's entry screen doesn't
  close on connection open — it waits for the first `'rpg-state'` message
  as proof of admission (`js/player/sync.js`'s `handleMessage`).
- **PIN doesn't match**: GM replies `{ type: 'rpg-denied', reason: 'pin' }`
  and closes the connection; the peer entry is discarded. The player sees
  "PIN incorreto" and stays on the entry screen — this also covers the
  auto-reconnect path (see "Backgrounded tab" below) if the PIN rotated
  while a player was disconnected.
- Every other incoming message type is ignored until `peer.admitted` is true.

`ensurePlayerToken` looks for an existing `isPlayer` token whose name
matches case-insensitively; if none exists it creates one (`isPlayer: true`,
so it joins the Party panel) in the currently open scene, near the center of
the GM's view with a small random jitter, in the next color from a rotating
palette. Because the lookup is by name, a player refreshing or reconnecting
lands back on their existing token instead of spawning a duplicate — and
their token is left in whatever scene it already occupies, since scene
placement is the GM's call (scene sidebar / "bring to scene"), not something
a reconnect should override. The token shape is duplicated from
`js/gm/token-modal.js`'s create branch — **keep the two in sync when adding
a token field**. The character name is required on the entry screen
precisely because it is the token's identity. Right after creating/finding
the token, the GM sends it back:
```js
{ type: 'rpg-my-token', tokenId }
```
`js/player/sync.js` stores this as `window.RPG`'s `myTokenId` — the player's
canvas (`js/player/state.js`) only allows dragging **this one token**, and
the GM re-validates ownership server-side on every move (see below), so a
compromised/hostile client still can't move anyone else's token.

GM broadcasts message type `'rpg-state'` to every **admitted** connection
(see `js/gm/sync.js`'s `doSendState`/`broadcast`). PeerJS serializes objects
itself, so these are sent as plain objects, not `JSON.stringify`'d strings:
```js
{
  type: 'rpg-state',
  grid, tokens, fog, objects, combat, partyBars,
  map: { scalePct, dataUrl? } // dataUrl: string = new, null = removed, absent = unchanged
}
```

**Players are not fully read-only** — each can send exactly two message
types back, both handled in `attachPeer()`'s `conn.on('data', ...)`:
```js
{ type: 'rpg-hello', name, pin }        // once, on connect (see above)
{ type: 'rpg-token-move', x, y }        // while dragging their own token, throttled ~60fps
```
`rpg-token-move` is applied only if `peer.tokenId` is set and matches an
existing token — the GM is the authority; movement is optimistic on the
player's own screen (`js/player/state.js` moves the local token immediately
for instant feedback, then echoes the position) but the GM's broadcast back
is what every other client actually renders.

GM also broadcasts message type `'rpg-fx'` (see `js/gm/sync.js`'s `sendFx`)
to trigger a cosmetic FX trail (explosion/fire/smoke/heal) on player
screens: `{ type: 'rpg-fx', fxType, x, y, opts: { scale, durationMult } }` —
`opts` comes from `js/gm/fx-settings.js`'s right-click size/duration popup.
Deliberately separate from `sendState`/the `sceneSyncPending` gate — it's a
one-shot animation trigger, not persistent state, so it always fires
immediately. `js/player/sync.js` handles it by calling
`window.RPG.spawnFx(fxType, x, y, opts)` (see `js/shared/fx-trail.js`) and
returns early, before the `'rpg-state'` check.

### Backgrounded tab (`js/player/sync.js`'s auto-reconnect)

Mobile browsers throttle or freeze timers and can silently kill the
underlying WebRTC connection while `player.html`'s tab is backgrounded
(app switched away from, screen locked, etc.) — often without ever firing
the `DataConnection`'s `'close'`/`'error'` events. Left unhandled, the
player returns to the tab still believing it's connected while nothing
actually works: can't drag the token, no state updates arrive.

Fix: on every `visibilitychange` back to `'visible'`, `isConnectionAlive()`
checks `conn.open` and the underlying PeerJS peer's `destroyed`/
`disconnected` flags; if either says the connection is actually dead,
`silentRejoin()` tears down the old `Peer` and redoes the full `joinHost()`
plus `'rpg-hello'` handshake automatically, using the room code
(`localStorage`'s `rpg-last-room-code`) and character name (`rpg-player-name`)
saved from the original join — no re-typing, just a brief "Reconectando…"
in the status banner. The PIN is **not** persisted across reconnects (it
read straight from `#entryPinInput`, which is never cleared after a
successful join, so the same value is reused) — if the GM rotated the PIN
while the player was backgrounded, the reconnect attempt gets `'rpg-denied'`
and the player lands back on the entry screen with a clear error instead of
hanging on "Reconectando…" forever.

### Player sync gate (`sceneSyncPending`)

Switching scenes does not push the change to the player immediately — the GM
may need to set up fog, reposition tokens, or otherwise prepare the new scene
before the players see it. `sceneSyncPending = true` after `switchScene()`
makes `sendState()` a no-op (every call site elsewhere in `js/gm/*` keeps
calling it as normal; they just don't have an effect while the gate is up).
The **"🔄 Atualizar telas dos jogadores"** button (`js/gm/sync.js`'s
`sendStateForced`) clears the gate and force-sends to every connected peer.
Player windows keep rendering the previous scene, unchanged, for as long as
the gate is up.

### Send throttling and image dedup

`sendState()` is called from dozens of sites, several of them on every
`mousemove` while dragging a token/object (`js/gm/mouse.js`). Two things
kept this from meaning "60 full-state sends a second":

- **Time-based throttling**: `scheduleSend()` enforces `SEND_MIN_INTERVAL_MS`
  (120ms, ~8/s) of real wall-clock time between sends, via `setTimeout` —
  not just one send per animation frame, which at 60fps was still far too
  often for a PeerJS `reliable: true` data connection to keep up with.
- **`bufferedAmount` back-pressure**: `broadcast()` skips a peer entirely
  for a given send if `conn.bufferedAmount` exceeds `MAX_BUFFERED_BYTES`
  (256KB) — a reliable/ordered WebRTC data channel behaves like TCP: if the
  receiver can't drain the socket as fast as we produce messages, unsent
  messages queue up and every new one becomes MORE stale than the last
  instead of just occasionally dropping a frame. Skipping means the next
  scheduled send (which will carry current data) isn't queued behind stale
  ones.
- **Image dedup** (`makeImageDedupe()`): a token's `photoDataUrl` and an
  object's `dataUrl` can be hundreds of KB, and neither changes from a
  drag/rotate/fog edit — only from the token/object modal. `tokenPhotoDedupe`/
  `objectImageDedupe` strip the image field from an item once it's already
  been sent unchanged, keyed by item `id`; `sendStateForced()` clears both
  (a fresh/reconnected peer has nothing cached to dedupe against). On the
  receiving end, `js/player/sync.js`'s `rehydrateTokenPhotos`/
  `rehydrateObjectImages` reattach the last-known image for any item that
  arrives without one, so `js/shared/photo-cache.js`'s `getTokenPhotoImg` /
  `js/shared/object-cache.js`'s `getObjectImg` (which read the field
  directly) never see an image "disappear" between pushes.

If sync ever feels laggy again, check these three things first before
assuming it's a network/NAT problem.

## Canvas rendering

- **GM view** (`js/gm/draw.js`): fog rects rendered semi-transparent
  (`rgba(3,20,10,0.32)`, GM sees the map underneath); the yellow rotation
  handle for a selected map object; in-progress fog drag preview; the
  "bring carry" ghost token.
- **Player view** (`js/player/draw.js`): fog rects rendered fully opaque
  black — see "Fog of war (GM-manual)" below.
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

## Fog of war (GM-manual)

There is no automatic reveal-by-vision, no cone, no wall occlusion, no
raycasting, no exploration memory. Fog is a plain GM-controlled overlay:

- **Drawing** (`js/gm/tools.js`'s fog-mode toggle + `js/gm/mouse.js`'s
  drag handling): with "▓ Névoa" active, click-drag on the GM canvas adds a
  `{ id, x, y, w, h }` rect to `state.fog[]`; a drag under 4px screen
  distance is discarded (accidental click, not a real rectangle).
  Right-click an existing rect removes it; "Limpar névoa" clears all of them.
- **GM view** (`js/gm/draw.js`): fog rects render semi-transparent
  (`rgba(3,20,10,0.32)`) so the GM can still see the map underneath while
  knowing which areas are hidden from players.
- **Player view** (`js/player/draw.js`): every `state.fog[]` rect is painted
  fully opaque black — no holes, no reveal, no per-token logic of any kind.
  Whatever is under a fog rect stays hidden until the GM erases it.
- Per-scene (`scenes[].fog`), like every other per-scene field — see "Add a
  new per-scene field" in Common tasks below.
- Tokens have no `facing`/rotation and there is no rotate handle for them —
  that machinery existed only to aim the old vision cone. Object rotation
  (`js/gm/hit-test.js`'s `objectRotateHandlePos`/`objectRotateHandleAt`) is
  unrelated and still works exactly as before — it orients a scenery image,
  not a token.

## Map objects (props/scenery — distinct from tokens)

- **`js/gm/objects.js`**: "Objetos" sidebar section (parallel to the Tokens/Party
  sections), add/edit modal (`#objectOverlay` in `master.html` — image upload
  only, no color/vision/isPlayer fields, no crop editor), resize buttons
  (`topObjectShrinkBtn`/`topObjectGrowBtn` in `js/gm/tools.js`, same
  ×1.15/÷1.15 factor pattern as token resize), `removeObject`.
- **The key difference from tokens**: an object's *whole uploaded image is its
  shape* — drawn as an unclipped rectangle (`ctx.drawImage` inside a
  `translate`+`rotate`, no circular clip), not cropped into a circle. No
  vision cone, no bars, no effects, no `isPlayer` — objects are pure scenery.
- **Data shape** (`state.objects`, per-scene like fog/notes — see
  `js/gm/scenes.js`): `{ id, x, y, w, h, rotation, dataUrl, name }`. `x`/`y`
  are the CENTER (unlike fog rects, which are top-left + w/h); `w`/`h` are
  world px; `rotation` is radians (0 = unrotated).
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
- **Rendered on the player window too** (unlike notes, which are GM-only) —
  see `js/player/draw.js`, drawn right after the map/grid and before tokens,
  same unclipped rotated-rect approach, no selection ring.
  Included in the `sendState()` payload (`js/gm/sync.js`) and mirrored in
  `js/player/state.js`/`js/player/sync.js` as `state.objects`.
- **Undo/redo, session export/import**: captured by `js/gm/history.js`'s
  snapshot (`state.objects`/`nextObjectId` alongside fog/notes) and
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
- **Background annotations** (`state.notes[]`, per-scene like fog):
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
  snapshot (`state.notes`/`nextNoteId` alongside fog) and trigger
  `sendState()`, but the player-side payload (`js/gm/sync.js`) does not
  include `notes` or `token.note` — see "Player sync protocol": GM-only
  reference text never crosses to the player, same as before.

## Camera & zoom

- Scroll wheel or the ±/reset buttons zoom, always anchored to the cursor
  (the world point under the cursor before zooming stays under it after).
- Min/max zoom: 0.1×–6× (`js/shared/camera.js`'s `MIN_ZOOM`/`MAX_ZOOM`).
- Middle-mouse drag pans (both windows). On the GM window: left-drag moves
  tokens (or draws fog/pans the carried "bring" ghost, depending on
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
- `state.glossary` — GM-defined status effects (name/desc/color/icon), plus
  optional `narrative` tag, `duration` (turns), and `barMods` (per-turn bar
  deltas). Applying one to a token (`js/gm/effects-picker.js`) adds
  `{ id, remaining }` to that token's `effects` array — deleting a glossary
  entry strips it from every token across every scene (`js/gm/glossary.js`'s
  delete handler iterates `allTokens`, not the current scene's view).
  `js/gm/combat.js`'s `nextTurn()` calls `applyEndOfTurnEffects()` on the
  token whose turn just ended: applies each active effect's `barMods` to
  that token's own `barValues` (rolling dice notation fresh via
  `rollDeltaExpr()` if the delta is e.g. `"-1d4"`), decrements `remaining`
  for effects with a `duration`, and drops the application once `remaining`
  hits 0. Narrative effects still count down the same way — the flag only
  changes how the glossary list displays them, it doesn't skip the countdown.
  Dice-notation barMods (not plain fixed numbers) log their roll to the
  Event Log (`window.RPG.logEvent`, see `js/gm/history.js`) — e.g.
  `"Sangramento em Aragorn: -1d4 → -3 (Vida)"`. Applying/removing a glossary
  effect on a token from `js/gm/effects-picker.js` is also logged.

## Development notes

### No build, no dependencies
- Open in browser: double-click `master.html`, or serve locally
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
- **Fog changes on the GM don't show up on the player?** That's by
  design if a scene switch is pending (see "Player sync gate"). Otherwise,
  confirm the mutation site calls `sendState()`.
- **A new module's functions are `undefined` when called?** Check the
  `<script>` load order in `master.html`/`player.html` against "Load order"
  above — a file can only call something defined in a file that loaded
  *before* it (or that's called later than both finish loading, per "Known
  forward-reference hazards").

- **NO YAPPING** Never write unnecessary explications, UNLESS the user asks for it.
