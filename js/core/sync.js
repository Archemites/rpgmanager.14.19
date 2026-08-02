/* ============================================================
   Sync: master-player postMessage protocol
   ============================================================ */

(function() {
  'use strict';

  let playerWin = null;

  function sendState(includeMap) {
    if (!playerWin || playerWin.closed) return;
    const map = { scalePct: window.RPG.state.map.scalePct };
    if (includeMap) map.dataUrl = window.RPG.state.map.dataUrl;
    playerWin.postMessage({
      type: 'rpg-state',
      grid: window.RPG.state.grid,
      tokens: window.RPG.state.tokens,
      fog: window.RPG.state.fog,
      map,
      combat: window.RPG.state.combat,
      partyBars: window.RPG.state.partyBars,
    }, '*');
  }

  function openPlayerWindow() {
    if (playerWin && !playerWin.closed) { playerWin.focus(); return; }
    playerWin = window.open('player.html', 'rpg-player', 'width=1024,height=768');
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'rpg-player-ready') sendState(true);
  });

  // Expose via shared namespace
  window.RPG = window.RPG || {};
  window.RPG.sendState = sendState;
  window.RPG.playerWin = { get: () => playerWin, set: (w) => { playerWin = w; } };
  window.RPG.openPlayerWindow = openPlayerWindow;

  // Master window's open player button
  if (typeof document !== 'undefined') {
    const btn = document.getElementById('openPlayerBtn');
    if (btn) btn.addEventListener('click', openPlayerWindow);
  }
})();
