/* ============================================================
   GM apply-effects picker: checklist (w/ search) to apply/remove glossary
   effects on a specific token.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  const effectsPickerOverlay = document.getElementById('effectsPickerOverlay');
  const effectsPickerTitle = document.getElementById('effectsPickerTitle');
  const effectsSearchInput = document.getElementById('effectsSearchInput');
  const effectsPickerList = document.getElementById('effectsPickerList');
  let effectsPickerToken = null;

  function openEffectsPicker(token) {
    effectsPickerToken = token;
    if (!token.effects) token.effects = [];
    effectsPickerTitle.textContent = `Efeitos — ${token.name || 'Token ' + token.id}`;
    effectsSearchInput.value = '';
    renderEffectsPicker();
    effectsPickerOverlay.classList.add('open');
    effectsSearchInput.focus();
  }

  function renderEffectsPicker() {
    const q = effectsSearchInput.value.trim().toLowerCase();
    effectsPickerList.innerHTML = '';

    if (state.glossary.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Glossário vazio. Cadastre efeitos no Glossário de efeitos.';
      effectsPickerList.appendChild(empty);
      return;
    }

    const matches = state.glossary.filter(eff =>
      !q || eff.name.toLowerCase().includes(q) || (eff.desc || '').toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Nenhum efeito encontrado.';
      effectsPickerList.appendChild(empty);
      return;
    }

    for (const eff of matches) {
      const applied = effectsPickerToken.effects.some(a => a.id === eff.id);
      const row = document.createElement('label');
      row.className = 'effects-pick-row';
      row.style.borderLeftColor = eff.color;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = applied;
      cb.addEventListener('change', () => {
        const applications = new Map(effectsPickerToken.effects.map(a => [a.id, a]));
        if (cb.checked) applications.set(eff.id, { id: eff.id, remaining: eff.duration || 0 });
        else applications.delete(eff.id);
        // keep glossary order
        effectsPickerToken.effects = state.glossary
          .filter(e => applications.has(e.id))
          .map(e => applications.get(e.id));
        const tokenLabel = effectsPickerToken.name || `Token ${effectsPickerToken.id}`;
        window.RPG.logEvent(cb.checked
          ? `Aplicou efeito "${eff.name}" em ${tokenLabel}`
          : `Removeu efeito "${eff.name}" de ${tokenLabel}`);
        window.RPG.renderTokenList();
        window.RPG.draw();
      });

      const icon = document.createElement('span');
      icon.className = 'ep-icon';
      icon.style.color = eff.color;
      icon.textContent = eff.icon || '';

      const body = document.createElement('div');
      body.className = 'ep-body';
      const name = document.createElement('div');
      name.className = 'ep-name';
      name.textContent = eff.name;
      name.style.color = eff.color;
      body.appendChild(name);
      if (eff.desc) {
        const desc = document.createElement('div');
        desc.className = 'ep-desc';
        desc.textContent = eff.desc;
        body.appendChild(desc);
      }
      if (applied && eff.duration) {
        const app = effectsPickerToken.effects.find(a => a.id === eff.id);
        const remaining = document.createElement('div');
        remaining.className = 'ep-desc';
        remaining.textContent = `Restam ${app.remaining} turno${app.remaining === 1 ? '' : 's'}`;
        body.appendChild(remaining);
      }

      row.appendChild(cb);
      if (eff.icon) row.appendChild(icon);
      row.appendChild(body);
      effectsPickerList.appendChild(row);
    }
  }

  effectsSearchInput.addEventListener('input', renderEffectsPicker);
  document.getElementById('effectsPickerCloseBtn').addEventListener('click', () => {
    effectsPickerOverlay.classList.remove('open');
    effectsPickerToken = null;
  });
  effectsPickerOverlay.addEventListener('click', (e) => {
    if (e.target === effectsPickerOverlay) {
      effectsPickerOverlay.classList.remove('open');
      effectsPickerToken = null;
    }
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.openEffectsPicker = openEffectsPicker;
})();
