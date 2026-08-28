// @ts-check
/* ============================================================
   Player state: state (received-from-GM view), cam, drag.
   Read-only mirror of whatever the GM last sent — never mutated locally
   except by the incoming 'rpg-state' message handler in js/player/sync.js.
   See ARCHITECTURE.md "State management" > "Player side".
   ============================================================ */

(() => {
  'use strict';

  const viewport = document.getElementById('viewport');
  /** @type {any} */ (window).RPG.combatBarTokens = document.getElementById('combatBar-tokens');
  /** @type {HTMLCanvasElement} */
  const canvas = (/** @type {any} */ (document.getElementById('canvas')));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const statusEl = document.getElementById('status');

  const MAX_ACTIVE_BARS = 2;

  // Camera (shared factory — js/shared/camera.js)
  const { cam, screenToWorld, eventScreenPos, zoomAt: zoomAtRaw, centerView: centerViewRaw } =
    /** @type {any} */ (window).RPG.createCamera(canvas, viewport);

  /** @type {any} */
  const state = {
    grid: { show: true, size: 48, color: null },
    map: { img: null, scalePct: 100, dataUrl: null, bgColor: null },
    tokens: [],
    fog: [],
    objects: [],
    combat: { active: false, order: [] },
    partyBars: [],
    notes: [],
    glossary: [],
    snapToGrid: true,
    nextId: 1,
    lights: [],
    music: { url: '', status: 'stopped', loop: true, volume: 1 },
    time: { paused: true, elapsed: 0, speed: 1 },
    weather: { active: false, type: 'rain', intensity: 0.5 },
    ambient: { url: '', status: 'stopped', loop: true, volume: 0.5 },
    sceneId: '',
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
    /** @type {any} */ (window).RPG.draw();
  }
  window.addEventListener('resize', resizeCanvas);

  function zoomAt(screenX, screenY, factor) {
    zoomAtRaw(screenX, screenY, factor, () => /** @type {any} */ (window).RPG.draw());
  }
  function centerView() {
    centerViewRaw(() => /** @type {any} */ (window).RPG.draw());
  }

  // ---------- Interaction: drag own token, middle/left-drag pan, scroll zoom ----------
  // Mouse and single-finger touch are unified through the same start/move/end
  // functions below — touch handlers just adapt a Touch object into the same
  // {x, y} shape eventScreenPos already produces for mouse events, then call
  // the identical logic. Two-finger touch is pinch-to-zoom only (see below).
  function pointerStart(sp, isPrimaryButton) {
    if (!isPrimaryButton) return;

    // Grabbing your own token takes priority over panning — checked first
    // so touching/clicking the token never starts a pan.
    const t = myToken();
    if (t) {
      const wp = screenToWorld(sp.x, sp.y);
      const r = /** @type {any} */ (t).r || (t.w || 48) / 2;
      const dx = wp.x - t.x, dy = wp.y - t.y;
      if (dx * dx + dy * dy <= r * r) {
        tokenDrag.active = true;
        tokenDrag.offsetX = dx;
        tokenDrag.offsetY = dy;
        canvas.classList.add('panning');
        return;
      }
    }

    drag.active = true;
    drag.startScreenX = sp.x;
    drag.startScreenY = sp.y;
    drag.camStartX = cam.x;
    drag.camStartY = cam.y;
    canvas.classList.add('panning');
  }

  function pointerMove(sp) {
    if (tokenDrag.active) {
      const t = myToken();
      if (!t) { tokenDrag.active = false; return; }
      const wp = screenToWorld(sp.x, sp.y);
      t.x = wp.x - tokenDrag.offsetX;
      t.y = wp.y - tokenDrag.offsetY;
      /** @type {any} */ (window).RPG.draw();
      scheduleMove(t.x, t.y);
      return;
    }
    if (!drag.active) return;
    cam.x = drag.camStartX - (sp.x - drag.startScreenX) / cam.zoom;
    cam.y = drag.camStartY - (sp.y - drag.startScreenY) / cam.zoom;
    /** @type {any} */ (window).RPG.draw();
  }

  function pointerEnd() {
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
  }

  // ---------- Mouse ----------
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 1 && e.button !== 0) return;
    e.preventDefault();
    pointerStart(eventScreenPos(e), true);
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag.active && !tokenDrag.active) return;
    pointerMove(eventScreenPos(e));
  });
  window.addEventListener('mouseup', pointerEnd);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sp = eventScreenPos(e);
    zoomAt(sp.x, sp.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // ---------- Touch: 1 finger = pan/drag (same as left-click), 2 fingers = pinch zoom ----------
  function touchScreenPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  function touchMidpoint(t0, t1) {
    return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
  }
  function touchDist(t0, t1) {
    return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  }

  let pinchActive = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // switching to pinch cancels any single-finger drag in progress
      if (drag.active || tokenDrag.active) pointerEnd();
      pinchActive = true;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartZoom = cam.zoom;
      return;
    }
    if (e.touches.length === 1 && !pinchActive) {
      pointerStart(touchScreenPos(e.touches[0]), true);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (pinchActive && e.touches.length === 2) {
      const dist = touchDist(e.touches[0], e.touches[1]);
      if (pinchStartDist > 0) {
        const mid = touchMidpoint(e.touches[0], e.touches[1]);
        const rect = canvas.getBoundingClientRect();
        const RPG = /** @type {any} */ (window).RPG;
        const targetZoom = Math.max(RPG.MIN_ZOOM, Math.min(RPG.MAX_ZOOM,
          pinchStartZoom * (dist / pinchStartDist)));
        zoomAt(mid.x - rect.left, mid.y - rect.top, targetZoom / cam.zoom);
      }
      return;
    }
    if (e.touches.length === 1 && !pinchActive) {
      pointerMove(touchScreenPos(e.touches[0]));
    }
  }, { passive: false });

  function touchEnd(e) {
    if (e.touches.length === 0) {
      pinchActive = false;
      pointerEnd();
    } else if (e.touches.length === 1) {
      // lifted one finger out of a pinch — resume as a single-finger pan
      // from here rather than jumping using the old two-finger start point
      pinchActive = false;
      pointerStart(touchScreenPos(e.touches[0]), true);
    }
  }
  canvas.addEventListener('touchend', touchEnd, { passive: false });
  canvas.addEventListener('touchcancel', touchEnd, { passive: false });

  // ---------- Photo cache (shared factory) ----------
  const getTokenPhotoImg = /** @type {any} */ (window).RPG.createPhotoCache(() => /** @type {any} */ (window).RPG.draw());
  const getObjectImg = /** @type {any} */ (window).RPG.createObjectImgCache(() => /** @type {any} */ (window).RPG.draw());
  const contrastColor = /** @type {any} */ (window).RPG.contrastColor;

  // ---------- Bar renderer (shared factory) ----------
  const barRenderer = /** @type {any} */ (window).RPG.createBarRenderer(() => ctx, () => cam, () => state, MAX_ACTIVE_BARS);

  // ---------- Scene renderer (shared factory) ----------
  const sceneRenderer = /** @type {any} */ (window).RPG.createSceneRenderer(() => state, getTokenPhotoImg, contrastColor);

  // ---------- Status banner ----------
  let statusTimer = null;
  function showStatus(text, autoHide) {
    statusEl.textContent = text;
    statusEl.classList.remove('hidden');
    if (statusTimer) clearTimeout(statusTimer);
    if (autoHide) statusTimer = setTimeout(() => statusEl.classList.add('hidden'), 2000);
  }

  // ---------- Expose to window.RPG ----------
  const RPG = /** @type {any} */ (window).RPG || {};
  /** @type {any} */ (window).RPG = RPG;

  RPG.viewport = viewport;
  RPG.canvas = canvas;
  RPG.ctx = ctx;
  RPG.statusEl = statusEl;
  RPG.getDpr = getDpr;
  RPG.cam = cam;
  RPG.getCam = () => cam;
  RPG.screenToWorld = screenToWorld;
  RPG.eventScreenPos = eventScreenPos;
  RPG.zoomAt = zoomAt;
  RPG.centerView = centerView;
  RPG.resizeCanvas = resizeCanvas;

  RPG.MAX_ACTIVE_BARS = MAX_ACTIVE_BARS;

  RPG.state = state;
  RPG.getState = () => state;

  // Resolves the active theme's default map background (--map-bg), mirrored
  // from js/gm/theme.js's rpg-theme message. Fallback when a scene has no
  // GM-set bgColor override.
  RPG.getThemeMapBg = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim();
    return v || '#03140a';
  };

  // Resolves the active theme's accent color, used as the default grid line
  // color. Fallback when a scene has no GM-set grid.color override.
  RPG.getThemeGridColor = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#45ff78';
  };

  RPG.getTokenPhotoImg = getTokenPhotoImg;
  RPG.getObjectImg = getObjectImg;
  RPG.contrastColor = contrastColor;
  RPG.drawTokenBars = barRenderer.drawTokenBars;
  RPG.drawMapAndGrid = sceneRenderer.drawMapAndGrid;
  RPG.drawTokenBasic = sceneRenderer.drawTokenBasic;

  RPG.showStatus = showStatus;

  RPG.setMyTokenId = (id) => { myTokenId = id; };
  RPG.getMyTokenId = () => myTokenId;
  RPG.setActiveConnection = (conn) => { activeConnection = conn; };
  RPG.getActiveConnection = () => activeConnection;
})();
