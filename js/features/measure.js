/* ============================================================
   Measure: distance measurement tool with grid-based meters
   Core system: click any point on the plane to measure. Two modes:
   - Started on a token: click-click — the line follows the mouse
     freely (no need to hold the button) until a second click locks
     the arrow between the two points.
   - Started on empty space: hold-and-drag — the line only exists
     while the left button is held, and disappears on release.
   Token snapping is an extra layered on top of the free-point core —
   clicking on a token uses its center and highlights it.
   ============================================================ */

(function() {
  'use strict';

  const measureState = {
    active: false,   // true while a line should be drawn (following mouse OR locked)
    locked: false,   // true when the line is a persistent click-click link
    freeDrag: false, // true when this measurement started on empty space (hold-and-drag mode)
    startX: 0, startY: 0,
    curX: 0, curY: 0,
    startTokenId: null,
    endTokenId: null,
  };

  // Expose to window.RPG
  window.RPG = window.RPG || {};
  window.RPG.measureState = measureState;

  // Calculate distance in grid squares (meters)
  function getDistanceInMeters(x1, y1, x2, y2, gridSize) {
    const dx = (x2 - x1) / gridSize;
    const dy = (y2 - y1) / gridSize;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Handle a click while measure mode is active (mousedown). worldX/worldY is
  // the click point in world space; token is the hit token (or null if
  // clicked empty space) — when present, its center is used and it gets
  // highlighted.
  window.RPG.measureClick = function(worldX, worldY, token) {
    if (!measureState.active) {
      // No measurement in progress: any click (point or token) starts one.
      // Starting on a token enables click-click mode; starting on empty
      // space enables hold-and-drag mode (line disappears on release).
      measureState.active = true;
      measureState.locked = false;
      measureState.freeDrag = !token;
      measureState.startX = token ? token.x : worldX;
      measureState.startY = token ? token.y : worldY;
      measureState.curX = measureState.startX;
      measureState.curY = measureState.startY;
      measureState.startTokenId = token ? token.id : null;
      measureState.endTokenId = null;
      return;
    }

    // A measurement is in progress (click-click mode only — freeDrag
    // measurements are finalized via measureRelease instead): this click
    // finalizes it, unless it re-clicks the exact same start token (then
    // cancel instead).
    if (measureState.freeDrag) return;

    if (token && token.id === measureState.startTokenId) {
      window.RPG.measureEnd();
      return;
    }

    measureState.curX = token ? token.x : worldX;
    measureState.curY = token ? token.y : worldY;
    measureState.endTokenId = token ? token.id : null;
    measureState.locked = true;
  };

  // Update live cursor position while the line is following the mouse
  window.RPG.measureUpdate = function(worldX, worldY) {
    if (!measureState.active || measureState.locked) return;
    measureState.curX = worldX;
    measureState.curY = worldY;
  };

  // Release the left mouse button — only relevant for hold-and-drag
  // measurements (started on empty space), which disappear on release.
  window.RPG.measureRelease = function() {
    if (measureState.active && measureState.freeDrag) {
      window.RPG.measureEnd();
    }
  };

  // Clear any active/locked measurement (e.g. toggling the tool off, starting a new one)
  window.RPG.measureEnd = function() {
    measureState.active = false;
    measureState.locked = false;
    measureState.freeDrag = false;
    measureState.startTokenId = null;
    measureState.endTokenId = null;
  };

  // Draw measurement on canvas
  window.RPG.drawMeasure = function(ctx, state, cam) {
    if (!measureState.active) return;

    const sx = measureState.startX;
    const sy = measureState.startY;
    const cx = measureState.curX;
    const cy = measureState.curY;

    const distance = getDistanceInMeters(sx, sy, cx, cy, state.grid.size);
    const lineWidth = measureState.locked ? 3 / cam.zoom : 2 / cam.zoom;

    // Draw line
    ctx.strokeStyle = '#45ff78';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Draw arrowhead at end
    const angle = Math.atan2(cy - sy, cx - sx);
    const arrowLength = 10 / cam.zoom;
    const arrowAngle = Math.PI / 6;

    const arrowX = cx - arrowLength * Math.cos(angle);
    const arrowY = cy - arrowLength * Math.sin(angle);

    ctx.fillStyle = '#45ff78';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(arrowX + arrowLength * Math.cos(angle + arrowAngle), arrowY + arrowLength * Math.sin(angle + arrowAngle));
    ctx.lineTo(arrowX + arrowLength * Math.cos(angle - arrowAngle), arrowY + arrowLength * Math.sin(angle - arrowAngle));
    ctx.closePath();
    ctx.fill();

    // Draw start point
    ctx.fillStyle = '#45ff78';
    ctx.beginPath();
    ctx.arc(sx, sy, 3 / cam.zoom, 0, Math.PI * 2);
    ctx.fill();

    // Draw distance text
    const midX = (sx + cx) / 2;
    const midY = (sy + cy) / 2;
    const offsetDist = 15 / cam.zoom;
    const perpAngle = angle + Math.PI / 2;
    const textX = midX + Math.cos(perpAngle) * offsetDist;
    const textY = midY + Math.sin(perpAngle) * offsetDist;

    const text = distance.toFixed(1) + 'm';
    const fontSize = Math.max(12, 14 / cam.zoom);
    ctx.font = `${fontSize}px "VT323", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4 / cam.zoom;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(text, textX, textY);
    ctx.fillStyle = '#45ff78';
    ctx.fillText(text, textX, textY);

    // Draw highlight on start/end tokens when locked
    if (measureState.locked) {
      [measureState.startTokenId, measureState.endTokenId].forEach((tokenId) => {
        const token = state.tokens.find(t => t.id === tokenId);
        if (!token) return;
        ctx.beginPath();
        ctx.arc(token.x, token.y, token.r + 4 / cam.zoom, 0, Math.PI * 2);
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeStyle = '#ffff00';
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
  };
})();
