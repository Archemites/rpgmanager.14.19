/* ============================================================
   GM state: allTokens (master list across ALL scenes), state (current-scene
   view), constants, DOM canvas/viewport refs. Every other js/gm/* file reads
   window.RPG.state / window.RPG.allTokens rather than declaring its own copy.
   See ARCHITECTURE.md "State management" > "GM side".
   ============================================================ */

(() => {
  'use strict';

  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const BASE_TOKEN_RADIUS = 20;
  const MAX_ACTIVE_BARS = 2;   // how many party bars can render on the map at once

  // Vision / lighting defaults
  const DEFAULT_VISION_ANGLE = window.RPG.DEFAULT_VISION_ANGLE;   // cone width in degrees
  const DEFAULT_VISION_MULT = window.RPG.DEFAULT_VISION_MULT;      // per-token range multiplier
  // Global lighting factor → base vision reach in WORLD px. 0 = tokens see nothing
  // beyond their own body; higher = the cone reaches deeper into the fog.
  const BASE_VISION_RANGE = window.RPG.BASE_VISION_RANGE;      // world px at lighting = 1
  const ROTATE_HANDLE_R = 7;          // rotation knob radius in SCREEN px

  // Camera (shared factory — js/shared/camera.js)
  const { cam, screenToWorld, eventScreenPos, zoomAt: zoomAtRaw, centerView: centerViewRaw } =
    window.RPG.createCamera(canvas, viewport);

  // Master token list across ALL scenes — never filtered. `state.tokens` (below)
  // is always a recomputed view of just the tokens present in the open scene;
  // see `refreshVisibleTokens()`. Mutate `allTokens` (push/splice), not
  // `state.tokens` directly, then call `refreshVisibleTokens()`.
  const allTokens = [];

  const state = {
    grid: { show: true, size: 48, color: null },  // null = follow theme's --accent
    map: { img: null, scalePct: 100, dataUrl: null, bgColor: null },  // image is centered on world origin (0,0); bgColor fills the canvas behind/around it, per-scene; null = follow theme's --map-bg
    tokens: [],                          // VIEW: tokens present in the open scene — see refreshVisibleTokens()
    fog: [],                             // {id, x, y, w, h} rects hiding the map, world coords
    // Walls = GM-only line-of-sight blockers. {id, x1, y1, x2, y2} world-coord segments.
    // Never sent to the player visually — only used there to truncate vision cones
    // (raycasting), so occluded areas stay dark even inside a token's nominal reach.
    walls: [],
    // Background annotations — GM-only sticky notes pinned to a world point.
    // {id, x, y, text}, per-scene like fog/walls. Never sent to the player.
    notes: [],
    // Map objects (props/scenery) — NOT tokens: the whole image is the object's
    // shape (no circular crop, no vision/bars/effects). {id, x, y, w, h, rotation,
    // dataUrl, name}, x/y = CENTER, w/h = world px, rotation in radians.
    // Per-scene like fog/walls/notes; sent to the player (see sync.js).
    objects: [],
    // Party bars are UNIVERSAL: one shared definition list; every party member has all of them.
    // Each member keeps its own current/max per bar in token.barValues.
    // {id, name, color, defaultMax, active, display:'horizontal'|'vertical'|'radial', side:'left'|'right', direction:'ltr'|'rtl'}
    // Only up to MAX_ACTIVE_BARS bars with active:true render on the map.
    partyBars: [
      { id: 'bar-vida', name: 'Vida', color: '#e04b4b', defaultMax: 10, active: true, display: 'horizontal', side: 'left', direction: 'ltr' },
    ],
    // Effects glossary — GM-only reference notes.
    // {id, name, desc, color, icon, narrative, duration, barMods}
    //   narrative: bool — tag only, shown separately in the glossary list, no other effect
    //   duration: turns remaining when freshly applied (null/0 = no auto countdown)
    //   barMods: [{barId, delta}] — per-turn amount added to token.barValues[barId].current while active.
    //     delta is a string: a plain signed number ("-2", "+1") or signed dice notation
    //     ("-1d4", "+2d6"); parsed/rolled each turn by rollDeltaExpr() in js/gm/combat.js.
    // Applied to a token via token.effects = [{id, remaining}], remaining decremented each nextTurn().
    glossary: [],
    // Fog of war = the area OUTSIDE the players' vision (not necessarily darkness).
    // `lighting` scales how far a token's vision cone reaches into the fog:
    //   reach(px) = BASE_VISION_RANGE * lighting * token.visionMult
    lighting: 1,
    // How walls occlude the player's vision cones (rendered client-side on the
    // player window): 'cell' snaps occlusion to the same 48px grid used for
    // exploration memory (cheap, blocky); 'raycast' builds a precise shadow
    // polygon from wall endpoints (sharper, costs more per frame).
    wallOcclusionMethod: 'cell',
    snapToGrid: false,  // GM-only drag behavior — not synced to the player window
    nextId: 1,
    nextFogId: 1,
    nextWallId: 1,
    nextNoteId: 1,
    nextObjectId: 1,
    nextBarId: 1,
    nextEffectId: 1,
    selectedTokenId: null,
    selectedTokenIds: [],   // multi-select via drag box; selectedTokenId stays the "primary" (rotate handle/vision preview)
    selectedObjectId: null,
    fogMode: false,
    wallMode: false,
    moveMode: false,  // when on, dragging a token never changes state.selectedTokenId
    combat: { active: false, order: [] },  // order: array of token ids, leftmost = current turn
  };

  // ---------- Canvas sizing (handles devicePixelRatio) ----------
  let dpr = 1;
  function getDpr() { return dpr; }
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    window.RPG.draw();
  }
  window.addEventListener('resize', resizeCanvas);

  function updateHud() {
    document.getElementById('zoomLabel').textContent = Math.round(cam.zoom * 100) + '%';
    document.getElementById('gridLabel').textContent = state.grid.size + 'px';
  }

  // Wrap the shared camera's zoomAt/centerView so they also update the HUD + redraw,
  // matching the old main.js behavior exactly.
  function zoomAt(screenX, screenY, factor) {
    zoomAtRaw(screenX, screenY, factor, () => { updateHud(); window.RPG.draw(); });
  }
  function centerView() {
    centerViewRaw(() => { updateHud(); window.RPG.draw(); });
  }

  // ---------- Sidebar resize (drag handle) ----------
  const sidebar = document.getElementById('sidebar');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const SIDEBAR_MIN = 220;
  const SIDEBAR_MAX = 600;
  let sidebarResizing = false;

  sidebarResizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sidebarResizing = true;
    sidebarResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!sidebarResizing) return;
    const rect = sidebar.getBoundingClientRect();
    const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX - rect.left));
    sidebar.style.width = w + 'px';
    resizeCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (!sidebarResizing) return;
    sidebarResizing = false;
    sidebarResizer.classList.remove('dragging');
    document.body.style.cursor = '';
  });

  // ---------- Scene sidebar resize (drag handle, right edge) ----------
  const sceneSidebar = document.getElementById('sceneSidebar');
  const sceneSidebarResizer = document.getElementById('sceneSidebarResizer');
  const SCENE_SIDEBAR_MIN = 160;
  const SCENE_SIDEBAR_MAX = 420;
  let sceneSidebarResizing = false;

  const sceneSidebarToggle = document.getElementById('sceneSidebarToggle');
  sceneSidebarToggle.addEventListener('mousedown', (e) => e.stopPropagation());
  sceneSidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsed = sceneSidebar.classList.toggle('collapsed');
    sceneSidebarResizer.classList.toggle('collapsed', collapsed);
    sceneSidebarToggle.textContent = collapsed ? '◀' : '▶';
    resizeCanvas();
  });

  sceneSidebarResizer.addEventListener('mousedown', (e) => {
    if (sceneSidebar.classList.contains('collapsed')) return;
    e.preventDefault();
    sceneSidebarResizing = true;
    sceneSidebarResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!sceneSidebarResizing) return;
    const rect = sceneSidebar.getBoundingClientRect();
    const w = Math.min(SCENE_SIDEBAR_MAX, Math.max(SCENE_SIDEBAR_MIN, rect.right - e.clientX));
    sceneSidebar.style.width = w + 'px';
    resizeCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (!sceneSidebarResizing) return;
    sceneSidebarResizing = false;
    sceneSidebarResizer.classList.remove('dragging');
    document.body.style.cursor = '';
  });

  // ---------- Vision helpers ----------
  // Fill in vision fields on tokens that predate this feature.
  function ensureTokenVision(t) {
    if (typeof t.facing !== 'number') t.facing = -Math.PI / 2;
    if (typeof t.visionAngle !== 'number') t.visionAngle = DEFAULT_VISION_ANGLE;
    if (typeof t.visionMult !== 'number') t.visionMult = DEFAULT_VISION_MULT;
  }

  // ---------- Interaction state (shared across gm/* files) ----------
  const drag = {
    mode: null,          // 'pan' | 'token' | 'rotate' | 'box' | 'object' | 'object-rotate' | null
    tokenId: null,
    objectId: null,      // used by 'object' / 'object-rotate' modes
    offsetX: 0, offsetY: 0,      // token grab offset (world units)
    startScreenX: 0, startScreenY: 0,
    camStartX: 0, camStartY: 0,
    // multi-token drag: world-space offset of each selected token from the grabbed one
    groupOffsets: null,   // [{ id, dx, dy }] or null
    // box-select: world coords of the drag rectangle
    boxStartX: 0, boxStartY: 0,
    boxCurX: 0, boxCurY: 0,
  };

  const fogDraw = {
    active: false,
    startX: 0, startY: 0,   // world coords
    curX: 0, curY: 0,
  };

  const wallDraw = {
    active: false,
    startX: 0, startY: 0,   // world coords
    curX: 0, curY: 0,
  };
  const WALL_HIT_DIST = 8;  // screen px tolerance for right-click removal

  let measureMode = false;
  let measureSelectedTokenId = null;  // para manter token selecionado na medição
  let fxMode = false;  // when on, clicking the map opens the FX-type picker instead of selecting/moving tokens

  // track effect dot positions for tooltip hit-testing — reset each draw() frame
  const effectDotHitboxes = [];  // {cx, cy, r, effectId}

  // ---------- Photo cache (shared factory) ----------
  const getTokenPhotoImg = window.RPG.createPhotoCache(() => window.RPG.draw());
  const getObjectImg = window.RPG.createObjectImgCache(() => window.RPG.draw());
  const contrastColor = window.RPG.contrastColor;

  // ---------- Bar renderer (shared factory) ----------
  const barRenderer = window.RPG.createBarRenderer(() => ctx, () => cam, () => state, MAX_ACTIVE_BARS);

  // ---------- Scene renderer (shared factory) ----------
  const sceneRenderer = window.RPG.createSceneRenderer(() => state, getTokenPhotoImg, contrastColor);

  // ---------- Expose to window.RPG ----------
  window.RPG = window.RPG || {};
  window.RPG.viewport = viewport;
  window.RPG.canvas = canvas;
  window.RPG.ctx = ctx;
  window.RPG.getCtx = () => ctx;
  window.RPG.getDpr = getDpr;
  window.RPG.cam = cam;
  window.RPG.getCam = () => cam;
  window.RPG.screenToWorld = screenToWorld;
  window.RPG.eventScreenPos = eventScreenPos;
  window.RPG.zoomAt = zoomAt;
  window.RPG.centerView = centerView;
  window.RPG.updateHud = updateHud;
  window.RPG.resizeCanvas = resizeCanvas;

  window.RPG.BASE_TOKEN_RADIUS = BASE_TOKEN_RADIUS;
  window.RPG.MAX_ACTIVE_BARS = MAX_ACTIVE_BARS;
  window.RPG.ROTATE_HANDLE_R = ROTATE_HANDLE_R;

  window.RPG.allTokens = allTokens;
  window.RPG.state = state;
  window.RPG.getState = () => state;

  window.RPG.ensureTokenVision = ensureTokenVision;

  window.RPG.drag = drag;
  window.RPG.fogDraw = fogDraw;
  window.RPG.wallDraw = wallDraw;
  window.RPG.WALL_HIT_DIST = WALL_HIT_DIST;
  window.RPG.getMeasureMode = () => measureMode;
  window.RPG.setMeasureMode = (v) => { measureMode = v; };
  window.RPG.getMeasureSelectedTokenId = () => measureSelectedTokenId;
  window.RPG.setMeasureSelectedTokenId = (v) => { measureSelectedTokenId = v; };
  window.RPG.getFxMode = () => fxMode;
  window.RPG.setFxMode = (v) => { fxMode = v; };

  window.RPG.effectDotHitboxes = effectDotHitboxes;

  window.RPG.getTokenPhotoImg = getTokenPhotoImg;
  window.RPG.getObjectImg = getObjectImg;
  window.RPG.contrastColor = contrastColor;
  window.RPG.drawTokenBars = barRenderer.drawTokenBars;
  window.RPG.tokenBarExtents = barRenderer.tokenBarExtents;
  window.RPG.drawMapAndGrid = sceneRenderer.drawMapAndGrid;
  window.RPG.drawTokenBasic = sceneRenderer.drawTokenBasic;
})();
