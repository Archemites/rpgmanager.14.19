/* ============================================================
   Session quicksave: export/import the entire session (all scenes, tokens,
   party bars, glossary, settings — maps/photos already embedded as
   dataURLs) as a single .json backup file, PLUS an autosave copy kept in
   localStorage so a page refresh/crash doesn't lose progress — restored
   automatically on load. GM-only. See ARCHITECTURE.md "State management" >
   "GM side" for the allTokens/state/scenes shapes this mirrors.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;
  const scenes = window.RPG.scenes;
  const folders = window.RPG.folders;

  const SESSION_FORMAT_VERSION = 1;
  const AUTOSAVE_KEY = 'rpg-autosave-session';
  const AUTOSAVE_DEBOUNCE_MS = 1500;

  // ---------- Version history: the actual .json files the user has
  // exported or imported (NOT autosave snapshots) — kept in IndexedDB since
  // they can be large (embedded map/photo dataURLs), capped at the 10 most
  // recent, oldest evicted first.
  const VERSION_HISTORY_LIMIT = 10;
  const VH_DB_NAME = 'rpg-version-history';
  const VH_STORE = 'versions';
  let vhDbPromise = null;

  function openVersionDb() {
    if (vhDbPromise) return vhDbPromise;
    vhDbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(VH_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(VH_STORE)) {
          db.createObjectStore(VH_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return vhDbPromise;
  }

  async function recordVersion(kind, filename, payload) {
    try {
      const db = await openVersionDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(VH_STORE, 'readwrite');
        tx.objectStore(VH_STORE).add({ kind, filename, savedAt: payload.savedAt || new Date().toISOString(), payload });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      await pruneVersionHistory();
    } catch (err) {
      console.error('Falha ao registrar versão no histórico:', err);
    }
  }

  async function listVersionHistory() {
    const db = await openVersionDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VH_STORE, 'readonly');
      const req = tx.objectStore(VH_STORE).getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.id - a.id));
      req.onerror = () => reject(req.error);
    });
  }

  async function pruneVersionHistory() {
    const all = await listVersionHistory();
    const toDelete = all.slice(VERSION_HISTORY_LIMIT);
    if (toDelete.length === 0) return;
    const db = await openVersionDb();
    const tx = db.transaction(VH_STORE, 'readwrite');
    for (const entry of toDelete) tx.objectStore(VH_STORE).delete(entry.id);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }

  async function getVersionEntry(id) {
    const db = await openVersionDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VH_STORE, 'readonly');
      const req = tx.objectStore(VH_STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // scenes[].map.img is a DOM Image — not serializable, and rebuilt from
  // dataUrl on import. Strip it before writing, so JSON.stringify doesn't choke.
  function sceneForExport(sc) {
    return { ...sc, map: { scalePct: sc.map.scalePct, dataUrl: sc.map.dataUrl, name: sc.map.name, bgColor: sc.map.bgColor } };
  }

  function buildSessionPayload() {
    window.RPG.commitSceneFields();
    return {
      formatVersion: SESSION_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      currentSceneId: window.RPG.getCurrentSceneId(),
      nextSceneId: Math.max(0, ...scenes.map(s => s.id)) + 1,
      scenes: scenes.map(sceneForExport),
      folders: folders.map(f => ({ ...f })),
      nextFolderId: Math.max(0, ...folders.map(f => f.id)) + 1,
      allTokens,
      partyBars: state.partyBars,
      glossary: state.glossary,
      nextId: state.nextId,
      nextBarId: state.nextBarId,
      nextEffectId: state.nextEffectId,
    };
  }

  function exportSession() {
    const payload = buildSessionPayload();
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = payload.savedAt.replace(/[:.]/g, '-');
    const filename = `sessao-rpg-${stamp}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.RPG.logEvent('Exportou backup da sessão');
    recordVersion('export', filename, payload).then(renderVersionHistory);
  }

  function rebuildSceneMapImg(sc) {
    if (!sc.map || !sc.map.dataUrl) { sc.map = sc.map || { img: null, scalePct: 100, dataUrl: null }; sc.map.img = null; return Promise.resolve(); }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { sc.map.img = img; resolve(); };
      img.onerror = () => { sc.map.img = null; resolve(); };
      img.src = sc.map.dataUrl;
    });
  }

  async function applySessionPayload(payload) {
    if (!payload || !Array.isArray(payload.scenes) || !Array.isArray(payload.allTokens)) {
      throw new Error('Arquivo de sessão inválido.');
    }

    await Promise.all(payload.scenes.map(rebuildSceneMapImg));

    scenes.length = 0;
    scenes.push(...payload.scenes);
    folders.length = 0;
    folders.push(...(payload.folders || []));
    window.RPG.setNextFolderId(payload.nextFolderId || (Math.max(0, ...folders.map(f => f.id)) + 1));
    window.RPG.clearSceneMultiSelect();
    allTokens.length = 0;
    allTokens.push(...payload.allTokens);
    for (const t of allTokens) {
      // migrate old save format: effects was an array of bare glossary ids
      if (Array.isArray(t.effects) && t.effects.length && typeof t.effects[0] !== 'object') {
        t.effects = t.effects.map(id => ({ id, remaining: 0 }));
      }
    }

    state.partyBars = payload.partyBars || state.partyBars;
    state.glossary = payload.glossary || [];
    state.nextId = payload.nextId || 1;
    state.nextBarId = payload.nextBarId || 1;
    state.nextEffectId = payload.nextEffectId || 1;
    state.selectedTokenId = null;
    state.selectedTokenIds = [];

    const targetId = payload.scenes.some(s => s.id === payload.currentSceneId)
      ? payload.currentSceneId
      : payload.scenes[0].id;
    const target = scenes.find(s => s.id === targetId);
    window.RPG.setCurrentSceneId(targetId);
    window.RPG.setNextSceneId(payload.nextSceneId || (Math.max(0, ...scenes.map(s => s.id)) + 1));
    state.map = target.map;
    state.fog = target.fog;
    state.notes = target.notes || [];
    state.objects = target.objects || [];
    state.grid = target.grid;
    state.combat = target.combat;
    state.nextFogId = target.nextFogId;
    state.nextNoteId = target.nextNoteId || 1;
    state.nextObjectId = target.nextObjectId || 1;

    window.RPG.refreshVisibleTokens();
    window.RPG.syncSceneControlsFromState();
    window.RPG.renderSceneList();
    window.RPG.renderTokenList();
    window.RPG.renderObjectList();
    window.RPG.renderParty();
    window.RPG.updateHud();
    window.RPG.draw();
    window.RPG.sendState(true);
  }

  function importSession(file) {
    file.text()
      .then(text => {
        const payload = JSON.parse(text);
        return applySessionPayload(payload).then(() => payload);
      })
      .then((payload) => {
        window.RPG.logEvent('Importou backup de sessão');
        return recordVersion('import', file.name, payload).then(renderVersionHistory);
      })
      .catch((err) => {
        console.error(err);
        alert('Falha ao importar sessão: ' + err.message);
      });
  }

  function restoreVersion(id) {
    getVersionEntry(id)
      .then((entry) => {
        if (!entry) throw new Error('Versão não encontrada.');
        if (!confirm(`Restaurar "${entry.filename}"? Isso substitui TUDO na sessão atual.`)) return;
        return applySessionPayload(entry.payload).then(() => {
          window.RPG.logEvent(`Restaurou versão "${entry.filename}"`);
        });
      })
      .catch((err) => {
        console.error(err);
        alert('Falha ao restaurar versão: ' + err.message);
      });
  }

  // ---------- Clear session (Ajustes > Sessão > "🧹 Limpar sessão") ----------
  // The app's factory state, snapshotted at load time — BEFORE the autosave
  // restore below runs, so it's exactly what a first-ever visit looks like
  // (one empty scene, no tokens, default party bars).
  // Deep-cloned through JSON so later mutations can't reach back into it.
  const PRISTINE_PAYLOAD = JSON.parse(JSON.stringify(buildSessionPayload()));

  // Wipe EVERYTHING back to that factory state: all scenes, all tokens, party
  // bars, glossary, maps/photos, settings, the undo stack + event log, and the
  // localStorage autosave. The IndexedDB version history (exported/imported
  // .json backups) is deliberately kept — it's the escape hatch if this was a
  // mistake. Not undoable, hence the #confirmClearOverlay confirmation.
  function clearSession() {
    window.RPG.closeNotePostit();
    window.RPG.closeContextMenu();
    window.RPG.stopCombat();          // resets the combat bar/button UI, not just the flag
    window.RPG.removeMap(true);       // silent — clears the map file input + controls
    return applySessionPayload(JSON.parse(JSON.stringify(PRISTINE_PAYLOAD)))
      .then(() => {
        window.RPG.centerView();
        window.RPG.resetHistory();
        clearAutosave();
        window.RPG.logEvent('Limpou a sessão inteira');
      })
      .catch((err) => {
        console.error(err);
        alert('Falha ao limpar a sessão: ' + err.message);
      });
  }

  // ---------- Autosave to localStorage (survives page refresh/crash) ----------
  let autosaveTimer = null;

  function autosaveNow() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildSessionPayload()));
    } catch (err) {
      console.error('Autosave falhou:', err);
    }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, AUTOSAVE_DEBOUNCE_MS);
  }

  function hasAutosave() {
    return !!localStorage.getItem(AUTOSAVE_KEY);
  }

  async function restoreAutosave() {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    await applySessionPayload(JSON.parse(raw));
    return true;
  }

  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  window.addEventListener('beforeunload', autosaveNow);

  // ---------- Version history tab rendering ----------
  function formatTimestamp(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function renderVersionHistory() {
    const listEl = document.getElementById('versionHistoryList');
    if (!listEl) return;
    listVersionHistory().then((entries) => {
      listEl.innerHTML = '';
      if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'event-log-empty';
        empty.textContent = 'Nenhum backup .json exportado ou importado ainda.';
        listEl.appendChild(empty);
        return;
      }
      for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'version-row';
        const info = document.createElement('div');
        info.className = 'version-info';
        const time = document.createElement('span');
        time.className = 'version-time';
        time.textContent = formatTimestamp(entry.savedAt);
        const label = document.createElement('span');
        label.className = 'version-label';
        const kindLabel = entry.kind === 'export' ? 'Exportado' : 'Importado';
        label.textContent = `${kindLabel}: ${entry.filename}`;
        info.appendChild(time);
        info.appendChild(label);
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'secondary';
        restoreBtn.textContent = 'Restaurar';
        restoreBtn.addEventListener('click', () => restoreVersion(entry.id));
        row.appendChild(info);
        row.appendChild(restoreBtn);
        listEl.appendChild(row);
      }
    });
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.exportSession = exportSession;
  window.RPG.importSession = importSession;
  window.RPG.scheduleAutosave = scheduleAutosave;
  window.RPG.hasAutosave = hasAutosave;
  window.RPG.restoreAutosave = restoreAutosave;
  window.RPG.clearAutosave = clearAutosave;
  window.RPG.clearSession = clearSession;
  window.RPG.renderVersionHistory = renderVersionHistory;

  // ---------- Restore on load, if an autosave exists ----------
  if (hasAutosave()) {
    restoreAutosave()
      .then((restored) => {
        if (restored) {
          window.RPG.logEvent('Sessão restaurada automaticamente (autosave)');
        }
      })
      .catch((err) => {
        console.error('Falha ao restaurar autosave:', err);
        clearAutosave();
      });
  }

  // ---------- Periodic autosave (catches changes beyond the debounce window) ----------
  setInterval(autosaveNow, 30000);

  // ---------- Settings modal buttons ----------
  const exportBtn = document.getElementById('exportSessionBtn');
  const importBtn = document.getElementById('importSessionBtn');
  const importInput = document.getElementById('importSessionInput');

  exportBtn.addEventListener('click', exportSession);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    importInput.value = '';
    if (!file) return;
    if (!confirm('Importar esta sessão vai substituir TUDO na sessão atual (cenas, tokens, mapas). Continuar?')) return;
    window.RPG.importSession(file);
  });

  // ---------- Clear-session button + confirmation ----------
  const clearSessionBtn = document.getElementById('clearSessionBtn');
  const confirmClearOverlay = document.getElementById('confirmClearOverlay');
  const confirmClearCancelBtn = document.getElementById('confirmClearCancelBtn');
  const confirmClearBtn = document.getElementById('confirmClearBtn');

  function closeConfirmClear() { confirmClearOverlay.classList.remove('open'); }

  clearSessionBtn.addEventListener('click', () => confirmClearOverlay.classList.add('open'));
  confirmClearCancelBtn.addEventListener('click', closeConfirmClear);
  confirmClearOverlay.addEventListener('click', (e) => { if (e.target === confirmClearOverlay) closeConfirmClear(); });
  confirmClearBtn.addEventListener('click', () => {
    closeConfirmClear();
    clearSession();
  });
})();
