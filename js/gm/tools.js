/* ============================================================
   GM tool-mode toggles (fog/move/measure) + top toolbar
   (import/sliders panel), zoom buttons, help modal.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const canvas = window.RPG.canvas;
  const viewport = window.RPG.viewport;
  const zoomAt = window.RPG.zoomAt;
  const centerView = window.RPG.centerView;

  const zoomLabel = document.getElementById('zoomLabel');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');

  // ---------- Zoom buttons ----------
  function viewportCenter() {
    return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  }
  zoomInBtn.addEventListener('click', () => {
    const c = viewportCenter();
    zoomAt(c.x, c.y, 1.25);
  });
  zoomOutBtn.addEventListener('click', () => {
    const c = viewportCenter();
    zoomAt(c.x, c.y, 1 / 1.25);
  });
  zoomResetBtn.addEventListener('click', centerView);

  const fogModeBtn = document.getElementById('topFogBtn');
  const clearFogBtn = document.getElementById('topClearFogBtn');
  const moveModeBtn = document.getElementById('topMoveBtn');
  const measureBtn = document.getElementById('topMeasureBtn');
  const fxModeBtn = document.getElementById('topFxBtn');

  function toggleFogMode() {
    state.fogMode = !state.fogMode;
    if (state.fogMode) {
      state.moveMode = false; moveModeBtn.classList.remove('active');
      window.RPG.setFxMode(false); fxModeBtn.classList.remove('active');
    }
    fogModeBtn.classList.toggle('active', state.fogMode);
    canvas.classList.toggle('fog-mode', state.fogMode);
    canvas.classList.remove('over-token');
  }
  fogModeBtn.addEventListener('click', toggleFogMode);

  clearFogBtn.addEventListener('click', () => {
    if (state.fog.length === 0) return;
    state.fog = [];
    window.RPG.draw();
    window.RPG.sendState();
  });

  function toggleMoveMode() {
    state.moveMode = !state.moveMode;
    if (state.moveMode) {
      state.fogMode = false; fogModeBtn.classList.remove('active');
      window.RPG.setFxMode(false); fxModeBtn.classList.remove('active');
      canvas.classList.remove('fog-mode');
    }
    moveModeBtn.classList.toggle('active', state.moveMode);
  }
  moveModeBtn.addEventListener('click', toggleMoveMode);

  function toggleMeasureMode() {
    const newMode = !window.RPG.getMeasureMode();
    window.RPG.setMeasureMode(newMode);
    measureBtn.classList.toggle('active', newMode);
    if (newMode) {
      window.RPG.setFxMode(false); fxModeBtn.classList.remove('active');
    } else {
      window.RPG.measureEnd();
      window.RPG.setMeasureSelectedTokenId(null);
      state.selectedTokenId = null;
      window.RPG.renderTokenList();
      window.RPG.draw();
    }
  }
  measureBtn.addEventListener('click', toggleMeasureMode);

  function toggleFxMode() {
    const newMode = !window.RPG.getFxMode();
    window.RPG.setFxMode(newMode);
    fxModeBtn.classList.toggle('active', newMode);
    if (newMode) {
      state.fogMode = false; fogModeBtn.classList.remove('active');
      state.moveMode = false; moveModeBtn.classList.remove('active');
      canvas.classList.remove('fog-mode');
    }
  }
  fxModeBtn.addEventListener('click', toggleFxMode);

  // ---------- Token resize ----------
  const TOKEN_MIN_R = 8;
  const TOKEN_MAX_R = 120;
  const tokenShrinkBtn = document.getElementById('topTokenShrinkBtn');
  const tokenGrowBtn = document.getElementById('topTokenGrowBtn');

  function resizeSelectedToken(factor) {
    const t = state.tokens.find(tk => tk.id === state.selectedTokenId);
    if (!t) return;
    window.RPG.captureBeforeChange(factor > 1 ? 'Aumentou token' : 'Diminuiu token');
    t.r = Math.min(TOKEN_MAX_R, Math.max(TOKEN_MIN_R, Math.round(t.r * factor)));
    window.RPG.draw();
    window.RPG.sendState();
  }
  tokenShrinkBtn.addEventListener('click', () => resizeSelectedToken(1 / 1.15));
  tokenGrowBtn.addEventListener('click', () => resizeSelectedToken(1.15));

  // ---------- Object resize ----------
  const objectShrinkBtn = document.getElementById('topObjectShrinkBtn');
  const objectGrowBtn = document.getElementById('topObjectGrowBtn');
  objectShrinkBtn.addEventListener('click', () => window.RPG.resizeSelectedObject(1 / 1.15));
  objectGrowBtn.addEventListener('click', () => window.RPG.resizeSelectedObject(1.15));

  // ---------- Top toolbar tools ----------
  const topImportBtn = document.getElementById('topImportBtn');
  const mapFileInput = document.getElementById('mapFileInput');

  topImportBtn.addEventListener('click', () => mapFileInput.click());

  // ---------- Right tools toggle (collapsible toolbar) ----------
  const rightToolsToggleBtn = document.getElementById('rightToolsToggleBtn');
  const rightToolsBar = document.getElementById('rightToolsBar');
  if (rightToolsToggleBtn && rightToolsBar) {
    rightToolsToggleBtn.addEventListener('click', () => {
      const collapsed = rightToolsBar.classList.toggle('collapsed');
      rightToolsToggleBtn.classList.toggle('collapsed', collapsed);
    });
  }

  // ---------- Settings modal ----------
  const settingsOverlay = document.getElementById('settingsOverlay');
  const topSlidersBtn = document.getElementById('topSlidersBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  function openSettings() {
    settingsOverlay.classList.add('open');
  }

  function closeSettings() {
    settingsOverlay.classList.remove('open');
  }

  topSlidersBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });

  // ---------- Event log modal ----------
  const eventLogOverlay = document.getElementById('eventLogOverlay');
  const openEventLogBtn = document.getElementById('openEventLogBtn');
  const closeEventLogBtn = document.getElementById('closeEventLogBtn');

  function openEventLog() {
    window.RPG.renderEventLog();
    window.RPG.renderVersionHistory();
    eventLogOverlay.classList.add('open');
  }

  function closeEventLog() {
    eventLogOverlay.classList.remove('open');
  }

  openEventLogBtn.addEventListener('click', openEventLog);
  closeEventLogBtn.addEventListener('click', closeEventLog);
  eventLogOverlay.addEventListener('click', (e) => { if (e.target === eventLogOverlay) closeEventLog(); });

  // ---------- Event log / version history tab switcher ----------
  const eventLogTabBtns = document.querySelectorAll('#eventLogModal .tab-btn');
  eventLogTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      eventLogTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('eventLogList').classList.toggle('active', btn.dataset.tab === 'eventLog');
      document.getElementById('versionHistoryList').classList.toggle('active', btn.dataset.tab === 'versionHistory');
    });
  });

  // ---------- Help modal ----------
  const helpOverlay = document.getElementById('helpOverlay');
  const helpBtn = document.getElementById('helpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  function openHelp() {
    helpOverlay.classList.add('open');
  }

  function closeHelp() {
    helpOverlay.classList.remove('open');
  }

  helpBtn.addEventListener('click', openHelp);
  closeHelpBtn.addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) closeHelp(); });

  // ---------- Expose to window.RPG ----------
  window.RPG.toggleFogMode = toggleFogMode;
  window.RPG.toggleMoveMode = toggleMoveMode;
  window.RPG.toggleMeasureMode = toggleMeasureMode;
})();
