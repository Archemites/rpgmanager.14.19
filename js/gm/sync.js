/* ============================================================
   GM sync: sendState/sendStateForced, sceneSyncPending gate, broadcasts
   over PeerJS data connections to every connected player. See
   ARCHITECTURE.md "Player sync protocol" + "Player sync gate".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  // Each entry: { id, name, conn, connected }, where conn is a PeerJS
  // DataConnection. The GM claims one short room code (see js/shared/webrtc.js)
  // and every player joins it — the broker only carries the handshake, game
  // data goes peer-to-peer.
  let peers = [];
  let nextPeerId = 1;
  let host = null;      // { peer, code, ready, destroy } from createHost()

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
    for (const peer of peers) {
      if (peer.conn && peer.conn.open) {
        try { peer.conn.send(msg); } catch (_) { /* peer dropped mid-send */ }
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

  // Room codes are short (5 chars), so this QR stays at a low version that a
  // phone camera reads instantly off a monitor. Failures never escape — the
  // printed code below the QR is always usable.
  function renderQr(el, text, statusEl) {
    el.innerHTML = '';
    if (!window.QRCode) return;
    try {
      new QRCode(el, {
        text,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (err) {
      el.innerHTML = '';
      if (statusEl) statusEl.textContent = 'Não foi possível gerar o QR — use o código abaixo.';
    }
  }

  function renderPeerList() {
    const el = document.getElementById('peerList');
    el.innerHTML = '';
    for (const peer of peers) {
      const row = document.createElement('div');
      row.className = 'peer-row';
      const label = document.createElement('span');
      label.textContent = `${peer.connected ? '🟢' : '⏳'} ${peer.name || 'Jogador'}`;
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
    try { peers[idx].conn.close(); } catch (_) {}
    peers.splice(idx, 1);
    renderPeerList();
  }

  // Wires a freshly-opened DataConnection into the peer list + sync loop.
  function attachPeer(conn) {
    const peer = { id: nextPeerId++, name: null, conn, connected: true };
    peers.push(peer);
    renderPeerList();
    inviteStatus.textContent = 'Jogador conectado ✓';

    // A brand-new peer has seen no state at all — force a full sync past the gate.
    sendStateForced(true);
    if (window.RPG.getTheme) sendTheme(window.RPG.getTheme());

    // Players are read-only except for announcing their name on join.
    conn.on('data', (msg) => {
      if (msg && msg.type === 'rpg-hello' && typeof msg.name === 'string') {
        peer.name = msg.name.slice(0, 40);
        renderPeerList();
      }
    });

    const drop = () => {
      peer.connected = false;
      renderPeerList();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  // ---------- Invite modal: one short room code, nothing to paste back ----------
  const inviteOverlay = document.getElementById('inviteOverlay');
  const inviteOfferQr = document.getElementById('inviteOfferQr');
  const inviteRoomCode = document.getElementById('inviteRoomCode');
  const inviteStatus = document.getElementById('inviteStatus');

  // The room is opened once, lazily, and then kept alive for the whole
  // session — every player joins the same code, so re-opening per invite
  // would invalidate codes already handed out.
  async function ensureHost() {
    if (host) return host;
    inviteStatus.textContent = 'Abrindo a mesa…';
    host = window.RPG.createHost({
      onConnection: attachPeer,
      onError: (err) => {
        inviteStatus.textContent = window.RPG.describePeerError(err);
      },
    });
    try {
      await host.ready;
    } catch (err) {
      inviteStatus.textContent = window.RPG.describePeerError(err);
      host = null;
      throw err;
    }
    inviteStatus.textContent = '';
    return host;
  }

  // The player opens player.html and types/scans the code, so the QR encodes
  // a full join URL — scanning it on a phone lands straight in the game.
  function joinUrlFor(code) {
    const base = location.href.replace(/[^/]*$/, '') + 'player.html';
    return base + '?mesa=' + encodeURIComponent(code);
  }

  document.getElementById('openInviteBtn').addEventListener('click', async () => {
    inviteOverlay.classList.add('open');
    inviteRoomCode.textContent = '·····';
    inviteOfferQr.innerHTML = '';
    try {
      const h = await ensureHost();
      inviteRoomCode.textContent = h.code;
      renderQr(inviteOfferQr, joinUrlFor(h.code), inviteStatus);
    } catch (_) {
      inviteRoomCode.textContent = '—';
    }
  });

  document.getElementById('inviteCloseBtn').addEventListener('click', () => {
    // Only closes the dialog — the room stays open so connected players and
    // already-shared codes keep working.
    inviteOverlay.classList.remove('open');
  });

  inviteOverlay.addEventListener('click', (e) => {
    if (e.target === inviteOverlay) inviteOverlay.classList.remove('open');
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
