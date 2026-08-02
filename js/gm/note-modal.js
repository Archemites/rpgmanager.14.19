/* ============================================================
   GM note editor modal: shared textarea popup used both for a token's
   annotation (token.note, saved under the token's name) and for background
   annotations pinned to a world point (state.notes[], GM-only, per-scene).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  const noteOverlay = document.getElementById('noteOverlay');
  const noteModalTitle = document.getElementById('noteModalTitle');
  const noteTextInput = document.getElementById('noteTextInput');
  const noteCancelBtn = document.getElementById('noteCancelBtn');
  const noteSaveBtn = document.getElementById('noteSaveBtn');
  const noteDeleteBtn = document.getElementById('noteDeleteBtn');

  let pendingSave = null;   // fn(text) => void
  let pendingDelete = null; // fn() => void, or null when not deletable from here

  function openNoteModal({ title, text, onSave, onDelete }) {
    noteModalTitle.textContent = title;
    noteTextInput.value = text || '';
    pendingSave = onSave;
    pendingDelete = onDelete || null;
    noteDeleteBtn.style.display = pendingDelete ? '' : 'none';
    noteOverlay.classList.add('open');
    noteTextInput.focus();
  }

  function closeNoteModal() {
    noteOverlay.classList.remove('open');
    pendingSave = null;
    pendingDelete = null;
  }

  noteCancelBtn.addEventListener('click', closeNoteModal);
  noteOverlay.addEventListener('click', (e) => { if (e.target === noteOverlay) closeNoteModal(); });

  noteSaveBtn.addEventListener('click', () => {
    const text = noteTextInput.value;
    if (pendingSave) pendingSave(text);
    closeNoteModal();
  });

  noteDeleteBtn.addEventListener('click', () => {
    if (pendingDelete) pendingDelete();
    closeNoteModal();
  });

  // ---------- Token annotation ----------
  function openTokenNote(t) {
    openNoteModal({
      title: 'Anotação — ' + (t.name || `Token ${t.id}`),
      text: t.note || '',
      onSave: (text) => {
        window.RPG.logEvent('Editou anotação de ' + (t.name || `token ${t.id}`));
        t.note = text;
        window.RPG.renderTokenList();
        window.RPG.sendState();
      },
    });
  }

  // ---------- Background annotation ----------
  function openBackgroundNoteCreate(x, y) {
    openNoteModal({
      title: 'Nova anotação',
      text: '',
      onSave: (text) => {
        if (!text.trim()) return;
        window.RPG.captureBeforeChange('Criou anotação no mapa');
        state.notes.push({ id: state.nextNoteId++, x, y, text });
        window.RPG.draw();
        window.RPG.sendState();
      },
    });
  }

  function openBackgroundNoteEdit(note) {
    openNoteModal({
      title: 'Anotação',
      text: note.text,
      onSave: (text) => {
        window.RPG.logEvent('Editou anotação do mapa');
        note.text = text;
        window.RPG.draw();
        window.RPG.sendState();
      },
      onDelete: () => {
        window.RPG.captureBeforeChange('Removeu anotação do mapa');
        state.notes = state.notes.filter(n => n.id !== note.id);
        window.RPG.draw();
        window.RPG.sendState();
      },
    });
  }

  function removeBackgroundNote(note) {
    window.RPG.captureBeforeChange('Removeu anotação do mapa');
    state.notes = state.notes.filter(n => n.id !== note.id);
    window.RPG.draw();
    window.RPG.sendState();
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.openTokenNote = openTokenNote;
  window.RPG.openBackgroundNoteCreate = openBackgroundNoteCreate;
  window.RPG.openBackgroundNoteEdit = openBackgroundNoteEdit;
  window.RPG.removeBackgroundNote = removeBackgroundNote;
})();
