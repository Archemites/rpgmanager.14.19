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

  // Access PIN: separate from the room code on purpose. The room code is
  // the PeerJS peer id — changing it means creating a whole new Peer, which
  // would drop every already-open DataConnection (that's how P2P works,
  // there's no "rename" for an active connection). The PIN is a GM-rotatable
  // gate checked only at the 'rpg-hello' handshake, so the GM can revoke
  // access for new joiners (e.g. a leaked code/QR) without kicking anyone
  // already at the table.
  const PIN_LEN = 4;
  let accessPin = randomPin();

  function randomPin() {
    const buf = new Uint8Array(PIN_LEN);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b % 10).join('');
  }

  // Gate that holds back sendState() after a scene switch: the GM may need to
  // set up fog/tokens in the new scene before the players see it. While
  // pending, every sendState() call is silently dropped — the player windows
  // keep showing the OLD scene exactly as it was — until the GM clicks
  // "Atualizar telas dos jogadores", which clears the gate and force-sends.
  let sceneSyncPending = false;

  // Dozens of call sites (token drag, fog drawing) call sendState() on every
  // 'mousemove'. Two problems compound here:
  //
  // 1) Coalescing only per animation frame (~60/s) still means the FULL
  //    tokens/fog/objects payload — including every token's
  //    photoDataUrl, which can be hundreds of KB each — gets re-serialized
  //    and re-sent 60 times a second while dragging. PeerJS data channels
  //    default to a RELIABLE, ORDERED transport (like TCP): a peer that
  //    can't drain the socket as fast as we produce messages builds an
  //    ever-growing send queue, so what the player sees gets progressively
  //    MORE stale over time instead of just occasionally skipping a frame —
  //    this is the "atrasado, às vezes nem atualiza" symptom.
  // 2) Photos never change mid-drag, so re-sending them on every state push
  //    was pure waste; they only need to go out when they actually change.
  //
  // Fix: throttle real wall-clock time (not just one send per rAF), skip a
  // scheduled send entirely while the channel's own send buffer is still
  // backed up (bufferedAmount), and never inline heavy assets (photos) into
  // the routine per-move payload — see makeImageDedupe() below.
  //
  // 16ms (~60/s) ceiling: mousemove itself never fires faster than the
  // display refresh rate, so this is effectively "no throttle" for movement
  // smoothness while still coalescing bursts into one send. The image
  // dedup above (not the interval) is what fixed the original lag — going
  // lower than 16ms buys nothing since the browser can't produce events
  // that fast anyway, and bufferedAmount below remains the real backstop
  // against flooding a slow peer's channel.
  const SEND_MIN_INTERVAL_MS = 16;
  const MAX_BUFFERED_BYTES = 256 * 1024; // skip a send while a peer's queue is this backed up

  let pendingIncludeMap = false;
  let sendTimerId = null;   // setTimeout handle, or null if nothing scheduled
  let lastSendAt = 0;

  function flushSendState() {
    sendTimerId = null;
    const includeMap = pendingIncludeMap;
    pendingIncludeMap = false;
    lastSendAt = performance.now();
    doSendState(includeMap);
  }

  function scheduleSend() {
    if (sendTimerId !== null) return; // already scheduled — the pending flags above cover any new changes
    const elapsed = performance.now() - lastSendAt;
    const delay = Math.max(0, SEND_MIN_INTERVAL_MS - elapsed);
    sendTimerId = setTimeout(flushSendState, delay);
  }

  // includeMap: send the (heavy) map image too — only on map changes / player connect
  function sendState(includeMap) {
    if (sceneSyncPending) return;
    if (includeMap) pendingIncludeMap = true;
    scheduleSend();
  }

  function broadcast(msg, excludePeerId = null) {
    for (const peer of peers) {
      if (!peer.conn || !peer.conn.open) continue;
      if (excludePeerId !== null && peer.id === excludePeerId) continue;
      // A peer whose send queue is still backed up from earlier messages
      // gets skipped this round rather than piling on yet another payload —
      // the next scheduled send will carry current data anyway, so a queued
      // stale one is pure waste that only pushes the peer further behind.
      if ((peer.conn.bufferedAmount || 0) > MAX_BUFFERED_BYTES) continue;
      try { peer.conn.send(msg); } catch (_) { /* peer dropped mid-send */ }
    }
  }

  // Token photos and object images are the things in state.tokens/objects big
  // enough to matter (hundreds of KB each) and neither changes from a
  // drag/rotate/fog edit — only from their respective modals. Strip the
  // image field from the routine payload and only (re-)send it when the
  // dataURL actually changes, so a player who already has it isn't re-sent
  // the same bytes on every move. Generic over the field name since tokens
  // use photoDataUrl and objects use dataUrl.
  function makeImageDedupe(field) {
    const sentByCollectionId = new Map(); // id -> last-sent value for `field`
    return {
      forWire(list) {
        return list.map((item) => {
          const value = item[field];
          if (!value) { sentByCollectionId.delete(item.id); return item; }
          if (sentByCollectionId.get(item.id) !== value) {
            sentByCollectionId.set(item.id, value);
            return item; // first time / changed — include this once
          }
          const rest = { ...item };
          delete rest[field];
          return rest; // unchanged — player already has this cached
        });
      },
      clear() { sentByCollectionId.clear(); },
    };
  }

  const tokenPhotoDedupe = makeImageDedupe('photoDataUrl');
  const objectImageDedupe = makeImageDedupe('dataUrl');

  function doSendState(includeMap) {
    if (sceneSyncPending) return;
    const map = { scalePct: state.map.scalePct, bgColor: state.map.bgColor || null };
    if (includeMap) map.dataUrl = state.map.dataUrl; // string or null (null = remove map)
    broadcast({
      type: 'rpg-state',
      grid: state.grid,
      tokens: tokenPhotoDedupe.forWire(state.tokens),
      fog: state.fog,
      objects: objectImageDedupe.forWire(state.objects),
      map,
      combat: state.combat,
      partyBars: state.partyBars,
    });
  }

  // Force-send regardless of the pending gate — used when a new peer just
  // connected (it has nothing yet) and by the "update player screens" button.
  // Always includes every token's current photo: a fresh peer (or one that
  // just reconnected) has no cache to dedupe against.
  function sendStateForced(includeMap) {
    sceneSyncPending = false;
    updatePlayerBtn.classList.remove('pending');
    if (sendTimerId !== null) { clearTimeout(sendTimerId); sendTimerId = null; }
    pendingIncludeMap = false;
    tokenPhotoDedupe.clear();
    objectImageDedupe.clear();
    lastSendAt = performance.now();
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
      const statusIcon = peer.connected
        ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="#45ff78" style="flex-shrink:0"><circle cx="12" cy="12" r="8"/></svg>'
        : '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#e0a84b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      const label = document.createElement('span');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.gap = '6px';
      label.innerHTML = `${statusIcon} <span>${peer.name || 'Jogador'}</span>`;
      row.appendChild(label);
      const removeBtn = document.createElement('button');
      removeBtn.className = 'secondary';
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
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

  // Colors handed out to auto-created player tokens, cycled by join order so
  // two players never land on the same color back-to-back. Same palette the
  // token modal offers (js/gm/token-modal.js's PRESET_COLORS), player-ish
  // hues first.
  const AUTO_TOKEN_COLORS = ['#4b8ee0', '#4be08f', '#e0c94b', '#a04be0', '#e08a4b', '#4be0d8', '#e04ba0', '#e04b4b'];
  let autoColorIdx = 0;

  // Creates the party token for a player that just announced its name, unless
  // one already exists for that name — a player refreshing the page or
  // reconnecting must land back on their existing token, not spawn a duplicate.
  // Token shape mirrors js/gm/token-modal.js's create branch; keep in sync.
  function ensurePlayerToken(peer, skipSync = false) {
    const name = (peer.name || '').trim();
    if (!name) return;

    const allTokens = window.RPG.allTokens;
    const state_ = window.RPG.state;
    if (!allTokens || !window.RPG.getCurrentSceneId) return;

    // Match case-insensitively so "aragorn" reconnects onto "Aragorn".
    const existing = allTokens.find((t) =>
      t.isPlayer && (t.name || '').trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      peer.tokenId = existing.id;
      // Their token may live in another scene from a previous session; leave
      // that alone — the GM decides where party members are via the scene
      // sidebar / "bring to scene", not the player's reconnect.
      sendMyToken(peer);
      return;
    }

    if (window.RPG.captureBeforeChange) {
      window.RPG.captureBeforeChange(`Jogador "${name}" entrou`);
    }

    // Spawn near the middle of the GM's current view, jittered so several
    // players joining at once don't stack exactly on top of each other.
    const vp = window.RPG.viewport;
    const c = window.RPG.screenToWorld(vp.clientWidth / 2, vp.clientHeight / 2);
    const x = c.x + (Math.random() * 60 - 30);
    const y = c.y + (Math.random() * 60 - 30);
    const sceneId = window.RPG.getCurrentSceneId();

    const token = {
      id: state_.nextId++,
      x, y,
      scenes: { [sceneId]: { x, y } },
      r: window.RPG.BASE_TOKEN_RADIUS,
      color: AUTO_TOKEN_COLORS[autoColorIdx++ % AUTO_TOKEN_COLORS.length],
      name,
      photoDataUrl: null,
      note: '',
      createdAt: Date.now(),
      isPlayer: true,          // joins the Party panel — this is the point
      barValues: {},
      effects: [],
    };
    if (window.RPG.syncTokenBarValues) window.RPG.syncTokenBarValues(token);
    allTokens.push(token);
    peer.tokenId = token.id;

    if (window.RPG.refreshVisibleTokens) window.RPG.refreshVisibleTokens();
    if (window.RPG.renderTokenList) window.RPG.renderTokenList();
    if (window.RPG.renderParty) window.RPG.renderParty();
    if (window.RPG.renderSceneList) window.RPG.renderSceneList();
    if (window.RPG.logEvent) window.RPG.logEvent(`Token de jogador criado: "${name}"`);
    window.RPG.draw();
    if (!skipSync) sendState();
    sendMyToken(peer);
  }

  // Tells a peer which token is theirs to drag — a player may only ever move
  // this one token (see 'rpg-token-move' handling in attachPeer below).
  function sendMyToken(peer) {
    if (peer.conn && peer.conn.open) {
      try { peer.conn.send({ type: 'rpg-my-token', tokenId: peer.tokenId }); } catch (_) {}
    }
  }

  // Wires a freshly-opened DataConnection into the peer list + sync loop.
  // The P2P connection itself opens before we know who's on the other end —
  // that's just transport. Nothing about the game (state, token) is sent
  // until 'rpg-hello' arrives with a PIN that matches the current one.
  function attachPeer(conn) {
    const peer = { id: nextPeerId++, name: null, conn, connected: true, tokenId: null, admitted: false };
    peers.push(peer);
    renderPeerList();
    inviteStatus.textContent = 'Jogador conectando…';

    conn.on('data', (msg) => {
      if (!msg) return;
      if (msg.type === 'rpg-hello' && typeof msg.name === 'string') {
        if (msg.pin !== accessPin) {
          try { conn.send({ type: 'rpg-denied', reason: 'pin' }); } catch (_) {}
          try { conn.close(); } catch (_) {}
          const idx = peers.indexOf(peer);
          if (idx !== -1) peers.splice(idx, 1);
          renderPeerList();
          return;
        }
        peer.admitted = true;
        peer.name = msg.name.slice(0, 40);
        renderPeerList();
        inviteStatus.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Jogador conectado</span>';

        // 1. Ensure token first (skip broadcast to avoid double-sending)
        ensurePlayerToken(peer, true);

        // 2. Send active theme to this peer
        if (window.RPG.getTheme) {
          try { conn.send({ type: 'rpg-theme', theme: window.RPG.getTheme() }); } catch (_) {}
        }

        // 3. Stage 1: Send initial state UNICAST to this peer WITHOUT the heavy map
        // Tiny payload (< 50KB) — player's screen unlocks immediately (< 0.5s)
        const initialMap = { scalePct: state.map.scalePct, bgColor: state.map.bgColor || null };
        try {
          conn.send({
            type: 'rpg-state',
            grid: state.grid,
            tokens: state.tokens,
            fog: state.fog,
            objects: state.objects,
            map: initialMap,
            combat: state.combat,
            partyBars: state.partyBars,
          });
        } catch (_) {}

        // 4. Stage 2: Send map image UNICAST to this peer if a map exists
        if (state.map.dataUrl) {
          try {
            conn.send({
              type: 'rpg-map',
              dataUrl: state.map.dataUrl,
              scalePct: state.map.scalePct,
              bgColor: state.map.bgColor || null,
            });
          } catch (_) {}
        }

        // 5. Notify already-connected peers that a new player joined (lightweight diff)
        sendState(false);
        return;
      }
      if (!peer.admitted) return; // ignore everything else until the PIN checks out

      if (msg.type === 'rpg-token-move' && typeof msg.x === 'number' && typeof msg.y === 'number') {
        if (!peer.tokenId) return;
        const allTokens = window.RPG.allTokens;
        const t = allTokens && allTokens.find((tk) => tk.id === peer.tokenId);
        if (!t) return;
        t.x = msg.x;
        t.y = msg.y;
        window.RPG.draw();
        sendState();
        return;
      }
    });

    const drop = () => {
      peer.connected = false;
      renderPeerList();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  // ---------- Invite modal: one short room code + a rotatable PIN ----------
  const inviteOverlay = document.getElementById('inviteOverlay');
  const inviteOfferQr = document.getElementById('inviteOfferQr');
  const inviteRoomCode = document.getElementById('inviteRoomCode');
  const invitePin = document.getElementById('invitePin');
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
  // a full join URL (code + current PIN) — scanning it on a phone lands
  // straight in the game with nothing to type.
  function joinUrlFor(code, pin) {
    const base = location.href.replace(/[^/]*$/, '') + 'player.html';
    return base + '?mesa=' + encodeURIComponent(code) + '&pin=' + encodeURIComponent(pin);
  }

  function refreshInviteQr(code) {
    invitePin.textContent = accessPin;
    renderQr(inviteOfferQr, joinUrlFor(code, accessPin), inviteStatus);
  }

  document.getElementById('openInviteBtn').addEventListener('click', async () => {
    inviteOverlay.classList.add('open');
    inviteRoomCode.textContent = '·····';
    invitePin.textContent = '····';
    inviteOfferQr.innerHTML = '';
    try {
      const h = await ensureHost();
      inviteRoomCode.textContent = h.code;
      refreshInviteQr(h.code);
    } catch (_) {
      inviteRoomCode.textContent = '—';
    }
  });

  // Rotating the PIN only blocks NEW joiners using the old one — already
  // connected peers were validated at their own 'rpg-hello' and are never
  // re-checked, so nobody currently at the table gets dropped.
  document.getElementById('invitePinRotateBtn').addEventListener('click', () => {
    accessPin = randomPin();
    if (host) refreshInviteQr(host.code);
    if (window.RPG.logEvent) window.RPG.logEvent('Trocou o PIN de acesso da mesa');
    inviteStatus.textContent = 'PIN atualizado — jogadores já conectados continuam normalmente.';
  });

  document.getElementById('inviteCloseBtn').addEventListener('click', () => {
    // Only closes the dialog — the room stays open so connected players and
    // already-shared codes keep working.
    inviteOverlay.classList.remove('open');
  });

  inviteOverlay.addEventListener('click', (e) => {
    if (e.target === inviteOverlay) inviteOverlay.classList.remove('open');
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.sendState = sendState;
  window.RPG.sendStateForced = sendStateForced;
  window.RPG.sendFx = sendFx;
  window.RPG.sendTheme = sendTheme;
  window.RPG.setSceneSyncPending = (v) => { sceneSyncPending = v; };
  window.RPG.getSceneSyncPending = () => sceneSyncPending;
})();
