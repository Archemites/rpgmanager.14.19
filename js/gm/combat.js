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

  // Resolves a barMod delta expression: a plain signed number ("-2", "+1")
  // or signed dice notation ("-1d4", "+2d6") — rolled fresh each turn.
  // Returns { value, rolled, expr } so callers can log dice results distinctly.
  function rollDeltaExpr(expr) {
    const s = String(expr).trim();
    const diceMatch = s.match(/^([+-]?)(\d+)d(\d+)$/i);
    if (!diceMatch) return { value: Number(s) || 0, rolled: false };
    const sign = diceMatch[1] === '-' ? -1 : 1;
    const count = parseInt(diceMatch[2], 10);
    const faces = parseInt(diceMatch[3], 10);
    let total = 0;
    for (let i = 0; i < count; i++) total += 1 + Math.floor(Math.random() * faces);
    return { value: sign * total, rolled: true, expr: s, total };
  }

  function applyEndOfTurnEffects(tokenId) {
    const token = state.tokens.find(t => t.id === tokenId);
    if (!token || !token.effects || token.effects.length === 0) return;
    const tokenLabel = token.name || `Token ${token.id}`;
    for (const app of token.effects) {
      const eff = state.glossary.find(e => e.id === app.id);
      if (!eff) continue;
      if (eff.barMods) {
        for (const mod of eff.barMods) {
          const bv = token.barValues && token.barValues[mod.barId];
          const roll = rollDeltaExpr(mod.delta);
          if (bv) bv.current = Math.max(0, Math.min(bv.max, bv.current + roll.value));
          if (roll.rolled) {
            const bar = state.partyBars.find(b => b.id === mod.barId);
            const sign = roll.value >= 0 ? '+' : '';
            window.RPG.logEvent(
              `${eff.name} em ${tokenLabel}: ${roll.expr} → ${sign}${roll.value}` +
              (bar ? ` (${bar.name})` : '')
            );
          }
        }
      }
      if (eff.duration) app.remaining--;
    }
    token.effects = token.effects.filter(app => {
      const eff = state.glossary.find(e => e.id === app.id);
      return !eff || !eff.duration || app.remaining > 0;
    });
  }

  const TOKEN_SIZE = 48;
  const TOKEN_SPACING = 10;
  const TOKEN_PADDING_LEFT = 12;
  const SLOT_WIDTH = TOKEN_SIZE + TOKEN_SPACING;

  let isAnimatingNextTurn = false;

  function nextTurn() {
    if (state.combat.order.length === 0 || isAnimatingNextTurn) return;
    if (state.combat.order.length === 1) {
      finishNextTurn();
      return;
    }
    
    isAnimatingNextTurn = true;
    const tokenCount = state.combat.order.length;
    const firstId = state.combat.order[0];
    const firstItem = combatBarTokens.querySelector(`[data-id="${firstId}"]`);

    if (firstItem) {
      firstItem.classList.remove('current'); // Remove highlight immediately
      firstItem.style.transition = 'left 0.4s ease-in-out';
      firstItem.style.left = ((tokenCount - 1) * SLOT_WIDTH + TOKEN_PADDING_LEFT) + 'px';

      for (let i = 1; i < tokenCount; i++) {
        const id = state.combat.order[i];
        const item = combatBarTokens.querySelector(`[data-id="${id}"]`);
        if (item) {
          item.style.transition = 'left 0.4s ease-in-out';
          item.style.left = ((i - 1) * SLOT_WIDTH + TOKEN_PADDING_LEFT) + 'px';
          if (i === 1) item.classList.add('current'); // Add highlight to new active token
        }
      }

      setTimeout(() => {
        finishNextTurn();
      }, 400);
    } else {
      finishNextTurn();
    }
  }

  function finishNextTurn() {
    isAnimatingNextTurn = false;
    if (state.combat.order.length === 0) return;
    
    const first = state.combat.order.shift();
    applyEndOfTurnEffects(first);
    state.combat.order.push(first);

    renderCombatBar();
    window.RPG.renderTokenList();
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
