/* ============================================================
   Player wall-occlusion raycasting engine: segmentsIntersect, exploration
   visitTokenVision, punchVisionCone, occludeConeMaskBy{Cell,Raycast}.
   Depends on js/player/memory.js's ensureMemoryCovers/renderCellSnapshot.
   See ARCHITECTURE.md "Vision & fog of war" > "Player side".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const EXPLORED_CELL = window.RPG.EXPLORED_CELL;
  const exploredCells = window.RPG.exploredCells;
  const tokenVisionReach = window.RPG.tokenVisionReach;

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

  // distance from point (px,py) to segment (x1,y1)-(x2,y2) — used to decide
  // whether a wall is close enough to the token to possibly cast a shadow
  // within the cone's reach (checking endpoint distance alone is wrong for a
  // long wall whose closest point is its middle, far from both endpoints).
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let tt = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    tt = Math.max(0, Math.min(1, tt));
    const cx = x1 + tt * dx, cy = y1 + tt * dy;
    return Math.hypot(px - cx, py - cy);
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
        window.RPG.ensureMemoryCovers(cx, cy);
        window.RPG.renderCellSnapshot(cx, cy, t.id);
      }
    }
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

  // Cut `mc` (destination-out, black) with an exact wall-shadow quad for
  // every wall within `reach` of `t`: the shadow is the quad formed by the
  // two wall endpoints, extruded along the wall's OWN perpendicular
  // (pointing away from the token) rather than radially from the token.
  // Radial-from-token projection breaks down when a wall is much longer than
  // the cone's reach: the ray from the token to a far endpoint runs nearly
  // parallel to the wall, so scaling along it barely advances in the
  // "depth" direction and leaves a gap directly behind the wall's middle
  // uncovered, no matter how large the scale factor is. Extruding
  // perpendicular to the wall instead always covers full depth regardless of
  // the token's angle to the wall, while still leaving the area beside a
  // short wall's endpoints unshadowed (so the token can see around a short
  // wall's ends).
  //
  // Used both as the 'raycast' occlusion method AND — regardless of which
  // wallOcclusionMethod is active — to clip the small always-visible body
  // circle in punchVisionCone(): that circle is small (t.r*2) and full-alpha,
  // so the coarse 48px 'cell' grid can leave a sliver of it showing through
  // a wall the token is standing right next to.
  function occludeMaskByWallsExact(mc, t, reach) {
    const depth = reach * 3 + 1;  // extrude well past the cone's rim
    mc.save();
    mc.globalCompositeOperation = 'destination-out';
    mc.fillStyle = '#000000';
    for (const wall of state.walls) {
      // skip walls entirely beyond the cone's reach — can't cast a visible
      // shadow. Uses distance to the SEGMENT (not just its endpoints): a long
      // wall can have both endpoints far away while its middle passes close
      // by the token, well within reach.
      if (distToSegment(t.x, t.y, wall.x1, wall.y1, wall.x2, wall.y2) > reach) continue;

      const wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
      const wlen = Math.hypot(wdx, wdy) || 1;
      let nx = -wdy / wlen, ny = wdx / wlen;  // unit normal, either side
      // orient the normal away from the token (shadow falls on the far side)
      const midX = (wall.x1 + wall.x2) / 2, midY = (wall.y1 + wall.y2) / 2;
      if (nx * (t.x - midX) + ny * (t.y - midY) > 0) { nx = -nx; ny = -ny; }

      const p1x = wall.x1 + nx * depth, p1y = wall.y1 + ny * depth;
      const p2x = wall.x2 + nx * depth, p2y = wall.y2 + ny * depth;
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

  function occludeConeMaskByRaycast(mc, t, reach) {
    occludeMaskByWallsExact(mc, t, reach);
  }

  // Punch a token's vision cone out of the (destination-out) fog layer, with a
  // soft falloff on EVERY side — radially toward the outer rim (front) AND
  // angularly toward both straight edges.
  //
  // The cone's alpha envelope is built on a separate mask layer, then stamped
  // into the fog with destination-out. The radial (front) fade is a gradient; the
  // angular (side) fade is a conic-gradient mask applied with
  // 'destination-in', giving a perfectly smooth edge with no wedge seams.
  function punchVisionCone(fx, t) {
    const reach = tokenVisionReach(t);
    if (reach <= t.r) return;
    const angle = (typeof t.visionAngle === 'number') ? t.visionAngle : 120;
    const facing = (typeof t.facing === 'number') ? t.facing : -Math.PI / 2;

    window.RPG.getFogLayer(fx.canvas.width, fx.canvas.height);
    const fogLayer = window.RPG.getFogLayerCanvas();

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
        // (behind/beside it) dark. Clipped with EXACT wall geometry right
        // away (not the coarse 'cell' grid below) — this circle is small
        // enough (t.r*2) that a 48px cell can leave a sliver of it showing
        // through a wall the token is standing flush against.
        mc.fillStyle = 'rgba(0,0,0,1)';
        mc.beginPath();
        mc.arc(t.x, t.y, t.r * 2, 0, Math.PI * 2);
        mc.fill();
        if (state.walls.length > 0) occludeMaskByWallsExact(mc, t, t.r * 2);
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
        if (state.walls.length > 0) occludeMaskByWallsExact(mc, t, t.r * 2);
      }
    }

    // occlude the rest of the cone mask by walls using the GM-selected method
    if (state.walls.length > 0) {
      occludeConeMaskByWalls(mc, t, reach);
    }

    // subtract the finished cone mask from the fog (identity transform for the stamp)
    fx.save();
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.drawImage(coneMask, 0, 0);
    fx.restore();
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.segmentsIntersect = segmentsIntersect;
  window.RPG.distToSegment = distToSegment;
  window.RPG.lineBlockedByWalls = lineBlockedByWalls;
  window.RPG.visitTokenVision = visitTokenVision;
  window.RPG.punchVisionCone = punchVisionCone;
  window.RPG.getConeMask = getConeMask;
})();
