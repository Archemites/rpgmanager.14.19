/* ============================================================
   Shared: token photo decode cache + contrast color helper
   Used by BOTH GM and player windows.
   ============================================================ */

(function() {
  'use strict';

  // Keyed by dataURL string itself — if a token's photoDataUrl changes, the
  // old cache entry is simply orphaned (freed on reload), never evicted.
  function createPhotoCache(onLoad) {
    const cache = new Map();
    return function getTokenPhotoImg(t) {
      if (!t.photoDataUrl) return null;
      let img = cache.get(t.photoDataUrl);
      if (!img) {
        img = new Image();
        img.onload = () => onLoad();
        img.src = t.photoDataUrl;
        cache.set(t.photoDataUrl, img);
      }
      return img.complete && img.naturalWidth ? img : null;
    };
  }

  // Picks black or white text for legibility against a hex background color.
  function contrastColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#ffffff';
  }

  window.RPG = window.RPG || {};
  window.RPG.createPhotoCache = createPhotoCache;
  window.RPG.contrastColor = contrastColor;
})();
