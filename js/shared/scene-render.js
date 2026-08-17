/* ============================================================
   Shared: basic map/grid/token rendering, used by BOTH windows.

   drawTokenBasic draws ONLY the circle/ring/initials/name — no bars, no
   effect dots. This is deliberately the subset the player's frozen
   exploration-memory snapshot uses (see js/player/memory.js) — HP bars and
   applied effects are live combat state that shouldn't linger stale in a
   memory snapshot. The GM's live draw() also uses it for the same shape,
   then layers bars/effects on top itself.
   ============================================================ */

(function() {
  'use strict';

  // `getState` returns the CURRENT state object (a function, not the object
  // itself, since the GM side reassigns `state.tokens`/`state.map`/etc. as
  // scenes switch — callers must always read live values, not a snapshot).
  // `getTokenPhotoImg`/`contrastColor` come from js/shared/photo-cache.js.
  function createSceneRenderer(getState, getTokenPhotoImg, contrastColor) {
    // Draw the map + grid onto any 2D context using WORLD coordinates (caller
    // sets the transform). `lineScale` = current world-to-device scale (so
    // 1px-wide strokes stay 1 device-px regardless of who's calling: the
    // live view at cam.zoom, or a frozen memory snapshot at MEMORY_SCALE).
    function drawMapAndGrid(octx, wl, wt, wr, wb, lineScale) {
      const state = getState();
      let mapL = null, mapT = null, mapR = null, mapB = null;
      if (state.map.img) {
        const img = state.map.img;
        const scale = state.map.scalePct / 100;
        const mw = img.naturalWidth * scale;
        const mh = img.naturalHeight * scale;
        mapL = -mw / 2; mapT = -mh / 2; mapR = mw / 2; mapB = mh / 2;
        octx.drawImage(img, mapL, mapT, mw, mh);
      }

      if (state.grid.show) {
        // The grid belongs to the MAP, not the viewport — clamp it to the map
        // image's world rect so it never bleeds out over the empty background
        // (where it reads as UI clutter behind the floating toolbars). With no
        // map loaded there's nothing to clamp to, so fall back to the viewport.
        const gl = mapL === null ? wl : Math.max(wl, mapL);
        const gt = mapT === null ? wt : Math.max(wt, mapT);
        const gr = mapR === null ? wr : Math.min(wr, mapR);
        const gb = mapB === null ? wb : Math.min(wb, mapB);

        if (gr > gl && gb > gt) {
          const g = state.grid.size;
          octx.strokeStyle = state.grid.color || (window.RPG.getThemeGridColor ? window.RPG.getThemeGridColor() : '#45ff78');
          octx.globalAlpha = 0.3;
          octx.lineWidth = 1 / lineScale;
          octx.beginPath();
          const x0 = Math.ceil(gl / g) * g;
          const y0 = Math.ceil(gt / g) * g;
          for (let x = x0; x <= gr; x += g) { octx.moveTo(x, gt); octx.lineTo(x, gb); }
          for (let y = y0; y <= gb; y += g) { octx.moveTo(gl, y); octx.lineTo(gr, y); }
          octx.stroke();
          octx.globalAlpha = 1;
        }
      }
    }

    // Basic token appearance only: circle (photo/color), turn ring, initials,
    // name. `lineScale` = current world-to-device scale (cam.zoom for the
    // live view, MEMORY_SCALE for a frozen snapshot).
    function drawTokenBasic(octx, t, lineScale) {
      const state = getState();
      const photo = getTokenPhotoImg(t);

      octx.save();
      octx.beginPath();
      octx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      if (photo) {
        octx.clip();
        octx.drawImage(photo, t.x - t.r, t.y - t.r, t.r * 2, t.r * 2);
      } else {
        octx.fillStyle = t.color;
        octx.fill();
      }
      octx.restore();

      const isCurrentTurn = state.combat.active && state.combat.order[0] === t.id;

      octx.beginPath();
      octx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      octx.lineWidth = (isCurrentTurn ? 4 : 2) / lineScale;
      octx.strokeStyle = isCurrentTurn ? '#ff9f45' : (photo ? t.color : 'rgba(0,0,0,0.5)');
      octx.stroke();

      if (!photo && t.name) {
        octx.font = `${Math.max(12, t.r * 0.7)}px "VT323", monospace`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillStyle = contrastColor(t.color);
        octx.fillText(t.name.slice(0, 2).toUpperCase(), t.x, t.y);
      }

      if (t.name) {
        octx.font = `${Math.max(14, t.r * 0.6)}px "VT323", monospace`;
        octx.textAlign = 'center';
        octx.textBaseline = 'top';
        const labelY = t.y + t.r + 4 / lineScale;
        octx.lineWidth = 3 / lineScale;
        octx.strokeStyle = 'rgba(0,0,0,0.8)';
        octx.strokeText(t.name, t.x, labelY);
        octx.fillStyle = '#ffffff';
        octx.fillText(t.name, t.x, labelY);
      }
    }

    return { drawMapAndGrid, drawTokenBasic };
  }

  window.RPG = window.RPG || {};
  window.RPG.createSceneRenderer = createSceneRenderer;
})();
