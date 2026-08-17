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

  // ---------- Own-token drag ----------
  // The GM assigns which token belongs to this player right after it
  // announces its name (js/player/sync.js's 'rpg-my-token' handler) and
  // tells us again on reconnect — a player can only ever drag THIS token,
  // enforced again server-side in js/gm/sync.js (never trust the client).
  let myTokenId = null;
  let activeConnection = null;
  const tokenDrag = {
    active: false,
    offsetX: 0, offsetY: 0,   // world-space grab offset from the token's center
  };

  // Movement is optimistic: applied to the local token immediately (so it
  // feels instant) and echoed to the GM — the GM is the authority and will
  // broadcast back the same or a corrected position. Throttled only to
  // ~60fps (16ms): mousemove itself never fires faster than the display's
  // refresh rate, so anything below that is wasted messages, not smoother
  // motion. This timer only ever runs while tokenDrag.active — no polling.
  const MOVE_MIN_INTERVAL_MS = 16;
  let moveTimerId = null;
  let lastMoveAt = 0;
  let pendingMove = null; // { x, y } or null

  function flushMove() {
    moveTimerId = null;
    if (!pendingMove || !activeConnection || !activeConnection.open) { pendingMove = null; return; }
    lastMoveAt = performance.now();
    try { activeConnection.send({ type: 'rpg-token-move', x: pendingMove.x, y: pendingMove.y }); } catch (_) {}
    pendingMove = null;
  }

  function scheduleMove(x, y) {
    pendingMove = { x, y };
    if (moveTimerId !== null) return;
    const elapsed = performance.now() - lastMoveAt;
    const delay = Math.max(0, MOVE_MIN_INTERVAL_MS - elapsed);
    moveTimerId = setTimeout(flushMove, delay);
  }

  function myToken() {
    if (myTokenId === null) return null;
    return state.tokens.find((t) => t.id === myTokenId) || null;
  }

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

  // ---------- Interaction: drag own token, middle/left-drag pan, scroll zoom ----------
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 1 && e.button !== 0) return;
    const sp = eventScreenPos(e);

    // Left-click on your own token grabs it instead of panning — checked
    // first so clicking the token never starts a pan.
    if (e.button === 0) {
      const t = myToken();
      if (t) {
        const wp = screenToWorld(sp.x, sp.y);
        const dx = wp.x - t.x, dy = wp.y - t.y;
        if (dx * dx + dy * dy <= t.r * t.r) {
          e.preventDefault();
          tokenDrag.active = true;
          tokenDrag.offsetX = dx;
          tokenDrag.offsetY = dy;
          canvas.classList.add('panning');
          return;
        }
      }
    }

    e.preventDefault();
    drag.active = true;
    drag.startScreenX = sp.x;
    drag.startScreenY = sp.y;
    drag.camStartX = cam.x;
    drag.camStartY = cam.y;
    canvas.classList.add('panning');
  });

  window.addEventListener('mousemove', (e) => {
    if (tokenDrag.active) {
      const t = myToken();
      if (!t) { tokenDrag.active = false; return; }
      const sp = eventScreenPos(e);
      const wp = screenToWorld(sp.x, sp.y);
      t.x = wp.x - tokenDrag.offsetX;
      t.y = wp.y - tokenDrag.offsetY;
      window.RPG.draw();
      scheduleMove(t.x, t.y);
      return;
    }
    if (!drag.active) return;
    const sp = eventScreenPos(e);
    cam.x = drag.camStartX - (sp.x - drag.startScreenX) / cam.zoom;
    cam.y = drag.camStartY - (sp.y - drag.startScreenY) / cam.zoom;
    window.RPG.draw();
  });

  window.addEventListener('mouseup', () => {
    if (tokenDrag.active) {
      tokenDrag.active = false;
      canvas.classList.remove('panning');
      // flush immediately so the GM sees the final drop position without
      // waiting out the throttle window
      if (moveTimerId !== null) { clearTimeout(moveTimerId); moveTimerId = null; }
      flushMove();
      return;
    }
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

  window.RPG.setMyTokenId = (id) => { myTokenId = id; };
  window.RPG.getMyTokenId = () => myTokenId;
  window.RPG.setActiveConnection = (conn) => { activeConnection = conn; };
})();
