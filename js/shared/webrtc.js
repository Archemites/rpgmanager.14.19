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

  function encodeSdp(desc) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(desc))));
  }

  function decodeSdp(code) {
    return JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
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
      return encodeSdp(pc.localDescription);
    }

    async function acceptAnswerCode(answerCode) {
      const answer = decodeSdp(answerCode);
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
      const offer = decodeSdp(offerCode);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);
      return encodeSdp(pc.localDescription);
    }

    return { pc, channelPromise, createAnswerCode };
  }

  window.RPG = window.RPG || {};
  window.RPG.createHostConnection = createHostConnection;
  window.RPG.createGuestConnection = createGuestConnection;
})();
