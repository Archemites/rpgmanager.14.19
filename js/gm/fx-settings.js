/* ============================================================
   GM FX size/duration popup: right-click while the "🎆 Efeitos" tool is
   active opens a small modal with two sliders (size %, duration %) that set
   the scale/durationMult applied to every FX spawned afterwards (js/gm/mouse.js's
   fx click handler reads getFxSettings()). Purely a GM-side control panel —
   the values only matter at spawn time, never synced on their own.
   ============================================================ */

(() => {
  'use strict';

  let scale = 1;
  let durationMult = 1;

  const overlay = document.getElementById('fxSettingsOverlay');
  const sizeSlider = document.getElementById('fxSizeSlider');
  const sizeVal = document.getElementById('fxSizeVal');
  const durationSlider = document.getElementById('fxDurationSlider');
  const durationVal = document.getElementById('fxDurationVal');
  const closeBtn = document.getElementById('closeFxSettingsBtn');

  function openFxSettings() {
    overlay.classList.add('open');
  }
  function closeFxSettings() {
    overlay.classList.remove('open');
  }

  sizeSlider.addEventListener('input', () => {
    scale = Number(sizeSlider.value) / 100;
    sizeVal.textContent = sizeSlider.value + '%';
  });
  durationSlider.addEventListener('input', () => {
    durationMult = Number(durationSlider.value) / 100;
    durationVal.textContent = durationSlider.value + '%';
  });

  closeBtn.addEventListener('click', closeFxSettings);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFxSettings(); });

  // ---------- Expose to window.RPG ----------
  window.RPG.openFxSettings = openFxSettings;
  window.RPG.closeFxSettings = closeFxSettings;
  window.RPG.getFxSettings = () => ({ scale, durationMult });
})();
