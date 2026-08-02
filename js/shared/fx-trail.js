/* ============================================================
   FX trail: purely cosmetic, transient visual effects (explosion, fire,
   smoke) placed by the GM at a world point. Never touches tokens, walls, or
   fog — self-expiring after a fixed lifetime, drawn on top of everything
   else. Used by BOTH windows: the GM spawns locally + broadcasts an
   'rpg-fx' postMessage (js/gm/sync.js sends it, js/player/sync.js listens),
   the player spawns the same effect on receipt. Shared here (not
   js/features/*) because both windows need identical spawn/update/draw
   logic to stay visually in sync.
   ============================================================ */

(() => {
  'use strict';

  // Each definition: base duration in ms, and a draw(ctx, cx, cy, t, cam, scale)
  // function where t is progress 0→1 over the effect's lifetime and scale is
  // a size multiplier (1 = base size) — GM-adjustable per spawn via the
  // right-click size/duration popup (js/gm/fx-settings.js).
  const FX_TYPES = {
    explosion: {
      label: '💥 Explosão',
      duration: 700,
      draw(ctx, cx, cy, t, cam, scale) {
        const maxR = 60 * scale;
        const r = maxR * Math.sin(t * Math.PI * 0.5);
        const alpha = 1 - t;
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,200,0.95)');
        grad.addColorStop(0.4, 'rgba(255,150,40,0.85)');
        grad.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    },
    fire: {
      label: '🔥 Fogo',
      duration: 1400,
      draw(ctx, cx, cy, t, cam, scale) {
        const flicker = 0.85 + 0.15 * Math.sin(t * 40);
        const h = 34 * flicker * (1 - 0.3 * t) * scale;
        const w = 20 * flicker * scale;
        const alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy - h * 0.3, h);
        grad.addColorStop(0, 'rgba(255,240,150,0.95)');
        grad.addColorStop(0.5, 'rgba(255,120,30,0.85)');
        grad.addColorStop(1, 'rgba(180,30,10,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy - h * 0.35, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    },
    smoke: {
      label: '💨 Fumaça',
      duration: 2200,
      draw(ctx, cx, cy, t, cam, scale) {
        const r = (14 + 46 * t) * scale;
        const rise = 30 * t * scale;
        const alpha = 0.5 * (1 - t);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(150,150,150,0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy - rise, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    },
    heal: {
      label: '✨ Cura',
      duration: 900,
      draw(ctx, cx, cy, t, cam, scale) {
        const r = 40 * t * scale;
        const alpha = 1 - t;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(120,255,180,0.9)';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        // small cross sparkle at center, fading in the first half
        if (t < 0.6) {
          const crossAlpha = 1 - t / 0.6;
          ctx.globalAlpha = crossAlpha;
          ctx.strokeStyle = 'rgba(220,255,230,0.95)';
          ctx.lineWidth = 2 / cam.zoom;
          const s = 10 * scale;
          ctx.beginPath();
          ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
          ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
          ctx.stroke();
        }
        ctx.restore();
      },
    },
  };

  // Active effect instances: { type, x, y, startedAt, duration, scale }. Pruned lazily on draw.
  const activeFx = [];

  function spawnFx(type, x, y, opts) {
    const def = FX_TYPES[type];
    if (!def) return;
    const scale = (opts && opts.scale) || 1;
    const durationMult = (opts && opts.durationMult) || 1;
    activeFx.push({ type, x, y, startedAt: performance.now(), duration: def.duration * durationMult, scale });
  }

  function drawFx(ctx, cam) {
    if (activeFx.length === 0) return;
    const now = performance.now();
    for (let i = activeFx.length - 1; i >= 0; i--) {
      const fx = activeFx[i];
      const def = FX_TYPES[fx.type];
      const t = (now - fx.startedAt) / fx.duration;
      if (t >= 1) { activeFx.splice(i, 1); continue; }
      def.draw(ctx, fx.x, fx.y, t, cam, fx.scale);
    }
  }

  function hasActiveFx() {
    return activeFx.length > 0;
  }

  // ---------- Animation driver ----------
  // draw() is normally event-driven only (no game loop) — while any fx is
  // active, keep calling it every frame so the animation actually plays,
  // then stop once the last effect expires.
  let rafId = null;
  function tick() {
    rafId = null;
    if (window.RPG.draw) window.RPG.draw();
    if (hasActiveFx()) rafId = requestAnimationFrame(tick);
  }
  function ensureFxLoop() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  // ---------- Expose to window.RPG ----------
  window.RPG = window.RPG || {};
  window.RPG.FX_TYPES = FX_TYPES;
  window.RPG.spawnFx = (type, x, y, opts) => { spawnFx(type, x, y, opts); ensureFxLoop(); };
  window.RPG.drawFx = drawFx;
  window.RPG.hasActiveFx = hasActiveFx;
})();
