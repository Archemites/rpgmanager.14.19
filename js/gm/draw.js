/* ============================================================
   GM draw(): the GM canvas render loop — map, grid, tokens, fog tint, walls,
   vision-cone preview, facing indicators, rotation handle, in-progress
   fog/wall drag previews, measure overlay, "bring carry" ghost.
   Depends on hit-test.js (none directly) and vision-preview.js (drawVisionCone,
   drawFacingIndicator, rotateHandlePos) having already run.
   See ARCHITECTURE.md "Canvas rendering" > "GM view".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
  const canvas = window.RPG.canvas;
  const ctx = window.RPG.ctx;
  const getDpr = window.RPG.getDpr;
  const getTokenPhotoImg = window.RPG.getTokenPhotoImg;
  const contrastColor = window.RPG.contrastColor;
  const drawTokenBars = window.RPG.drawTokenBars;
  const tokenBarExtents = window.RPG.tokenBarExtents;
  const effectDotHitboxes = window.RPG.effectDotHitboxes;
  const fogDraw = window.RPG.fogDraw;
  const wallDraw = window.RPG.wallDraw;
  const ROTATE_HANDLE_R = window.RPG.ROTATE_HANDLE_R;

  // status dots stacked at the token's top-right corner, clear of its bars, colored by effect
  function drawEffectDots(t) {
    const dotR = Math.max(2.5 / cam.zoom, t.r * 0.16);
    const gap = dotR * 0.9;
    const ext = tokenBarExtents(t);
    const pad = 3 / cam.zoom;
    // anchor just outside the top-right of the token (past any bars there)
    const cx = t.x + t.r + ext.right + dotR + pad;
    let cy = t.y - t.r - ext.top - dotR - pad;
    for (const app of t.effects) {
      const eff = state.glossary.find(e => e.id === app.id);
      if (!eff) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = eff.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.fill();
      ctx.stroke();
      // track for hit-testing
      effectDotHitboxes.push({ cx, cy, r: dotR, effectId: app.id });
      cy += dotR * 2 + gap; // stack downward
    }
  }

  function draw() {
    const dpr = getDpr();
    effectDotHitboxes.length = 0;  // reset for this frame
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // background — per-scene, GM-configurable (Ajustes > Mapa)
    ctx.fillStyle = state.map.bgColor || '#03140a';
    ctx.fillRect(0, 0, w, h);

    // camera transform (world → device pixels)
    const s = cam.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

    // visible world bounds
    const wl = cam.x;
    const wt = cam.y;
    const wr = cam.x + (w / dpr) / cam.zoom;
    const wb = cam.y + (h / dpr) / cam.zoom;

    // map image centered on world origin
    let mapL = null, mapT = null, mapR = null, mapB = null;
    if (state.map.img) {
      const img = state.map.img;
      const scale = state.map.scalePct / 100;
      const mw = img.naturalWidth * scale;
      const mh = img.naturalHeight * scale;
      mapL = -mw / 2; mapT = -mh / 2; mapR = mw / 2; mapB = mh / 2;
      ctx.drawImage(img, mapL, mapT, mw, mh);
    }

    // grid (only visible lines, and only OVER THE MAP — clamped to the map
    // image's world rect so it doesn't bleed across the empty background
    // behind the floating toolbars. No map loaded → fall back to viewport.)
    if (state.grid.show) {
      const gl = mapL === null ? wl : Math.max(wl, mapL);
      const gt = mapT === null ? wt : Math.max(wt, mapT);
      const gr = mapR === null ? wr : Math.min(wr, mapR);
      const gb = mapB === null ? wb : Math.min(wb, mapB);

      if (gr > gl && gb > gt) {
        const g = state.grid.size;
        ctx.strokeStyle = state.grid.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath();
        const x0 = Math.ceil(gl / g) * g;
        const y0 = Math.ceil(gt / g) * g;
        for (let x = x0; x <= gr; x += g) {
          ctx.moveTo(x, gt);
          ctx.lineTo(x, gb);
        }
        for (let y = y0; y <= gb; y += g) {
          ctx.moveTo(gl, y);
          ctx.lineTo(gr, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // map objects (props/scenery) — drawn under tokens, above the map/grid.
    // Unlike tokens, the whole image IS the shape: no circular clip.
    for (const o of state.objects) {
      const img = window.RPG.getObjectImg(o);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rotation);
      if (img) {
        ctx.drawImage(img, -o.w / 2, -o.h / 2, o.w, o.h);
      } else {
        ctx.fillStyle = 'rgba(120,120,120,0.5)';
        ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
      }
      if (o.id === state.selectedObjectId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / cam.zoom;
        ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
      }
      ctx.restore();
    }

    // tokens
    for (const t of state.tokens) {
      const photo = getTokenPhotoImg(t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      if (photo) {
        ctx.clip();
        ctx.drawImage(photo, t.x - t.r, t.y - t.r, t.r * 2, t.r * 2);
      } else {
        ctx.fillStyle = t.color;
        ctx.fill();
      }
      ctx.restore();

      const isCurrentTurn = state.combat.active && state.combat.order[0] === t.id;

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      const isMultiSelected = state.selectedTokenIds.length > 1 && state.selectedTokenIds.includes(t.id);
      ctx.lineWidth = (isCurrentTurn ? 4 : (isMultiSelected || t.id === state.selectedTokenId ? 3 : 2)) / cam.zoom;
      ctx.strokeStyle = isCurrentTurn ? '#ff9f45' : (isMultiSelected ? '#45ff78' : (t.id === state.selectedTokenId ? '#ffffff' : (photo ? t.color : 'rgba(0,0,0,0.5)')));
      ctx.stroke();

      if (!photo && t.name) {
        ctx.font = `${Math.max(12, t.r * 0.7)}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = contrastColor(t.color);
        ctx.fillText(t.name.slice(0, 2).toUpperCase(), t.x, t.y);
      }

      // applied effects — a column of white dots at the token's top-right,
      // offset so they never overlap (or get hidden behind) its status bars
      if (t.effects && t.effects.length > 0) {
        drawEffectDots(t);
      }

      if (t.name) {
        ctx.font = `${Math.max(14, t.r * 0.6)}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = t.y + t.r + 4 / cam.zoom;
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(t.name, t.x, labelY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.name, t.x, labelY);
      }

      drawTokenBars(t);
    }

    // background note markers — GM-only sticky notes pinned to a world point
    for (const n of state.notes) {
      const r = window.RPG.NOTE_MARKER_R / cam.zoom;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 210, 74, 0.85)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.fill();
      ctx.stroke();
      ctx.font = `${r * 1.3}px "VT323", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1400';
      ctx.fillText('📝', n.x, n.y + 0.5 / cam.zoom);
    }

    // fog of war rects — kept lightly tinted on the master so the GM sees the
    // map clearly underneath while still knowing which areas are hidden.
    ctx.fillStyle = 'rgba(3, 20, 10, 0.32)';
    ctx.strokeStyle = 'rgba(69,255,120,0.35)';
    ctx.lineWidth = 1 / cam.zoom;
    for (const f of state.fog) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeRect(f.x, f.y, f.w, f.h);
    }

    // walls — GM-only line-of-sight blockers, never sent to the player visually
    if (state.walls.length > 0) {
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3 / cam.zoom;
      ctx.lineCap = 'round';
      for (const wall of state.walls) {
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
      }
    }

    // vision cones (master preview) — drawn on top of the light fog so the GM
    // can see exactly where each player token can see into the fog.
    for (const t of state.tokens) {
      if (!t.isPlayer) continue;
      window.RPG.drawVisionCone(ctx, t);
    }

    // facing indicators for every token
    for (const t of state.tokens) {
      window.RPG.drawFacingIndicator(ctx, t);
    }

    // rotation handle for the selected token
    const sel = state.tokens.find(t => t.id === state.selectedTokenId);
    if (sel && !state.fogMode && !state.wallMode && !window.RPG.getMeasureMode()) {
      const hp = window.RPG.rotateHandlePos(sel);
      ctx.beginPath();
      ctx.moveTo(sel.x, sel.y);
      ctx.lineTo(hp.x, hp.y);
      ctx.strokeStyle = 'rgba(255,210,74,0.7)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, ROTATE_HANDLE_R / cam.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd24a';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.fill();
      ctx.stroke();
    }

    // rotation handle for the selected object
    const selObj = state.objects.find(o => o.id === state.selectedObjectId);
    if (selObj && !state.fogMode && !state.wallMode && !window.RPG.getMeasureMode()) {
      const hp = window.RPG.objectRotateHandlePos(selObj);
      ctx.beginPath();
      ctx.moveTo(selObj.x, selObj.y);
      ctx.lineTo(hp.x, hp.y);
      ctx.strokeStyle = 'rgba(255,210,74,0.7)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, ROTATE_HANDLE_R / cam.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd24a';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.fill();
      ctx.stroke();
    }

    // in-progress box-select rectangle
    if (window.RPG.drag && window.RPG.drag.mode === 'box') {
      const d = window.RPG.drag;
      const rx = Math.min(d.boxStartX, d.boxCurX);
      const ry = Math.min(d.boxStartY, d.boxCurY);
      const rw = Math.abs(d.boxCurX - d.boxStartX);
      const rh = Math.abs(d.boxCurY - d.boxStartY);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.setLineDash([5 / cam.zoom, 3 / cam.zoom]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }

    // in-progress fog rect being drawn
    if (fogDraw.active) {
      const rx = Math.min(fogDraw.startX, fogDraw.curX);
      const ry = Math.min(fogDraw.startY, fogDraw.curY);
      const rw = Math.abs(fogDraw.curX - fogDraw.startX);
      const rh = Math.abs(fogDraw.curY - fogDraw.startY);
      ctx.fillStyle = 'rgba(69,255,120,0.18)';
      ctx.strokeStyle = 'rgba(69,255,120,0.9)';
      ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }

    // in-progress wall segment being drawn
    if (wallDraw.active) {
      ctx.beginPath();
      ctx.moveTo(wallDraw.startX, wallDraw.startY);
      ctx.lineTo(wallDraw.curX, wallDraw.curY);
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3 / cam.zoom;
      ctx.lineCap = 'round';
      ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // draw measurement
    if (window.RPG && window.RPG.drawMeasure) {
      window.RPG.drawMeasure(ctx, state, cam);
    }

    // cosmetic FX trail (explosion/fire/smoke/etc.) — purely visual, on top of everything
    if (window.RPG.drawFx) window.RPG.drawFx(ctx, cam);

    // ghost preview of a token being "brought" from another scene — follows
    // the cursor until the GM clicks to drop it into the open scene
    const carry = window.RPG.bringCarry;
    if (carry.active) {
      const t = carry.token;
      const gx = carry.worldX, gy = carry.worldY;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(gx, gy, t.r, 0, Math.PI * 2);
      const photo = getTokenPhotoImg(t);
      if (photo) {
        ctx.clip();
        ctx.drawImage(photo, gx - t.r, gy - t.r, t.r * 2, t.r * 2);
      } else {
        ctx.fillStyle = t.color;
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(gx, gy, t.r, 0, Math.PI * 2);
      ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeStyle = '#ffd24a';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // keep the annotation post-it (if open) anchored to its world point,
    // then draw the thin connector line from the anchor to its current
    // on-screen corner (reposition first so the DOM rect read below is current)
    if (window.RPG.repositionNotePostit) window.RPG.repositionNotePostit();
    if (window.RPG.drawNotePostitConnector) window.RPG.drawNotePostitConnector(ctx);
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.draw = draw;
  window.RPG.drawEffectDots = drawEffectDots;
})();
