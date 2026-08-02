/* ============================================================
   Player combat bar: read-only timeline display — no drag-reorder, since
   the player can't act on initiative order.
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const getTokenPhotoImg = window.RPG.getTokenPhotoImg;

  const combatBar = document.getElementById('combatBar');
  const combatBarTokens = document.getElementById('combatBar-tokens');

  function renderCombatBar() {
    combatBar.classList.toggle('open', !!state.combat.active);
    combatBarTokens.innerHTML = '';
    const TOKEN_SIZE = 48;
    const TOKEN_SPACING = 10;
    const TOKEN_PADDING_LEFT = 12;

    state.combat.order.forEach((id, idx) => {
      const t = state.tokens.find(t => t.id === id);
      if (!t) return;

      const item = document.createElement('div');
      item.className = 'combat-token' + (idx === 0 ? ' current' : '');
      const left = idx * (TOKEN_SIZE + TOKEN_SPACING) + TOKEN_PADDING_LEFT;
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
      combatBarTokens.appendChild(item);
    });
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.renderCombatBar = renderCombatBar;
})();
