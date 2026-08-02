/* ============================================================
   Draw: main canvas rendering function
   ============================================================ */

(function() {
  'use strict';

  const effectDotHitboxes = [];

  function contrastColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#ffffff';
  }

  function drawEffectDots(ctx, t, cam) {
    const dotR = Math.max(2.5 / cam.zoom, t.r * 0.16);
    const gap = dotR * 0.9;
    const ext = window.RPG.tokenBarExtents(t, cam);
    const pad = 3 / cam.zoom;
    const cx = t.x + t.r + ext.right + dotR + pad;
    let cy = t.y - t.r - ext.top - dotR - pad;
    for (const id of t.effects) {
      const eff = window.RPG.state.glossary.find(e => e.id === id);
      if (!eff) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = eff.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.fill();
      ctx.stroke();
      effectDotHitboxes.push({ cx, cy, r: dotR, effectId: id });
      cy += dotR * 2 + gap;
    }
  }

  function draw(canvas, ctx, dpr) {
    const cam = window.RPG.cam;
    const state = window.RPG.state;

    effectDotHitboxes.length = 0;
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#03140a';
    ctx.fillRect(0, 0, w, h);

    const s = cam.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

    const wl = cam.x;
    const wt = cam.y;
    const wr = cam.x + (w / dpr) / cam.zoom;
    const wb = cam.y + (h / dpr) / cam.zoom;

    if (state.map.img) {
      const img = state.map.img;
      const scale = state.map.scalePct / 100;
      const mw = img.naturalWidth * scale;
      const mh = img.naturalHeight * scale;
      ctx.drawImage(img, -mw / 2, -mh / 2, mw, mh);
    }

    if (state.grid.show) {
      const g = state.grid.size;
      ctx.strokeStyle = state.grid.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1 / cam.zoom;
      ctx.beginPath();
      const x0 = Math.floor(wl / g) * g;
      const y0 = Math.floor(wt / g) * g;
      for (let x = x0; x <= wr; x += g) {
        ctx.moveTo(x, wt);
        ctx.lineTo(x, wb);
      }
      for (let y = y0; y <= wb; y += g) {
        ctx.moveTo(wl, y);
        ctx.lineTo(wr, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const t of state.tokens) {
      const photo = window.RPG.getTokenPhotoImg(t);

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
      ctx.lineWidth = (isCurrentTurn ? 4 : (t.id === state.selectedTokenId ? 3 : 2)) / cam.zoom;
      ctx.strokeStyle = isCurrentTurn ? '#ff9f45' : (t.id === state.selectedTokenId ? '#ffffff' : (photo ? t.color : 'rgba(0,0,0,0.5)'));
      ctx.stroke();

      if (!photo && t.name) {
        ctx.font = `${Math.max(12, t.r * 0.7)}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = contrastColor(t.color);
        ctx.fillText(t.name.slice(0, 2).toUpperCase(), t.x, t.y);
      }

      if (t.effects && t.effects.length > 0) {
        drawEffectDots(ctx, t, cam);
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

      window.RPG.drawTokenBars(ctx, t, cam);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = 'rgba(69,255,120,0.6)';
    ctx.lineWidth = 1 / cam.zoom;
    for (const f of state.fog) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeRect(f.x, f.y, f.w, f.h);
    }

    if (window.RPG.fogDraw && window.RPG.fogDraw.active) {
      const fogDraw = window.RPG.fogDraw;
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
  }

  // Expose via shared namespace
  window.RPG = window.RPG || {};
  window.RPG.draw = function() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    draw(canvas, ctx, dpr);
  };
  window.RPG.effectDotHitboxes = effectDotHitboxes;
  window.RPG.contrastColor = contrastColor;
})();
