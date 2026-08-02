/* ============================================================
   Player state: state (received-from-GM view), cam, drag, exploredCells.
   Read-only mirror of whatever the GM last sent — never mutated locally
   except by the incoming 'rpg-state' message handler in js/player/sync.js.
   See ARCHITECTURE.md "State management" > "Player side".
   ============================================================ */

(() => {
  'use strict';

  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');

  const MAX_ACTIVE_BARS = 2;
  const EXPLORED_CELL = 48;       // world-px grid used to remember explored ground
  const EXPLORED_DIM_ALPHA = 0.55; // fog opacity over explored-but-not-visible ground (0 = clear, 1 = opaque)
  const MEMORY_SCALE = 0.5;       // memory canvas px per world px (kept < 1 to bound its size)
  const MEMORY_MARGIN_CELLS = 8;  // extra cells of headroom when the memory canvas grows

  // Cells a player token has ever seen, keyed by "cellX,cellY" (world grid coords).
  // Persists for the life of the tab — never cleared, so exploration accumulates
  // like classic fog-of-war memory: once seen, a cell keeps showing a FROZEN
  // snapshot of what was there (map + tokens) at the moment it was last inside a
  // vision cone — not the live scene. Only cells currently inside a cone show the
  // live scene; stepping away freezes that cell's last look until re-visited.
  const exploredCells = new Set();

  // Camera (shared factory — js/shared/camera.js)
  const { cam, screenToWorld, eventScreenPos, zoomAt: zoomAtRaw, centerView: centerViewRaw } =
    window.RPG.createCamera(canvas, viewport);

  const state = {
    grid: { show: true, size: 48, color: '#45ff78' },
    map: { img: null, scalePct: 100, bgColor: '#03140a' },
    tokens: [],
    fog: [],
    walls: [],   // GM-only line-of-sight blockers: {id, x1, y1, x2, y2}, used only to occlude vision here
    objects: [], // map props/scenery: {id, x, y, w, h, rotation, dataUrl, name}
    combat: { active: false, order: [] },
    partyBars: [],
    lighting: 1,
    wallOcclusionMethod: 'cell',  // 'cell' (grid-snapped, cheap) | 'raycast' (precise shadow polygon)
    activeVisionTokenId: null,    // only this player token's cone reveals/updates fog
  };

  const drag = {
    active: false,
    startScreenX: 0, startScreenY: 0,
    camStartX: 0, camStartY: 0,
  };

  // ---------- Canvas sizing ----------
  let dpr = 1;
  function getDpr() { return dpr; }
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport.clientWidth * dpr);
    canvas.height = Math.round(viewport.clientHeight * dpr);
    window.RPG.draw();
  }
  window.addEventListener('resize', resizeCanvas);

  function zoomAt(screenX, screenY, factor) {
    zoomAtRaw(screenX, screenY, factor, () => window.RPG.draw());
  }
  function centerView() {
    centerViewRaw(() => window.RPG.draw());
  }

  // ---------- View-only interaction: middle-drag pan + scroll zoom ----------
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 1 && e.button !== 0) return;
    e.preventDefault();
    const sp = eventScreenPos(e);
    drag.active = true;
    drag.startScreenX = sp.x;
    drag.startScreenY = sp.y;
    drag.camStartX = cam.x;
    drag.camStartY = cam.y;
    canvas.classList.add('panning');
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag.active) return;
    const sp = eventScreenPos(e);
    cam.x = drag.camStartX - (sp.x - drag.startScreenX) / cam.zoom;
    cam.y = drag.camStartY - (sp.y - drag.startScreenY) / cam.zoom;
    window.RPG.draw();
  });

  window.addEventListener('mouseup', () => {
    drag.active = false;
    canvas.classList.remove('panning');
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sp = eventScreenPos(e);
    zoomAt(sp.x, sp.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // ---------- Photo cache (shared factory) ----------
  const getTokenPhotoImg = window.RPG.createPhotoCache(() => window.RPG.draw());
  const getObjectImg = window.RPG.createObjectImgCache(() => window.RPG.draw());
  const contrastColor = window.RPG.contrastColor;

  // ---------- Bar renderer (shared factory) ----------
  const barRenderer = window.RPG.createBarRenderer(() => ctx, () => cam, () => state, MAX_ACTIVE_BARS);

  // ---------- Scene renderer (shared factory) ----------
  const sceneRenderer = window.RPG.createSceneRenderer(() => state, getTokenPhotoImg, contrastColor);

  // Total world-px reach of a token's vision cone (mirrors the GM). Captures
  // the shared js/shared/vision-math.js implementation before overwriting
  // window.RPG.tokenVisionReach below with this lighting-bound wrapper.
  const sharedTokenVisionReach = window.RPG.tokenVisionReach;
  function tokenVisionReach(t) {
    return sharedTokenVisionReach(t, state.lighting);
  }

  // ---------- Status banner ----------
  let statusTimer = null;
  function showStatus(text, autoHide) {
    statusEl.textContent = text;
    statusEl.classList.remove('hidden');
    if (statusTimer) clearTimeout(statusTimer);
    if (autoHide) statusTimer = setTimeout(() => statusEl.classList.add('hidden'), 2000);
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.viewport = viewport;
  window.RPG.canvas = canvas;
  window.RPG.ctx = ctx;
  window.RPG.statusEl = statusEl;
  window.RPG.getDpr = getDpr;
  window.RPG.cam = cam;
  window.RPG.getCam = () => cam;
  window.RPG.screenToWorld = screenToWorld;
  window.RPG.eventScreenPos = eventScreenPos;
  window.RPG.zoomAt = zoomAt;
  window.RPG.centerView = centerView;
  window.RPG.resizeCanvas = resizeCanvas;

  window.RPG.MAX_ACTIVE_BARS = MAX_ACTIVE_BARS;
  window.RPG.EXPLORED_CELL = EXPLORED_CELL;
  window.RPG.EXPLORED_DIM_ALPHA = EXPLORED_DIM_ALPHA;
  window.RPG.MEMORY_SCALE = MEMORY_SCALE;
  window.RPG.MEMORY_MARGIN_CELLS = MEMORY_MARGIN_CELLS;
  window.RPG.exploredCells = exploredCells;

  window.RPG.state = state;
  window.RPG.getState = () => state;

  window.RPG.getTokenPhotoImg = getTokenPhotoImg;
  window.RPG.getObjectImg = getObjectImg;
  window.RPG.contrastColor = contrastColor;
  window.RPG.drawTokenBars = barRenderer.drawTokenBars;
  window.RPG.drawMapAndGrid = sceneRenderer.drawMapAndGrid;
  window.RPG.drawTokenBasic = sceneRenderer.drawTokenBasic;
  window.RPG.tokenVisionReach = tokenVisionReach;

  window.RPG.showStatus = showStatus;
})();
