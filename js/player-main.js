
(() => {
  'use strict';

  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 6;
  const MAX_ACTIVE_BARS = 2;
  const BASE_VISION_RANGE = 320;  // must match the master
  const EXPLORED_CELL = 48;       // world-px grid used to remember explored ground
  const EXPLORED_DIM_ALPHA = 0.55; // fog opacity over explored-but-not-visible ground (0 = clear, 1 = opaque)
  const MEMORY_SCALE = 0.5;       // memory canvas px per world px (kept < 1 to bound its size)
  const MEMORY_MARGIN_CELLS = 8;  // extra cells of headroom when the memory canvas grows

  // Cells a player token has ever seen, keyed by "cellX,cellY" (world grid coords).
  // Persists for the life of the tab — never cleared, so exploration accumulates
  // like classic fog-of-war memory: once seen, a cell keeps showing a FROZEN
  // snapshot of what was there (map + tokens) at the moment it was last inside a
  // vision cone — not the live scene. Only cells currently inside a cone show the
  // live scene; stepping away freezes that cell's last look until re-visited.
  const exploredCells = new Set();

  const cam = { x: 0, y: 0, zoom: 1 };

  const state = {
    grid: { show: true, size: 48, color: '#45ff78' },
    map: { img: null, scalePct: 100 },
    tokens: [],
    fog: [],
    walls: [],   // GM-only line-of-sight blockers: {id, x1, y1, x2, y2}, used only to occlude vision here
    combat: { active: false, order: [] },
    partyBars: [],
    lighting: 1,
    wallOcclusionMethod: 'cell',  // 'cell' (grid-snapped, cheap) | 'raycast' (precise shadow polygon)
    activeVisionTokenId: null,    // only this player token's cone reveals/updates fog
  };

  const drag = {
    active: false,
    startScreenX: 0, startScreenY: 0,
    camStartX: 0, camStartY: 0,
  };

  // ---------- Canvas sizing ----------
  let dpr = 1;
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport.clientWidth * dpr);
    canvas.height = Math.round(viewport.clientHeight * dpr);
    draw();
  }
  window.addEventListener('resize', resizeCanvas);

  function screenToWorld(sx, sy) {
    return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
  }
  function eventScreenPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function zoomAt(screenX, screenY, factor) {
    const before = screenToWorld(screenX, screenY);
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
    cam.x = before.x - screenX / cam.zoom;
    cam.y = before.y - screenY / cam.zoom;
    draw();
  }

  function centerView() {
    cam.zoom = 1;
    cam.x = -viewport.clientWidth / 2;
    cam.y = -viewport.clientHeight / 2;
    draw();
  }

  // Draw the map + grid onto any 2D context using WORLD coordinates (caller sets
  // the transform). Shared by the live view and the frozen memory snapshot.
  // `lineScale` = current world-to-device scale (so 1px-wide strokes stay 1
  // device-px regardless of who's calling: the live view at cam.zoom, or the
  // memory snapshot at MEMORY_SCALE).
  function drawMapAndGrid(octx, wl, wt, wr, wb, lineScale) {
    if (state.map.img) {
      const img = state.map.img;
      const scale = state.map.scalePct / 100;
      const mw = img.naturalWidth * scale;
      const mh = img.naturalHeight * scale;
      octx.drawImage(img, -mw / 2, -mh / 2, mw, mh);
    }

    if (state.grid.show) {
      const g = state.grid.size;
      octx.strokeStyle = state.grid.color;
      octx.globalAlpha = 0.3;
      octx.lineWidth = 1 / lineScale;
      octx.beginPath();
      const x0 = Math.floor(wl / g) * g;
      const y0 = Math.floor(wt / g) * g;
      for (let x = x0; x <= wr; x += g) { octx.moveTo(x, wt); octx.lineTo(x, wb); }
      for (let y = y0; y <= wb; y += g) { octx.moveTo(wl, y); octx.lineTo(wr, y); }
      octx.stroke();
      octx.globalAlpha = 1;
    }
  }

  // Basic token appearance only: circle (photo/color), turn ring, initials, name.
  // No bars/effects — this is what gets frozen into the explored-memory snapshot,
  // since HP/effects are live combat data that shouldn't linger stale in memory.
  // `lineScale` = current world-to-device scale (cam.zoom for the live view,
  // MEMORY_SCALE for the frozen snapshot) so strokes/fonts size consistently.
  function drawTokenBasic(octx, t, lineScale) {
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

  // ---------- Drawing (same renderer as the master) ----------
  function draw() {
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

    drawMapAndGrid(ctx, wl, wt, wr, wb, cam.zoom);

    for (const t of state.tokens) {
      drawTokenBasic(ctx, t, cam.zoom);
      drawTokenBars(t);
    }

    // fog of war = the area OUTSIDE the players' vision. The live scene above is
    // covered by an opaque fog layer, with two kinds of holes punched into it:
    //   - the CURRENT vision cone: a true hole (destination-out) → the live scene
    //     underneath shows through, fully up to date.
    //   - previously-explored cells NOT currently in a cone: instead of a hole,
    //     we paint a FROZEN snapshot of that cell (map + tokens as they looked the
    //     last time a cone covered them) so tokens/changes that happened after the
    //     party left stay hidden until re-visited — only re-entering the cone
    //     refreshes that cell's snapshot.
    if (state.fog.length > 0) {
      // Only the GM-selected "active" player token projects a cone / reveals
      // fog — with several party members, the others stay dormant until picked.
      const playerTokens = state.tokens.filter(t => t.isPlayer && t.id === state.activeVisionTokenId);
      // mark cells explored AND freeze a fresh snapshot for cells inside a cone
      // right now (basic tokens only — no bars — memory freezes appearance,
      // not live combat stats)
      for (const t of playerTokens) visitTokenVision(t);

      const fx = getFogLayer(w, h);
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.clearRect(0, 0, w, h);
      fx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = '#000000';
      for (const f of state.fog) fx.fillRect(f.x, f.y, f.w, f.h);

      // paste the frozen memory (dimmed) over explored fog cells
      if (exploredCells.size > 0 && memoryLayer) {
        fx.save();
        fx.globalAlpha = EXPLORED_DIM_ALPHA;
        fx.setTransform(1, 0, 0, 1, 0, 0);
        for (const f of state.fog) {
          const minCx = Math.floor(f.x / EXPLORED_CELL);
          const maxCx = Math.floor((f.x + f.w) / EXPLORED_CELL);
          const minCy = Math.floor(f.y / EXPLORED_CELL);
          const maxCy = Math.floor((f.y + f.h) / EXPLORED_CELL);
          for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
              const key = cx + ',' + cy;
              if (!exploredCells.has(key)) continue;
              drawMemoryCellPatch(fx, cx, cy, s);
            }
          }
        }
        fx.restore();
        fx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
      }

      // punch the CURRENT cone out as a true hole — live scene shows through
      fx.globalCompositeOperation = 'destination-out';
      for (const t of playerTokens) {
        punchVisionCone(fx, t);
      }

      // composite the fog (+ memory patches, + cone hole) over the live scene
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fogLayer, 0, 0);
      ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    }
  }

  // ---------- Wall occlusion (line of sight) ----------
  // True if segments (x1,y1)-(x2,y2) and (x3,y3)-(x4,y4) cross.
  function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const d1x = x2 - x1, d1y = y2 - y1;
    const d2x = x4 - x3, d2y = y4 - y3;
    const denom = d1x * d2y - d1y * d2x;
    if (denom === 0) return false;  // parallel (ignore exact-collinear edge case)
    const t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / denom;
    const u = ((x3 - x1) * d1y - (y3 - y1) * d1x) / denom;
    return t > 0 && t < 1 && u > 0 && u < 1;
  }

  // 'cell' method: is the straight line from the token to (wx, wy) blocked by
  // any wall? Cheap per-cell test, snapped to EXPLORED_CELL — occlusion reads
  // as grid-blocky rather than a precise wall silhouette.
  function lineBlockedByWalls(t, wx, wy) {
    for (const wall of state.walls) {
      if (segmentsIntersect(t.x, t.y, wx, wy, wall.x1, wall.y1, wall.x2, wall.y2)) return true;
    }
    return false;
  }

  // Visit every grid cell inside a token's current vision cone: mark it explored
  // and freeze a fresh snapshot of it into the memory canvas. Approximate cone
  // shape (cell center within reach + angular half-width) — exact feathering
  // doesn't matter here, only which ground has been revealed and needs re-stamping.
  // Walls occlude per-cell (token→cell-center line of sight) regardless of the
  // active wallOcclusionMethod — exploration memory always uses the cheap test;
  // 'raycast' only affects the live cone's visual edge (see punchVisionCone).
  function visitTokenVision(t) {
    const reach = tokenVisionReach(t);
    if (reach <= t.r) return;
    const angle = (typeof t.visionAngle === 'number') ? t.visionAngle : 120;
    const facing = (typeof t.facing === 'number') ? t.facing : -Math.PI / 2;
    const half = (angle * Math.PI / 180) / 2;
    const full = angle >= 360;
    // the cell the token's own body stands on is always visited, regardless of
    // facing/angle — a narrow cone still shouldn't leave its own square dark
    const ownCx = Math.floor(t.x / EXPLORED_CELL);
    const ownCy = Math.floor(t.y / EXPLORED_CELL);

    const minCx = Math.floor((t.x - reach) / EXPLORED_CELL);
    const maxCx = Math.floor((t.x + reach) / EXPLORED_CELL);
    const minCy = Math.floor((t.y - reach) / EXPLORED_CELL);
    const maxCy = Math.floor((t.y + reach) / EXPLORED_CELL);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const isOwnCell = cx === ownCx && cy === ownCy;
        const wx = (cx + 0.5) * EXPLORED_CELL;
        const wy = (cy + 0.5) * EXPLORED_CELL;
        if (!isOwnCell) {
          const dx = wx - t.x, dy = wy - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > reach) continue;
          if (!full) {
            const ang = Math.atan2(dy, dx);
            let diff = Math.abs(ang - facing) % (Math.PI * 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff > half) continue;
          }
          if (state.walls.length > 0 && lineBlockedByWalls(t, wx, wy)) continue;
        }
        exploredCells.add(cx + ',' + cy);
        ensureMemoryCovers(cx, cy);
        renderCellSnapshot(cx, cy, t.id);
      }
    }
  }

  // Punch a token's vision cone out of the (destination-out) fog layer, with a
  // soft falloff on EVERY side — radially toward the outer rim (front) AND
  // angularly toward both straight edges.
  //
  // The cone's alpha envelope is built on a separate mask layer, then stamped
  // into the fog with destination-out. The radial (front) fade is a gradient;
  // the angular (side) fade is a conic-gradient mask applied with
  // 'destination-in', giving a perfectly smooth edge with no wedge seams.
  function punchVisionCone(fx, t) {
    const reach = tokenVisionReach(t);
    if (reach <= t.r) return;
    const angle = (typeof t.visionAngle === 'number') ? t.visionAngle : 120;
    const facing = (typeof t.facing === 'number') ? t.facing : -Math.PI / 2;

    const mkRadial = (c) => {
      const g = c.createRadialGradient(t.x, t.y, t.r * 0.5, t.x, t.y, reach);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.82, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      return g;
    };

    // build the cone alpha envelope on the mask layer, matching fx's transform
    const mc = getConeMask(fogLayer.width, fogLayer.height);
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.clearRect(0, 0, coneMask.width, coneMask.height);  // clear in device space
    mc.setTransform(fx.getTransform());
    mc.globalCompositeOperation = 'source-over';

    if (angle >= 360) {
      // full circle: no side edges — radial fade only
      mc.fillStyle = mkRadial(mc);
      mc.beginPath();
      mc.arc(t.x, t.y, reach, 0, Math.PI * 2);
      mc.fill();
    } else {
      const halfA = (angle * Math.PI / 180) / 2;
      const featherFrac = 0.5;
      const mask = makeAngularMask(mc, t.x, t.y, facing, halfA, featherFrac);

      if (mask) {
        // full disc with the radial (front) fade …
        mc.fillStyle = mkRadial(mc);
        mc.beginPath();
        mc.arc(t.x, t.y, reach, 0, Math.PI * 2);
        mc.fill();
        // … then keep only the cone's angular slice (soft side edges)
        mc.globalCompositeOperation = 'destination-in';
        mc.fillStyle = mask;
        mc.beginPath();
        mc.arc(t.x, t.y, reach, 0, Math.PI * 2);
        mc.fill();
        mc.globalCompositeOperation = 'source-over';
        // always reveal a small circle right around the token's own body —
        // even a narrow cone shouldn't leave the ground the token stands on
        // (behind/beside it) dark.
        mc.fillStyle = 'rgba(0,0,0,1)';
        mc.beginPath();
        mc.arc(t.x, t.y, t.r * 2, 0, Math.PI * 2);
        mc.fill();
      } else {
        // fallback: hard-sided sector with the radial front fade only
        mc.fillStyle = mkRadial(mc);
        mc.beginPath();
        mc.moveTo(t.x, t.y);
        mc.arc(t.x, t.y, reach, facing - halfA, facing + halfA);
        mc.closePath();
        mc.fill();
        // same small always-visible circle around the token's own body
        mc.fillStyle = 'rgba(0,0,0,1)';
        mc.beginPath();
        mc.arc(t.x, t.y, t.r * 2, 0, Math.PI * 2);
        mc.fill();
      }
    }

    // occlude the cone mask by walls, if any
    if (state.walls.length > 0) {
      occludeConeMaskByWalls(mc, t, reach);
    }

    // subtract the finished cone mask from the fog (identity transform for the stamp)
    fx.save();
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.drawImage(coneMask, 0, 0);
    fx.restore();
  }

  // Cut the parts of a token's cone mask that walls block from view, using the
  // GM-selected method (state.wallOcclusionMethod):
  //   'cell'    — cheap: erase whole EXPLORED_CELL-sized blocks whose center is
  //               blocked by a wall (same test as exploration memory) — blocky.
  //   'raycast' — precise: cast a ray past each wall endpoint (±a hair) and cut
  //               a shadow polygon behind it — sharp silhouette, costs more.
  // `mc` is already in the same world-space transform as the rest of the cone.
  function occludeConeMaskByWalls(mc, t, reach) {
    if (state.wallOcclusionMethod === 'raycast') {
      occludeConeMaskByRaycast(mc, t, reach);
    } else {
      occludeConeMaskByCell(mc, t, reach);
    }
  }

  function occludeConeMaskByCell(mc, t, reach) {
    const minCx = Math.floor((t.x - reach) / EXPLORED_CELL);
    const maxCx = Math.floor((t.x + reach) / EXPLORED_CELL);
    const minCy = Math.floor((t.y - reach) / EXPLORED_CELL);
    const maxCy = Math.floor((t.y + reach) / EXPLORED_CELL);

    mc.save();
    mc.globalCompositeOperation = 'destination-out';
    mc.fillStyle = '#000000';
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const wx = (cx + 0.5) * EXPLORED_CELL;
        const wy = (cy + 0.5) * EXPLORED_CELL;
        if (!lineBlockedByWalls(t, wx, wy)) continue;
        mc.fillRect(cx * EXPLORED_CELL, cy * EXPLORED_CELL, EXPLORED_CELL, EXPLORED_CELL);
      }
    }
    mc.restore();
  }

  // Cast a shadow behind each wall segment: for a wall (x1,y1)-(x2,y2) seen from
  // `t`, the shadow is the quad formed by the two wall endpoints and their
  // projections out to `reach` (plus a hair past it so the far edge is covered).
  function occludeConeMaskByRaycast(mc, t, reach) {
    const far = reach * 1.5 + 1;  // project shadow well past the cone's rim
    mc.save();
    mc.globalCompositeOperation = 'destination-out';
    mc.fillStyle = '#000000';
    for (const wall of state.walls) {
      const dx1 = wall.x1 - t.x, dy1 = wall.y1 - t.y;
      const dx2 = wall.x2 - t.x, dy2 = wall.y2 - t.y;
      const d1 = Math.hypot(dx1, dy1) || 1;
      const d2 = Math.hypot(dx2, dy2) || 1;
      // skip walls entirely beyond the cone's reach — can't cast a visible shadow
      if (Math.min(d1, d2) > reach) continue;
      const p1x = t.x + (dx1 / d1) * far, p1y = t.y + (dy1 / d1) * far;
      const p2x = t.x + (dx2 / d2) * far, p2y = t.y + (dy2 / d2) * far;
      mc.beginPath();
      mc.moveTo(wall.x1, wall.y1);
      mc.lineTo(p1x, p1y);
      mc.lineTo(p2x, p2y);
      mc.lineTo(wall.x2, wall.y2);
      mc.closePath();
      mc.fill();
    }
    mc.restore();
  }

  // Conic-gradient angular mask centered on `facing`: opaque (black, alpha 1)
  // across the cone core, smoothstep fade to transparent toward each straight
  // edge (±half). Used with 'destination-in' so the cone's sides feather
  // smoothly. Returns null when createConicGradient is unavailable.
  function makeAngularMask(octx, cx, cy, facing, half, featherFrac) {
    if (typeof octx.createConicGradient !== 'function') return null;
    const g = octx.createConicGradient(facing, cx, cy);
    const featherStart = half * (1 - featherFrac);
    const N = 24;
    for (let i = 0; i <= N * 2; i++) {
      const tt = i / (N * 2);
      const ang = tt * Math.PI * 2;
      const off = ang <= Math.PI ? ang : (Math.PI * 2 - ang);  // 0..π, symmetric
      let a;
      if (off <= featherStart) a = 1;
      else if (off >= half) a = 0;
      else { const x = 1 - (off - featherStart) / (half - featherStart); a = x * x * (3 - 2 * x); }
      g.addColorStop(tt, `rgba(0,0,0,${a.toFixed(4)})`);
    }
    return g;
  }

  // reusable offscreen cone-mask layer (sized to the fog layer)
  let coneMask = null, coneMaskCtx = null;
  function getConeMask(w, h) {
    if (!coneMask) { coneMask = document.createElement('canvas'); coneMaskCtx = coneMask.getContext('2d'); }
    if (coneMask.width !== w || coneMask.height !== h) { coneMask.width = w; coneMask.height = h; }
    return coneMaskCtx;
  }

  // reusable offscreen fog layer (sized to the main canvas)
  let fogLayer = null, fogLayerCtx = null;
  function getFogLayer(w, h) {
    if (!fogLayer) { fogLayer = document.createElement('canvas'); fogLayerCtx = fogLayer.getContext('2d'); }
    if (fogLayer.width !== w || fogLayer.height !== h) { fogLayer.width = w; fogLayer.height = h; }
    return fogLayerCtx;
  }

  // ---------- Frozen exploration memory ----------
  // World-space canvas (fixed scale, independent of the live camera) that stores
  // the last-seen appearance of every explored cell. Grows (re-anchoring its
  // origin) on demand as exploration spreads, preserving previously-recorded
  // content. Cell (cx, cy) in EXPLORED_CELL units maps to memory-canvas pixels:
  //   px = (cx - memoryOriginCx) * EXPLORED_CELL * MEMORY_SCALE
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

  // Total world-px reach of a token's vision cone (mirrors the master).
  function tokenVisionReach(t) {
    const mult = (typeof t.visionMult === 'number') ? t.visionMult : 1;
    return t.r + BASE_VISION_RANGE * state.lighting * mult;
  }

  const photoImgCache = new Map();
  function getTokenPhotoImg(t) {
    if (!t.photoDataUrl) return null;
    let img = photoImgCache.get(t.photoDataUrl);
    if (!img) {
      img = new Image();
      img.onload = () => draw();
      img.src = t.photoDataUrl;
      photoImgCache.set(t.photoDataUrl, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  function contrastColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#ffffff';
  }

  // mini status bars for a player token; only "active" universal bars render, each in its own display mode
  function drawTokenBars(t) {
    if (!t.isPlayer || !state.partyBars) return;
    const vals = t.barValues || {};
    const activeBars = state.partyBars.filter(d => d.active).slice(0, MAX_ACTIVE_BARS);
    if (activeBars.length === 0) return;

    const barPct = (def) => {
      const v = vals[def.id] || { current: def.defaultMax, max: def.defaultMax };
      return v.max > 0 ? Math.max(0, Math.min(1, v.current / v.max)) : 0;
    };

    let horizIdx = 0, vertLeftIdx = 0, vertRightIdx = 0, radialIdx = 0;
    for (const def of activeBars) {
      const pct = barPct(def);
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

  function drawHorizontalBar(t, def, pct, idx) {
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

  function drawVerticalBar(t, def, pct, idx, onLeft) {
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

  function drawRadialBar(t, def, pct, idx) {
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

  // ---------- View-only interaction: middle-drag pan + scroll zoom ----------
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 1 && e.button !== 0) return;
    e.preventDefault();
    const sp = eventScreenPos(e);
    drag.active = true;
    drag.startScreenX = sp.x;
    drag.startScreenY = sp.y;
    drag.camStartX = cam.x;
    drag.camStartY = cam.y;
    canvas.classList.add('panning');
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag.active) return;
    const sp = eventScreenPos(e);
    cam.x = drag.camStartX - (sp.x - drag.startScreenX) / cam.zoom;
    cam.y = drag.camStartY - (sp.y - drag.startScreenY) / cam.zoom;
    draw();
  });

  window.addEventListener('mouseup', () => {
    drag.active = false;
    canvas.classList.remove('panning');
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sp = eventScreenPos(e);
    zoomAt(sp.x, sp.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // ---------- Combat bar (read-only timeline) ----------
  const combatBar = document.getElementById('combatBar');
  const combatBarTrack = document.getElementById('combatBar-track');
  const combatBarTokens = document.getElementById('combatBar-tokens');

  function renderCombatBar() {
    combatBar.classList.toggle('open', !!state.combat.active);
    combatBarTokens.innerHTML = '';
    const TOKEN_SIZE = 48;
    const TOKEN_SPACING = 10;
    const TOKEN_PADDING_LEFT = 12;

    const count = state.combat.order.length;
    const neededWidth = count > 0 ? (count * (TOKEN_SIZE + TOKEN_SPACING) + TOKEN_PADDING_LEFT + 6) : 60;
    if (combatBarTrack) {
      combatBarTrack.style.width = neededWidth + 'px';
    }

    state.combat.order.forEach((id, idx) => {
      const t = state.tokens.find(t => t.id === id);
      if (!t) return;

      const item = document.createElement('div');
      item.className = 'combat-token' + (idx === 0 ? ' current' : '');
      const left = idx * (TOKEN_SIZE + TOKEN_SPACING) + TOKEN_PADDING_LEFT;
      item.style.left = left + 'px';
      item.style.marginLeft = '0';

      // Render token circle with same clipping as map canvas
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      canvas.className = 'dot';
      const c = canvas.getContext('2d');
      const photo = getTokenPhotoImg(t);

      c.beginPath();
      c.arc(24, 24, 24, 0, Math.PI * 2);
      if (photo) {
        c.clip();
        c.drawImage(photo, 0, 0, 48, 48);
      } else {
        c.fillStyle = t.color;
        c.fill();
      }

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = t.name || `Token ${t.id}`;

      item.appendChild(canvas);
      item.appendChild(name);
      combatBarTokens.appendChild(item);
    });
  }

  // ---------- Sync with the master window ----------
  let statusTimer = null;
  function showStatus(text, autoHide) {
    statusEl.textContent = text;
    statusEl.classList.remove('hidden');
    if (statusTimer) clearTimeout(statusTimer);
    if (autoHide) statusTimer = setTimeout(() => statusEl.classList.add('hidden'), 2000);
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.type !== 'rpg-state') return;

    state.grid = msg.grid;
    state.tokens = msg.tokens;
    state.fog = msg.fog || [];
    state.walls = msg.walls || [];
    state.wallOcclusionMethod = msg.wallOcclusionMethod || 'cell';
    state.activeVisionTokenId = ('activeVisionTokenId' in msg) ? msg.activeVisionTokenId : null;
    state.map.scalePct = msg.map.scalePct;
    state.combat = msg.combat || { active: false, order: [] };
    state.partyBars = msg.partyBars || [];
    state.lighting = (typeof msg.lighting === 'number') ? msg.lighting : 1;
    renderCombatBar();

    // dataUrl: string = new map, null = map removed, absent = unchanged
    if ('dataUrl' in msg.map) {
      if (msg.map.dataUrl) {
        if (state.map._loadedUrl !== msg.map.dataUrl) {
          resetExplorationMemory();  // new map: old explored coordinates no longer apply
          const img = new Image();
          img.onload = () => {
            state.map.img = img;
            state.map._loadedUrl = msg.map.dataUrl;
            draw();
          };
          img.src = msg.map.dataUrl;
        }
      } else {
        state.map.img = null;
        state.map._loadedUrl = null;
        resetExplorationMemory();
      }
    }

    showStatus('Conectado ao mestre', true);
    draw();
  });

  // ask the master (opener) for the current state
  if (window.opener) {
    window.opener.postMessage({ type: 'rpg-player-ready' }, '*');
  } else {
    showStatus('Abra esta tela pelo botão "Tela do jogador" no app do mestre.');
  }

  // ---------- Init ----------
  resizeCanvas();
  centerView();
})();
