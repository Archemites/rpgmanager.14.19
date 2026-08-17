/* ============================================================
   GM hit-test: tokenAt/fogRectAt/effectDotAt/noteAt/objectAt.
   See ARCHITECTURE.md "Token management" (hit testing).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
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

  // World-space position of an object's rotate handle — a fixed screen-px
  // offset above the object's top edge, rotated with it.
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
  window.RPG.effectDotAt = effectDotAt;
  window.RPG.noteAt = noteAt;
  window.RPG.NOTE_MARKER_R = NOTE_MARKER_R;
  window.RPG.objectAt = objectAt;
  window.RPG.objectRotateHandlePos = objectRotateHandlePos;
  window.RPG.objectRotateHandleAt = objectRotateHandleAt;
})();
