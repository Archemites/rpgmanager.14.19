/* ============================================================
   Shared P2P helper built on PeerJS (js/vendor/peerjs.min.js).

   Why PeerJS instead of raw RTCPeerConnection: a manual WebRTC handshake has
   to move the full SDP (ufrag + pwd + a 32-byte random DTLS fingerprint +
   candidates) in BOTH directions. Even stripped to the essential fields and
   deflated that floors out around 100+ chars per code, produces a QR too
   dense to scan off a screen, and forces the player to hand a second code
   back to the GM. PeerJS uses a public broker purely for signaling, so the
   GM only has to share ONE short room code (e.g. "MESA-K4P2") and nothing
   comes back — the actual game data still flows peer-to-peer, never through
   the broker.

   This module owns only connection plumbing — no state/allTokens knowledge.
   Message shapes sent over the connection live in ARCHITECTURE.md
   "Player sync protocol".
   ============================================================ */

(() => {
  'use strict';

  // Room codes the GM reads out loud / puts in a QR. Ambiguous characters
  // (0/O, 1/I/L) are excluded so a code can be dictated or typed without
  // confusion; the prefix namespaces us on the shared public broker.
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const CODE_LEN = 5;
  const PEER_PREFIX = 'rpgmesa-';

  function randomRoomCode() {
    let out = '';
    const buf = new Uint8Array(CODE_LEN);
    crypto.getRandomValues(buf);
    for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return out;
  }

  // Room code (what the user sees) -> PeerJS id (what the broker sees).
  function codeToPeerId(code) {
    return PEER_PREFIX + String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function normalizeCode(code) {
    return String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // STUN only, same as before: enough for LAN and most home NATs. No TURN,
  // so symmetric-NAT-to-symmetric-NAT may still fail — that would need a
  // relay server, which is out of scope for a static-hosted app.
  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  };

  /* ---------- GM side ----------
     Claims a room code on the broker and listens for incoming players.
     onConnection(conn) fires once per player that joins, with an open
     PeerJS DataConnection (same send()/on('data') shape both sides use).
  */
  function createHost({ onConnection, onError } = {}) {
    const code = randomRoomCode();
    const peer = new Peer(codeToPeerId(code), PEER_CONFIG);

    const ready = new Promise((resolve, reject) => {
      peer.on('open', () => resolve(code));
      peer.on('error', (err) => {
        // 'unavailable-id' means this code is already taken on the broker —
        // astronomically unlikely with a random code, but surface it rather
        // than hanging on the ready promise.
        reject(err);
        if (onError) onError(err);
      });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => { if (onConnection) onConnection(conn); });
    });

    return { peer, code, ready, destroy: () => peer.destroy() };
  }

  /* ---------- Player side ----------
     Joins the GM's room code. Resolves with an open DataConnection.
  */
  function joinHost(code, { onError } = {}) {
    const peer = new Peer(null, PEER_CONFIG);

    const connection = new Promise((resolve, reject) => {
      peer.on('open', () => {
        const conn = peer.connect(codeToPeerId(code), { reliable: true });
        conn.on('open', () => resolve(conn));
        conn.on('error', (err) => reject(err));
      });
      peer.on('error', (err) => {
        reject(err);
        if (onError) onError(err);
      });
    });

    return { peer, connection, destroy: () => peer.destroy() };
  }

  // Human-readable reasons for the PeerJS error types users can actually hit.
  function describePeerError(err) {
    const t = err && err.type;
    if (t === 'peer-unavailable') return 'Código não encontrado — confira se digitou certo e se o mestre ainda está com a mesa aberta.';
    if (t === 'unavailable-id') return 'Este código já está em uso. Gere outro.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Sem conexão com o servidor de pareamento. Verifique sua internet.';
    if (t === 'browser-incompatible') return 'Este navegador não suporta a conexão P2P necessária.';
    if (t === 'webrtc') return 'Falha ao estabelecer a conexão direta. Tente novamente.';
    return 'Não foi possível conectar. Tente novamente.';
  }

  window.RPG = window.RPG || {};
  window.RPG.createHost = createHost;
  window.RPG.joinHost = joinHost;
  window.RPG.normalizeRoomCode = normalizeCode;
  window.RPG.describePeerError = describePeerError;
})();
