/* ============================================================
   GM effects glossary modal — reference notes, not applied automatically.
   Deleting a glossary entry strips it from every token across every scene.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;

  const GLOSSARY_PRESET_COLORS = ['#4be08f','#e04b4b','#4b8ee0','#a04be0','#e0c94b','#e08a4b','#4be0d8','#e04ba0'];
  const glossaryOverlay = document.getElementById('glossaryOverlay');
  const glossaryList = document.getElementById('glossaryList');
  const glossaryFormTitle = document.getElementById('glossaryFormTitle');
  const glossaryNameInput = document.getElementById('glossaryNameInput');
  const glossaryDescInput = document.getElementById('glossaryDescInput');
  const glossaryColorInput = document.getElementById('glossaryColorInput');
  const glossaryIconInput = document.getElementById('glossaryIconInput');
  const glossaryDurationInput = document.getElementById('glossaryDurationInput');
  const glossaryNarrativeInput = document.getElementById('glossaryNarrativeInput');
  const glossaryBarModsList = document.getElementById('glossaryBarModsList');
  const glossaryAddBarModBtn = document.getElementById('glossaryAddBarModBtn');
  const glossarySwatchRow = document.getElementById('glossarySwatchRow');
  const glossarySaveBtn = document.getElementById('glossarySaveBtn');
  const glossaryClearBtn = document.getElementById('glossaryClearBtn');

  let glossaryEditId = null; // id of effect being edited, or null when adding
  let glossaryBarMods = []; // [{barId, delta}] being edited in the form

  function renderBarModsForm() {
    glossaryBarModsList.innerHTML = '';
    glossaryBarMods.forEach((mod, idx) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '6px';
      row.style.marginTop = '4px';

      const sel = document.createElement('select');
      sel.style.flex = '1';
      for (const bar of state.partyBars) {
        const opt = document.createElement('option');
        opt.value = bar.id;
        opt.textContent = bar.name;
        if (bar.id === mod.barId) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => { mod.barId = sel.value; });

      const delta = document.createElement('input');
      delta.type = 'text';
      delta.value = mod.delta;
      delta.style.width = '70px';
      delta.placeholder = 'ex: -1d4';
      delta.title = 'Quanto muda por turno: número fixo (-2, +1) ou dado (-1d4, +2d6)';
      delta.addEventListener('input', () => { mod.delta = delta.value.trim(); });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'secondary';
      del.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      del.addEventListener('click', () => {
        glossaryBarMods.splice(idx, 1);
        renderBarModsForm();
      });

      row.appendChild(sel);
      row.appendChild(delta);
      row.appendChild(del);
      glossaryBarModsList.appendChild(row);
    });
  }

  glossaryAddBarModBtn.addEventListener('click', () => {
    if (state.partyBars.length === 0) return;
    glossaryBarMods.push({ barId: state.partyBars[0].id, delta: '-1' });
    renderBarModsForm();
  });

  GLOSSARY_PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      glossaryColorInput.value = c;
      glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    glossarySwatchRow.appendChild(sw);
  });

  function resetGlossaryForm() {
    glossaryEditId = null;
    glossaryFormTitle.textContent = 'Novo efeito';
    glossarySaveBtn.textContent = 'Adicionar';
    glossaryNameInput.value = '';
    glossaryDescInput.value = '';
    glossaryIconInput.value = '';
    glossaryDurationInput.value = '';
    glossaryNarrativeInput.checked = false;
    glossaryBarMods = [];
    renderBarModsForm();
    glossaryColorInput.value = GLOSSARY_PRESET_COLORS[state.glossary.length % GLOSSARY_PRESET_COLORS.length];
    glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  }

  function renderGlossary() {
    glossaryList.innerHTML = '';
    if (state.glossary.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Nenhum efeito cadastrado ainda.';
      glossaryList.appendChild(empty);
      return;
    }
    for (const eff of state.glossary) {
      const item = document.createElement('div');
      item.className = 'glossary-item';
      item.style.borderLeftColor = eff.color;

      const icon = document.createElement('div');
      icon.className = 'gi-icon';
      icon.textContent = eff.icon || '';
      icon.style.color = eff.color;

      const body = document.createElement('div');
      body.className = 'gi-body';
      const name = document.createElement('div');
      name.className = 'gi-name';
      name.textContent = eff.name;
      name.style.color = eff.color;
      const desc = document.createElement('div');
      desc.className = 'gi-desc';
      desc.textContent = eff.desc || '';
      body.appendChild(name);
      if (eff.desc) body.appendChild(desc);

      const meta = [];
      if (eff.narrative) meta.push('narrativo');
      if (eff.duration) meta.push(`${eff.duration} turno${eff.duration === 1 ? '' : 's'}`);
      if (eff.barMods && eff.barMods.length) {
        for (const mod of eff.barMods) {
          const bar = state.partyBars.find(b => b.id === mod.barId);
          if (bar) {
            const sign = /^[+-]/.test(mod.delta) ? '' : '+';
            meta.push(`${bar.name} ${sign}${mod.delta}/turno`);
          }
        }
      }
      if (meta.length) {
        const metaEl = document.createElement('div');
        metaEl.className = 'gi-meta';
        metaEl.textContent = meta.join(' · ');
        body.appendChild(metaEl);
      }

      const actions = document.createElement('div');
      actions.className = 'gi-actions';
      const editBtn = document.createElement('button');
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.title = 'Editar';
      editBtn.addEventListener('click', () => startEditEffect(eff.id));
      const delBtn = document.createElement('button');
      delBtn.className = 'gi-del';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      delBtn.title = 'Remover';
      delBtn.addEventListener('click', () => {
        state.glossary = state.glossary.filter(e => e.id !== eff.id);
        // drop this effect from any token that had it applied (across all scenes)
        for (const t of allTokens) {
          if (t.effects) t.effects = t.effects.filter(a => a.id !== eff.id);
        }
        if (glossaryEditId === eff.id) resetGlossaryForm();
        renderGlossary();
        window.RPG.renderTokenList();
        window.RPG.draw();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(actions);
      glossaryList.appendChild(item);
    }
  }

  function startEditEffect(id) {
    const eff = state.glossary.find(e => e.id === id);
    if (!eff) return;
    glossaryEditId = id;
    glossaryFormTitle.textContent = 'Editar efeito';
    glossarySaveBtn.textContent = 'Salvar';
    glossaryNameInput.value = eff.name;
    glossaryDescInput.value = eff.desc || '';
    glossaryIconInput.value = eff.icon || '';
    glossaryDurationInput.value = eff.duration || '';
    glossaryNarrativeInput.checked = !!eff.narrative;
    glossaryBarMods = (eff.barMods || []).map(m => ({ ...m }));
    renderBarModsForm();
    glossaryColorInput.value = eff.color;
    glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    glossaryNameInput.focus();
  }

  glossarySaveBtn.addEventListener('click', () => {
    const name = glossaryNameInput.value.trim();
    if (!name) { glossaryNameInput.focus(); return; }
    const duration = Number(glossaryDurationInput.value) || 0;
    const data = {
      name,
      desc: glossaryDescInput.value.trim(),
      color: glossaryColorInput.value,
      icon: glossaryIconInput.value.trim(),
      duration,
      narrative: glossaryNarrativeInput.checked,
      barMods: glossaryBarMods.filter(m => m.barId && m.delta).map(m => ({ ...m })),
    };
    if (glossaryEditId != null) {
      const eff = state.glossary.find(e => e.id === glossaryEditId);
      if (eff) Object.assign(eff, data);
    } else {
      state.glossary.push({ id: state.nextEffectId++, ...data });
    }
    resetGlossaryForm();
    renderGlossary();
  });

  glossaryClearBtn.addEventListener('click', resetGlossaryForm);

  document.getElementById('openGlossaryBtn').addEventListener('click', () => {
    resetGlossaryForm();
    renderGlossary();
    glossaryOverlay.classList.add('open');
  });
  document.getElementById('glossaryCloseBtn').addEventListener('click', () => {
    glossaryOverlay.classList.remove('open');
  });
  glossaryOverlay.addEventListener('click', (e) => {
    if (e.target === glossaryOverlay) glossaryOverlay.classList.remove('open');
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.renderGlossary = renderGlossary;
})();
