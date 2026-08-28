/* ============================================================
   GM sidebar token list: render, sort, effect badges, delete confirmation.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  const tokenList = document.getElementById('tokenList');
  const tokenCount = document.getElementById('tokenCount');

  // ---------- Token list sorting ----------
  const tokenSortSelect = document.getElementById('tokenSortSelect');
  let tokenSortMode = 'added';
  tokenSortSelect.addEventListener('change', () => {
    tokenSortMode = tokenSortSelect.value;
    renderTokenList();
  });

  function getSortedTokens() {
    const list = state.tokens.slice();
    if (tokenSortMode === 'name') {
      list.sort((a, b) => (a.name || `Token ${a.id}`).localeCompare(b.name || `Token ${b.id}`, 'pt-BR', { sensitivity: 'base' }));
    } else {
      list.sort((a, b) => (a.createdAt || a.id) - (b.createdAt || b.id));
    }
    return list;
  }

  // ---------- Delete confirmation ----------
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmTokenName = document.getElementById('confirmTokenName');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  let pendingDeleteId = null;

  function askRemoveToken(t) {
    pendingDeleteId = t.id;
    confirmTokenName.textContent = t.name || `Token ${t.id}`;
    confirmOverlay.classList.add('open');
  }

  function closeConfirm() {
    confirmOverlay.classList.remove('open');
    pendingDeleteId = null;
  }

  confirmCancelBtn.addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeConfirm(); });
  confirmDeleteBtn.addEventListener('click', () => {
    if (pendingDeleteId !== null) window.RPG.removeToken(pendingDeleteId);
    closeConfirm();
  });

  function renderTokenList() {
    tokenCount.textContent = state.tokens.length;
    tokenList.innerHTML = '';
    for (const t of getSortedTokens()) {
      const item = document.createElement('div');
      item.className = 'token-item';
      if (t.id === state.selectedTokenId) item.classList.add('selected');

      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.background = t.color;
      if (t.photoDataUrl) {
        dot.style.backgroundImage = `url(${t.photoDataUrl})`;
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = t.name || `Token ${t.id}`;
      nameSpan.style.flex = '1';
      nameSpan.style.overflow = 'hidden';
      nameSpan.style.textOverflow = 'ellipsis';
      nameSpan.style.whiteSpace = 'nowrap';

      const badges = buildEffectBadges(t);

      const effectsBtn = document.createElement('button');
      effectsBtn.className = 'icon-btn effects-btn';
      effectsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>';
      effectsBtn.title = 'Aplicar efeitos';
      effectsBtn.addEventListener('click', (e) => { e.stopPropagation(); window.RPG.openEffectsPicker(t); });

      const noteBtn = document.createElement('button');
      noteBtn.className = 'icon-btn note-btn' + (t.note ? ' has-note' : '');
      noteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
      noteBtn.title = 'Anotações';
      noteBtn.addEventListener('click', (e) => { e.stopPropagation(); window.RPG.openTokenNote(t); });

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn edit-btn';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.title = 'Editar token';
      editBtn.addEventListener('click', () => window.RPG.openModalForEdit(t));

      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn remove-btn';
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeBtn.title = 'Excluir token';
      removeBtn.addEventListener('click', () => askRemoveToken(t));

      item.appendChild(dot);
      item.appendChild(nameSpan);
      if (badges) item.appendChild(badges);
      item.appendChild(effectsBtn);
      item.appendChild(noteBtn);
      item.appendChild(editBtn);
      item.appendChild(removeBtn);
      item.addEventListener('mouseenter', () => { state.selectedTokenId = t.id; window.RPG.draw(); });
      tokenList.appendChild(item);
    }
  }

  // small colored icon chips shown next to a token name for its applied effects
  function buildEffectBadges(token) {
    if (!token.effects || token.effects.length === 0) return null;
    const wrap = document.createElement('div');
    wrap.className = 'effect-badges';
    for (const app of token.effects) {
      const eff = state.glossary.find(e => e.id === app.id);
      if (!eff) continue;
      const badge = document.createElement('span');
      badge.className = 'effect-badge';
      badge.style.background = eff.color;
      let title = eff.name + (eff.desc ? ' — ' + eff.desc : '');
      if (eff.duration) title += ` (restam ${app.remaining} turno${app.remaining === 1 ? '' : 's'})`;
      badge.title = title;
      badge.textContent = eff.icon || eff.name.slice(0, 1).toUpperCase();
      wrap.appendChild(badge);
    }
    return wrap.children.length ? wrap : null;
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.renderTokenList = renderTokenList;
  window.RPG.getSortedTokens = getSortedTokens;
})();
