/* ============================================================
   GM token modal: create/edit token modal (name, photo, color, isPlayer)
   + removeToken(). See ARCHITECTURE.md directory layout.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;
  const viewport = window.RPG.viewport;
  const screenToWorld = window.RPG.screenToWorld;
  const BASE_TOKEN_RADIUS = window.RPG.BASE_TOKEN_RADIUS;

  const addTokenBtn = document.getElementById('addTokenBtn');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const tokenNameInput = document.getElementById('tokenNameInput');
  const tokenPhotoInput = document.getElementById('tokenPhotoInput');
  const photoPreview = document.getElementById('photoPreview');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const tokenColorInput = document.getElementById('tokenColorInput');
  const modalSwatchRow = document.getElementById('modalSwatchRow');
  const cancelTokenBtn = document.getElementById('cancelTokenBtn');
  const saveTokenBtn = document.getElementById('saveTokenBtn');

  // ---------- Tokens ----------
  const PRESET_COLORS = ['#e04b4b','#4b8ee0','#4be08f','#e0c94b','#a04be0','#e08a4b','#4be0d8','#e04ba0','#ffffff','#333333'];
  PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      tokenColorInput.value = c;
      modalSwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    modalSwatchRow.appendChild(sw);
  });

  // ---------- Token modal ----------
  let modalMode = 'create'; // 'create' | 'edit'
  let modalEditingId = null;
  let modalPhotoDataUrl = null;

  function updatePhotoPreview() {
    if (modalPhotoDataUrl) {
      photoPreview.src = modalPhotoDataUrl;
      photoPreview.classList.remove('empty');
      removePhotoBtn.style.display = '';
    } else {
      photoPreview.removeAttribute('src');
      photoPreview.classList.add('empty');
      removePhotoBtn.style.display = 'none';
    }
  }

  const tokenIsPlayerInput = document.getElementById('tokenIsPlayerInput');

  function openModalForCreate() {
    modalMode = 'create';
    modalEditingId = null;
    modalPhotoDataUrl = null;
    tokenNameInput.value = '';
    tokenColorInput.value = PRESET_COLORS[state.tokens.length % PRESET_COLORS.length];
    tokenIsPlayerInput.checked = false;
    modalTitle.textContent = 'Novo token';
    saveTokenBtn.textContent = 'Adicionar';
    updatePhotoPreview();
    modalOverlay.classList.add('open');
    tokenNameInput.focus();
  }

  function openModalForEdit(t) {
    modalMode = 'edit';
    modalEditingId = t.id;
    modalPhotoDataUrl = t.photoDataUrl || null;
    tokenNameInput.value = t.name || '';
    tokenColorInput.value = t.color;
    tokenIsPlayerInput.checked = !!t.isPlayer;
    modalTitle.textContent = 'Editar token';
    saveTokenBtn.textContent = 'Salvar';
    updatePhotoPreview();
    modalOverlay.classList.add('open');
    tokenNameInput.focus();
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  addTokenBtn.addEventListener('click', openModalForCreate);
  cancelTokenBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  tokenPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      window.RPG.openCropEditor(ev.target.result, (croppedDataUrl) => {
        modalPhotoDataUrl = croppedDataUrl;
        updatePhotoPreview();
      });
    };
    reader.readAsDataURL(file);
    tokenPhotoInput.value = '';
  });

  removePhotoBtn.addEventListener('click', () => {
    modalPhotoDataUrl = null;
    tokenPhotoInput.value = '';
    updatePhotoPreview();
  });

  saveTokenBtn.addEventListener('click', () => {
    const name = tokenNameInput.value.trim();
    const color = tokenColorInput.value;
    const isPlayer = tokenIsPlayerInput.checked;

    if (modalMode === 'create') {
      window.RPG.captureBeforeChange('Criou token' + (name ? ` "${name}"` : ''));
      const c = screenToWorld(viewport.clientWidth / 2, viewport.clientHeight / 2);
      const x = c.x + (Math.random() * 40 - 20);
      const y = c.y + (Math.random() * 40 - 20);
      const token = {
        id: state.nextId++,
        x, y,
        // presence is per-scene — a new token only exists in the scene open
        // when it was created, until dragged to another via its thumbnail
        scenes: { [window.RPG.getCurrentSceneId()]: { x, y } },
        r: BASE_TOKEN_RADIUS,
        color,
        name,
        photoDataUrl: modalPhotoDataUrl,
        note: '',
        createdAt: Date.now(),
        isPlayer,
        barValues: {},
        effects: [],   // GM-only: array of {id, remaining} glossary effect applications on this token
      };
      if (isPlayer) window.RPG.syncTokenBarValues(token);
      allTokens.push(token);
      window.RPG.refreshVisibleTokens();
      state.selectedTokenId = token.id;
    } else {
      const t = allTokens.find(t => t.id === modalEditingId);
      if (t) {
        window.RPG.logEvent('Editou token' + (name ? ` "${name}"` : ''));
        t.name = name;
        t.color = color;
        t.photoDataUrl = modalPhotoDataUrl;
        t.isPlayer = isPlayer;
        if (isPlayer) window.RPG.syncTokenBarValues(t);
      }
    }

    closeModal();
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    window.RPG.draw();
    window.RPG.sendState();
  });

  function removeToken(id) {
    const removed = allTokens.find(t => t.id === id);
    window.RPG.captureBeforeChange('Removeu token' + (removed && removed.name ? ` "${removed.name}"` : ''));
    const idx = allTokens.findIndex(t => t.id === id);
    if (idx !== -1) allTokens.splice(idx, 1);
    window.RPG.refreshVisibleTokens();
    if (state.selectedTokenId === id) state.selectedTokenId = null;
    state.selectedTokenIds = state.selectedTokenIds.filter(sid => sid !== id);
    state.combat.order = state.combat.order.filter(oid => oid !== id);
    window.RPG.renderTokenList();
    window.RPG.renderParty();
    window.RPG.renderSceneList();
    if (state.combat.active) window.RPG.renderCombatBar();
    window.RPG.draw();
    window.RPG.sendState();
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.openModalForCreate = openModalForCreate;
  window.RPG.openModalForEdit = openModalForEdit;
  window.RPG.closeModal = closeModal;
  window.RPG.removeToken = removeToken;
  window.RPG.PRESET_COLORS = PRESET_COLORS;
})();
