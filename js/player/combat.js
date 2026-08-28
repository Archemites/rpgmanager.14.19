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
    
    const TOKEN_SIZE = 48;
    const TOKEN_SPACING = 10;
    const TOKEN_PADDING_LEFT = 12;

    // Remove tokens that are no longer in combat
    const currentTokens = Array.from(combatBarTokens.children);
    currentTokens.forEach(el => {
      if (!state.combat.order.includes(el.dataset.id)) {
        el.remove();
      }
    });

    state.combat.order.forEach((id, idx) => {
      const t = state.tokens.find(t => t.id === id);
      if (!t) return;

      const left = idx * (TOKEN_SIZE + TOKEN_SPACING) + TOKEN_PADDING_LEFT;
      let item = combatBarTokens.querySelector(`[data-id="${id}"]`);
      
      if (!item) {
        item = document.createElement('div');
        item.dataset.id = id;
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

        // Delay transition to prevent flying in on creation
        setTimeout(() => { 
          if (item) item.style.transition = 'left 0.4s ease-in-out'; 
        }, 50);
      }
      
      item.className = 'combat-token' + (idx === 0 ? ' current' : '');
      item.style.left = left + 'px';
    });
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.renderCombatBar = renderCombatBar;
})();
