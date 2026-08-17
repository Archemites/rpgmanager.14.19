/* ============================================================
   Player state: state (received-from-GM view), cam, drag.
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

  // Camera (shared factory — js/shared/camera.js)
  const { cam, screenToWorld, eventScreenPos, zoomAt: zoomAtRaw, centerView: centerViewRaw } =
    window.RPG.createCamera(canvas, viewport);

  const state = {
    grid: { show: true, size: 48, color: null },  // null = follow theme's --accent
    map: { img: null, scalePct: 100, bgColor: null },  // null = no GM override, follow theme's --map-bg
    tokens: [],
    fog: [],     // opaque rectangles hiding the map/tokens beneath — GM-manual only, see js/player/draw.js
    objects: [], // map props/scenery: {id, x, y, w, h, rotation, dataUrl, name}
    combat: { active: false, order: [] },
    partyBars: [],
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

  window.RPG.state = state;
  window.RPG.getState = () => state;

  // Resolves the active theme's default map background (--map-bg), mirrored
  // from js/gm/theme.js's rpg-theme message. Fallback when a scene has no
  // GM-set bgColor override.
  window.RPG.getThemeMapBg = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim();
    return v || '#03140a';
  };

  // Resolves the active theme's accent color, used as the default grid line
  // color. Fallback when a scene has no GM-set grid.color override.
  window.RPG.getThemeGridColor = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#45ff78';
  };

  window.RPG.getTokenPhotoImg = getTokenPhotoImg;
  window.RPG.getObjectImg = getObjectImg;
  window.RPG.contrastColor = contrastColor;
  window.RPG.drawTokenBars = barRenderer.drawTokenBars;
  window.RPG.drawMapAndGrid = sceneRenderer.drawMapAndGrid;
  window.RPG.drawTokenBasic = sceneRenderer.drawTokenBasic;

  window.RPG.showStatus = showStatus;
})();
