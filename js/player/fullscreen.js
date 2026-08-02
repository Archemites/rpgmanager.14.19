/* ============================================================
   Player fullscreen: kills the browser navigation/address bar on the player
   window. Browser chrome cannot be removed by script alone — the Fullscreen
   API is the only way — and it requires a user gesture *inside this window*,
   so a postMessage from the GM can't trigger it. Hence the click-to-enter
   overlay shown on load, plus a persistent ⛶ toggle and the F key.

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

  // ---------- Click-to-enter overlay (shown once, on load) ----------
  const prompt = document.createElement('div');
  prompt.id = 'fsPrompt';
  prompt.innerHTML =
    '<div class="fs-box">' +
      '<div class="fs-icon">⛶</div>' +
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
  btn.textContent = '⛶';
  btn.addEventListener('click', toggle);

  if (supported) {
    document.body.appendChild(prompt);
    document.body.appendChild(btn);
    // already fullscreen (e.g. window reloaded inside F11)? skip the overlay
    if (isFullscreen()) dismissPrompt();
  }

  // ---------- Keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') { toggle(); dismissPrompt(); }
  });

  // ---------- Keep the canvas in step with the viewport ----------
  const onChange = () => {
    if (isFullscreen()) dismissPrompt();
    btn.title = isFullscreen() ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
    // fullscreenchange fires before the viewport settles on some browsers
    requestAnimationFrame(() => window.RPG.resizeCanvas());
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
})();
