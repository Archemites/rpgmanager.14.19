/* ============================================================
   Shared WebRTC P2P helper: no signaling server, no dependency on
   state/allTokens. Handshake is manual (offer/answer copy-pasted or shown
   as QR by the caller) — this module only does the RTCPeerConnection/
   RTCDataChannel plumbing and SDP<->code encoding. See ARCHITECTURE.md
   "Player sync protocol" for the message shapes sent over the channel.
   ============================================================ */

(() => {
  'use strict';

  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

  /* ---------- Compact code encoding ----------
     A full SDP in base64 runs ~1100+ chars, which forces a QR so dense
     (version ~40, 177x177 modules) that phone cameras cannot read it off a
     screen. Almost all of that is boilerplate identical on both ends for a
     data-channel-only connection, so we transmit ONLY the parts that vary —
     ice-ufrag, ice-pwd, DTLS fingerprint, setup role, and the candidate
     lines — then rebuild the surrounding SDP from a fixed template on the
     far side. With deflate + base64url that lands around ~370 chars (QR
     version ~15), which scans fine.

     Field keys are single letters to keep the JSON small:
       t = type ('o' offer | 'a' answer), u = ice-ufrag, p = ice-pwd,
       f = fingerprint (colons stripped), s = setup, c = candidate lines
  */

  const B64URL_TO_B64 = (s) => s.replace(/-/g, '+').replace(/_/g, '/');
  const B64_TO_B64URL = (s) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // CompressionStream is unavailable on older Safari/Firefox; fall back to
  // uncompressed (still ~600 chars — bigger QR, but functional). A 'Z' vs 'P'
  // prefix tells the far side which path produced the code.
  const hasCompression = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  async function streamThrough(bytes, transform) {
    const stream = new Blob([bytes]).stream().pipeThrough(transform);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  function sdpFields(desc) {
    const sdp = desc.sdp;
    const pick = (re) => { const m = sdp.match(re); return m ? m[1] : ''; };
    return {
      t: desc.type === 'answer' ? 'a' : 'o',
      u: pick(/a=ice-ufrag:(\S+)/),
      p: pick(/a=ice-pwd:(\S+)/),
      f: pick(/a=fingerprint:sha-256 (\S+)/).replace(/:/g, ''),
      s: pick(/a=setup:(\S+)/) || 'actpass',
      c: Array.from(sdp.matchAll(/^a=candidate:(.+)$/gm)).map((m) => m[1].trim()),
    };
  }

  function fieldsToSdp(f) {
    const fp = (f.f.match(/.{2}/g) || []).join(':');
    return [
      'v=0',
      'o=- 0 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'a=extmap-allow-mixed',
      'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:' + f.u,
      'a=ice-pwd:' + f.p,
      'a=ice-options:trickle',
      'a=fingerprint:sha-256 ' + fp,
      'a=setup:' + f.s,
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144',
      ...(f.c || []).map((c) => 'a=candidate:' + c),
      '',
    ].join('\r\n');
  }

  async function encodeSdp(desc) {
    const json = JSON.stringify(sdpFields(desc));
    const raw = new TextEncoder().encode(json);
    if (!hasCompression) return 'P' + B64_TO_B64URL(bytesToB64(raw));
    const deflated = await streamThrough(raw, new CompressionStream('deflate-raw'));
    return 'Z' + B64_TO_B64URL(bytesToB64(deflated));
  }

  async function decodeSdp(code) {
    const trimmed = code.trim();
    const tag = trimmed[0];
    const bytes = b64ToBytes(B64URL_TO_B64(trimmed.slice(1)));
    let json;
    if (tag === 'Z') {
      const inflated = await streamThrough(bytes, new DecompressionStream('deflate-raw'));
      json = new TextDecoder().decode(inflated);
    } else if (tag === 'P') {
      json = new TextDecoder().decode(bytes);
    } else {
      throw new Error('Código inválido');
    }
    const f = JSON.parse(json);
    return { type: f.t === 'a' ? 'answer' : 'offer', sdp: fieldsToSdp(f) };
  }

  // Waits for ICE gathering to finish so the exported code is a single,
  // trickle-free blob (no separate ICE candidate messages to relay). Some
  // browsers/networks never fire icegatheringstatechange all the way to
  // 'complete' (e.g. no reachable STUN, or the event fires before the
  // listener is attached) — a hard timeout keeps this from hanging forever
  // and silently blocking the whole invite flow. Whatever candidates have
  // gathered by then still work for same-network (LAN) peers.
  const ICE_GATHER_TIMEOUT_MS = 3000;

  function waitForIceGathering(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        pc.removeEventListener('icegatheringstatechange', check);
        clearTimeout(timer);
        resolve();
      }
      function check() {
        if (pc.iceGatheringState === 'complete') finish();
      }
      pc.addEventListener('icegatheringstatechange', check);
      const timer = setTimeout(finish, ICE_GATHER_TIMEOUT_MS);
      check(); // re-check in case gathering completed before the listener attached
    });
  }

  // GM side: create a connection + data channel, produce an offer code to
  // share, and accept the guest's answer code to complete the handshake.
  function createHostConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const channel = pc.createDataChannel('rpg-sync');

    async function createOfferCode() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);
      return await encodeSdp(pc.localDescription);
    }

    async function acceptAnswerCode(answerCode) {
      const answer = await decodeSdp(answerCode);
      await pc.setRemoteDescription(answer);
    }

    return { pc, channel, createOfferCode, acceptAnswerCode };
  }

  // Player side: given the GM's offer code, create a connection, accept the
  // remote data channel, and produce an answer code to send back.
  function createGuestConnection(offerCode) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    let channel = null;
    let resolveChannel;
    const channelPromise = new Promise((resolve) => { resolveChannel = resolve; });

    pc.addEventListener('datachannel', (e) => {
      channel = e.channel;
      resolveChannel(channel);
    });

    async function createAnswerCode() {
      const offer = await decodeSdp(offerCode);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);
      return await encodeSdp(pc.localDescription);
    }

    return { pc, channelPromise, createAnswerCode };
  }

  window.RPG = window.RPG || {};
  window.RPG.createHostConnection = createHostConnection;
  window.RPG.createGuestConnection = createGuestConnection;
})();
