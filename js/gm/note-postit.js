/* ============================================================
   GM annotation post-it: a small floating, draggable note anchored to a
   world point (a background note marker, or a token) via a thin connector
   line drawn on the canvas (see js/gm/draw.js's drawNotePostitConnector).
   Left-click on a background note marker, or double-click a token, opens
   this instead of the centered note-modal.js dialog — stays open while the
   GM keeps working, auto-saves on every edit, closed via its own close button or Escape.
   ============================================================ */

(() => {
  'use strict';

  const cam = window.RPG.cam;

  const postit = document.getElementById('notePostit');
  const postitHeader = document.getElementById('notePostitHeader');
  const postitText = document.getElementById('notePostitText');
  const postitClose = document.getElementById('notePostitClose');

  // target = { kind: 'note', note } | { kind: 'token', token } | null
  let target = null;
  // drag offset from the anchor, in WORLD units, so it stays visually
  // consistent (same relative position) across pan/zoom — recomputed once
  // per drag from screen-space deltas divided by the zoom at drag time.
  let offsetWX = 16, offsetWY = -16;
  let dragging = false;
  let dragStartScreenX = 0, dragStartScreenY = 0;
  let dragStartOffsetWX = 0, dragStartOffsetWY = 0;

  function worldToScreen(wx, wy) {
    return { x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom };
  }

  function anchorWorldPos() {
    if (!target) return null;
    return target.kind === 'note'
      ? { x: target.note.x, y: target.note.y }
      : { x: target.token.x, y: target.token.y - target.token.r };
  }

  function save() {
    if (!target) return;
    const text = postitText.value;
    if (target.kind === 'note') {
      target.note.text = text;
    } else {
      target.token.note = text;
      window.RPG.renderTokenList();
    }
    window.RPG.sendState();
  }

  function close() {
    if (!target) return;
    save();
    target = null;
    postit.classList.remove('show');
  }

  function reposition() {
    if (!target) return;
    const anchor = anchorWorldPos();
    const noteSp = worldToScreen(anchor.x + offsetWX, anchor.y + offsetWY);
    postit.style.left = noteSp.x + 'px';
    postit.style.top = noteSp.y + 'px';
  }

  // Draw a thin dashed connector from the anchor's world point to the
  // post-it's current on-screen corner — called from js/gm/draw.js right
  // after reposition() so the DOM position it reads is already up to date.
  function drawConnector(ctx) {
    if (!target) return;
    const anchor = anchorWorldPos();
    const rect = postit.getBoundingClientRect();
    const canvasRect = window.RPG.canvas.getBoundingClientRect();
    const cornerSx = rect.left - canvasRect.left;
    const cornerSy = rect.top - canvasRect.top;
    const cornerWp = { x: cornerSx / cam.zoom + cam.x, y: cornerSy / cam.zoom + cam.y };
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(cornerWp.x, cornerWp.y);
    ctx.strokeStyle = 'rgba(69,255,120,0.55)';
    ctx.lineWidth = 1 / cam.zoom;
    ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 3 / cam.zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(69,255,120,0.8)';
    ctx.fill();
    ctx.restore();
  }

  function openForNote(note) {
    if (target && target.kind === 'note' && target.note.id === note.id) return;
    save();
    target = { kind: 'note', note };
    offsetWX = 16; offsetWY = -16;
    postitText.value = note.text || '';
    postit.classList.add('show');
    reposition();
    postitText.focus();
  }

  function openForToken(t) {
    if (target && target.kind === 'token' && target.token.id === t.id) return;
    save();
    target = { kind: 'token', token: t };
    offsetWX = 16; offsetWY = -16;
    postitText.value = t.note || '';
    postit.classList.add('show');
    reposition();
    postitText.focus();
  }

  // ---------- Drag the post-it by its header ----------
  postitHeader.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !target) return;
    e.preventDefault();
    dragging = true;
    postit.classList.add('dragging');
    dragStartScreenX = e.clientX;
    dragStartScreenY = e.clientY;
    dragStartOffsetWX = offsetWX;
    dragStartOffsetWY = offsetWY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !target) return;
    const dsx = e.clientX - dragStartScreenX;
    const dsy = e.clientY - dragStartScreenY;
    offsetWX = dragStartOffsetWX + dsx / cam.zoom;
    offsetWY = dragStartOffsetWY + dsy / cam.zoom;
    reposition();
    window.RPG.draw();
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    postit.classList.remove('dragging');
  });

  postitClose.addEventListener('click', close);
  postitText.addEventListener('input', save);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && target) close();
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.openNotePostitForNote = openForNote;
  window.RPG.openNotePostitForToken = openForToken;
  window.RPG.closeNotePostit = close;
  window.RPG.repositionNotePostit = reposition;
  window.RPG.drawNotePostitConnector = drawConnector;
})();
