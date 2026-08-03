/* ============================================================
   Shared: party member status bar rendering (Vida/Mana/etc.), used by
   BOTH windows. Only "active" universal bar definitions render, each in
   its own display mode (horizontal/vertical/radial), stacked so multiple
   bars of the same mode don't overlap.
   ============================================================ */

(function() {
  'use strict';

  // `getCtx`/`getCam` are functions (not values) since each window's ctx/cam
  // are stable object references anyway, but this keeps the dependency
  // explicit and consistent with createSceneRenderer's pattern.
  function createBarRenderer(getCtx, getCam, getState, maxActiveBars) {
    function barPct(vals, def) {
      const v = vals[def.id] || { current: def.defaultMax, max: def.defaultMax };
      return v.max > 0 ? Math.max(0, Math.min(1, v.current / v.max)) : 0;
    }

    function drawHorizontalBar(t, def, pct, idx) {
      const ctx = getCtx(), cam = getCam();
      const barW = t.r * 2;
      const barH = 5 / cam.zoom;
      const gap = 2 / cam.zoom;
      const x = t.x - t.r;
      const y = t.y - t.r - 2 / cam.zoom - (idx + 1) * (barH + gap);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = def.color;
      if (def.direction === 'rtl') {
        ctx.fillRect(x + barW * (1 - pct), y, barW * pct, barH); // empties toward the left
      } else {
        ctx.fillRect(x, y, barW * pct, barH);
      }
      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeRect(x, y, barW, barH);
    }

    function drawVerticalBar(t, def, pct, idx, onLeft) {
      const ctx = getCtx(), cam = getCam();
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
      // direction ltr = fills from bottom up; rtl = fills from top down
      if (def.direction === 'rtl') {
        ctx.fillRect(x, y, barW, barH * pct);
      } else {
        ctx.fillRect(x, y + barH * (1 - pct), barW, barH * pct);
      }
      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeRect(x, y, barW, barH);
    }

    function drawRadialBar(t, def, pct, idx) {
      const ctx = getCtx(), cam = getCam();
      const ringGap = 4 / cam.zoom;
      const ringW = 3.75 / cam.zoom;
      const radius = t.r + 4 / cam.zoom + idx * (ringW + ringGap);
      const start = -Math.PI / 2; // 12 o'clock
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

    function drawTokenBars(t) {
      const state = getState();
      if (!t.isPlayer || !state.partyBars) return;
      const vals = t.barValues || {};
      const activeBars = state.partyBars.filter(d => d.active).slice(0, maxActiveBars);
      if (activeBars.length === 0) return;

      let horizIdx = 0, vertLeftIdx = 0, vertRightIdx = 0, radialIdx = 0;
      for (const def of activeBars) {
        const pct = barPct(vals, def);
        if (def.display === 'radial') {
          drawRadialBar(t, def, pct, radialIdx++);
        } else if (def.display === 'vertical') {
          const onLeft = def.side === 'left';
          drawVerticalBar(t, def, pct, onLeft ? vertLeftIdx++ : vertRightIdx++, onLeft);
        } else {
          drawHorizontalBar(t, def, pct, horizIdx++);
        }
      }
    }

    // How far a token's status bars extend past its radius on each side
    // (world units) — GM-only (used to keep effect dots clear of the bars).
    function tokenBarExtents(t) {
      const state = getState();
      const cam = getCam();
      const ext = { top: 0, right: 0 };
      if (!t.isPlayer || !state.partyBars) return ext;
      const activeBars = state.partyBars.filter(d => d.active).slice(0, maxActiveBars);
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

    return { drawTokenBars, tokenBarExtents, drawHorizontalBar, drawVerticalBar, drawRadialBar };
  }

  window.RPG = window.RPG || {};
  window.RPG.createBarRenderer = createBarRenderer;
})();
