/* ============================================================
   Player frozen exploration memory: a world-space canvas (fixed scale,
   independent of the live camera) that stores the last-seen appearance of
   every explored cell. Grows/re-anchors its origin on demand.
   See ARCHITECTURE.md "Vision & fog of war" > "Frozen exploration memory".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
  const EXPLORED_CELL = window.RPG.EXPLORED_CELL;
  const MEMORY_SCALE = window.RPG.MEMORY_SCALE;
  const MEMORY_MARGIN_CELLS = window.RPG.MEMORY_MARGIN_CELLS;
  const exploredCells = window.RPG.exploredCells;
  const drawMapAndGrid = window.RPG.drawMapAndGrid;
  const drawTokenBasic = window.RPG.drawTokenBasic;

  let memoryLayer = null, memoryLayerCtx = null;
  let memoryOriginCx = 0, memoryOriginCy = 0;   // world cell coords of the canvas's top-left
  let memoryColsCells = 0, memoryRowsCells = 0; // current canvas size, in cells

  function memoryCellToPx(cx, cy) {
    return {
      x: (cx - memoryOriginCx) * EXPLORED_CELL * MEMORY_SCALE,
      y: (cy - memoryOriginCy) * EXPLORED_CELL * MEMORY_SCALE,
    };
  }

  // Ensure the memory canvas covers cell (cx, cy), growing/re-anchoring (and
  // copying old content across) if it doesn't yet.
  function ensureMemoryCovers(cx, cy) {
    if (!memoryLayer) {
      memoryLayer = document.createElement('canvas');
      memoryLayerCtx = memoryLayer.getContext('2d');
      memoryOriginCx = cx - MEMORY_MARGIN_CELLS;
      memoryOriginCy = cy - MEMORY_MARGIN_CELLS;
      memoryColsCells = MEMORY_MARGIN_CELLS * 2 + 1;
      memoryRowsCells = MEMORY_MARGIN_CELLS * 2 + 1;
      memoryLayer.width = Math.ceil(memoryColsCells * EXPLORED_CELL * MEMORY_SCALE);
      memoryLayer.height = Math.ceil(memoryRowsCells * EXPLORED_CELL * MEMORY_SCALE);
      return;
    }

    const withinCols = cx >= memoryOriginCx && cx < memoryOriginCx + memoryColsCells;
    const withinRows = cy >= memoryOriginCy && cy < memoryOriginCy + memoryRowsCells;
    if (withinCols && withinRows) return;

    const newOriginCx = Math.min(memoryOriginCx, cx - MEMORY_MARGIN_CELLS);
    const newOriginCy = Math.min(memoryOriginCy, cy - MEMORY_MARGIN_CELLS);
    const newMaxCx = Math.max(memoryOriginCx + memoryColsCells, cx + MEMORY_MARGIN_CELLS + 1);
    const newMaxCy = Math.max(memoryOriginCy + memoryRowsCells, cy + MEMORY_MARGIN_CELLS + 1);
    const newCols = newMaxCx - newOriginCx;
    const newRows = newMaxCy - newOriginCy;

    const grown = document.createElement('canvas');
    grown.width = Math.ceil(newCols * EXPLORED_CELL * MEMORY_SCALE);
    grown.height = Math.ceil(newRows * EXPLORED_CELL * MEMORY_SCALE);
    const gctx = grown.getContext('2d');
    const offX = (memoryOriginCx - newOriginCx) * EXPLORED_CELL * MEMORY_SCALE;
    const offY = (memoryOriginCy - newOriginCy) * EXPLORED_CELL * MEMORY_SCALE;
    gctx.drawImage(memoryLayer, offX, offY);

    memoryLayer = grown;
    memoryLayerCtx = gctx;
    memoryOriginCx = newOriginCx;
    memoryOriginCy = newOriginCy;
    memoryColsCells = newCols;
    memoryRowsCells = newRows;
  }

  // Render one explored cell's world-space patch (map + grid + basic tokens)
  // directly into the memory canvas at its fixed world scale. `observerId`
  // (the token whose cone is doing the seeing) is excluded from its own
  // snapshot — a token can't see itself standing in a room from the outside,
  // and it's the one token guaranteed to always be live/on-screen anyway.
  function renderCellSnapshot(cx, cy, observerId) {
    const wx0 = cx * EXPLORED_CELL, wy0 = cy * EXPLORED_CELL;
    const p = memoryCellToPx(cx, cy);
    const cellPx = EXPLORED_CELL * MEMORY_SCALE;

    memoryLayerCtx.save();
    memoryLayerCtx.beginPath();
    memoryLayerCtx.rect(p.x, p.y, cellPx, cellPx);
    memoryLayerCtx.clip();
    memoryLayerCtx.clearRect(p.x, p.y, cellPx, cellPx);
    memoryLayerCtx.setTransform(MEMORY_SCALE, 0, 0, MEMORY_SCALE, p.x - wx0 * MEMORY_SCALE, p.y - wy0 * MEMORY_SCALE);
    drawMapAndGrid(memoryLayerCtx, wx0, wy0, wx0 + EXPLORED_CELL, wy0 + EXPLORED_CELL, MEMORY_SCALE);
    for (const t of state.tokens) {
      if (t.id === observerId) continue;
      if (t.x + t.r < wx0 || t.x - t.r > wx0 + EXPLORED_CELL) continue;
      if (t.y + t.r < wy0 || t.y - t.r > wy0 + EXPLORED_CELL) continue;
      drawTokenBasic(memoryLayerCtx, t, MEMORY_SCALE);
    }
    memoryLayerCtx.restore();
  }

  // Clear all exploration state — used when the map changes/is removed, since
  // previously-recorded world coordinates no longer correspond to anything.
  function resetExplorationMemory() {
    exploredCells.clear();
    memoryLayer = null;
    memoryLayerCtx = null;
    memoryOriginCx = 0;
    memoryOriginCy = 0;
    memoryColsCells = 0;
    memoryRowsCells = 0;
  }

  // Paint one explored cell's frozen memory patch onto `fx` (fog layer, identity
  // transform) at its current SCREEN position (world cell -> screen via cam/s).
  function drawMemoryCellPatch(fx, cx, cy, s) {
    if (!memoryLayer) return;
    if (cx < memoryOriginCx || cx >= memoryOriginCx + memoryColsCells) return;
    if (cy < memoryOriginCy || cy >= memoryOriginCy + memoryRowsCells) return;
    const src = memoryCellToPx(cx, cy);
    const srcSize = EXPLORED_CELL * MEMORY_SCALE;
    const wx0 = cx * EXPLORED_CELL, wy0 = cy * EXPLORED_CELL;
    const dstX = (wx0 - cam.x) * s;
    const dstY = (wy0 - cam.y) * s;
    const dstSize = EXPLORED_CELL * s;
    fx.drawImage(memoryLayer, src.x, src.y, srcSize, srcSize, dstX, dstY, dstSize, dstSize);
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.ensureMemoryCovers = ensureMemoryCovers;
  window.RPG.renderCellSnapshot = renderCellSnapshot;
  window.RPG.resetExplorationMemory = resetExplorationMemory;
  window.RPG.drawMemoryCellPatch = drawMemoryCellPatch;
  window.RPG.getMemoryLayer = () => memoryLayer;
})();
