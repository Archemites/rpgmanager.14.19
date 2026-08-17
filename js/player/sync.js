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

  const entryOverlay = document.getElementById('entryOverlay');
  const entryNameInput = document.getElementById('entryNameInput');
  const entryCodeInput = document.getElementById('entryCodeInput');
  const entryJoinBtn = document.getElementById('entryJoinBtn');
  const entryStatus = document.getElementById('entryStatus');
  const viewport = document.getElementById('viewport');

  const entryModeScanBtn = document.getElementById('entryModeScanBtn');
  const entryModeScan = document.getElementById('entryModeScan');
  const entryScanVideo = document.getElementById('entryScanVideo');
  const entryScanHint = document.getElementById('entryScanHint');

  entryNameInput.value = localStorage.getItem(NAME_KEY) || '';

  // Scanning the GM's QR opens player.html?mesa=CODE, so prefill from the URL
  // and jump straight to joining — a scanned player never types anything.
  const urlCode = new URLSearchParams(location.search).get('mesa');
  if (urlCode) entryCodeInput.value = window.RPG.normalizeRoomCode(urlCode);

  entryCodeInput.addEventListener('input', () => {
    entryCodeInput.value = entryCodeInput.value.toUpperCase();
  });
  entryCodeInput.addEventListener('keydown', (e) => {
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

  // The GM's QR holds a full player.html?mesa=CODE URL; accept a bare code too.
  function codeFromScan(text) {
    try {
      const u = new URL(text);
      const m = u.searchParams.get('mesa');
      if (m) return window.RPG.normalizeRoomCode(m);
    } catch (_) { /* not a URL */ }
    return window.RPG.normalizeRoomCode(text);
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
          entryCodeInput.value = codeFromScan(code.data);
          entryScanHint.textContent = 'Código lido ✓';
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

  function handleMessage(msg) {
    if (msg && msg.type === 'rpg-fx') {
      if (window.RPG.spawnFx) window.RPG.spawnFx(msg.fxType, msg.x, msg.y, msg.opts);
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
    state.map.bgColor = msg.map.bgColor || null;
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
  }

  function onConnected(conn) {
    stopScan();
    entryOverlay.classList.remove('open');
    viewport.classList.remove('hidden');
    window.RPG.resizeCanvas();
    if (window.RPG.showFullscreenUI) window.RPG.showFullscreenUI();

    // Announce who we are so the GM's player list can label this connection —
    // the only message the player ever sends.
    const myName = (entryNameInput.value.trim() || localStorage.getItem(NAME_KEY) || '').slice(0, 40);
    if (myName) {
      try { conn.send({ type: 'rpg-hello', name: myName }); } catch (_) {}
    }

    conn.on('data', handleMessage);

    const lost = () => {
      showStatus('Conexão com o mestre perdida.');
      entryOverlay.classList.add('open');
      viewport.classList.add('hidden');
      entryStatus.textContent = 'Conexão perdida — entre novamente com o código da mesa.';
      entryJoinBtn.disabled = false;
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

    joining = true;
    entryJoinBtn.disabled = true;
    entryStatus.textContent = 'Conectando…';

    const guest = window.RPG.joinHost(code);
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

  entryJoinBtn.addEventListener('click', join);
  entryNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });

  // A scanned/shared link carries the code, so only the character name is
  // still missing — auto-join if we already know it from a previous session,
  // otherwise focus the name field and wait.
  if (urlCode) {
    if (entryNameInput.value.trim()) join();
    else entryNameInput.focus();
  }

  // ---------- Init ----------
  window.RPG.resizeCanvas();
  window.RPG.centerView();
})();
