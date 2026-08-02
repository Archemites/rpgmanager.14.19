/* ============================================================
   Photo Cache: token photo image caching
   ============================================================ */

(function() {
  'use strict';

  const photoImgCache = new Map();

  function getTokenPhotoImg(t) {
    if (!t.photoDataUrl) return null;
    let img = photoImgCache.get(t.photoDataUrl);
    if (!img) {
      img = new Image();
      img.onload = () => window.RPG.draw();
      img.src = t.photoDataUrl;
      photoImgCache.set(t.photoDataUrl, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  // Expose via shared namespace
  window.RPG = window.RPG || {};
  window.RPG.getTokenPhotoImg = getTokenPhotoImg;
  window.RPG.photoImgCache = photoImgCache;
})();
