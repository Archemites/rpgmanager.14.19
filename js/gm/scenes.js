/* ============================================================
   GM scenes: scenes[]/currentSceneId/bringCarry — the only file that touches
   scenes[]/currentSceneId directly. Everything else reads the CURRENT
   scene's data through the flattened `state` object as if there were only
   ever one scene. See ARCHITECTURE.md "Scenes".

   Forward-reference hazard: switchScene() touches combatBar (js/gm/combat.js)
   and calls sendState()/renderTokenList()/renderParty() (js/gm/sync.js,
   js/gm/token-list.js, js/gm/party.js) — all fine since those are only
   invoked at CALL TIME (by the time js/gm/init.js runs), not at parse time.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;
  const viewport = window.RPG.viewport;
  const canvas = window.RPG.canvas;
  const screenToWorld = window.RPG.screenToWorld;

  let nextSceneId = 2;
  const scenes = [
    { id: 1, name: 'Cena 1', map: { img: null, scalePct: 100, dataUrl: null, bgColor: null }, fog: [], walls: [], notes: [], objects: [],
      grid: { show: true, size: 48, color: null }, combat: { active: false, order: [] },
      nextFogId: 1, nextWallId: 1, nextNoteId: 1, nextObjectId: 1, folderId: null },
  ];
  let currentSceneId = 1;

  // Scene folders: a flat (non-nested) grouping, sibling state to scenes[].
  // Each scene optionally carries a folderId (null = ungrouped) rather than a
  // folder owning an id-list — mirrors the flat-field style of the scene
  // object itself and forbids a scene from being in two folders at once.
  let nextFolderId = 1;
  const folders = [];   // { id, name, collapsed }

  // Transient multi-select (Ctrl+click), UI-only: not persisted, not synced
  // to the player, not undoable. Feeds "group into folder".
  let multiSelectedSceneIds = new Set();

  function currentScene() {
    return scenes.find(s => s.id === currentSceneId);
  }

  // Tokens present in the currently open scene (have a position entry for it).
  function visibleTokens() {
    return allTokens.filter(t => t.scenes && t.scenes[currentSceneId]);
  }

  // Recompute `state.tokens` (the view) from `allTokens` — call after any
  // create/remove/scene-switch/bring-to-scene operation.
  function refreshVisibleTokens() {
    state.tokens = visibleTokens();
  }

  // Pull a token's cached scene-local x/y out into its per-scene position map —
  // called before switching away from a scene, for every token visible in it.
  function commitTokenPosition(t) {
    if (!t.scenes || !t.scenes[currentSceneId]) return;
    t.scenes[currentSceneId] = { x: t.x, y: t.y };
  }

  // Snapshot the open scene's mutable fields (fog/walls/map/grid/combat/id
  // counters) from `state` back into its `scenes[]` entry.
  function commitSceneFields() {
    const sc = currentScene();
    if (!sc) return;
    sc.map = state.map;
    sc.fog = state.fog;
    sc.walls = state.walls;
    sc.notes = state.notes;
    sc.objects = state.objects;
    sc.grid = state.grid;
    sc.combat = state.combat;
    sc.nextFogId = state.nextFogId;
    sc.nextWallId = state.nextWallId;
    sc.nextNoteId = state.nextNoteId;
    sc.nextObjectId = state.nextObjectId;
    for (const t of visibleTokens()) commitTokenPosition(t);
  }

  // Switch the open scene to `sceneId`: commit the current scene's fields +
  // token positions, then load the target scene's fields onto `state` and
  // sync each of its tokens' x/y from their per-scene position.
  function switchScene(sceneId) {
    const target = scenes.find(s => s.id === sceneId);
    if (!target || sceneId === currentSceneId) return;
    commitSceneFields();
    currentSceneId = sceneId;
    state.map = target.map;
    state.fog = target.fog;
    state.walls = target.walls;
    state.notes = target.notes || [];
    state.objects = target.objects || [];
    state.grid = target.grid;
    state.combat = target.combat;
    state.nextFogId = target.nextFogId;
    state.nextWallId = target.nextWallId;
    state.nextNoteId = target.nextNoteId || 1;
    state.nextObjectId = target.nextObjectId || 1;
    state.selectedTokenId = null;
    state.selectedTokenIds = [];
    state.selectedObjectId = null;
    for (const t of allTokens) {
      const pos = t.scenes && t.scenes[sceneId];
      if (pos) { t.x = pos.x; t.y = pos.y; }
    }
    refreshVisibleTokens();
    window.RPG.syncSceneControlsFromState();
    window.RPG.renderSceneList();
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    const combatBar = document.getElementById('combatBar');
    combatBar.classList.toggle('open', state.combat.active);
    if (state.combat.active) window.RPG.renderCombatBar();
    window.RPG.updateHud();
    window.RPG.draw();
    // hold back the player window until the GM explicitly confirms — they may
    // need to set up fog/tokens in the new scene before players see it
    window.RPG.setSceneSyncPending(true);
    document.getElementById('updatePlayerBtn').classList.add('pending');
  }

  function createScene(name) {
    const sc = {
      id: nextSceneId++,
      name: name || `Cena ${scenes.length + 1}`,
      // bgColor: null = no manual override, follows the current theme's --map-bg
      map: { img: null, scalePct: 100, dataUrl: null, bgColor: null },
      fog: [], walls: [], notes: [], objects: [],
      grid: { show: true, size: 48, color: null },  // null = no manual override, follows theme's --accent
      combat: { active: false, order: [] },
      nextFogId: 1, nextWallId: 1, nextNoteId: 1, nextObjectId: 1,
      folderId: null,
    };
    scenes.push(sc);
    window.RPG.renderSceneList();
    return sc;
  }

  // Rename a scene (first rename affordance in the app — click-to-edit via
  // renderSceneList()'s inline-rename, see startInlineRename()).
  function renameScene(sceneId, name) {
    const sc = scenes.find(s => s.id === sceneId);
    if (!sc) return;
    const trimmed = (name || '').trim();
    if (trimmed) sc.name = trimmed;
    renderSceneList();
  }

  // ---------- Scene folders (flat grouping, see data model comment above) ----------

  // Groups the given scenes into a brand-new folder, clearing the multi-
  // selection that fed it. name=null uses a default "Pasta N" label — the
  // "group into folder" button opens inline-rename right after, so the GM
  // usually never sees the default name.
  function createFolder(name, sceneIds) {
    if (!sceneIds || sceneIds.length === 0) return null;
    const folder = { id: nextFolderId++, name: (name || '').trim() || `Pasta ${folders.length + 1}`, collapsed: false };
    folders.push(folder);
    for (const id of sceneIds) {
      const sc = scenes.find(s => s.id === id);
      if (sc) sc.folderId = folder.id;
    }
    multiSelectedSceneIds.clear();
    renderSceneList();
    return folder;
  }

  function renameFolder(folderId, name) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const trimmed = (name || '').trim();
    if (trimmed) folder.name = trimmed;
    renderSceneList();
  }

  // Ungroups every member scene (folderId -> null) and removes the folder
  // itself — never deletes the scenes it contained.
  function deleteFolder(folderId) {
    for (const sc of scenes) {
      if (sc.folderId === folderId) sc.folderId = null;
    }
    const idx = folders.findIndex(f => f.id === folderId);
    if (idx !== -1) folders.splice(idx, 1);
    renderSceneList();
  }

  // folderId=null moves the scene back to the top-level ungrouped area.
  function moveSceneToFolder(sceneId, folderId) {
    const sc = scenes.find(s => s.id === sceneId);
    if (!sc) return;
    sc.folderId = folderId;
    renderSceneList();
  }

  function toggleFolderCollapsed(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    folder.collapsed = !folder.collapsed;
    renderSceneList();
  }

  function toggleSceneMultiSelect(sceneId) {
    if (multiSelectedSceneIds.has(sceneId)) multiSelectedSceneIds.delete(sceneId);
    else multiSelectedSceneIds.add(sceneId);
    renderSceneList();
  }

  // "Bring to scene" carry: a party member from another scene follows the
  // cursor (ghost preview, see draw()) until the GM clicks the map to drop it
  // into the currently open scene at that spot. See startBringToken()/draw()'s ghost.
  const bringCarry = {
    active: false,
    token: null,
    worldX: 0, worldY: 0,
  };

  // Start "carrying" a party member from another scene: it follows the cursor
  // (ghost preview, see draw()) until the next left-click on the map, which
  // drops it into the CURRENT scene at that spot. Any other click cancels.
  function startBringToken(t) {
    bringCarry.active = true;
    bringCarry.token = t;
    const c = screenToWorld(viewport.clientWidth / 2, viewport.clientHeight / 2);
    bringCarry.worldX = c.x;
    bringCarry.worldY = c.y;
    canvas.classList.add('bring-mode');
    window.RPG.draw();
  }

  // Move a token into the current scene at (x, y) — a FULL migration: the
  // token is removed from every other scene's presence map first, so it
  // exists in exactly one scene at a time (no leftover clone/duplicate on
  // the scene it came from).
  function bringTokenToCurrentScene(t, x, y) {
    t.scenes = { [currentSceneId]: { x, y } };
    t.x = x;
    t.y = y;
    refreshVisibleTokens();
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    window.RPG.renderSceneList();
    window.RPG.draw();
    window.RPG.sendState();
  }

  // ---------- Scene sidebar ----------
  const sceneListEl = document.getElementById('sceneList');
  const addSceneBtn = document.getElementById('addSceneBtn');
  const groupScenesBtn = document.getElementById('groupScenesBtn');
  const THUMB_W = 200, THUMB_H = 150;  // logical size of each mini-map canvas

  addSceneBtn.addEventListener('click', () => {
    const sc = createScene();
    switchScene(sc.id);
  });

  // Groups the current multi-selection into a new folder, then immediately
  // opens the folder's name for inline-rename (no blocking prompt) — see
  // startInlineRename().
  groupScenesBtn.addEventListener('click', () => {
    const folder = createFolder(null, [...multiSelectedSceneIds]);
    if (!folder) return;
    const nameEl = sceneListEl.querySelector(`.scene-folder[data-folder-id="${folder.id}"] .scene-folder-name`);
    if (nameEl) startInlineRename(nameEl, folder.name, (val) => renameFolder(folder.id, val));
  });

  // ---------- Delete scene (with confirmation) ----------
  const confirmSceneOverlay = document.getElementById('confirmSceneOverlay');
  const confirmSceneName = document.getElementById('confirmSceneName');
  const confirmSceneCancelBtn = document.getElementById('confirmSceneCancelBtn');
  const confirmSceneDeleteBtn = document.getElementById('confirmSceneDeleteBtn');
  let pendingDeleteSceneId = null;

  function askDeleteScene(sc) {
    if (scenes.length <= 1) {
      alert('Não é possível excluir a única cena.');
      return;
    }
    pendingDeleteSceneId = sc.id;
    confirmSceneName.textContent = sc.name;
    confirmSceneOverlay.classList.add('open');
  }

  function closeConfirmScene() {
    confirmSceneOverlay.classList.remove('open');
    pendingDeleteSceneId = null;
  }

  confirmSceneCancelBtn.addEventListener('click', closeConfirmScene);
  confirmSceneOverlay.addEventListener('click', (e) => { if (e.target === confirmSceneOverlay) closeConfirmScene(); });
  confirmSceneDeleteBtn.addEventListener('click', () => {
    if (pendingDeleteSceneId !== null) deleteScene(pendingDeleteSceneId);
    closeConfirmScene();
  });

  // Removes a scene entirely: if it's the open one, switches to another scene
  // first (commits nothing FROM the deleted scene — its fields are discarded).
  // Tokens present only in this scene lose their presence there (their
  // `scenes` map entry for this id); a token present in other scenes too is
  // unaffected, matching how a token's per-scene presence already works
  // elsewhere (see "State management" in ARCHITECTURE.md).
  function deleteScene(sceneId) {
    if (scenes.length <= 1) return;
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) return;

    if (sceneId === currentSceneId) {
      const fallback = scenes.find(s => s.id !== sceneId);
      switchScene(fallback.id);
    }

    scenes.splice(scenes.findIndex(s => s.id === sceneId), 1);
    for (const t of allTokens) {
      if (t.scenes && t.scenes[sceneId]) delete t.scenes[sceneId];
    }
    refreshVisibleTokens();
    window.RPG.renderSceneList();
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    window.RPG.logEvent('Excluiu cena');
    window.RPG.draw();
    window.RPG.sendState();
  }

  // World-space window a scene's thumbnail renders: the map's own bounding box
  // (centered on world origin, same convention as the main canvas), falling
  // back to a generic square if the scene has no map yet.
  function sceneWorldBounds(sc) {
    if (sc.map.img) {
      const scale = sc.map.scalePct / 100;
      const mw = sc.map.img.naturalWidth * scale;
      const mh = sc.map.img.naturalHeight * scale;
      return { w: mw, h: mh };
    }
    return { w: 800, h: 600 };
  }

  function drawSceneThumb(canvasEl, sc) {
    const tctx = canvasEl.getContext('2d');
    tctx.clearRect(0, 0, THUMB_W, THUMB_H);
    tctx.fillStyle = sc.map.bgColor || window.RPG.getThemeMapBg();
    tctx.fillRect(0, 0, THUMB_W, THUMB_H);
    if (sc.map.img) {
      const scale = sc.map.scalePct / 100;
      const mw = sc.map.img.naturalWidth * scale;
      const mh = sc.map.img.naturalHeight * scale;
      const fit = Math.min(THUMB_W / mw, THUMB_H / mh);
      const dw = mw * fit, dh = mh * fit;
      tctx.drawImage(sc.map.img, (THUMB_W - dw) / 2, (THUMB_H - dh) / 2, dw, dh);
    }
  }

  // Convert a scene-local world point to thumbnail-canvas pixel coords (the
  // same fit/center math as drawSceneThumb, so token dots align with the map).
  function sceneWorldToThumbPx(sc, wx, wy) {
    const b = sceneWorldBounds(sc);
    const fit = Math.min(THUMB_W / b.w, THUMB_H / b.h);
    const originX = THUMB_W / 2, originY = THUMB_H / 2;
    return { x: originX + wx * fit, y: originY + wy * fit };
  }
  function thumbPxToSceneWorld(sc, px, py) {
    const b = sceneWorldBounds(sc);
    const fit = Math.min(THUMB_W / b.w, THUMB_H / b.h);
    const originX = THUMB_W / 2, originY = THUMB_H / 2;
    return { x: (px - originX) / fit, y: (py - originY) / fit };
  }

  // Shared inline-edit affordance for scene names + folder names (the only
  // rename UI in the app — no modal/prompt() convention exists to reuse).
  // Replaces `labelEl`'s text with a temporary input; Enter/blur commits via
  // `onCommit(value)`, Escape cancels and restores the original text.
  function startInlineRename(labelEl, currentValue, onCommit) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-rename-input';
    input.value = currentValue;
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function commit() {
      if (done) return;
      done = true;
      onCommit(input.value);
    }
    function cancel() {
      if (done) return;
      done = true;
      renderSceneList();
    }
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
  }

  // Builds one .scene-card element (thumbnail, token dots, header, remove
  // button, click-to-switch/multi-select, click-to-rename, drag-to-folder).
  // Shared by both the folder branch and the ungrouped branch of
  // renderSceneList() so per-card behavior isn't duplicated.
  function buildSceneCard(sc) {
    const card = document.createElement('div');
    card.className = 'scene-card'
      + (sc.id === currentSceneId ? ' active' : '')
      + (multiSelectedSceneIds.has(sc.id) ? ' multi-selected' : '');
    card.dataset.sceneId = sc.id;

    const nameEl = document.createElement('div');
    nameEl.className = 'scene-card-name';
    nameEl.textContent = sc.name;
    nameEl.title = 'Clique para renomear';
    nameEl.addEventListener('click', (e) => {
      if (e.ctrlKey) return;  // Ctrl+click is reserved for multi-select
      e.stopPropagation();
      startInlineRename(nameEl, sc.name, (val) => renameScene(sc.id, val));
    });

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'scene-card-thumb';
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = THUMB_W;
    thumbCanvas.height = THUMB_H;
    thumbWrap.appendChild(thumbCanvas);
    drawSceneThumb(thumbCanvas, sc);

    // token dots — the token being viewed here may be the live-edited copy
    // (if this is the open scene) or its committed per-scene position
    const isOpenScene = sc.id === currentSceneId;
    for (const t of allTokens) {
      const pos = isOpenScene ? (t.scenes && t.scenes[sc.id] ? { x: t.x, y: t.y } : null) : (t.scenes && t.scenes[sc.id]);
      if (!pos) continue;
      const dot = document.createElement('div');
      dot.className = 'scene-token-dot';
      const ppx = sceneWorldToThumbPx(sc, pos.x, pos.y);
      const dotSize = 10;
      dot.style.left = (ppx.x - dotSize / 2) + 'px';
      dot.style.top = (ppx.y - dotSize / 2) + 'px';
      dot.style.width = dotSize + 'px';
      dot.style.height = dotSize + 'px';
      dot.style.background = t.color;
      dot.title = t.name || `Token ${t.id}`;
      attachSceneDotHandlers(dot, thumbWrap, sc, t);
      thumbWrap.appendChild(dot);
    }

    const header = document.createElement('div');
    header.className = 'scene-card-header';
    header.appendChild(nameEl);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'scene-card-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Excluir cena';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      askDeleteScene(sc);
    });
    header.appendChild(removeBtn);

    card.appendChild(header);
    card.appendChild(thumbWrap);
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('scene-token-dot')) return;
      if (e.target.closest('.inline-rename-input')) return;
      if (e.ctrlKey) { toggleSceneMultiSelect(sc.id); return; }
      switchScene(sc.id);
    });
    attachSceneCardDragHandlers(card, sc);
    return card;
  }

  function renderSceneList() {
    sceneListEl.innerHTML = '';

    // Bucket scenes by folderId in one pass, preserving scenes[] order.
    const byFolder = new Map();
    const ungrouped = [];
    for (const sc of scenes) {
      if (sc.folderId != null && folders.some(f => f.id === sc.folderId)) {
        if (!byFolder.has(sc.folderId)) byFolder.set(sc.folderId, []);
        byFolder.get(sc.folderId).push(sc);
      } else {
        ungrouped.push(sc);
      }
    }

    for (const folder of folders) {
      const wrap = document.createElement('div');
      wrap.className = 'scene-folder';
      wrap.dataset.folderId = folder.id;

      const header = document.createElement('div');
      header.className = 'scene-folder-header';

      const collapseIcon = document.createElement('span');
      collapseIcon.className = 'scene-folder-collapse-icon' + (folder.collapsed ? ' collapsed' : '');
      collapseIcon.textContent = '▾';

      const nameEl = document.createElement('div');
      nameEl.className = 'scene-folder-name';
      nameEl.textContent = folder.name;
      nameEl.title = 'Clique para renomear';
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineRename(nameEl, folder.name, (val) => renameFolder(folder.id, val));
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'scene-folder-delete-btn';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Desagrupar pasta';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(folder.id);
      });

      header.appendChild(collapseIcon);
      header.appendChild(nameEl);
      header.appendChild(deleteBtn);
      header.addEventListener('click', (e) => {
        if (e.target === nameEl || e.target === deleteBtn) return;
        toggleFolderCollapsed(folder.id);
      });

      const body = document.createElement('div');
      body.className = 'scene-folder-body' + (folder.collapsed ? ' collapsed' : '');
      for (const sc of (byFolder.get(folder.id) || [])) {
        body.appendChild(buildSceneCard(sc));
      }

      wrap.appendChild(header);
      wrap.appendChild(body);
      sceneListEl.appendChild(wrap);
    }

    for (const sc of ungrouped) {
      sceneListEl.appendChild(buildSceneCard(sc));
    }

    groupScenesBtn.disabled = multiSelectedSceneIds.size < 2;
  }

  // Drag a token's dot within its scene's thumbnail to reposition it there
  // (without opening that scene); double-click brings it into the CURRENT
  // scene, at the same relative spot, and switches selection to it.
  function attachSceneDotHandlers(dot, thumbWrap, sc, t) {
    let dragging = false;
    dot.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      const onMove = (ev) => {
        if (!dragging) return;
        const rect = thumbWrap.getBoundingClientRect();
        const px = Math.max(0, Math.min(THUMB_W, ev.clientX - rect.left));
        const py = Math.max(0, Math.min(THUMB_H, ev.clientY - rect.top));
        dot.style.left = (px - 5) + 'px';
        dot.style.top = (py - 5) + 'px';
      };
      const onUp = (ev) => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const rect = thumbWrap.getBoundingClientRect();
        const px = Math.max(0, Math.min(THUMB_W, ev.clientX - rect.left));
        const py = Math.max(0, Math.min(THUMB_H, ev.clientY - rect.top));
        const world = thumbPxToSceneWorld(sc, px, py);
        if (sc.id === currentSceneId) {
          // live scene — update the token's cached x/y directly
          t.x = world.x;
          t.y = world.y;
          refreshVisibleTokens();
          window.RPG.draw();
          window.RPG.sendState();
        } else {
          t.scenes[sc.id] = { x: world.x, y: world.y };
        }
        renderSceneList();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
    dot.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sc.id === currentSceneId) return;  // already in the open scene
      const pos = t.scenes[sc.id];
      bringTokenToCurrentScene(t, pos.x, pos.y);
      state.selectedTokenId = t.id;
    });
  }

  // Drag a scene card into/out of a folder. Raw mouse events (not HTML5 DnD),
  // matching attachSceneDotHandlers/note-postit.js's drag pattern elsewhere
  // in this codebase. A drag under DRAG_THRESHOLD px is ignored so a plain
  // click still reaches the card's own click handler unimpeded (both
  // listeners coexist without preventDefault/stopPropagation conflicts).
  const DRAG_THRESHOLD = 4;
  function attachSceneCardDragHandlers(card, sc) {
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.scene-token-dot, .scene-card-remove-btn, .inline-rename-input, .scene-card-name')) return;
      const startX = e.clientX, startY = e.clientY;
      let dragging = false;
      let currentTarget = null;

      function resolveDropTarget(clientX, clientY) {
        const el = document.elementFromPoint(clientX, clientY);
        if (!el) return null;
        return el.closest('.scene-folder') || (el.closest('#sceneList') ? sceneListEl : null);
      }

      function onMove(ev) {
        if (!dragging) {
          if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD && Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
          dragging = true;
          card.classList.add('dragging');
        }
        const target = resolveDropTarget(ev.clientX, ev.clientY);
        if (target !== currentTarget) {
          if (currentTarget) currentTarget.classList.remove('drop-target');
          if (target) target.classList.add('drop-target');
          currentTarget = target;
        }
      }

      function onUp(ev) {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (!dragging) return;
        card.classList.remove('dragging');
        if (currentTarget) currentTarget.classList.remove('drop-target');
        const target = resolveDropTarget(ev.clientX, ev.clientY);
        if (target && target.classList.contains('scene-folder')) {
          moveSceneToFolder(sc.id, Number(target.dataset.folderId));
        } else if (target === sceneListEl) {
          moveSceneToFolder(sc.id, null);
        }
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.scenes = scenes;
  window.RPG.getCurrentSceneId = () => currentSceneId;
  window.RPG.setCurrentSceneId = (id) => { currentSceneId = id; };
  window.RPG.setNextSceneId = (id) => { nextSceneId = id; };
  window.RPG.commitSceneFields = commitSceneFields;
  window.RPG.currentScene = currentScene;
  window.RPG.visibleTokens = visibleTokens;
  window.RPG.refreshVisibleTokens = refreshVisibleTokens;
  window.RPG.switchScene = switchScene;
  window.RPG.createScene = createScene;
  window.RPG.bringCarry = bringCarry;
  window.RPG.startBringToken = startBringToken;
  window.RPG.bringTokenToCurrentScene = bringTokenToCurrentScene;
  window.RPG.renderSceneList = renderSceneList;
  window.RPG.renameScene = renameScene;
  window.RPG.folders = folders;
  window.RPG.createFolder = createFolder;
  window.RPG.renameFolder = renameFolder;
  window.RPG.deleteFolder = deleteFolder;
  window.RPG.moveSceneToFolder = moveSceneToFolder;
  window.RPG.toggleFolderCollapsed = toggleFolderCollapsed;
  window.RPG.toggleSceneMultiSelect = toggleSceneMultiSelect;
  window.RPG.getMultiSelectedSceneIds = () => multiSelectedSceneIds;
  window.RPG.setNextFolderId = (id) => { nextFolderId = id; };
  window.RPG.clearSceneMultiSelect = () => { multiSelectedSceneIds.clear(); };
})();
