/* ============================================================
   Camera: world-to-screen coordinate conversion and camera control
   ============================================================ */

(function() {
  'use strict';

  const cam = { x: 0, y: 0, zoom: 1 };

  function screenToWorld(sx, sy) {
    return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
  }

  function eventScreenPos(e) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function zoomAt(screenX, screenY, factor) {
    const before = screenToWorld(screenX, screenY);
    cam.zoom = Math.min(window.RPG.MAX_ZOOM, Math.max(window.RPG.MIN_ZOOM, cam.zoom * factor));
    cam.x = before.x - screenX / cam.zoom;
    cam.y = before.y - screenY / cam.zoom;
  }

  function centerView(viewport) {
    cam.zoom = 1;
    cam.x = -viewport.clientWidth / 2;
    cam.y = -viewport.clientHeight / 2;
  }

  // Expose via shared namespace
  window.RPG = window.RPG || {};
  window.RPG.cam = cam;
  window.RPG.screenToWorld = screenToWorld;
  window.RPG.eventScreenPos = eventScreenPos;
  window.RPG.zoomAt = zoomAt;
  window.RPG.centerView = centerView;
})();
