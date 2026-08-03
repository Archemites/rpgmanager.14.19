/* ============================================================
   Player sync: postMessage receiver ('rpg-state'), 'rpg-player-ready'
   handshake, status banner, init. Loads absolute last among player files.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const showStatus = window.RPG.showStatus;

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg && msg.type === 'rpg-fx') {
      if (window.RPG.spawnFx) window.RPG.spawnFx(msg.fxType, msg.x, msg.y, msg.opts);
      return;
    }
    // whole-app theme skin, mirrored from the GM window (see js/gm/theme.js)
    if (msg && msg.type === 'rpg-theme') {
      const THEMES = ['cyberpunk', 'dnd', 'cthulhu', 'black', 'cream'];
      const theme = THEMES.includes(msg.theme) ? msg.theme : 'cyberpunk';
      document.documentElement.setAttribute('data-theme', theme);
      return;
    }
    if (!msg || msg.type !== 'rpg-state') return;

    // bump on every incoming state so frozen-memory cell snapshots know to
    // re-render (see js/player/vision-fog.js's dirtyVersion) — cheap counter,
    // avoids diffing tokens/walls/objects to decide if a repaint is needed
    window.RPG.sceneVersion = (window.RPG.sceneVersion || 0) + 1;

    state.grid = msg.grid;
    state.tokens = msg.tokens;
    state.fog = msg.fog || [];
    state.walls = msg.walls || [];
    state.objects = msg.objects || [];
    state.wallOcclusionMethod = msg.wallOcclusionMethod || 'cell';
    state.activeVisionTokenId = ('activeVisionTokenId' in msg) ? msg.activeVisionTokenId : null;
    state.map.scalePct = msg.map.scalePct;
    state.map.bgColor = msg.map.bgColor || '#03140a';
    state.combat = msg.combat || { active: false, order: [] };
    state.partyBars = msg.partyBars || [];
    state.lighting = (typeof msg.lighting === 'number') ? msg.lighting : 1;
    window.RPG.renderCombatBar();

    // dataUrl: string = new map, null = map removed, absent = unchanged
    if ('dataUrl' in msg.map) {
      if (msg.map.dataUrl) {
        if (state.map._loadedUrl !== msg.map.dataUrl) {
          window.RPG.resetExplorationMemory();  // new map: old explored coordinates no longer apply
          const img = new Image();
          img.onload = () => {
            state.map.img = img;
            state.map._loadedUrl = msg.map.dataUrl;
            window.RPG.draw();
          };
          img.src = msg.map.dataUrl;
        }
      } else {
        state.map.img = null;
        state.map._loadedUrl = null;
        window.RPG.resetExplorationMemory();
      }
    }

    showStatus('Conectado ao mestre ✓', true);
    window.RPG.draw();
  });

  // ask the master (opener) for the current state
  if (window.opener) {
    window.opener.postMessage({ type: 'rpg-player-ready' }, '*');
  } else {
    showStatus('Abra esta tela pelo botão "Tela do jogador" no app do mestre.');
  }

  // ---------- Init ----------
  window.RPG.resizeCanvas();
  window.RPG.centerView();
})();
