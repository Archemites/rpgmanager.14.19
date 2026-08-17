/* ============================================================
   GM table theme picker (Ajustes > Tema de Mesa). Swaps the whole-app CSS
   skin by setting data-theme on <html> — every color across the app resolves
   from the CSS variables redefined per theme in css/theme.css, so there's no
   per-element work here. Persists the choice to localStorage and mirrors it
   to the player window (js/gm/sync.js's sendTheme → js/player/sync.js).
   ============================================================ */

(() => {
  'use strict';

  const THEME_KEY = 'rpg-table-theme';
  const THEMES = ['cyberpunk', 'dnd', 'cthulhu', 'black', 'cream'];
  const DEFAULT_THEME = 'cyberpunk';

  let currentTheme = DEFAULT_THEME;

  const picker = document.getElementById('themePicker');
  const swatches = picker ? Array.from(picker.querySelectorAll('.theme-swatch')) : [];

  function markActive(theme) {
    for (const sw of swatches) sw.classList.toggle('active', sw.dataset.theme === theme);
  }

  function applyTheme(theme, opts) {
    if (!THEMES.includes(theme)) theme = DEFAULT_THEME;
    currentTheme = theme;
    // cyberpunk is the bare :root default — no attribute needed, but setting
    // it explicitly is harmless and keeps the active-swatch logic uniform
    document.documentElement.setAttribute('data-theme', theme);
    markActive(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
    if (opts && opts.broadcast && window.RPG.sendTheme) window.RPG.sendTheme(theme);
    if (opts && opts.log && window.RPG.logEvent) window.RPG.logEvent('Trocou tema: ' + theme);
    // scenes with no manual bgColor override follow the theme's --map-bg —
    // redraw/resync so the switch is visible immediately, not just on next scene change
    if (window.RPG.draw) window.RPG.draw();
    if (window.RPG.renderSceneList) window.RPG.renderSceneList();
    if (opts && opts.broadcast && window.RPG.sendState) window.RPG.sendState();
  }

  // Resolves the active theme's default map background (--map-bg). Used as
  // the fallback wherever a scene has no manual bgColor override.
  function getThemeMapBg() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim();
    return v || '#03140a';
  }

  // Resolves the active theme's accent color, used as the default grid line
  // color. Fallback wherever a scene has no manual grid.color override.
  function getThemeGridColor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#45ff78';
  }

  for (const sw of swatches) {
    sw.addEventListener('click', () => applyTheme(sw.dataset.theme, { broadcast: true, log: true }));
  }

  // ---------- Restore saved theme on load ----------
  let saved = DEFAULT_THEME;
  try { saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME; } catch (e) { /* ignore */ }
  applyTheme(saved, { broadcast: false, log: false });

  // ---------- Expose to window.RPG ----------
  window.RPG.getTheme = () => currentTheme;
  window.RPG.applyTheme = applyTheme;
  window.RPG.getThemeMapBg = getThemeMapBg;
  window.RPG.getThemeGridColor = getThemeGridColor;
})();
