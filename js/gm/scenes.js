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
    { id: 1, name: 'Cena 1', map: { img: null, scalePct: 100, dataUrl: null, bgColor: '#03140a' }, fog: [], walls: [], notes: [], objects: [],
      grid: { show: true, size: 48, color: '#45ff78' }, combat: { active: false, order: [] },
      nextFogId: 1, nextWallId: 1, nextNoteId: 1, nextObjectId: 1 },
  ];
  let currentSceneId = 1;

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
      map: { img: null, scalePct: 100, dataUrl: null, bgColor: '#03140a' },
      fog: [], walls: [], notes: [], objects: [],
      grid: { show: true, size: 48, color: '#45ff78' },
      combat: { active: false, order: [] },
      nextFogId: 1, nextWallId: 1, nextNoteId: 1, nextObjectId: 1,
    };
    scenes.push(sc);
    window.RPG.renderSceneList();
    return sc;
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
  const THUMB_W = 200, THUMB_H = 150;  // logical size of each mini-map canvas

  addSceneBtn.addEventListener('click', () => {
    const sc = createScene();
    switchScene(sc.id);
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
    tctx.fillStyle = sc.map.bgColor || '#03140a';
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

  function renderSceneList() {
    sceneListEl.innerHTML = '';
    for (const sc of scenes) {
      const card = document.createElement('div');
      card.className = 'scene-card' + (sc.id === currentSceneId ? ' active' : '');

      const nameEl = document.createElement('div');
      nameEl.className = 'scene-card-name';
      nameEl.textContent = sc.name;

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
        switchScene(sc.id);
      });
      sceneListEl.appendChild(card);
    }
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
})();
