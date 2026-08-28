/* ============================================================
   GM map objects (props/scenery — NOT tokens): sidebar list, add/edit modal
   (image upload, no crop), resize/rotate/remove. The whole uploaded image IS
   the object's shape (rectangular, unclipped) — unlike tokens, which are
   always circular. Per-scene like fog/walls/notes (see js/gm/scenes.js).
   Loads after js/gm/token-list.js, before js/gm/mouse.js (which dispatches
   drag/rotate/context-menu clicks into this file).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;

  const OBJECT_MIN_SIZE = 16;
  const OBJECT_MAX_SIZE = 2000;
  const OBJECT_DEFAULT_SIZE = 128;

  // ---------- Sidebar list ----------
  const objectList = document.getElementById('objectList');
  const objectCount = document.getElementById('objectCount');

  function renderObjectList() {
    objectCount.textContent = state.objects.length;
    objectList.innerHTML = '';
    for (const o of state.objects) {
      const item = document.createElement('div');
      item.className = 'token-item';
      if (o.id === state.selectedObjectId) item.classList.add('selected');

      const dot = document.createElement('div');
      dot.className = 'dot';
      if (o.dataUrl) {
        dot.style.backgroundImage = `url(${o.dataUrl})`;
        dot.style.backgroundSize = 'cover';
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = o.name || `Objeto ${o.id}`;
      nameSpan.style.flex = '1';
      nameSpan.style.overflow = 'hidden';
      nameSpan.style.textOverflow = 'ellipsis';
      nameSpan.style.whiteSpace = 'nowrap';

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn edit-btn';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.title = 'Editar objeto';
      editBtn.addEventListener('click', () => openObjectModalForEdit(o));

      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn remove-btn';
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeBtn.title = 'Excluir objeto';
      removeBtn.addEventListener('click', () => removeObject(o.id));

      item.appendChild(dot);
      item.appendChild(nameSpan);
      item.appendChild(editBtn);
      item.appendChild(removeBtn);
      item.addEventListener('mouseenter', () => { state.selectedObjectId = o.id; window.RPG.draw(); });
      item.addEventListener('click', () => { state.selectedObjectId = o.id; renderObjectList(); window.RPG.draw(); });
      objectList.appendChild(item);
    }
  }

  function removeObject(id) {
    window.RPG.captureBeforeChange('Excluiu objeto');
    state.objects = state.objects.filter(o => o.id !== id);
    if (state.selectedObjectId === id) state.selectedObjectId = null;
    renderObjectList();
    window.RPG.draw();
    window.RPG.sendState();
  }

  // ---------- Resize (mirrors js/gm/tools.js's token resize buttons) ----------
  function resizeSelectedObject(factor) {
    const o = state.objects.find(ob => ob.id === state.selectedObjectId);
    if (!o) return;
    window.RPG.captureBeforeChange(factor > 1 ? 'Aumentou objeto' : 'Diminuiu objeto');
    o.w = Math.min(OBJECT_MAX_SIZE, Math.max(OBJECT_MIN_SIZE, Math.round(o.w * factor)));
    o.h = Math.min(OBJECT_MAX_SIZE, Math.max(OBJECT_MIN_SIZE, Math.round(o.h * factor)));
    window.RPG.draw();
    window.RPG.sendState();
  }

  // ---------- Add/edit modal ----------
  const overlay = document.getElementById('objectOverlay');
  const modalTitle = document.getElementById('objectModalTitle');
  const nameInput = document.getElementById('objectNameInput');
  const fileInput = document.getElementById('objectImageInput');
  const preview = document.getElementById('objectImagePreview');
  const saveBtn = document.getElementById('objectSaveBtn');
  const cancelBtn = document.getElementById('objectCancelBtn');

  let editingId = null;
  let pendingDataUrl = null;
  let pendingImgW = OBJECT_DEFAULT_SIZE, pendingImgH = OBJECT_DEFAULT_SIZE;

  function updatePreview() {
    if (pendingDataUrl) {
      preview.src = pendingDataUrl;
      preview.classList.remove('empty');
    } else {
      preview.src = '';
      preview.classList.add('empty');
    }
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        pendingDataUrl = dataUrl;
        // scale the default footprint to the image's aspect ratio, capped so
        // it doesn't spawn absurdly large/small on the map
        const longSide = Math.max(img.naturalWidth, img.naturalHeight) || 1;
        const fit = OBJECT_DEFAULT_SIZE / longSide;
        pendingImgW = Math.round(img.naturalWidth * fit);
        pendingImgH = Math.round(img.naturalHeight * fit);
        updatePreview();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  function openObjectModalForCreate() {
    editingId = null;
    pendingDataUrl = null;
    pendingImgW = pendingImgH = OBJECT_DEFAULT_SIZE;
    nameInput.value = '';
    updatePreview();
    modalTitle.textContent = 'Novo objeto';
    saveBtn.textContent = 'Adicionar';
    overlay.classList.add('open');
    nameInput.focus();
  }

  function openObjectModalForEdit(o) {
    editingId = o.id;
    pendingDataUrl = o.dataUrl;
    pendingImgW = o.w;
    pendingImgH = o.h;
    nameInput.value = o.name || '';
    updatePreview();
    modalTitle.textContent = 'Editar objeto';
    saveBtn.textContent = 'Salvar';
    overlay.classList.add('open');
  }

  function closeObjectModal() {
    overlay.classList.remove('open');
  }

  saveBtn.addEventListener('click', () => {
    if (!pendingDataUrl) { alert('Escolha uma imagem para o objeto.'); return; }
    const name = nameInput.value.trim();

    if (editingId === null) {
      window.RPG.captureBeforeChange('Adicionou objeto');
      const viewport = window.RPG.viewport;
      const c = window.RPG.screenToWorld(viewport.clientWidth / 2, viewport.clientHeight / 2);
      const o = {
        id: state.nextObjectId++,
        x: c.x, y: c.y,
        w: pendingImgW, h: pendingImgH,
        rotation: 0,
        dataUrl: pendingDataUrl,
        name,
      };
      state.objects.push(o);
      state.selectedObjectId = o.id;
    } else {
      window.RPG.captureBeforeChange('Editou objeto');
      const o = state.objects.find(ob => ob.id === editingId);
      if (o) {
        o.name = name;
        o.dataUrl = pendingDataUrl;
      }
    }
    closeObjectModal();
    renderObjectList();
    window.RPG.draw();
    window.RPG.sendState();
  });

  cancelBtn.addEventListener('click', closeObjectModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeObjectModal(); });

  document.getElementById('addObjectBtn').addEventListener('click', openObjectModalForCreate);

  // ---------- Expose to window.RPG ----------
  window.RPG.renderObjectList = renderObjectList;
  window.RPG.removeObject = removeObject;
  window.RPG.resizeSelectedObject = resizeSelectedObject;
  window.RPG.openObjectModalForCreate = openObjectModalForCreate;
  window.RPG.openObjectModalForEdit = openObjectModalForEdit;
})();
