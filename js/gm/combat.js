/* ============================================================
   GM combat tracker: start/stop/next-turn, draggable reorder bar.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const getTokenPhotoImg = window.RPG.getTokenPhotoImg;

  const startCombatBtn = document.getElementById('startCombatBtn');
  const stopCombatBtn = document.getElementById('stopCombatBtn');
  const nextTurnBtn = document.getElementById('nextTurnBtn');
  const combatControls = document.getElementById('combatControls');
  const combatBar = document.getElementById('combatBar');
  const combatBarTrack = document.getElementById('combatBar-track');
  const combatBarTokens = document.getElementById('combatBar-tokens');

  function startCombat() {
    if (state.tokens.length === 0) return;
    let ids = state.selectedTokenIds && state.selectedTokenIds.length > 0
      ? state.selectedTokenIds
      : (state.selectedTokenId ? [state.selectedTokenId] : state.tokens.map(t => t.id));
    ids = ids.filter(id => state.tokens.some(t => t.id === id));
    if (ids.length === 0) return;
    const existing = state.combat.order.filter(id => ids.includes(id));
    const newIds = ids.filter(id => !existing.includes(id));
    state.combat.order = existing.concat(newIds);
    state.combat.active = true;
    startCombatBtn.classList.add('active');
    combatControls.classList.add('open');
    combatBar.classList.add('open');
    renderCombatBar();
    window.RPG.draw();
    window.RPG.sendState();
  }

  function stopCombat() {
    state.combat.active = false;
    startCombatBtn.classList.remove('active');
    combatControls.classList.remove('open');
    combatBar.classList.remove('open');
    window.RPG.draw();
    window.RPG.sendState();
  }

  function nextTurn() {
    if (state.combat.order.length === 0) return;
    const first = state.combat.order.shift();
    state.combat.order.push(first);

    // Animate first token sliding right
    const firstItem = combatBarTokens.querySelector(`[data-id="${first}"]`);
    if (firstItem) {
      firstItem.style.transition = 'none';
      firstItem.style.left = TOKEN_PADDING_LEFT + 'px';
      setTimeout(() => {
        firstItem.style.transition = 'left 0.6s ease-out';
        firstItem.style.left = (state.combat.order.length * SLOT_WIDTH + TOKEN_PADDING_LEFT) + 'px';
      }, 16);
    }

    renderCombatBar();
    window.RPG.draw();
    window.RPG.sendState();
  }

  startCombatBtn.addEventListener('click', startCombat);
  stopCombatBtn.addEventListener('click', stopCombat);
  nextTurnBtn.addEventListener('click', nextTurn);

  let combatDragId = null;
  let combatDragStart = null;

  function renderCombatBar() {
    combatBarTokens.innerHTML = '';
    const TOKEN_SIZE = 48;
    const TOKEN_SPACING = 10;  // gap between tokens

    state.combat.order.forEach((id, idx) => {
      const t = state.tokens.find(t => t.id === id);
      if (!t) return;

      const item = document.createElement('div');
      item.className = 'combat-token' + (idx === 0 ? ' current' : '');
      item.dataset.id = id;
      // Compact layout: left-aligned with 10px gap
      const left = idx * (TOKEN_SIZE + TOKEN_SPACING) + 12;  // 12px left padding
      item.style.left = left + 'px';
      item.style.marginLeft = '0';

      // Render token circle with same clipping as map canvas
      const canvasEl = document.createElement('canvas');
      canvasEl.width = 48;
      canvasEl.height = 48;
      canvasEl.className = 'dot';
      const c = canvasEl.getContext('2d');
      const photo = getTokenPhotoImg(t);

      c.beginPath();
      c.arc(24, 24, 24, 0, Math.PI * 2);
      if (photo) {
        c.clip();
        c.drawImage(photo, 0, 0, 48, 48);
      } else {
        c.fillStyle = t.color;
        c.fill();
      }

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = t.name || `Token ${t.id}`;

      item.appendChild(canvasEl);
      item.appendChild(name);

      item.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        combatDragId = id;
        combatDragStart = e.clientX;
        combatDragInitialLeft = parseFloat(item.style.left);
        item.classList.add('dragging');
      });

      combatBarTokens.appendChild(item);
    });
  }

  // Drag horizontal on timeline (raw logic only)
  const TOKEN_SIZE = 48;
  const TOKEN_SPACING = 10;
  const TOKEN_PADDING_LEFT = 12;
  const SLOT_WIDTH = TOKEN_SIZE + TOKEN_SPACING;

  let combatDragInitialLeft = 0;

  window.addEventListener('mousemove', (e) => {
    if (combatDragId === null) return;
    e.preventDefault();

    const delta = e.clientX - combatDragStart;
    const item = combatBarTokens.querySelector(`[data-id="${combatDragId}"]`);
    if (!item) return;

    const trackWidth = combatBarTrack.clientWidth;
    let left = combatDragInitialLeft + delta;
    left = Math.max(0, Math.min(trackWidth - TOKEN_SIZE, left));

    // Snap to nearest slot
    const order = state.combat.order;
    const idx = order.indexOf(combatDragId);
    const tokenCount = order.length;

    let snapIdx = idx;
    for (let i = 0; i < tokenCount; i++) {
      if (i === idx) continue;
      const snapX = i * SLOT_WIDTH + TOKEN_PADDING_LEFT;
      if (Math.abs(left - snapX) < SLOT_WIDTH * 0.4) {
        snapIdx = i;
        break;
      }
    }

    if (snapIdx !== idx) {
      order.splice(idx, 1);
      order.splice(snapIdx, 0, combatDragId);
      renderCombatBar();
      return;
    }

    item.style.left = left + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (combatDragId === null) return;

    const item = combatBarTokens.querySelector(`[data-id="${combatDragId}"]`);
    if (item) item.classList.remove('dragging');

    combatDragId = null;
    combatDragStart = null;
    renderCombatBar();
    window.RPG.draw();
    window.RPG.sendState();
  });

  // ---------- Expose to window.RPG ----------
  window.RPG.combatBar = combatBar;
  window.RPG.renderCombatBar = renderCombatBar;
  window.RPG.startCombat = startCombat;
  window.RPG.stopCombat = stopCombat;
  window.RPG.nextTurn = nextTurn;
})();
