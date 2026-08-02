/* ============================================================
   GM circular photo crop modal — self-contained, minimal coupling.
   openCropEditor(srcDataUrl, onDone) opens it; onDone(dataUrl) fires on Apply.
   ============================================================ */

(() => {
  'use strict';

  const cropOverlay = document.getElementById('cropOverlay');
  const cropCanvasWrap = document.getElementById('cropCanvasWrap');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropCtx = cropCanvas.getContext('2d');
  const cropZoomSlider = document.getElementById('cropZoomSlider');
  const cropCancelBtn = document.getElementById('cropCancelBtn');
  const cropApplyBtn = document.getElementById('cropApplyBtn');

  const CROP_OUTPUT_SIZE = 256; // final exported square image, in px

  const cropState = {
    img: null,
    minZoom: 1,       // zoom at which the image just covers the crop circle
    zoom: 1,           // user zoom multiplier on top of minZoom
    offsetX: 0,         // image-space pan offset (in source image pixels)
    offsetY: 0,
    onDone: null,
  };

  const cropDrag = { active: false, startX: 0, startY: 0, offX: 0, offY: 0 };

  function openCropEditor(srcDataUrl, onDone) {
    const img = new Image();
    img.onload = () => {
      cropState.img = img;
      cropState.onDone = onDone;
      cropState.offsetX = img.naturalWidth / 2;
      cropState.offsetY = img.naturalHeight / 2;
      cropState.minZoom = 1;
      cropState.zoom = 1;
      cropZoomSlider.value = 1;
      cropOverlay.classList.add('open');
      resizeCropCanvas();
    };
    img.src = srcDataUrl;
  }

  function resizeCropCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = cropCanvasWrap.clientWidth;
    cropCanvas.width = Math.round(size * dpr);
    cropCanvas.height = Math.round(size * dpr);
    drawCrop();
  }
  window.addEventListener('resize', () => {
    if (cropOverlay.classList.contains('open')) resizeCropCanvas();
  });

  function drawCrop() {
    const img = cropState.img;
    if (!img) return;
    const size = cropCanvas.width; // square, device px
    cropCtx.setTransform(1, 0, 0, 1, 0, 0);
    cropCtx.clearRect(0, 0, size, size);
    cropCtx.fillStyle = '#111';
    cropCtx.fillRect(0, 0, size, size);

    // "cover" scale: image fills the square crop area at zoom=1
    const coverScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = coverScale * cropState.zoom;

    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = size / 2 - cropState.offsetX * scale;
    const cy = size / 2 - cropState.offsetY * scale;

    cropCtx.drawImage(img, cx, cy, drawW, drawH);

    // dim outside the circular crop area
    cropCtx.save();
    cropCtx.fillStyle = 'rgba(0,0,0,0.55)';
    cropCtx.beginPath();
    cropCtx.rect(0, 0, size, size);
    cropCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
    cropCtx.fill('evenodd');
    cropCtx.restore();

    cropCtx.beginPath();
    cropCtx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    cropCtx.lineWidth = 2;
    cropCtx.strokeStyle = 'rgba(255,255,255,0.8)';
    cropCtx.stroke();
  }

  function clampCropOffset() {
    const img = cropState.img;
    if (!img) return;
    const size = cropCanvas.width;
    const coverScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = coverScale * cropState.zoom;
    // visible half-extent in image space
    const halfW = (size / scale) / 2;
    const halfH = (size / scale) / 2;
    cropState.offsetX = Math.min(img.naturalWidth - halfW, Math.max(halfW, cropState.offsetX));
    cropState.offsetY = Math.min(img.naturalHeight - halfH, Math.max(halfH, cropState.offsetY));
  }

  cropZoomSlider.addEventListener('input', () => {
    cropState.zoom = Number(cropZoomSlider.value);
    clampCropOffset();
    drawCrop();
  });

  cropCanvasWrap.addEventListener('mousedown', (e) => {
    cropDrag.active = true;
    cropCanvasWrap.classList.add('dragging');
    cropDrag.startX = e.clientX;
    cropDrag.startY = e.clientY;
    cropDrag.offX = cropState.offsetX;
    cropDrag.offY = cropState.offsetY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!cropDrag.active) return;
    const img = cropState.img;
    const size = cropCanvas.width;
    const coverScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = coverScale * cropState.zoom;
    const dpr = window.devicePixelRatio || 1;
    const dx = (e.clientX - cropDrag.startX) * dpr;
    const dy = (e.clientY - cropDrag.startY) * dpr;
    cropState.offsetX = cropDrag.offX - dx / scale;
    cropState.offsetY = cropDrag.offY - dy / scale;
    clampCropOffset();
    drawCrop();
  });
  window.addEventListener('mouseup', () => {
    cropDrag.active = false;
    cropCanvasWrap.classList.remove('dragging');
  });

  cropCanvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    cropState.zoom = Math.min(4, Math.max(1, cropState.zoom * delta));
    cropZoomSlider.value = cropState.zoom;
    clampCropOffset();
    drawCrop();
  }, { passive: false });

  function closeCropEditor() {
    cropOverlay.classList.remove('open');
    cropState.img = null;
    cropState.onDone = null;
  }

  cropCancelBtn.addEventListener('click', closeCropEditor);
  cropOverlay.addEventListener('click', (e) => { if (e.target === cropOverlay) closeCropEditor(); });

  cropApplyBtn.addEventListener('click', () => {
    const img = cropState.img;
    if (!img) return;

    const out = document.createElement('canvas');
    out.width = CROP_OUTPUT_SIZE;
    out.height = CROP_OUTPUT_SIZE;
    const octx = out.getContext('2d');

    const coverScale = Math.max(cropCanvas.width / img.naturalWidth, cropCanvas.width / img.naturalHeight);
    const scale = coverScale * cropState.zoom;
    // source rect (in original image pixels) that maps to the crop square
    const srcHalf = (cropCanvas.width / scale) / 2;
    const sx = cropState.offsetX - srcHalf;
    const sy = cropState.offsetY - srcHalf;
    const sSize = srcHalf * 2;

    octx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

    const resultUrl = out.toDataURL('image/png');
    const cb = cropState.onDone;
    closeCropEditor();
    if (cb) cb(resultUrl);
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.openCropEditor = openCropEditor;
})();
