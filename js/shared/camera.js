/* ============================================================
   Shared: camera model (world <-> screen conversion, zoom/pan)
   Used by BOTH index.html (GM) and player.html — loaded before
   js/gm/* and js/player/*. See ARCHITECTURE.md "Load order".

   World-space camera model:
     screenX = (worldX - cam.x) * cam.zoom
     screenY = (worldY - cam.y) * cam.zoom
   cam.x/cam.y = world point at the top-left corner of the screen.
   ============================================================ */

(function() {
  'use strict';

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 6;

  // Build a camera bound to a specific canvas/viewport pair. Each window
  // (GM, player) has its own canvas/viewport, so each calls this once and
  // keeps the returned `cam` object — `zoomAt`/`centerView` take an
  // `afterChange` callback since what happens after (redraw, HUD update)
  // differs between the two windows.
  function createCamera(canvas, viewport) {
    const cam = { x: 0, y: 0, zoom: 1 };

    function screenToWorld(sx, sy) {
      return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
    }

    function eventScreenPos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // zoomAt: always anchored to a screen point (that world point stays
    // fixed under the cursor before/after the zoom).
    function zoomAt(screenX, screenY, factor, afterChange) {
      const before = screenToWorld(screenX, screenY);
      cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
      cam.x = before.x - screenX / cam.zoom;
      cam.y = before.y - screenY / cam.zoom;
      if (afterChange) afterChange();
    }

    function centerView(afterChange) {
      cam.zoom = 1;
      cam.x = -viewport.clientWidth / 2;
      cam.y = -viewport.clientHeight / 2;
      if (afterChange) afterChange();
    }

    return { cam, screenToWorld, eventScreenPos, zoomAt, centerView };
  }

  window.RPG = window.RPG || {};
  window.RPG.MIN_ZOOM = MIN_ZOOM;
  window.RPG.MAX_ZOOM = MAX_ZOOM;
  window.RPG.createCamera = createCamera;
})();
