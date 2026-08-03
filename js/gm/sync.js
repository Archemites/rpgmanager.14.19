/* ============================================================
   GM sync: sendState/sendStateForced, sceneSyncPending gate, postMessage to
   the player window. See ARCHITECTURE.md "Player sync protocol" +
   "Player sync gate".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  let playerWin = null;

  // Gate that holds back sendState() after a scene switch: the GM may need to
  // set up fog/tokens in the new scene before the players see it. While
  // pending, every sendState() call is silently dropped — the player window
  // keeps showing the OLD scene exactly as it was — until the GM clicks
  // "🔄 Atualizar tela do jogador", which clears the gate and force-sends.
  let sceneSyncPending = false;

  // Dozens of call sites (token drag, wall/fog drawing, rotation) call
  // sendState() on every 'mousemove' — postMessage structured-clones the
  // whole tokens/fog/walls/objects payload AND makes the player window redo
  // its full draw()+fog composite, so firing it on every pixel of mouse
  // movement was costing real frame time on both windows for no visible
  // benefit (the player only ever sees the latest position anyway).
  // Coalesce to at most one send per animation frame; sendStateForced always
  // bypasses this (immediate) since it's a deliberate one-off user action.
  let pendingIncludeMap = false;
  let sendRafId = null;

  function flushSendState() {
    sendRafId = null;
    const includeMap = pendingIncludeMap;
    pendingIncludeMap = false;
    doSendState(includeMap);
  }

  // includeMap: send the (heavy) map image too — only on map changes / player connect
  function sendState(includeMap) {
    if (!playerWin || playerWin.closed) return;
    if (sceneSyncPending) return;
    if (includeMap) pendingIncludeMap = true;
    if (sendRafId === null) sendRafId = requestAnimationFrame(flushSendState);
  }

  function doSendState(includeMap) {
    if (!playerWin || playerWin.closed) return;
    if (sceneSyncPending) return;
    const map = { scalePct: state.map.scalePct, bgColor: state.map.bgColor || '#03140a' };
    if (includeMap) map.dataUrl = state.map.dataUrl; // string or null (null = remove map)
    playerWin.postMessage({
      type: 'rpg-state',
      grid: state.grid,
      tokens: state.tokens,
      fog: state.fog,
      walls: state.walls,
      objects: state.objects,
      map,
      combat: state.combat,
      partyBars: state.partyBars,
      lighting: state.lighting,
      wallOcclusionMethod: state.wallOcclusionMethod,
      // Only this player token projects a vision cone / reveals fog on the
      // player window — lets the GM control which party member is "active"
      // when there are several, instead of all of them revealing at once.
      activeVisionTokenId: state.selectedTokenId,
    }, '*');
  }

  // Force-send regardless of the pending gate — used when the player window
  // just opened (it has nothing yet) and by the "update player view" button.
  function sendStateForced(includeMap) {
    sceneSyncPending = false;
    updatePlayerBtn.classList.remove('pending');
    if (sendRafId !== null) { cancelAnimationFrame(sendRafId); sendRafId = null; }
    pendingIncludeMap = false;
    doSendState(includeMap);
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'rpg-player-ready') {
      sendStateForced(true);
      // the freshly-opened player window has the default theme — push the
      // GM's current one so both windows match immediately
      if (window.RPG.getTheme) sendTheme(window.RPG.getTheme());
    }
  });

  // Broadcast the current table theme to the player window (the whole-app CSS
  // skin — see js/gm/theme.js). Separate one-shot message like sendFx, not
  // part of the scene state / sync gate.
  function sendTheme(theme) {
    if (!playerWin || playerWin.closed) return;
    playerWin.postMessage({ type: 'rpg-theme', theme }, '*');
  }

  document.getElementById('openPlayerBtn').addEventListener('click', () => {
    if (playerWin && !playerWin.closed) { playerWin.focus(); return; }
    // popup=yes + toolbar/location/menubar=no strips as much browser chrome as
    // the browser allows from script; the rest (Chromium's read-only URL strip)
    // only goes away in fullscreen — js/player/fullscreen.js handles that.
    playerWin = window.open(
      'player.html', 'rpg-player',
      'popup=yes,width=1024,height=768,toolbar=no,location=no,menubar=no,status=no,scrollbars=no,resizable=yes'
    );
  });

  const updatePlayerBtn = document.getElementById('updatePlayerBtn');
  updatePlayerBtn.addEventListener('click', () => sendStateForced(true));

  // Broadcast a cosmetic FX spawn to the player window — separate from
  // sendState/the scene-sync gate on purpose: a one-shot animation trigger,
  // not persistent state, so it always fires immediately even mid-gate.
  function sendFx(type, x, y, opts) {
    if (!playerWin || playerWin.closed) return;
    playerWin.postMessage({ type: 'rpg-fx', fxType: type, x, y, opts }, '*');
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.sendState = sendState;
  window.RPG.sendStateForced = sendStateForced;
  window.RPG.sendFx = sendFx;
  window.RPG.sendTheme = sendTheme;
  window.RPG.setSceneSyncPending = (v) => { sceneSyncPending = v; };
  window.RPG.getSceneSyncPending = () => sceneSyncPending;
})();
