/* ============================================================
   GM undo/redo history: snapshot-based, scoped to the CURRENT scene's
   mutable content (token existence/position/scenes-map, fog, walls).
   Map image/grid/lighting/combat are intentionally excluded — undo is for
   "oops I moved/deleted/pasted the wrong thing", not a full time machine.
   Consumed by js/gm/hotkeys.js (Ctrl+Z/Ctrl+Y) and called by any action
   that should be undoable (drag-move, delete, paste, box-select move, ...).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;

  const HISTORY_LIMIT = 60;
  const undoStack = [];
  const redoStack = [];
  let suppressCapture = false;  // true while applying a snapshot, so restore doesn't re-push itself

  // ---------- Event log: last action + timestamp, shown in the "Log de
  // Eventos" modal. Independent of the undo stack's size limit — this is a
  // human-readable trail, not undo state, so it's capped separately.
  const EVENT_LOG_LIMIT = 100;
  const eventLog = [];  // [{ label, time: 'HH:MM:SS' }], newest first

  function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function logEvent(label) {
    eventLog.unshift({ label, time: timestamp() });
    if (eventLog.length > EVENT_LOG_LIMIT) eventLog.pop();
    // Almost every mutating GM action calls logEvent — piggyback the
    // autosave trigger here instead of hooking every individual file.
    if (window.RPG.scheduleAutosave) window.RPG.scheduleAutosave();
  }

  function renderEventLog() {
    const listEl = document.getElementById('eventLogList');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (eventLog.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'event-log-empty';
      empty.textContent = 'Nenhuma ação registrada ainda.';
      listEl.appendChild(empty);
      return;
    }
    for (const entry of eventLog) {
      const row = document.createElement('div');
      row.className = 'event-log-row';
      const time = document.createElement('span');
      time.className = 'event-log-time';
      time.textContent = entry.time;
      const desc = document.createElement('span');
      desc.className = 'event-log-desc';
      desc.textContent = entry.label;
      row.appendChild(time);
      row.appendChild(desc);
      listEl.appendChild(row);
    }
  }

  // Snapshot = current scene's tokens (existence/position/scenes-map) + fog + walls.
  // Tokens from OTHER scenes are captured by reference-preserving clone of the
  // full allTokens array so cross-scene "scenes" maps stay intact on restore.
  function snapshot() {
    return {
      sceneId: window.RPG.getCurrentSceneId(),
      tokens: JSON.parse(JSON.stringify(allTokens)),
      fog: JSON.parse(JSON.stringify(state.fog)),
      walls: JSON.parse(JSON.stringify(state.walls)),
      notes: JSON.parse(JSON.stringify(state.notes)),
      objects: JSON.parse(JSON.stringify(state.objects)),
      nextId: state.nextId,
      nextFogId: state.nextFogId,
      nextWallId: state.nextWallId,
      nextNoteId: state.nextNoteId,
      nextObjectId: state.nextObjectId,
    };
  }

  function restore(snap) {
    if (window.RPG.getCurrentSceneId() !== snap.sceneId) return;  // stale scene, ignore
    suppressCapture = true;
    allTokens.length = 0;
    for (const t of snap.tokens) allTokens.push(t);
    state.fog = JSON.parse(JSON.stringify(snap.fog));
    state.walls = JSON.parse(JSON.stringify(snap.walls));
    state.notes = JSON.parse(JSON.stringify(snap.notes || []));
    state.objects = JSON.parse(JSON.stringify(snap.objects || []));
    state.nextId = snap.nextId;
    state.nextFogId = snap.nextFogId;
    state.nextWallId = snap.nextWallId;
    state.nextNoteId = snap.nextNoteId || 1;
    state.nextObjectId = snap.nextObjectId || 1;
    state.selectedTokenId = null;
    state.selectedTokenIds = [];
    state.selectedObjectId = null;
    window.RPG.refreshVisibleTokens();
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    window.RPG.renderSceneList();
    window.RPG.renderObjectList();
    window.RPG.draw();
    window.RPG.sendState();
    suppressCapture = false;
  }

  // Call BEFORE a mutating action (drag start, delete, paste, ...) to push
  // the pre-action state onto the undo stack. Clears the redo stack (new
  // branch of history). `label` (Portuguese, human-readable) is recorded to
  // the event log — pass one from every call site so the log stays meaningful.
  function captureBeforeChange(label) {
    if (suppressCapture) return;
    undoStack.push(snapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    if (label) logEvent(label);
  }

  // Call after a captureBeforeChange() turned out to be a no-op (e.g. a
  // token was grabbed but never actually moved) — drops the snapshot just
  // pushed so undo doesn't offer a step that changes nothing.
  function discardLastCapture() {
    undoStack.pop();
  }

  // Wipe undo/redo + the event log — for a full session reset (see
  // js/gm/session-io.js's clearSession), where every snapshot on the stack
  // refers to content that no longer exists.
  function resetHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    eventLog.length = 0;
    renderEventLog();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const cur = snapshot();
    const prev = undoStack.pop();
    if (prev.sceneId !== cur.sceneId) return;  // scene changed since — bail rather than corrupt state
    redoStack.push(cur);
    restore(prev);
    logEvent('Desfazer (Ctrl+Z)');
  }

  function redo() {
    if (redoStack.length === 0) return;
    const cur = snapshot();
    const next = redoStack.pop();
    if (next.sceneId !== cur.sceneId) return;
    undoStack.push(cur);
    restore(next);
    logEvent('Refazer (Ctrl+Y)');
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.captureBeforeChange = captureBeforeChange;
  window.RPG.discardLastCapture = discardLastCapture;
  window.RPG.logEvent = logEvent;
  window.RPG.resetHistory = resetHistory;
  window.RPG.undo = undo;
  window.RPG.redo = redo;
  window.RPG.renderEventLog = renderEventLog;
})();
