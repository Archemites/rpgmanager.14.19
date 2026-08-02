/* ============================================================
   Bars: universal party bar rendering (horizontal, vertical, radial)
   ============================================================ */

(function() {
  'use strict';

  function drawTokenBars(ctx, t, cam) {
    if (!t.isPlayer || !window.RPG.state.partyBars) return;
    const vals = t.barValues || {};
    const activeBars = window.RPG.state.partyBars.filter(d => d.active).slice(0, window.RPG.MAX_ACTIVE_BARS);
    if (activeBars.length === 0) return;

    const barPct = (def) => {
      const v = vals[def.id] || { current: def.defaultMax, max: def.defaultMax };
      return v.max > 0 ? Math.max(0, Math.min(1, v.current / v.max)) : 0;
    };

    let horizIdx = 0, vertLeftIdx = 0, vertRightIdx = 0, radialIdx = 0;
    for (const def of activeBars) {
      const pct = barPct(def);
      if (def.display === 'radial') {
        drawRadialBar(ctx, t, def, pct, radialIdx++, cam);
      } else if (def.display === 'vertical') {
        const onLeft = def.side === 'left';
        drawVerticalBar(ctx, t, def, pct, onLeft ? vertLeftIdx++ : vertRightIdx++, onLeft, cam);
      } else {
        drawHorizontalBar(ctx, t, def, pct, horizIdx++, cam);
      }
    }
  }

  function drawHorizontalBar(ctx, t, def, pct, idx, cam) {
    const barW = t.r * 2;
    const barH = 5 / cam.zoom;
    const gap = 2 / cam.zoom;
    const x = t.x - t.r;
    const y = t.y - t.r - 2 / cam.zoom - (idx + 1) * (barH + gap);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = def.color;
    if (def.direction === 'rtl') {
      ctx.fillRect(x + barW * (1 - pct), y, barW * pct, barH);
    } else {
      ctx.fillRect(x, y, barW * pct, barH);
    }
    ctx.lineWidth = 1 / cam.zoom;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(x, y, barW, barH);
  }

  function drawVerticalBar(ctx, t, def, pct, idx, onLeft, cam) {
    const barH = t.r * 2;
    const barW = 5 / cam.zoom;
    const gap = 2 / cam.zoom;
    const x = onLeft
      ? (t.x - t.r - 2 / cam.zoom - (idx + 1) * (barW + gap))
      : (t.x + t.r + 2 / cam.zoom + idx * (barW + gap));
    const y = t.y - t.r;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = def.color;
    if (def.direction === 'rtl') {
      ctx.fillRect(x, y, barW, barH * pct);
    } else {
      ctx.fillRect(x, y + barH * (1 - pct), barW, barH * pct);
    }
    ctx.lineWidth = 1 / cam.zoom;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(x, y, barW, barH);
  }

  function drawRadialBar(ctx, t, def, pct, idx, cam) {
    const ringGap = 4 / cam.zoom;
    const ringW = 3 / cam.zoom;
    const radius = t.r + 4 / cam.zoom + idx * (ringW + ringGap);
    const start = -Math.PI / 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
    ctx.lineWidth = ringW;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius, start, start + Math.PI * 2 * pct);
    ctx.lineWidth = ringW;
    ctx.strokeStyle = def.color;
    ctx.stroke();
  }

  function tokenBarExtents(t, cam) {
    const ext = { top: 0, right: 0 };
    if (!t.isPlayer || !window.RPG.state.partyBars) return ext;
    const activeBars = window.RPG.state.partyBars.filter(d => d.active).slice(0, window.RPG.MAX_ACTIVE_BARS);
    let horiz = 0, vertRight = 0, radial = 0;
    for (const def of activeBars) {
      if (def.display === 'radial') radial++;
      else if (def.display === 'vertical') { if (def.side !== 'left') vertRight++; }
      else horiz++;
    }
    if (horiz > 0) {
      const barH = 5 / cam.zoom, gap = 2 / cam.zoom;
      ext.top = Math.max(ext.top, 2 / cam.zoom + horiz * (barH + gap));
    }
    if (vertRight > 0) {
      const barW = 5 / cam.zoom, gap = 2 / cam.zoom;
      ext.right = Math.max(ext.right, 2 / cam.zoom + vertRight * (barW + gap));
    }
    if (radial > 0) {
      const ringGap = 4 / cam.zoom, ringW = 3 / cam.zoom;
      const ring = 4 / cam.zoom + radial * (ringW + ringGap);
      ext.top = Math.max(ext.top, ring);
      ext.right = Math.max(ext.right, ring);
    }
    return ext;
  }

  // Expose via shared namespace
  window.RPG = window.RPG || {};
  window.RPG.drawTokenBars = drawTokenBars;
  window.RPG.drawHorizontalBar = drawHorizontalBar;
  window.RPG.drawVerticalBar = drawVerticalBar;
  window.RPG.drawRadialBar = drawRadialBar;
  window.RPG.tokenBarExtents = tokenBarExtents;
})();
