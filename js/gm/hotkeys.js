/* ============================================================
   GM global hotkeys: Ctrl+C/Ctrl+V (copy/paste tokens), Delete (delete
   whatever's under the cursor — token, wall, or fog rect), Ctrl+Z/Ctrl+Y
   (undo/redo via js/gm/history.js). Loads after mouse.js so it can reuse
   hit-test + the shared world-cursor tracking.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;
  const canvas = window.RPG.canvas;
  const screenToWorld = window.RPG.screenToWorld;
  const eventScreenPos = window.RPG.eventScreenPos;
  const tokenAt = window.RPG.tokenAt;
  const wallAt = window.RPG.wallAt;
  const fogRectAt = window.RPG.fogRectAt;

  // Track the cursor's last known world position (canvas-relative) so Delete
  // and Ctrl+V can act on "whatever's under/near the cursor" without needing
  // a mouse event of their own.
  let lastWorldX = 0, lastWorldY = 0;
  canvas.addEventListener('mousemove', (e) => {
    const sp = eventScreenPos(e);
    const wp = screenToWorld(sp.x, sp.y);
    lastWorldX = wp.x;
    lastWorldY = wp.y;
  });

  let clipboard = [];  // array of cloned token objects (no id/scenes — assigned fresh on paste)

  function isTypingTarget(e) {
    const tag = (e.target && e.target.tagName) || '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
  }

  function copySelection() {
    const ids = state.selectedTokenIds.length > 0
      ? state.selectedTokenIds
      : (state.selectedTokenId ? [state.selectedTokenId] : []);
    if (ids.length === 0) return;
    clipboard = ids
      .map(id => state.tokens.find(t => t.id === id))
      .filter(Boolean)
      .map(t => JSON.parse(JSON.stringify(t)));
    if (clipboard.length > 0) {
      window.RPG.logEvent(clipboard.length > 1 ? `Copiou ${clipboard.length} tokens` : `Copiou token${clipboard[0].name ? ` "${clipboard[0].name}"` : ''}`);
    }
  }

  function pasteClipboard() {
    if (clipboard.length === 0) return;
    window.RPG.captureBeforeChange(clipboard.length > 1 ? `Colou ${clipboard.length} tokens` : `Colou token${clipboard[0].name ? ` "${clipboard[0].name}"` : ''}`);

    // paste centered on the cursor: shift the whole clipboard group so its
    // bounding-box center lands at the last known cursor world position
    const cx = clipboard.reduce((s, t) => s + t.x, 0) / clipboard.length;
    const cy = clipboard.reduce((s, t) => s + t.y, 0) / clipboard.length;
    const dx = lastWorldX - cx;
    const dy = lastWorldY - cy;

    const sceneId = window.RPG.getCurrentSceneId();
    const newIds = [];
    for (const src of clipboard) {
      const x = src.x + dx, y = src.y + dy;
      const token = {
        ...src,
        id: state.nextId++,
        x, y,
        scenes: { [sceneId]: { x, y } },
        createdAt: Date.now(),
      };
      if (token.isPlayer) window.RPG.syncTokenBarValues(token);
      allTokens.push(token);
      newIds.push(token.id);
    }
    window.RPG.refreshVisibleTokens();
    state.selectedTokenIds = newIds;
    state.selectedTokenId = newIds[newIds.length - 1];
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    window.RPG.renderSceneList();
    window.RPG.draw();
    window.RPG.sendState();
  }

  // Delete whatever's under the cursor: a token first (also clears it from
  // any active multi-selection), else a wall, else a fog rect.
  function deleteUnderCursor() {
    const hitToken = tokenAt(lastWorldX, lastWorldY);
    if (hitToken) {
      window.RPG.removeToken(hitToken.id);
      return;
    }
    const wall = wallAt(lastWorldX, lastWorldY);
    if (wall) {
      window.RPG.captureBeforeChange('Removeu parede (Delete)');
      state.walls = state.walls.filter(w => w.id !== wall.id);
      window.RPG.draw();
      window.RPG.sendState();
      return;
    }
    const fog = fogRectAt(lastWorldX, lastWorldY);
    if (fog) {
      window.RPG.captureBeforeChange('Removeu retângulo de névoa (Delete)');
      state.fog = state.fog.filter(r => r.id !== fog.id);
      window.RPG.draw();
      window.RPG.sendState();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e)) return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === 'c') {
      copySelection();
      return;
    }
    if (ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteClipboard();
      return;
    }
    if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      window.RPG.undo();
      return;
    }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      window.RPG.redo();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Backspace only counts over the canvas — elsewhere it's likely meant
      // for normal browser text-editing, not a delete-under-cursor shortcut.
      if (e.key === 'Backspace' && e.target !== document.body && e.target !== canvas) return;
      e.preventDefault();
      deleteUnderCursor();
    }
  });
})();
