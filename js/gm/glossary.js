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
  const glossarySwatchRow = document.getElementById('glossarySwatchRow');
  const glossarySaveBtn = document.getElementById('glossarySaveBtn');
  const glossaryClearBtn = document.getElementById('glossaryClearBtn');

  let glossaryEditId = null; // id of effect being edited, or null when adding

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

      const actions = document.createElement('div');
      actions.className = 'gi-actions';
      const editBtn = document.createElement('button');
      editBtn.textContent = '✎';
      editBtn.title = 'Editar';
      editBtn.addEventListener('click', () => startEditEffect(eff.id));
      const delBtn = document.createElement('button');
      delBtn.className = 'gi-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Remover';
      delBtn.addEventListener('click', () => {
        state.glossary = state.glossary.filter(e => e.id !== eff.id);
        // drop this effect from any token that had it applied (across all scenes)
        for (const t of allTokens) {
          if (t.effects) t.effects = t.effects.filter(id => id !== eff.id);
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
    glossaryColorInput.value = eff.color;
    glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    glossaryNameInput.focus();
  }

  glossarySaveBtn.addEventListener('click', () => {
    const name = glossaryNameInput.value.trim();
    if (!name) { glossaryNameInput.focus(); return; }
    const data = {
      name,
      desc: glossaryDescInput.value.trim(),
      color: glossaryColorInput.value,
      icon: glossaryIconInput.value.trim(),
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
