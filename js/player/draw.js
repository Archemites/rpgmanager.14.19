/* ============================================================
   Player draw(): the player canvas render loop — live scene + fog
   compositing. Fog is GM-manual only: state.fog[] rectangles are drawn
   fully opaque, no reveal automation of any kind. See ARCHITECTURE.md
   "Canvas rendering" > "Player view".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
  const canvas = window.RPG.canvas;
  const ctx = window.RPG.ctx;
  const getDpr = window.RPG.getDpr;
  const drawMapAndGrid = window.RPG.drawMapAndGrid;
  const drawTokenBasic = window.RPG.drawTokenBasic;
  const drawTokenBars = window.RPG.drawTokenBars;

  function draw() {
    const dpr = getDpr();
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = state.map.bgColor || (window.RPG.getThemeMapBg ? window.RPG.getThemeMapBg() : '#03140a');
    ctx.fillRect(0, 0, w, h);

    const s = cam.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

    const wl = cam.x;
    const wt = cam.y;
    const wr = cam.x + (w / dpr) / cam.zoom;
    const wb = cam.y + (h / dpr) / cam.zoom;

    drawMapAndGrid(ctx, wl, wt, wr, wb, cam.zoom);

    for (const o of state.objects) {
      const img = window.RPG.getObjectImg(o);
      if (!img) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rotation);
      ctx.drawImage(img, -o.w / 2, -o.h / 2, o.w, o.h);
      ctx.restore();
    }

    for (const t of state.tokens) {
      drawTokenBasic(ctx, t, cam.zoom);
      drawTokenBars(t);
    }

    // Fog of war: purely GM-manual. Each state.fog[] rectangle is painted
    // fully opaque — no reveal-by-vision, no cone, no exploration memory.
    // The GM erases/redraws these rects by hand as the party explores.
    ctx.fillStyle = '#000000';
    for (const f of state.fog) ctx.fillRect(f.x, f.y, f.w, f.h);

    // cosmetic FX trail (explosion/fire/smoke/etc.) — drawn on top of fog so
    // players see it wherever it's placed, purely visual, no state impact
    if (window.RPG.drawFx) window.RPG.drawFx(ctx, cam);
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.draw = draw;
})();
