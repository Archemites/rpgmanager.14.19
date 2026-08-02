/* ============================================================
   GM universal-bar-definition editor + per-member value editor (two modes
   in one modal: 'def' creates/edits a universal bar definition, 'value'
   edits one party member's current/max for a specific bar).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  const BAR_PRESET_COLORS = ['#e04b4b','#4b8ee0','#a04be0','#4be08f','#e0c94b','#e08a4b','#4be0d8','#e04ba0'];
  const barOverlay = document.getElementById('barOverlay');
  const barModalTitle = document.getElementById('barModalTitle');
  const barNameInput = document.getElementById('barNameInput');
  const barNameField = barNameInput.closest('.field');
  const barCurrentInput = document.getElementById('barCurrentInput');
  const barMaxInput = document.getElementById('barMaxInput');
  const barColorInput = document.getElementById('barColorInput');
  const barColorField = barColorInput.closest('.field');
  const barSwatchRow = document.getElementById('barSwatchRow');
  const barDisplayFields = document.getElementById('barDisplayFields');
  const barDisplaySelect = document.getElementById('barDisplaySelect');
  const barSideField = document.getElementById('barSideField');
  const barSideSelect = document.getElementById('barSideSelect');
  const barDirectionField = document.getElementById('barDirectionField');
  const barDirectionSelect = document.getElementById('barDirectionSelect');
  const barCancelBtn = document.getElementById('barCancelBtn');
  const barSaveBtn = document.getElementById('barSaveBtn');

  // show/hide side & direction depending on the chosen display mode
  function updateBarDisplayFieldsVisibility() {
    const mode = barDisplaySelect.value;
    // side only matters for vertical; direction matters for horizontal & vertical (not radial)
    barSideField.style.display = (mode === 'vertical') ? '' : 'none';
    barDirectionField.style.display = (mode === 'radial') ? 'none' : '';
  }
  barDisplaySelect.addEventListener('change', updateBarDisplayFieldsVisibility);

  BAR_PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      barColorInput.value = c;
      barSwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    barSwatchRow.appendChild(sw);
  });

  // mode: 'def' (universal name+color) | 'value' (per-member current/max)
  let barEditMode = null;
  let barEditDef = null;   // def being created/edited
  let barEditToken = null; // token when editing a value

  function openBarDefEditor(def) {
    barEditMode = 'def';
    barEditDef = def;
    barEditToken = null;
    barNameField.style.display = '';
    barColorField.style.display = '';
    barDisplayFields.style.display = '';
    if (def) {
      barModalTitle.textContent = 'Editar barra universal';
      barNameInput.value = def.name;
      barColorInput.value = def.color;
      barCurrentInput.value = def.defaultMax;
      barMaxInput.value = def.defaultMax;
      barDisplaySelect.value = def.display || 'horizontal';
      barSideSelect.value = def.side || 'left';
      barDirectionSelect.value = def.direction || 'ltr';
    } else {
      barModalTitle.textContent = 'Nova barra universal';
      barNameInput.value = '';
      barColorInput.value = BAR_PRESET_COLORS[state.partyBars.length % BAR_PRESET_COLORS.length];
      barCurrentInput.value = 10;
      barMaxInput.value = 10;
      barDisplaySelect.value = 'horizontal';
      barSideSelect.value = 'left';
      barDirectionSelect.value = 'ltr';
    }
    updateBarDisplayFieldsVisibility();
    barSwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    barOverlay.classList.add('open');
    barNameInput.focus();
  }

  function openBarValueEditor(token, def) {
    barEditMode = 'value';
    barEditDef = def;
    barEditToken = token;
    const val = token.barValues[def.id] || { current: def.defaultMax, max: def.defaultMax };
    barModalTitle.textContent = `${def.name} — ${token.name || 'Token ' + token.id}`;
    // hide name, color & display (those are universal); show only current/max
    barNameField.style.display = 'none';
    barColorField.style.display = 'none';
    barDisplayFields.style.display = 'none';
    barCurrentInput.value = val.current;
    barMaxInput.value = val.max;
    barOverlay.classList.add('open');
    barCurrentInput.focus();
  }

  function closeBarEditor() {
    barOverlay.classList.remove('open');
    barEditMode = null;
    barEditDef = null;
    barEditToken = null;
  }

  barCancelBtn.addEventListener('click', closeBarEditor);
  barOverlay.addEventListener('click', (e) => { if (e.target === barOverlay) closeBarEditor(); });

  barSaveBtn.addEventListener('click', () => {
    const max = Math.max(1, Number(barMaxInput.value) || 1);
    const current = Math.max(0, Math.min(max, Number(barCurrentInput.value) || 0));

    if (barEditMode === 'def') {
      const name = barNameInput.value.trim() || 'Barra';
      const color = barColorInput.value;
      const display = barDisplaySelect.value;
      const side = barSideSelect.value;
      const direction = barDirectionSelect.value;
      if (barEditDef) {
        barEditDef.name = name;
        barEditDef.color = color;
        barEditDef.defaultMax = max;
        barEditDef.display = display;
        barEditDef.side = side;
        barEditDef.direction = direction;
      } else {
        state.partyBars.push({ id: 'bar-' + (state.nextBarId++), name, color, defaultMax: max, active: false, display, side, direction });
      }
      window.RPG.syncAllPartyBarValues();
    } else if (barEditMode === 'value' && barEditToken && barEditDef) {
      if (!barEditToken.barValues) barEditToken.barValues = {};
      barEditToken.barValues[barEditDef.id] = { current, max };
    }

    closeBarEditor();
    window.RPG.renderParty();
    window.RPG.draw();
    window.RPG.sendState();
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.openBarDefEditor = openBarDefEditor;
  window.RPG.openBarValueEditor = openBarValueEditor;
})();
