/* ============================================================
   Player sync: entry screen (name + WebRTC invite code handshake, via
   pasted text or camera QR scan), then consumes 'rpg-state'/'rpg-fx'/
   'rpg-theme' messages over the data channel. Loads absolute last among
   player files.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const showStatus = window.RPG.showStatus;

  const NAME_KEY = 'rpg-player-name';

  const entryOverlay = document.getElementById('entryOverlay');
  const entryStep1 = document.getElementById('entryStep1');
  const entryStep2 = document.getElementById('entryStep2');
  const entryNameInput = document.getElementById('entryNameInput');
  const entryOfferInput = document.getElementById('entryOfferInput');
  const entryJoinBtn = document.getElementById('entryJoinBtn');
  const entryAnswerCode = document.getElementById('entryAnswerCode');
  const entryAnswerQr = document.getElementById('entryAnswerQr');
  const entryStatus = document.getElementById('entryStatus');
  const viewport = document.getElementById('viewport');

  const entryModeTextBtn = document.getElementById('entryModeTextBtn');
  const entryModeScanBtn = document.getElementById('entryModeScanBtn');
  const entryModeText = document.getElementById('entryModeText');
  const entryModeScan = document.getElementById('entryModeScan');
  const entryScanVideo = document.getElementById('entryScanVideo');
  const entryScanHint = document.getElementById('entryScanHint');

  entryNameInput.value = localStorage.getItem(NAME_KEY) || '';

  // ---------- Text vs camera-scan mode toggle ----------
  let scanStream = null;
  let scanRafId = null;
  let scannedOfferCode = null;

  function stopScan() {
    if (scanRafId !== null) { cancelAnimationFrame(scanRafId); scanRafId = null; }
    if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  }

  async function startScan() {
    scannedOfferCode = null;
    entryScanHint.textContent = 'Aponte a câmera para o QR do mestre.';
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (err) {
      entryScanHint.textContent = 'Não foi possível acessar a câmera.';
      return;
    }
    entryScanVideo.srcObject = scanStream;
    await entryScanVideo.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    function tick() {
      if (!scanStream) return;
      if (entryScanVideo.readyState === entryScanVideo.HAVE_ENOUGH_DATA && window.jsQR) {
        canvas.width = entryScanVideo.videoWidth;
        canvas.height = entryScanVideo.videoHeight;
        ctx.drawImage(entryScanVideo, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code && code.data) {
          scannedOfferCode = code.data;
          entryScanHint.textContent = 'QR lido ✓ — clique em Entrar.';
          stopScan();
          return;
        }
      }
      scanRafId = requestAnimationFrame(tick);
    }
    scanRafId = requestAnimationFrame(tick);
  }

  function setMode(mode) {
    stopScan();
    const isScan = mode === 'scan';
    entryModeTextBtn.classList.toggle('active', !isScan);
    entryModeScanBtn.classList.toggle('active', isScan);
    entryModeText.classList.toggle('hidden', isScan);
    entryModeScan.classList.toggle('hidden', !isScan);
    if (isScan) startScan();
  }

  entryModeTextBtn.addEventListener('click', () => setMode('text'));
  entryModeScanBtn.addEventListener('click', () => setMode('scan'));

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

  function onConnected(channel) {
    stopScan();
    entryOverlay.classList.remove('open');
    viewport.classList.remove('hidden');
    window.RPG.resizeCanvas();
    if (window.RPG.showFullscreenUI) window.RPG.showFullscreenUI();

    channel.addEventListener('message', (e) => {
      try { handleMessage(JSON.parse(e.data)); } catch (_) {}
    });
    channel.addEventListener('close', () => {
      showStatus('Conexão com o mestre perdida.');
      entryOverlay.classList.add('open');
      viewport.classList.add('hidden');
      entryStep1.classList.remove('hidden');
      entryStep2.classList.add('hidden');
      entryStatus.textContent = 'Conexão perdida — cole um novo código de convite para reconectar.';
    });
  }

  entryJoinBtn.addEventListener('click', async () => {
    const name = entryNameInput.value.trim();
    if (name) localStorage.setItem(NAME_KEY, name);

    const isScanMode = !entryModeScan.classList.contains('hidden');
    const offerCode = isScanMode ? (scannedOfferCode || '') : entryOfferInput.value.trim();
    if (!offerCode) {
      entryStatus.textContent = isScanMode ? 'Escaneie o QR do mestre primeiro.' : 'Cole o código de convite primeiro.';
      return;
    }

    stopScan();
    entryStatus.textContent = 'Gerando resposta…';
    let guest;
    try {
      guest = window.RPG.createGuestConnection(offerCode);
    } catch (err) {
      entryStatus.textContent = 'Código de convite inválido.';
      return;
    }

    let answerCode;
    try {
      answerCode = await guest.createAnswerCode();
    } catch (err) {
      entryStatus.textContent = 'Não foi possível processar o código de convite.';
      return;
    }

    entryAnswerCode.value = answerCode;
    entryAnswerQr.innerHTML = '';
    if (window.QRCode) {
      new QRCode(entryAnswerQr, { text: answerCode, width: 200, height: 200 });
    }
    entryStatus.textContent = 'Envie o código de resposta acima ao mestre. Aguardando conexão…';
    entryStep1.classList.add('hidden');
    entryStep2.classList.remove('hidden');

    guest.channelPromise.then((channel) => {
      if (channel.readyState === 'open') {
        onConnected(channel);
      } else {
        channel.addEventListener('open', () => onConnected(channel), { once: true });
      }
    });
  });

  // ---------- Init ----------
  window.RPG.resizeCanvas();
  window.RPG.centerView();
})();
