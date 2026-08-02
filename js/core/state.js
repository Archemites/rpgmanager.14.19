/* ============================================================
   State: shared state object and constants
   ============================================================ */

(function() {
  'use strict';

  // Constants
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 6;
  const BASE_TOKEN_RADIUS = 20;
  const MAX_ACTIVE_BARS = 2;

  // Shared state object
  const state = {
    grid: { show: true, size: 48, color: '#45ff78' },
    map: { img: null, scalePct: 100, dataUrl: null },
    tokens: [],
    fog: [],
    partyBars: [
      { id: 'bar-vida', name: 'Vida', color: '#e04b4b', defaultMax: 10, active: true, display: 'horizontal', side: 'left', direction: 'ltr' },
    ],
    glossary: [],
    nextId: 1,
    nextFogId: 1,
    nextBarId: 1,
    nextEffectId: 1,
    selectedTokenId: null,
    fogMode: false,
    combat: { active: false, order: [] },
  };

  // Expose via shared namespace
  window.RPG = window.RPG || {};
  window.RPG.state = state;
  window.RPG.MIN_ZOOM = MIN_ZOOM;
  window.RPG.MAX_ZOOM = MAX_ZOOM;
  window.RPG.BASE_TOKEN_RADIUS = BASE_TOKEN_RADIUS;
  window.RPG.MAX_ACTIVE_BARS = MAX_ACTIVE_BARS;
})();
