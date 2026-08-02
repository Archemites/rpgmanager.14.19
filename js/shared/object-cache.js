/* ============================================================
   Shared: map-object image decode cache. Same pattern as
   js/shared/photo-cache.js's getTokenPhotoImg, but keyed off o.dataUrl
   (objects) instead of t.photoDataUrl (tokens) — used by BOTH windows'
   draw() loops for js/gm/objects.js-managed state.objects.
   ============================================================ */

(function() {
  'use strict';

  function createObjectImgCache(onLoad) {
    const cache = new Map();
    return function getObjectImg(o) {
      if (!o.dataUrl) return null;
      let img = cache.get(o.dataUrl);
      if (!img) {
        img = new Image();
        img.onload = () => onLoad();
        img.src = o.dataUrl;
        cache.set(o.dataUrl, img);
      }
      return img.complete && img.naturalWidth ? img : null;
    };
  }

  window.RPG = window.RPG || {};
  window.RPG.createObjectImgCache = createObjectImgCache;
})();
