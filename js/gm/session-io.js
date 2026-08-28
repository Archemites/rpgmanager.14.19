// @ts-check
/* ============================================================
   Session quicksave: export/import the entire session (all scenes, tokens,
   party bars, glossary, settings â€” maps/photos already embedded as
   dataURLs) as a single .json backup file, PLUS an autosave copy kept in
   localStorage so a page refresh/crash doesn't lose progress â€” restored
   automatically on load. GM-only. See ARCHITECTURE.md "State management" >
   "GM side" for the allTokens/state/scenes shapes this mirrors.
   ============================================================ */

(() => {
  'use strict';

  const RPG = /** @type {any} */ (window).RPG;
  const state = RPG.state;
  const allTokens = RPG.allTokens;
  const scenes = RPG.scenes;
  const folders = RPG.folders;

  const SESSION_FORMAT_VERSION = 1;
  const AUTOSAVE_KEY = 'rpg-autosave-session'; // mantido para migrar dados antigos
  const AUTOSAVE_DEBOUNCE_MS = 1500;

  // ---------- IndexedDB: banco unificado (versÃµes + autosave) ----------
  const DB_NAME = 'rpg-session-db';
  const VH_STORE = 'versions';
  const AS_STORE = 'autosave';
  const AS_KEY = 'current';
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        // Store para histÃ³rico de versÃµes (.json exports/imports)
        if (!db.objectStoreNames.contains(VH_STORE)) {
          db.createObjectStore(VH_STORE, { keyPath: 'id', autoIncrement: true });
        }
        // Store para autosave â€” uma Ãºnica entrada com key fixa 'current'
        if (!db.objectStoreNames.contains(AS_STORE)) {
          db.createObjectStore(AS_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  // Alias mantido para nÃ£o quebrar a assinatura interna
  const VERSION_HISTORY_LIMIT = 10;
  function openVersionDb() { return openDb(); }

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
      console.error('Falha ao registrar versÃ£o no histÃ³rico:', err);
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

  // scenes[].map.img is a DOM Image â€” not serializable, and rebuilt from
  // dataUrl on import. Strip it before writing, so JSON.stringify doesn't choke.
  function sceneForExport(sc) {
    return { ...sc, map: { scalePct: sc.map.scalePct, dataUrl: sc.map.dataUrl, name: sc.map.name, bgColor: sc.map.bgColor } };
  }

  function buildSessionPayload() {
    RPG.commitSceneFields();
    return {
      formatVersion: SESSION_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      currentSceneId: RPG.getCurrentSceneId(),
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
    RPG.logEvent('Exportou backup da sessÃ£o');
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
      throw new Error('Arquivo de sessÃ£o invÃ¡lido.');
    }

    await Promise.all(payload.scenes.map(rebuildSceneMapImg));

    scenes.length = 0;
    scenes.push(...payload.scenes);
    folders.length = 0;
    folders.push(...(payload.folders || []));
    RPG.setNextFolderId(payload.nextFolderId || (Math.max(0, ...folders.map(f => f.id)) + 1));
    RPG.clearSceneMultiSelect();
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
    RPG.setCurrentSceneId(targetId);
    RPG.setNextSceneId(payload.nextSceneId || (Math.max(0, ...scenes.map(s => s.id)) + 1));
    state.map = target.map;
    state.fog = target.fog;
    state.notes = target.notes || [];
    state.objects = target.objects || [];
    state.grid = target.grid;
    state.combat = target.combat;
    state.nextFogId = target.nextFogId;
    state.nextNoteId = target.nextNoteId || 1;
    state.nextObjectId = target.nextObjectId || 1;

    RPG.refreshVisibleTokens();
    RPG.syncSceneControlsFromState();
    RPG.renderSceneList();
    RPG.renderTokenList();
    RPG.renderObjectList();
    RPG.renderParty();
    RPG.updateHud();
    RPG.draw();
    RPG.sendState(true);
  }

  function importSession(file) {
    file.text()
      .then(text => {
        const payload = JSON.parse(text);
        return applySessionPayload(payload).then(() => payload);
      })
      .then((payload) => {
        RPG.logEvent('Importou backup de sessÃ£o');
        return recordVersion('import', file.name, payload).then(renderVersionHistory);
      })
      .catch((err) => {
        console.error(err);
        alert('Falha ao importar sessÃ£o: ' + err.message);
      });
  }

  function restoreVersion(id) {
    getVersionEntry(id)
      .then((entry) => {
        if (!entry) throw new Error('VersÃ£o nÃ£o encontrada.');
        if (!confirm(`Restaurar "${entry.filename}"? Isso substitui TUDO na sessÃ£o atual.`)) return;
        return applySessionPayload(entry.payload).then(() => {
          RPG.logEvent(`Restaurou versÃ£o "${entry.filename}"`);
        });
      })
      .catch((err) => {
        console.error(err);
        alert('Falha ao restaurar versÃ£o: ' + err.message);
      });
  }

  // ---------- Clear session (Ajustes > SessÃ£o > "ðŸ§¹ Limpar sessÃ£o") ----------
  // The app's factory state, snapshotted at load time â€” BEFORE the autosave
  // restore below runs, so it's exactly what a first-ever visit looks like
  // (one empty scene, no tokens, default party bars).
  // Deep-cloned through JSON so later mutations can't reach back into it.
  const PRISTINE_PAYLOAD = JSON.parse(JSON.stringify(buildSessionPayload()));

  // Wipe EVERYTHING back to that factory state: all scenes, all tokens, party
  // bars, glossary, maps/photos, settings, the undo stack + event log, and the
  // localStorage autosave. The IndexedDB version history (exported/imported
  // .json backups) is deliberately kept â€” it's the escape hatch if this was a
  // mistake. Not undoable, hence the #confirmClearOverlay confirmation.
  function clearSession() {
    RPG.closeNotePostit();
    RPG.closeContextMenu();
    RPG.stopCombat();          // resets the combat bar/button UI, not just the flag
    RPG.removeMap(true);       // silent â€” clears the map file input + controls
    return applySessionPayload(JSON.parse(JSON.stringify(PRISTINE_PAYLOAD)))
      .then(() => {
        RPG.centerView();
        RPG.resetHistory();
        clearAutosave();
        RPG.logEvent('Limpou a sessÃ£o inteira');
      })
      .catch((err) => {
        console.error(err);
        alert('Falha ao limpar a sessÃ£o: ' + err.message);
      });
  }

  // ---------- Autosave para IndexedDB (sem limite de tamanho) ----------
  // Cache em memÃ³ria usado pelo beforeunload sÃ­ncrono â€” garante que a Ãºltima
  // versÃ£o conhecida seja persistida mesmo que o browser feche antes do
  // await do IndexedDB terminar.
  let autosaveMemCache = null;
  let autosaveTimer = null;

  async function autosaveNow() {
    const payload = buildSessionPayload();
    autosaveMemCache = payload; // atualiza o cache sÃ­ncrono
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(AS_STORE, 'readwrite');
        tx.objectStore(AS_STORE).put(payload, AS_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      // MigraÃ§Ã£o: limpa entrada antiga do localStorage se ainda existir
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
    } catch (err) {
      console.error('Autosave IndexedDB falhou:', err);
    }
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, AUTOSAVE_DEBOUNCE_MS);
  }

  async function hasAutosave() {
    // Verifica IndexedDB primeiro; cai para localStorage (migraÃ§Ã£o de dados antigos)
    try {
      const db = await openDb();
      const val = await new Promise((resolve, reject) => {
        const tx = db.transaction(AS_STORE, 'readonly');
        const req = tx.objectStore(AS_STORE).get(AS_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (val) return true;
    } catch (_) {}
    // Fallback legado
    try { return !!localStorage.getItem(AUTOSAVE_KEY); } catch (_) { return false; }
  }

  async function restoreAutosave() {
    let payload = null;
    try {
      const db = await openDb();
      payload = await new Promise((resolve, reject) => {
        const tx = db.transaction(AS_STORE, 'readonly');
        const req = tx.objectStore(AS_STORE).get(AS_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (_) {}
    // MigraÃ§Ã£o: tenta localStorage se IndexedDB nÃ£o tiver nada
    if (!payload) {
      try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (raw) {
          payload = JSON.parse(raw);
          // Move para IndexedDB e limpa o localStorage
          await autosaveNow();
          localStorage.removeItem(AUTOSAVE_KEY);
        }
      } catch (_) {}
    }
    if (!payload) return false;
    await applySessionPayload(payload);
    return true;
  }

  async function clearAutosave() {
    autosaveMemCache = null;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(AS_STORE, 'readwrite');
        tx.objectStore(AS_STORE).delete(AS_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) {}
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
  }

  // beforeunload Ã© sÃ­ncrono â€” nÃ£o dÃ¡ para usar await aqui.
  // Usamos o cache em memÃ³ria para garantir que o payload mais recente
  // seja lanÃ§ado para o IndexedDB (fire-and-forget), e como fallback
  // escrevemos uma versÃ£o compacta no sessionStorage (dura sÃ³ atÃ© fechar a aba).
  window.addEventListener('beforeunload', () => {
    const payload = autosaveMemCache || buildSessionPayload();
    // Fire-and-forget para IndexedDB
    openDb().then(db => {
      const tx = db.transaction(AS_STORE, 'readwrite');
      tx.objectStore(AS_STORE).put(payload, AS_KEY);
    }).catch(() => {});
  });

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

  // ---------- Expose to RPG ----------
  RPG.exportSession = exportSession;
  RPG.importSession = importSession;
  RPG.scheduleAutosave = scheduleAutosave;
  RPG.hasAutosave = hasAutosave;
  RPG.restoreAutosave = restoreAutosave;
  RPG.clearAutosave = clearAutosave;
  RPG.clearSession = clearSession;
  RPG.renderVersionHistory = renderVersionHistory;

  // ---------- Restore on load, if an autosave exists ----------
  hasAutosave().then((has) => {
    if (!has) return;
    return restoreAutosave()
      .then((restored) => {
        if (restored) {
          RPG.logEvent('SessÃ£o restaurada automaticamente (autosave)');
        }
      });
  }).catch((err) => {
    console.error('Falha ao restaurar autosave:', err);
    clearAutosave();
  });

  // ---------- Periodic autosave (catches changes beyond the debounce window) ----------
  setInterval(autosaveNow, 30000);

  // ---------- Settings modal buttons ----------
  const exportBtn = document.getElementById('exportSessionBtn');
  const importBtn = document.getElementById('importSessionBtn');
  const importInput = document.getElementById('importSessionInput');

  exportBtn.addEventListener('click', exportSession);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (!confirm('Importar esta sessÃ£o vai substituir TUDO na sessÃ£o atual (cenas, tokens, mapas). Continuar?')) return;
    RPG.importSession(file);
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
