/* ============================================================
   GM map import/scale, grid controls, global lighting slider,
   wall-occlusion-method select. Owns the top-bar DOM controls for these.
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
    mapBgColor.value = state.map.bgColor || window.RPG.getThemeMapBg();
    gridToggle.checked = state.grid.show;
    gridSize.value = state.grid.size;
    gridSizeVal.textContent = state.grid.size + 'px';
    gridColor.value = state.grid.color || window.RPG.getThemeGridColor();
  }

  // ---------- Map import ----------
  mapFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        state.map.img = img;
        state.map.dataUrl = dataUrl;
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
      img.src = dataUrl;
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
  gridColor.addEventListener('input', () => {
    state.grid.color = gridColor.value;
    window.RPG.draw();
    window.RPG.sendState();
  });

  // ---------- Global lighting (vision reach into fog) ----------
  const lightingInput = document.getElementById('topLighting');
  const lightingVal = document.getElementById('topLightingVal');
  lightingInput.addEventListener('input', () => {
    const pct = Number(lightingInput.value);
    state.lighting = pct / 100;
    lightingVal.textContent = pct + '%';
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

  // ---------- Wall occlusion method (rendered on the player window) ----------
  const wallMethodSelect = document.getElementById('topWallMethod');
  wallMethodSelect.value = state.wallOcclusionMethod;
  wallMethodSelect.addEventListener('change', () => {
    state.wallOcclusionMethod = wallMethodSelect.value;
    window.RPG.sendState();
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.syncSceneControlsFromState = syncSceneControlsFromState;
  window.RPG.removeMap = removeMap;
  window.RPG.setMapScale = setMapScale;
  window.RPG.setGridSize = setGridSize;
})();
