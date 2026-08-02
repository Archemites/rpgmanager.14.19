/* ============================================================
   GM vision preview: soft, non-occluded glow for every isPlayer token's cone
   — cosmetic reference only, walls do NOT block this. Also owns the rotation
   handle (drag/hit-test) and per-token facing-direction indicator triangle.
   See ARCHITECTURE.md "Vision & fog of war" > "GM side".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
  const canvas = window.RPG.canvas;
  const getDpr = window.RPG.getDpr;
  const ensureTokenVision = window.RPG.ensureTokenVision;
  const tokenVisionReach = window.RPG.tokenVisionReach;
  const ROTATE_HANDLE_R = window.RPG.ROTATE_HANDLE_R;

  // Build a conic gradient centered on `facing` that is fully opaque across the
  // cone's core and smoothly (smoothstep) fades to transparent toward each
  // straight edge — used as an angular mask so the sides feather with no seams.
  // Returns null when the browser lacks createConicGradient (caller falls back).
  function makeAngularMask(octx, cx, cy, facing, half, featherFrac) {
    if (typeof octx.createConicGradient !== 'function') return null;
    // conic gradient param t (0..1) maps to angle offset from `facing`:
    //   t=0/1 = facing (straight ahead), t=0.5 = directly behind.
    const g = octx.createConicGradient(facing, cx, cy);
    const featherStart = half * (1 - featherFrac);   // where the side fade begins
    const N = 24;                                     // smoothstep resolution
    // walk the full circle; alpha = 1 inside the core, smoothstep across the
    // feather band, 0 outside the cone. Sampled on both sides symmetrically.
    for (let i = 0; i <= N * 2; i++) {
      const t = i / (N * 2);                          // 0..1 around the circle
      const ang = t * Math.PI * 2;                    // offset from facing (0..2π)
      const off = ang <= Math.PI ? ang : (Math.PI * 2 - ang);  // 0..π, symmetric
      let a;
      if (off <= featherStart) a = 1;
      else if (off >= half) a = 0;
      else { const x = 1 - (off - featherStart) / (half - featherStart); a = x * x * (3 - 2 * x); }
      g.addColorStop(t, `rgba(0,0,0,${a.toFixed(4)})`);
    }
    return g;
  }

  // Paint a token's vision cone onto `octx` (an otherwise-empty layer) as a soft
  // alpha envelope that fades on EVERY side — radially toward the rim (front)
  // and angularly toward both straight edges. The radial fade is a gradient; the
  // angular fade is a conic-gradient mask applied with 'destination-in', so the
  // result is perfectly smooth (no wedge seams). `rgb`/`peak` set the colour.
  function paintConeEnvelope(octx, t, rgb, peak) {
    const reach = tokenVisionReach(t, state.lighting);
    const facing = t.facing;
    const radial = octx.createRadialGradient(t.x, t.y, t.r * 0.5, t.x, t.y, reach);
    radial.addColorStop(0, `rgba(${rgb},${peak})`);
    radial.addColorStop(0.82, `rgba(${rgb},${peak})`);
    radial.addColorStop(1, `rgba(${rgb},0)`);

    if (t.visionAngle >= 360) {
      octx.fillStyle = radial;
      octx.beginPath();
      octx.arc(t.x, t.y, reach, 0, Math.PI * 2);
      octx.fill();
      return;
    }

    const half = (t.visionAngle * Math.PI / 180) / 2;
    const featherFrac = 0.5;
    const mask = makeAngularMask(octx, t.x, t.y, facing, half, featherFrac);

    if (mask) {
      // full disc with the radial fade, then keep only the cone's angular slice
      octx.fillStyle = radial;
      octx.beginPath();
      octx.arc(t.x, t.y, reach, 0, Math.PI * 2);
      octx.fill();
      octx.save();
      octx.globalCompositeOperation = 'destination-in';
      octx.fillStyle = mask;
      octx.beginPath();
      octx.arc(t.x, t.y, reach, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    } else {
      // fallback: hard-sided sector with the radial front fade only
      octx.fillStyle = radial;
      octx.beginPath();
      octx.moveTo(t.x, t.y);
      octx.arc(t.x, t.y, reach, facing - half, facing + half);
      octx.closePath();
      octx.fill();
    }
  }

  // reusable offscreen layer for the master's cone glow
  let coneLayer = null, coneLayerCtx = null;
  function getConeLayer(w, h) {
    if (!coneLayer) { coneLayer = document.createElement('canvas'); coneLayerCtx = coneLayer.getContext('2d'); }
    if (coneLayer.width !== w || coneLayer.height !== h) { coneLayer.width = w; coneLayer.height = h; }
    return coneLayerCtx;
  }

  // Master preview of a token's vision cone: a soft green glow feathered on all
  // sides. Rendered on its own layer then composited over the scene.
  function drawVisionCone(ctx, t) {
    if (state.lighting <= 0) return;
    ensureTokenVision(t);
    const dpr = getDpr();
    const s = cam.zoom * dpr;
    const octx = getConeLayer(canvas.width, canvas.height);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, coneLayer.width, coneLayer.height);
    octx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    paintConeEnvelope(octx, t, '120,255,170', 0.22);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(coneLayer, 0, 0);
    ctx.restore();
  }

  // World position of the rotation handle (a fixed screen distance beyond the rim).
  function rotateHandlePos(t) {
    ensureTokenVision(t);
    const dist = t.r + 26 / cam.zoom;
    return { x: t.x + Math.cos(t.facing) * dist, y: t.y + Math.sin(t.facing) * dist };
  }
  // Hit-test the selected token's rotation handle (world coords in, bool out).
  function rotateHandleAt(wx, wy) {
    const t = state.tokens.find(tk => tk.id === state.selectedTokenId);
    if (!t) return null;
    const h = rotateHandlePos(t);
    const rr = (ROTATE_HANDLE_R + 4) / cam.zoom;
    const dx = wx - h.x, dy = wy - h.y;
    return (dx * dx + dy * dy <= rr * rr) ? t : null;
  }

  // Small triangular arrow on the token's rim showing which way it faces.
  function drawFacingIndicator(ctx, t) {
    ensureTokenVision(t);
    const a = t.facing;
    const tip = t.r + Math.max(6 / cam.zoom, t.r * 0.45);
    const baseA = t.r * 0.9;
    const spread = 0.42;
    const tx = t.x + Math.cos(a) * tip;
    const ty = t.y + Math.sin(a) * tip;
    const l1x = t.x + Math.cos(a - spread) * baseA;
    const l1y = t.y + Math.sin(a - spread) * baseA;
    const l2x = t.x + Math.cos(a + spread) * baseA;
    const l2y = t.y + Math.sin(a + spread) * baseA;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(l1x, l1y);
    ctx.lineTo(l2x, l2y);
    ctx.closePath();
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1 / cam.zoom;
    ctx.fill();
    ctx.stroke();
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.makeAngularMask = makeAngularMask;
  window.RPG.drawVisionCone = drawVisionCone;
  window.RPG.rotateHandlePos = rotateHandlePos;
  window.RPG.rotateHandleAt = rotateHandleAt;
  window.RPG.drawFacingIndicator = drawFacingIndicator;
})();
