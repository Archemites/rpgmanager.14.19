/* ============================================================
   GM sync: sendState/sendStateForced, sceneSyncPending gate, broadcasts
   over WebRTC data channels to every connected player peer. See
   ARCHITECTURE.md "Player sync protocol" + "Player sync gate".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  // Each entry: { id, name, pc, channel, connected }. One RTCPeerConnection
  // per player — there's no signaling server, so each connects via a
  // manually-exchanged offer/answer code (see js/shared/webrtc.js).
  let peers = [];
  let nextPeerId = 1;

  // Gate that holds back sendState() after a scene switch: the GM may need to
  // set up fog/tokens in the new scene before the players see it. While
  // pending, every sendState() call is silently dropped — the player windows
  // keep showing the OLD scene exactly as it was — until the GM clicks
  // "🔄 Atualizar telas dos jogadores", which clears the gate and force-sends.
  let sceneSyncPending = false;

  // Dozens of call sites (token drag, wall/fog drawing, rotation) call
  // sendState() on every 'mousemove' — serializing/broadcasting the whole
  // tokens/fog/walls/objects payload to every peer on every pixel of mouse
  // movement was costing real frame time for no visible benefit (players
  // only ever see the latest position anyway). Coalesce to at most one send
  // per animation frame; sendStateForced always bypasses this (immediate)
  // since it's a deliberate one-off user action.
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
    if (sceneSyncPending) return;
    if (includeMap) pendingIncludeMap = true;
    if (sendRafId === null) sendRafId = requestAnimationFrame(flushSendState);
  }

  function broadcast(msg) {
    const json = JSON.stringify(msg);
    for (const peer of peers) {
      if (peer.channel && peer.channel.readyState === 'open') {
        peer.channel.send(json);
      }
    }
  }

  function doSendState(includeMap) {
    if (sceneSyncPending) return;
    const map = { scalePct: state.map.scalePct, bgColor: state.map.bgColor || null };
    if (includeMap) map.dataUrl = state.map.dataUrl; // string or null (null = remove map)
    broadcast({
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
    });
  }

  // Force-send regardless of the pending gate — used when a new peer just
  // connected (it has nothing yet) and by the "update player screens" button.
  function sendStateForced(includeMap) {
    sceneSyncPending = false;
    updatePlayerBtn.classList.remove('pending');
    if (sendRafId !== null) { cancelAnimationFrame(sendRafId); sendRafId = null; }
    pendingIncludeMap = false;
    doSendState(includeMap);
  }

  // Broadcast the current table theme to every player peer (the whole-app
  // CSS skin — see js/gm/theme.js). Separate one-shot message like sendFx,
  // not part of the scene state / sync gate.
  function sendTheme(theme) {
    broadcast({ type: 'rpg-theme', theme });
  }

  // Broadcast a cosmetic FX spawn — separate from sendState/the scene-sync
  // gate on purpose: a one-shot animation trigger, not persistent state, so
  // it always fires immediately even mid-gate.
  function sendFx(type, x, y, opts) {
    broadcast({ type: 'rpg-fx', fxType: type, x, y, opts });
  }

  // Renders `code` as a QR into `el`. js/shared/webrtc.js keeps codes compact
  // (~330 chars => QR version ~12, 65x65 modules) specifically so a phone
  // camera can read this off a monitor; correctLevel M gives decent error
  // tolerance at that size. A QR failure must never escape — the text code
  // below it is always the reliable fallback.
  function renderQr(el, code, statusEl) {
    el.innerHTML = '';
    if (!window.QRCode) return;
    try {
      new QRCode(el, {
        text: code,
        width: 260,
        height: 260,
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (err) {
      el.innerHTML = '';
      if (statusEl) statusEl.textContent = 'Não foi possível gerar o QR — use o código de texto abaixo.';
    }
  }

  function renderPeerList() {
    const el = document.getElementById('peerList');
    el.innerHTML = '';
    for (const peer of peers) {
      const row = document.createElement('div');
      row.className = 'peer-row';
      const status = peer.connected ? '🟢' : '⏳';
      const label = document.createElement('span');
      label.textContent = `${status} ${peer.name || 'Jogador'}`;
      row.appendChild(label);
      const removeBtn = document.createElement('button');
      removeBtn.className = 'secondary';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Desconectar';
      removeBtn.addEventListener('click', () => removePeer(peer.id));
      row.appendChild(removeBtn);
      el.appendChild(row);
    }
  }

  function removePeer(peerId) {
    const idx = peers.findIndex((p) => p.id === peerId);
    if (idx === -1) return;
    try { peers[idx].pc.close(); } catch (_) {}
    peers.splice(idx, 1);
    renderPeerList();
  }

  // ---------- Invite modal (offer/answer handshake, no signaling server) ----------
  // 3 steps: (1) optional name + generate, (2) QR + code only, (3) paste the
  // player's answer code to complete the connection.
  const inviteOverlay = document.getElementById('inviteOverlay');
  const inviteStep1 = document.getElementById('inviteStep1');
  const inviteStep2 = document.getElementById('inviteStep2');
  const inviteStep3 = document.getElementById('inviteStep3');
  const inviteOfferCode = document.getElementById('inviteOfferCode');
  const inviteOfferQr = document.getElementById('inviteOfferQr');
  const inviteAnswerInput = document.getElementById('inviteAnswerInput');
  const inviteStatus = document.getElementById('inviteStatus');

  let pendingHost = null; // { pc, channel, createOfferCode, acceptAnswerCode }
  let pendingPeerId = null;

  function showInviteStep(n) {
    inviteStep1.classList.toggle('hidden', n !== 1);
    inviteStep2.classList.toggle('hidden', n !== 2);
    inviteStep3.classList.toggle('hidden', n !== 3);
  }

  function resetInviteModal() {
    showInviteStep(1);
    inviteOfferCode.value = '';
    inviteOfferQr.innerHTML = '';
    inviteAnswerInput.value = '';
    inviteStatus.textContent = '';
    pendingHost = null;
    pendingPeerId = null;
  }

  document.getElementById('openInviteBtn').addEventListener('click', () => {
    resetInviteModal();
    inviteOverlay.classList.add('open');
  });

  document.getElementById('inviteCloseBtn').addEventListener('click', () => {
    inviteOverlay.classList.remove('open');
    if (pendingPeerId !== null) removePeer(pendingPeerId);
    resetInviteModal();
  });

  inviteOverlay.addEventListener('click', (e) => {
    if (e.target !== inviteOverlay) return;
    inviteOverlay.classList.remove('open');
    if (pendingPeerId !== null) removePeer(pendingPeerId);
    resetInviteModal();
  });

  document.getElementById('inviteGenerateBtn').addEventListener('click', async () => {
    pendingHost = window.RPG.createHostConnection();
    const peerId = nextPeerId++;
    pendingPeerId = peerId;
    // name stays null until the player announces theirs ('rpg-hello', sent by
    // js/player/sync.js on connect) — the GM never types a player's name.
    const peer = { id: peerId, name: null, pc: pendingHost.pc, channel: pendingHost.channel, connected: false };
    peers.push(peer);
    renderPeerList();

    peer.channel.addEventListener('open', () => {
      peer.connected = true;
      renderPeerList();
      inviteStatus.textContent = 'Jogador conectado ✓';
      // freshly-connected peer has never seen any state — force a full sync
      sendStateForced(true);
      if (window.RPG.getTheme) sendTheme(window.RPG.getTheme());
    });
    peer.channel.addEventListener('close', () => {
      peer.connected = false;
      renderPeerList();
    });
    // The player window is read-only except for this one announce message.
    peer.channel.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }
      if (msg && msg.type === 'rpg-hello' && typeof msg.name === 'string') {
        peer.name = msg.name.slice(0, 40);
        renderPeerList();
      }
    });

    let offerCode;
    try {
      offerCode = await pendingHost.createOfferCode();
    } catch (err) {
      inviteStatus.textContent = 'Falha ao gerar convite: ' + (err && err.message ? err.message : err);
      removePeer(peerId);
      return;
    }
    inviteOfferCode.value = offerCode;
    // Show the step FIRST: a QR failure must never leave the modal stuck on
    // step 1 with a generated-but-invisible code.
    showInviteStep(2);
    renderQr(inviteOfferQr, offerCode, inviteStatus);
  });

  document.getElementById('inviteHaveAnswerBtn').addEventListener('click', () => {
    inviteStatus.textContent = '';
    showInviteStep(3);
  });

  document.getElementById('inviteBackBtn').addEventListener('click', () => {
    showInviteStep(2);
  });

  document.getElementById('inviteConnectBtn').addEventListener('click', async () => {
    if (!pendingHost) return;
    const answerCode = inviteAnswerInput.value.trim();
    if (!answerCode) return;
    try {
      inviteStatus.textContent = 'Conectando…';
      await pendingHost.acceptAnswerCode(answerCode);
    } catch (err) {
      inviteStatus.textContent = 'Código de resposta inválido.';
    }
  });

  const updatePlayerBtn = document.getElementById('updatePlayerBtn');
  updatePlayerBtn.addEventListener('click', () => sendStateForced(true));

  // ---------- Expose to window.RPG ----------
  window.RPG.sendState = sendState;
  window.RPG.sendStateForced = sendStateForced;
  window.RPG.sendFx = sendFx;
  window.RPG.sendTheme = sendTheme;
  window.RPG.setSceneSyncPending = (v) => { sceneSyncPending = v; };
  window.RPG.getSceneSyncPending = () => sceneSyncPending;
})();
