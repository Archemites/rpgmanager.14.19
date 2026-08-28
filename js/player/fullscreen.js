/* ============================================================
   Player fullscreen: kills the browser navigation/address bar on the player
   window. Browser chrome cannot be removed by script alone — the Fullscreen
   API is the only way — and it requires a user gesture *inside this window*,
   so a postMessage from the GM can't trigger it. Hence the click-to-enter
   overlay shown on load, plus a persistent fullscreen toggle and the F key.

   Self-contained: only consumes window.RPG.resizeCanvas (js/player/state.js),
   exposes nothing. Loads after state.js, before sync.js.
   ============================================================ */

(() => {
  'use strict';

  const root = document.documentElement;

  const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function enter() {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) return;
    // navigationUI:'hide' asks the browser to drop every scrap of chrome it can
    const p = req.call(root, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  }

  function exit() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) { const p = fn.call(document); if (p && p.catch) p.catch(() => {}); }
  }

  function toggle() { isFullscreen() ? exit() : enter(); }

  const FS_EXPAND_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  const FS_COLLAPSE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';

  // ---------- Click-to-enter overlay (shown once, on load) ----------
  const prompt = document.createElement('div');
  prompt.id = 'fsPrompt';
  prompt.innerHTML =
    '<div class="fs-box">' +
      '<div class="fs-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></div>' +
      '<div class="fs-title">CLIQUE PARA TELA CHEIA</div>' +
      '<div class="fs-hint">Esc sai &middot; F alterna</div>' +
    '</div>';
  prompt.addEventListener('click', () => { enter(); dismissPrompt(); });

  function dismissPrompt() { prompt.classList.add('hidden'); }

  // ---------- Persistent toggle button ----------
  const btn = document.createElement('button');
  btn.id = 'fsBtn';
  btn.type = 'button';
  btn.title = 'Tela cheia (F)';
  btn.innerHTML = FS_EXPAND_SVG;
  btn.addEventListener('click', toggle);

  // Both stay hidden until js/player/sync.js calls window.RPG.showFullscreenUI()
  // once the WebRTC handshake completes — the entry screen owns the page
  // before that, and showing "click for fullscreen" over it is confusing.
  prompt.classList.add('hidden');
  btn.classList.add('hidden');

  if (supported) {
    document.body.appendChild(prompt);
    document.body.appendChild(btn);
  }

  window.RPG.showFullscreenUI = () => {
    if (!supported) return;
    btn.classList.remove('hidden');
    // already fullscreen (e.g. window reloaded inside F11)? skip the overlay
    if (!isFullscreen()) prompt.classList.remove('hidden');
  };

  // ---------- Keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') { toggle(); dismissPrompt(); }
  });

  // ---------- Keep the canvas in step with the viewport ----------
  const onChange = () => {
    if (isFullscreen()) dismissPrompt();
    btn.title = isFullscreen() ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
    btn.innerHTML = isFullscreen() ? FS_COLLAPSE_SVG : FS_EXPAND_SVG;
    // fullscreenchange fires before the viewport settles on some browsers
    requestAnimationFrame(() => window.RPG.resizeCanvas());
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
})();
