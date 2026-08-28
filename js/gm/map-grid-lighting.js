/* ============================================================
   GM map import/scale, grid controls. Owns the top-bar DOM controls for these.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  // ---------- Elements ----------
  const mapFileInput = document.getElementById('mapFileInput');
  const mapScale = document.getElementById('topMapScale');
  const mapScaleVal = document.getElementById('topMapScaleVal');
  const removeMapBtn = document.getElementById('topRemoveMapBtn');
  const mapLabel = document.getElementById('mapLabel');
  const mapBgColor = document.getElementById('topMapBgColor');

  const gridToggle = document.getElementById('topGridToggle');
  const gridSize = document.getElementById('topGridSize');
  const gridSizeVal = document.getElementById('topGridSizeVal');
  const gridOpacity = document.getElementById('topGridOpacity');
  const gridOpacityVal = document.getElementById('topGridOpacityVal');
  const gridColor = document.getElementById('topGridColor');

  // Reflect the (just-switched-to) scene's map/grid fields onto the top-bar
  // controls — those inputs are otherwise only ever set once, at load time.
  function syncSceneControlsFromState() {
    const hasMap = !!state.map.img;
    mapScale.value = state.map.scalePct;
    mapScaleVal.textContent = state.map.scalePct + '%';
    mapScale.disabled = !hasMap;
    removeMapBtn.disabled = !hasMap;
    mapLabel.textContent = hasMap ? (state.map.name || 'mapa') : 'nenhum';
    mapBgColor.value = state.map.bgColor || (window.RPG.getThemeMapBg ? window.RPG.getThemeMapBg() : '#03140a');
    gridToggle.checked = state.grid.show;
    gridSize.value = state.grid.size;
    gridSizeVal.textContent = state.grid.size + 'px';
    const op = (state.grid.opacity !== undefined && state.grid.opacity !== null) ? state.grid.opacity : 30;
    if (gridOpacity) gridOpacity.value = op;
    if (gridOpacityVal) gridOpacityVal.textContent = op + '%';
    gridColor.value = state.grid.color || (window.RPG.getThemeGridColor ? window.RPG.getThemeGridColor() : '#45ff78');
  }

  // ---------- Map import & optimization ----------
  const MAX_MAP_DIM = 2560;

  function optimizeMapDataUrl(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= MAX_MAP_DIM && height <= MAX_MAP_DIM && dataUrl.length < 1024 * 1024) {
          resolve({ img, dataUrl });
          return;
        }

        if (width > MAX_MAP_DIM || height > MAX_MAP_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_MAP_DIM) / width);
            width = MAX_MAP_DIM;
          } else {
            width = Math.round((width * MAX_MAP_DIM) / height);
            height = MAX_MAP_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ img, dataUrl });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let optimized = '';
        try {
          optimized = canvas.toDataURL('image/webp', 0.82);
        } catch (_) {}

        if (!optimized || !optimized.startsWith('data:image/webp')) {
          try {
            optimized = canvas.toDataURL('image/jpeg', 0.82);
          } catch (_) {
            optimized = dataUrl;
          }
        }

        const finalUrl = (optimized && optimized.length < dataUrl.length) ? optimized : dataUrl;
        const finalImg = new Image();
        finalImg.onload = () => resolve({ img: finalImg, dataUrl: finalUrl });
        finalImg.onerror = () => resolve({ img, dataUrl });
        finalImg.src = finalUrl;
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  window.RPG.optimizeMapDataUrl = optimizeMapDataUrl;

  mapFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    mapLabel.textContent = 'Otimizando mapa…';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawDataUrl = ev.target.result;
      const res = await optimizeMapDataUrl(rawDataUrl);
      if (!res) {
        mapLabel.textContent = file.name;
        return;
      }
      state.map.img = res.img;
      state.map.dataUrl = res.dataUrl;
      state.map.scalePct = 100;
      state.map.name = file.name;
      mapScale.value = 100;
      mapScaleVal.textContent = '100%';
      mapScale.disabled = false;
      removeMapBtn.disabled = false;
      mapLabel.textContent = file.name;
      window.RPG.draw();
      window.RPG.renderSceneList();
      window.RPG.sendState(true);
    };
    reader.readAsDataURL(file);
  });

  // Drop the open scene's map image + reset its controls. `silent` skips the
  // draw/sync so a caller doing a bigger batch (clearCurrentScene) can do one
  // redraw/sendState at the end instead of two.
  function removeMap(silent) {
    state.map.img = null;
    state.map.dataUrl = null;
    state.map.name = null;
    mapScale.disabled = true;
    removeMapBtn.disabled = true;
    mapLabel.textContent = 'nenhum';
    mapFileInput.value = '';
    if (silent) return;
    window.RPG.draw();
    window.RPG.renderSceneList();
    window.RPG.sendState(true);
  }

  removeMapBtn.addEventListener('click', () => removeMap());

  function setMapScale(val) {
    const v = Math.min(400, Math.max(10, val || 100));
    state.map.scalePct = v;
    mapScale.value = v;
    mapScaleVal.textContent = v + '%';
    window.RPG.draw();
    window.RPG.renderSceneList();
    window.RPG.sendState();
  }
  mapScale.addEventListener('input', () => setMapScale(Number(mapScale.value)));

  mapBgColor.addEventListener('input', () => {
    state.map.bgColor = mapBgColor.value;
    window.RPG.draw();
    window.RPG.sendState();
  });

  // ---------- Grid controls ----------
  gridToggle.addEventListener('change', () => {
    state.grid.show = gridToggle.checked;
    window.RPG.logEvent(state.grid.show ? 'Ativou grid' : 'Desativou grid');
    window.RPG.draw();
    window.RPG.sendState();
  });
  function setGridSize(val) {
    const v = Math.min(128, Math.max(16, val || 48));
    state.grid.size = v;
    gridSize.value = v;
    gridSizeVal.textContent = v + 'px';
    window.RPG.updateHud();
    window.RPG.draw();
    window.RPG.sendState();
  }
  gridSize.addEventListener('input', () => setGridSize(Number(gridSize.value)));

  function setGridOpacity(val) {
    const v = Math.min(100, Math.max(5, val !== undefined ? val : 30));
    state.grid.opacity = v;
    if (gridOpacity) gridOpacity.value = v;
    if (gridOpacityVal) gridOpacityVal.textContent = v + '%';
    window.RPG.draw();
    window.RPG.sendState();
  }
  if (gridOpacity) {
    gridOpacity.addEventListener('input', () => setGridOpacity(Number(gridOpacity.value)));
  }

  gridColor.addEventListener('input', () => {
    state.grid.color = gridColor.value;
    window.RPG.draw();
    window.RPG.sendState();
  });

  // ---------- Snap to grid (GM-only drag behavior, not sent to player) ----------
  const snapToGridToggle = document.getElementById('topSnapToGrid');
  snapToGridToggle.checked = state.snapToGrid;
  snapToGridToggle.addEventListener('change', () => {
    state.snapToGrid = snapToGridToggle.checked;
    window.RPG.logEvent(state.snapToGrid ? 'Ativou encaixe na grade' : 'Desativou encaixe na grade');
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.syncSceneControlsFromState = syncSceneControlsFromState;
  window.RPG.removeMap = removeMap;
  window.RPG.setMapScale = setMapScale;
  window.RPG.setGridSize = setGridSize;
  window.RPG.setGridOpacity = setGridOpacity;
})();
