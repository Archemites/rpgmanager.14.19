/* ============================================================
   Player draw(): the player canvas render loop — live scene + fog
   compositing. Depends on js/player/vision-fog.js (visitTokenVision,
   punchVisionCone) and js/player/memory.js (drawMemoryCellPatch) having
   already run. See ARCHITECTURE.md "Canvas rendering" > "Player view".
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
  const EXPLORED_CELL = window.RPG.EXPLORED_CELL;
  const EXPLORED_DIM_ALPHA = window.RPG.EXPLORED_DIM_ALPHA;
  const exploredCells = window.RPG.exploredCells;

  // reusable offscreen fog layer (sized to the main canvas)
  let fogLayer = null, fogLayerCtx = null;
  function getFogLayer(w, h) {
    if (!fogLayer) { fogLayer = document.createElement('canvas'); fogLayerCtx = fogLayer.getContext('2d'); }
    if (fogLayer.width !== w || fogLayer.height !== h) { fogLayer.width = w; fogLayer.height = h; }
    return fogLayerCtx;
  }

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

    // fog of war = the area OUTSIDE the players' vision. The live scene above is
    // covered by an opaque fog layer, with two kinds of holes punched into it:
    //   - the CURRENT vision cone: a true hole (destination-out) → the live scene
    //     underneath shows through, fully up to date.
    //   - previously-explored cells NOT currently in a cone: instead of a hole,
    //     we paint a FROZEN snapshot of that cell (map + tokens as they looked the
    //     last time a cone covered them) so tokens/changes that happened after the
    //     party left stay hidden until re-visited — only re-entering the cone
    //     refreshes that cell's snapshot.
    if (state.fog.length > 0) {
      // Only the GM-selected "active" player token projects a cone / reveals
      // fog — with several party members, the others stay dormant until picked.
      const playerTokens = state.tokens.filter(t => t.isPlayer && t.id === state.activeVisionTokenId);
      // mark cells explored AND freeze a fresh snapshot for cells inside a cone
      // right now (basic tokens only — no bars — memory freezes appearance,
      // not live combat stats)
      for (const t of playerTokens) window.RPG.visitTokenVision(t);

      const fx = getFogLayer(w, h);
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.clearRect(0, 0, w, h);
      fx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = '#000000';
      for (const f of state.fog) fx.fillRect(f.x, f.y, f.w, f.h);

      // paste the frozen memory (dimmed) over explored fog cells
      const memoryLayer = window.RPG.getMemoryLayer();
      if (exploredCells.size > 0 && memoryLayer) {
        fx.save();
        fx.globalAlpha = EXPLORED_DIM_ALPHA;
        fx.setTransform(1, 0, 0, 1, 0, 0);
        for (const f of state.fog) {
          const minCx = Math.floor(f.x / EXPLORED_CELL);
          const maxCx = Math.floor((f.x + f.w) / EXPLORED_CELL);
          const minCy = Math.floor(f.y / EXPLORED_CELL);
          const maxCy = Math.floor((f.y + f.h) / EXPLORED_CELL);
          for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
              const key = cx + ',' + cy;
              if (!exploredCells.has(key)) continue;
              window.RPG.drawMemoryCellPatch(fx, cx, cy, s);
            }
          }
        }
        fx.restore();
        fx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
      }

      // punch the CURRENT cone out as a true hole — live scene shows through
      fx.globalCompositeOperation = 'destination-out';
      for (const t of playerTokens) {
        window.RPG.punchVisionCone(fx, t);
      }

      // composite the fog (+ memory patches, + cone hole) over the live scene
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fogLayer, 0, 0);
      ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    }

    // cosmetic FX trail (explosion/fire/smoke/etc.) — drawn on top of fog so
    // players see it wherever it's placed, purely visual, no state impact
    if (window.RPG.drawFx) window.RPG.drawFx(ctx, cam);
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.draw = draw;
  window.RPG.getFogLayer = getFogLayer;
  window.RPG.getFogLayerCanvas = () => fogLayer;
})();
