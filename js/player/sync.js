/* ============================================================
   Player sync: entry screen (name + short room code, typed or scanned from
   the GM's QR), then consumes 'rpg-state'/'rpg-fx'/'rpg-theme' messages over
   the PeerJS data connection. Loads absolute last among player files.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const showStatus = window.RPG.showStatus;

  const NAME_KEY = 'rpg-player-name';
  const CODE_KEY = 'rpg-last-room-code';

  const entryOverlay = document.getElementById('entryOverlay');
  const entryNameInput = /** @type {HTMLInputElement} */ (document.getElementById('entryNameInput'));
  const entryCodeInput = /** @type {HTMLInputElement} */ (document.getElementById('entryCodeInput'));
  const entryPinInput = /** @type {HTMLInputElement} */ (document.getElementById('entryPinInput'));
  const entryJoinBtn = /** @type {HTMLButtonElement} */ (document.getElementById('entryJoinBtn'));
  const entryStatus = document.getElementById('entryStatus');
  const viewport = document.getElementById('viewport');

  const entryModeScanBtn = document.getElementById('entryModeScanBtn');
  const entryModeScan = document.getElementById('entryModeScan');
  const entryScanVideo = /** @type {HTMLVideoElement} */ (document.getElementById('entryScanVideo'));
  const entryScanHint = document.getElementById('entryScanHint');

  entryNameInput.value = localStorage.getItem(NAME_KEY) || '';

  // Scanning the GM's QR opens player.html?mesa=CODE&pin=PIN, so prefill
  // both from the URL and jump straight to joining — a scanned player never
  // types anything. The PIN is not persisted across sessions (it rotates,
  // so an old cached value would just cause confusing rejections).
  const urlCode = new URLSearchParams(location.search).get('mesa');
  const urlPin = new URLSearchParams(location.search).get('pin');
  if (urlCode) entryCodeInput.value = window.RPG.normalizeRoomCode(urlCode);
  if (urlPin) entryPinInput.value = urlPin.replace(/\D/g, '').slice(0, 4);

  entryCodeInput.addEventListener('input', () => {
    entryCodeInput.value = entryCodeInput.value.toUpperCase();
  });
  entryCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entryJoinBtn.click();
  });
  entryPinInput.addEventListener('input', () => {
    entryPinInput.value = entryPinInput.value.replace(/\D/g, '').slice(0, 4);
  });
  entryPinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entryJoinBtn.click();
  });

  // ---------- Optional camera QR scan ----------
  let scanStream = null;
  let scanRafId = null;

  // js/vendor/jsQR.js is a webpack UMD bundle with an ESM default export, so
  // window.jsQR is the module OBJECT, not the decode function — the callable
  // lives on .default. Resolve both shapes so either build works.
  function getJsQR() {
    const m = window.jsQR;
    if (typeof m === 'function') return m;
    if (m && typeof m.default === 'function') return m.default;
    return null;
  }

  function stopScan() {
    if (scanRafId !== null) { cancelAnimationFrame(scanRafId); scanRafId = null; }
    if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
    entryModeScan.classList.add('hidden');
  }

  // The GM's QR holds a full player.html?mesa=CODE&pin=PIN URL; accept a
  // bare code (no PIN available then) too.
  function fromScan(text) {
    try {
      const u = new URL(text);
      const m = u.searchParams.get('mesa');
      const p = u.searchParams.get('pin');
      if (m) return { code: window.RPG.normalizeRoomCode(m), pin: p ? p.replace(/\D/g, '').slice(0, 4) : '' };
    } catch (_) { /* not a URL */ }
    return { code: window.RPG.normalizeRoomCode(text), pin: '' };
  }

  async function startScan() {
    const decode = getJsQR();
    if (!decode) {
      entryScanHint.textContent = 'Leitor de QR não carregou — digite o código.';
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      entryScanHint.textContent = 'Câmera indisponível neste navegador — digite o código.';
      return;
    }
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (err) {
      const n = err && err.name;
      entryScanHint.textContent =
        n === 'NotAllowedError' ? 'Permissão de câmera negada — digite o código.'
        : n === 'NotFoundError' ? 'Nenhuma câmera encontrada — digite o código.'
        : 'Não foi possível acessar a câmera — digite o código.';
      return;
    }

    entryModeScan.classList.remove('hidden');
    entryScanHint.textContent = 'Aponte a câmera para o QR do mestre.';
    entryScanVideo.srcObject = scanStream;
    try {
      await entryScanVideo.play();
    } catch (err) {
      entryScanHint.textContent = 'Não foi possível iniciar a câmera.';
      stopScan();
      return;
    }

    const canvas = document.createElement('canvas');
    // willReadFrequently: this canvas is read via getImageData every frame
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (!scanStream) return;   // stopScan() ran
      const w = entryScanVideo.videoWidth;
      const h = entryScanVideo.videoHeight;
      // videoWidth/Height stay 0 until the first frame actually arrives
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(entryScanVideo, 0, 0, w, h);
        const code = decode(ctx.getImageData(0, 0, w, h).data, w, h);
        if (code && code.data) {
          const scanned = fromScan(code.data);
          entryCodeInput.value = scanned.code;
          if (scanned.pin) entryPinInput.value = scanned.pin;
          entryScanHint.textContent = 'Código lido com sucesso';
          stopScan();
          join();
          return;
        }
      }
      scanRafId = requestAnimationFrame(tick);
    }
    scanRafId = requestAnimationFrame(tick);
  }

  entryModeScanBtn.addEventListener('click', () => {
    if (scanStream) { stopScan(); entryScanHint.textContent = ''; }
    else startScan();
  });

  // js/gm/sync.js drops a token's photoDataUrl / an object's dataUrl from
  // routine updates once we've already been sent it once (neither changes
  // mid-drag, so re-sending hundreds of KB on every move was the main cause
  // of lag). Reattach the last-known image for any item missing one here so
  // the player-side render (js/shared/photo-cache.js's getTokenPhotoImg /
  // js/shared/object-cache.js's getObjectImg, which just read the field
  // directly) never sees an image "disappear" between one state push and
  // the next.
  function makeImageRehydrator(field) {
    const lastById = new Map();
    return (list) => {
      for (const item of list) {
        if (item[field]) lastById.set(item.id, item[field]);
        else if (lastById.has(item.id)) item[field] = lastById.get(item.id);
      }
      return list;
    };
  }

  const rehydrateTokenPhotos = makeImageRehydrator('photoDataUrl');
  const rehydrateObjectImages = makeImageRehydrator('dataUrl');

  function handleMessage(msg) {
    if (msg && msg.type === 'rpg-denied') {
      // GM rejected the PIN — this connection will be closed by the GM right
      // after, but don't wait for 'close' to tell the player why. Also
      // covers the auto-reconnect path (silentRejoin): if the PIN rotated
      // while this player was backgrounded, they land back on the entry
      // screen instead of hanging on "Reconectando…" forever.
      entryOverlay.classList.add('open');
      viewport.classList.add('hidden');
      entryStatus.textContent = 'PIN incorreto — confira com o mestre e tente de novo.';
      entryJoinBtn.disabled = false;
      window.RPG.setActiveConnection(null);
      return;
    }
    if (msg && msg.type === 'rpg-my-token') {
      window.RPG.setMyTokenId(typeof msg.tokenId === 'number' ? msg.tokenId : null);
      return;
    }
    if (msg && msg.type === 'rpg-fx') {
      if (window.RPG.spawnFx) window.RPG.spawnFx(msg.fxType, msg.x, msg.y, msg.opts);
      return;
    }
    if (msg && msg.type === 'rpg-dice-roll') {
      if (window.RPG.onRemoteDiceRoll) {
        window.RPG.onRemoteDiceRoll(msg);
      }
      return;
    }
    // whole-app theme skin, mirrored from the GM window (see js/gm/theme.js)
    if (msg && msg.type === 'rpg-theme') {
      const THEMES = ['cyberpunk', 'dnd', 'cthulhu', 'black', 'cream'];
      const theme = THEMES.includes(msg.theme) ? msg.theme : 'cyberpunk';
      document.documentElement.setAttribute('data-theme', theme);
      window.RPG.draw();
      return;
    }

    // Two-stage map delivery: arrives in background without blocking entry screen
    if (msg && msg.type === 'rpg-map') {
      if (msg.scalePct !== undefined) state.map.scalePct = msg.scalePct;
      if (msg.bgColor !== undefined) state.map.bgColor = msg.bgColor;
      if (msg.dataUrl) {
        if (state.map._loadedUrl !== msg.dataUrl) {
          showStatus('Carregando mapa…');
          const img = new Image();
          img.onload = () => {
            state.map.img = img;
            state.map._loadedUrl = msg.dataUrl;
            showStatus('Conectado ao mestre', true);
            window.RPG.draw();
          };
          img.onerror = () => {
            showStatus('Falha ao carregar mapa', true);
          };
          img.src = msg.dataUrl;
        }
      } else {
        state.map.img = null;
        state.map._loadedUrl = null;
        window.RPG.draw();
      }
      return;
    }

    if (!msg || msg.type !== 'rpg-state') return;

    // The first 'rpg-state' is the GM's proof the PIN was accepted (the GM
    // never sends state to a peer it hasn't admitted) — that's the actual
    // "you're in" signal, not the WebRTC connection opening.
    if (entryOverlay.classList.contains('open')) {
      stopScan();
      entryOverlay.classList.remove('open');
      viewport.classList.remove('hidden');
      window.RPG.resizeCanvas();
      if (window.RPG.showFullscreenUI) window.RPG.showFullscreenUI();
      document.dispatchEvent(new CustomEvent('rpg:connected'));
    }

    // bump on every incoming state so frozen-memory cell snapshots know to
    // re-render — cheap counter, avoids diffing tokens/objects to decide if
    // a repaint is needed
    window.RPG.sceneVersion = (window.RPG.sceneVersion || 0) + 1;

    state.grid = msg.grid;
    state.tokens = rehydrateTokenPhotos(msg.tokens);
    state.fog = msg.fog || [];
    state.objects = rehydrateObjectImages(msg.objects || []);
    state.map.scalePct = msg.map.scalePct;
    state.map.bgColor = msg.map.bgColor || null;
    state.combat = msg.combat || { active: false, order: [] };
    state.partyBars = msg.partyBars || [];
    window.RPG.renderCombatBar();

    // dataUrl: string = new map, null = map removed, absent = unchanged
    if ('dataUrl' in msg.map) {
      if (msg.map.dataUrl) {
        if (state.map._loadedUrl !== msg.map.dataUrl) {
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
      }
    }

    showStatus('Conectado ao mestre', true);
    window.RPG.draw();
  }

  function onConnected(conn) {
    entryStatus.textContent = 'Verificando PIN…';

    // Announce who we are + the access PIN — the GM validates it before
    // sending any state or creating a token; the entry screen only closes
    // once the first 'rpg-state' proves we were admitted (see handleMessage).
    const myName = (entryNameInput.value.trim() || localStorage.getItem(NAME_KEY) || '').slice(0, 40);
    const pin = entryPinInput.value.trim();
    if (myName) {
      try { conn.send({ type: 'rpg-hello', name: myName, pin }); } catch (_) {}
    }

    conn.on('data', handleMessage);
    window.RPG.setActiveConnection(conn);

    const lost = () => {
      showStatus('Conexão com o mestre perdida.');
      entryOverlay.classList.add('open');
      viewport.classList.add('hidden');
      entryStatus.textContent = 'Conexão perdida — entre novamente com o código da mesa.';
      entryJoinBtn.disabled = false;
      window.RPG.setActiveConnection(null);
      window.RPG.setMyTokenId(null);
      // No cache to clear here: js/gm/sync.js's sendStateForced (used on
      // every (re)connect) always sends every image at least once, which
      // naturally overwrites whatever the rehydrators remembered from before.
    };
    conn.on('close', lost);
    conn.on('error', lost);
  }

  let joining = false;

  async function join() {
    if (joining) return;

    // Required: the GM auto-creates this player's party token from this name
    // (js/gm/sync.js's ensurePlayerToken), and reuses it on reconnect.
    const name = entryNameInput.value.trim();
    if (!name) {
      entryStatus.textContent = 'Digite o nome do seu personagem.';
      entryNameInput.focus();
      return;
    }
    localStorage.setItem(NAME_KEY, name);

    const code = window.RPG.normalizeRoomCode(entryCodeInput.value);
    if (!code) {
      entryStatus.textContent = 'Digite o código da mesa.';
      entryCodeInput.focus();
      return;
    }
    localStorage.setItem(CODE_KEY, code);

    if (entryPinInput.value.trim().length !== 4) {
      entryStatus.textContent = 'Digite o PIN de 4 dígitos da mesa.';
      entryPinInput.focus();
      return;
    }

    joining = true;
    entryJoinBtn.disabled = true;
    entryStatus.textContent = 'Conectando…';

    const guest = window.RPG.joinHost(code);
    activeGuest = guest;
    try {
      const conn = await guest.connection;
      entryStatus.textContent = '';
      onConnected(conn);
    } catch (err) {
      entryStatus.textContent = window.RPG.describePeerError(err);
      try { guest.destroy(); } catch (_) {}
      entryJoinBtn.disabled = false;
    } finally {
      joining = false;
    }
  }

  // ---------- Auto-reconnect after the tab returns from background ----------
  // Mobile browsers throttle/freeze timers and can silently kill the
  // underlying WebRTC connection while a tab is backgrounded, without ever
  // firing the DataConnection's 'close'/'error' — so on return the app can
  // be left believing it's still connected while nothing actually works
  // (can't drag the token, no updates arrive). Re-verify on every return to
  // visibility and silently rejoin using the same code+name if it's dead.
  let activeGuest = null; // { peer, connection, destroy } from the current joinHost() call

  function isConnectionAlive() {
    const conn = window.RPG.getActiveConnection ? window.RPG.getActiveConnection() : null;
    if (!conn || !conn.open) return false;
    const peer = activeGuest && activeGuest.peer;
    if (peer && (peer.destroyed || peer.disconnected)) return false;
    return true;
  }

  let rejoining = false;

  async function silentRejoin() {
    if (rejoining) return;
    const code = localStorage.getItem(CODE_KEY);
    const name = localStorage.getItem(NAME_KEY);
    if (!code || !name) return; // never successfully joined before — nothing to resume

    rejoining = true;
    showStatus('Reconectando…');
    if (activeGuest) { try { activeGuest.destroy(); } catch (_) {} }
    window.RPG.setActiveConnection(null);
    window.RPG.setMyTokenId(null);

    const guest = window.RPG.joinHost(code);
    activeGuest = guest;
    try {
      const conn = await guest.connection;
      onConnected(conn);
    } catch (err) {
      // Surface it on the entry screen rather than failing silently forever —
      // the player can still retry by hand (code/name are already filled in).
      entryOverlay.classList.add('open');
      viewport.classList.add('hidden');
      entryStatus.textContent = window.RPG.describePeerError(err);
    } finally {
      rejoining = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (entryOverlay.classList.contains('open')) return; // never connected / already on entry screen
    if (!isConnectionAlive()) silentRejoin();
  });

  entryJoinBtn.addEventListener('click', join);
  entryNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });

  // A scanned/shared link carries the code + PIN, so only the character name
  // is still missing — auto-join if we already know it from a previous
  // session, otherwise focus the name field and wait.
  if (urlCode && urlPin) {
    if (entryNameInput.value.trim()) join();
    else entryNameInput.focus();
  }

  function sendDiceRoll(rollData) {
    const conn = window.RPG.getActiveConnection ? window.RPG.getActiveConnection() : null;
    if (conn && conn.open) {
      const myName = (entryNameInput.value.trim() || localStorage.getItem(NAME_KEY) || 'Jogador').slice(0, 40);
      try {
        conn.send({
          type: 'rpg-dice-roll',
          senderName: myName,
          ...rollData
        });
      } catch (e) {
        console.warn('Erro ao enviar rolagem:', e);
      }
    }
  }

  // ---------- Init ----------
  window.RPG.sendDiceRoll = sendDiceRoll;
  window.RPG.resizeCanvas();
  window.RPG.centerView();
})();

