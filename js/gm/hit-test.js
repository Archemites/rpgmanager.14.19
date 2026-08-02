/* ============================================================
   GM hit-test: tokenAt/fogRectAt/wallAt/effectDotAt/distToSegment/
   snapToCardinal/snapWallEndpoint. See ARCHITECTURE.md "Token management"
   (hit testing) and "Vision & fog of war" (wall endpoint snapping).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
  const WALL_HIT_DIST = window.RPG.WALL_HIT_DIST;
  const effectDotHitboxes = window.RPG.effectDotHitboxes;

  function tokenAt(wx, wy) {
    for (let i = state.tokens.length - 1; i >= 0; i--) {
      const t = state.tokens[i];
      const dx = wx - t.x, dy = wy - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) return t;
    }
    return null;
  }

  function fogRectAt(wx, wy) {
    for (let i = state.fog.length - 1; i >= 0; i--) {
      const f = state.fog[i];
      if (wx >= f.x && wx <= f.x + f.w && wy >= f.y && wy <= f.y + f.h) return f;
    }
    return null;
  }

  // distance from point (px,py) to segment (x1,y1)-(x2,y2)
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function wallAt(wx, wy) {
    const tol = WALL_HIT_DIST / cam.zoom;
    for (let i = state.walls.length - 1; i >= 0; i--) {
      const wall = state.walls[i];
      if (distToSegment(wx, wy, wall.x1, wall.y1, wall.x2, wall.y2) <= tol) return wall;
    }
    return null;
  }

  // Snap the point (wx,wy) so the segment from (x0,y0) follows the nearest
  // cardinal/diagonal direction (0°, 45°, 90°, ... every 45°) — used to draw
  // perfectly straight walls while holding Shift. Preserves the drag length.
  function snapToCardinal(x0, y0, wx, wy) {
    const dx = wx - x0, dy = wy - y0;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { x: wx, y: wy };
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4;  // 45°
    const snappedAngle = Math.round(angle / step) * step;
    return { x: x0 + Math.cos(snappedAngle) * dist, y: y0 + Math.sin(snappedAngle) * dist };
  }

  // Snap a new wall endpoint onto any existing wall endpoint within
  // WALL_ENDPOINT_SNAP world px — closes gaps smaller than that between two
  // segments (e.g. a corner drawn in two strokes) so the player-side raycast
  // occlusion can't leak light through a sliver too thin to see.
  const WALL_ENDPOINT_SNAP = 2;
  function snapWallEndpoint(x, y) {
    let best = null, bestDist = WALL_ENDPOINT_SNAP;
    for (const wall of state.walls) {
      for (const [ex, ey] of [[wall.x1, wall.y1], [wall.x2, wall.y2]]) {
        const d = Math.hypot(x - ex, y - ey);
        if (d < bestDist) { bestDist = d; best = { x: ex, y: ey }; }
      }
    }
    return best || { x, y };
  }

  const NOTE_MARKER_R = 12;  // world px (scaled with zoom like a token) hitbox for background note markers
  function noteAt(wx, wy) {
    const r = NOTE_MARKER_R / cam.zoom;
    for (let i = state.notes.length - 1; i >= 0; i--) {
      const n = state.notes[i];
      const dx = wx - n.x, dy = wy - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  // Rotated-rect hit test: transform the point into the object's local
  // (unrotated) space around its center, then a simple AABB check.
  function objectAt(wx, wy) {
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      const dx = wx - o.x, dy = wy - o.y;
      const cos = Math.cos(-o.rotation), sin = Math.sin(-o.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2) return o;
    }
    return null;
  }

  // World-space position of an object's rotate handle (like rotateHandlePos
  // for tokens) — a fixed screen-px offset above the object's top edge,
  // rotated with it.
  const OBJECT_ROTATE_HANDLE_OFFSET = 24; // screen px above the top edge
  function objectRotateHandlePos(o) {
    const dist = o.h / 2 + OBJECT_ROTATE_HANDLE_OFFSET / cam.zoom;
    const angle = o.rotation - Math.PI / 2;
    return { x: o.x + Math.cos(angle) * dist, y: o.y + Math.sin(angle) * dist };
  }

  function objectRotateHandleAt(wx, wy) {
    const r = window.RPG.ROTATE_HANDLE_R / cam.zoom;
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      if (o.id !== state.selectedObjectId) continue;
      const hp = objectRotateHandlePos(o);
      const dx = wx - hp.x, dy = wy - hp.y;
      if (dx * dx + dy * dy <= r * r) return o;
    }
    return null;
  }

  function effectDotAt(wx, wy) {
    for (let i = effectDotHitboxes.length - 1; i >= 0; i--) {
      const dot = effectDotHitboxes[i];
      const dx = wx - dot.cx, dy = wy - dot.cy;
      if (dx * dx + dy * dy <= dot.r * dot.r) return dot;
    }
    return null;
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.tokenAt = tokenAt;
  window.RPG.fogRectAt = fogRectAt;
  window.RPG.distToSegment = distToSegment;
  window.RPG.wallAt = wallAt;
  window.RPG.snapToCardinal = snapToCardinal;
  window.RPG.snapWallEndpoint = snapWallEndpoint;
  window.RPG.effectDotAt = effectDotAt;
  window.RPG.noteAt = noteAt;
  window.RPG.NOTE_MARKER_R = NOTE_MARKER_R;
  window.RPG.objectAt = objectAt;
  window.RPG.objectRotateHandlePos = objectRotateHandlePos;
  window.RPG.objectRotateHandleAt = objectRotateHandleAt;
})();
