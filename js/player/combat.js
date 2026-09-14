// @ts-check
/* ============================================================
   Player combat bar: read-only timeline display — no drag-reorder, since
   the player can't act on initiative order.
   Uses FLIP animation (First, Last, Invert, Play) for reliable cross-device
   animations, including mobile browsers.
   ============================================================ */

(() => {
  'use strict';

  const RPG = /** @type {any} */ (window).RPG;
  const state = RPG.state;
  const getTokenPhotoImg = RPG.getTokenPhotoImg;

  /** @type {HTMLElement} */
  const combatBar = (/** @type {any} */ (document.getElementById('combatBar')));
  /** @type {HTMLElement|null} */
  const combatBarTrack = document.getElementById('combatBar-track');
  /** @type {HTMLElement} */
  const combatBarTokens = (/** @type {any} */ (document.getElementById('combatBar-tokens')));

  const TOKEN_SIZE = 48;
  const TOKEN_SPACING = 10;
  const TOKEN_PADDING_LEFT = 12;
  const SLOT_WIDTH = TOKEN_SIZE + TOKEN_SPACING;

  function renderCombatBar() {
    combatBar.classList.toggle('open', !!state.combat.active);
    if (!state.combat.active) return;

    const count = state.combat.order.length;
    const neededWidth = count > 0 ? (count * SLOT_WIDTH + TOKEN_PADDING_LEFT + 6) : 60;
    if (combatBarTrack) {
      combatBarTrack.style.width = neededWidth + 'px';
    }

    // --- FLIP Step 1: First — snapshot current left positions ---
    const firstPositions = {};
    Array.from(combatBarTokens.children).forEach(child => {
      const el = /** @type {HTMLElement} */ (child);
      firstPositions[el.dataset.id || ''] = parseFloat(el.style.left) || 0;
    });

    // Remove tokens no longer in combat
    Array.from(combatBarTokens.children).forEach(child => {
      const el = /** @type {HTMLElement} */ (child);
      if (!state.combat.order.includes(el.dataset.id || '')) el.remove();
    });

    // --- FLIP Step 2: Last — create/update elements at their FINAL positions ---
    state.combat.order.forEach((id, idx) => {
      const t = state.tokens.find(t => t.id === id);
      if (!t) return;

      const finalLeft = idx * SLOT_WIDTH + TOKEN_PADDING_LEFT;
      /** @type {HTMLElement|null} */
      let item = combatBarTokens.querySelector(`[data-id="${id}"]`);

      if (!item) {
        // New token: build and place at final position, mark as new
        item = document.createElement('div');
        item.dataset.id = id;
        item.dataset.isNew = '1';
        item.style.marginLeft = '0';

        const canvasEl = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
        canvasEl.width = 48;
        canvasEl.height = 48;
        canvasEl.className = 'dot';
        const c = /** @type {CanvasRenderingContext2D} */ (canvasEl.getContext('2d'));
        const photo = getTokenPhotoImg(t);
        c.beginPath();
        c.arc(24, 24, 24, 0, Math.PI * 2);
        if (photo) { c.clip(); c.drawImage(photo, 0, 0, 48, 48); }
        else { c.fillStyle = t.color; c.fill(); }

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = t.name || `Token ${t.id}`;
        item.appendChild(canvasEl);
        item.appendChild(name);
        combatBarTokens.appendChild(item);
      }

      // Disable transition and set final position (browser won't animate yet)
      item.style.transition = 'none';
      item.style.left = finalLeft + 'px';
      item.className = 'combat-token' + (idx === 0 ? ' current' : '');
    });

    // --- FLIP Steps 3+4: Invert + Play ---
    // Two nested rAFs guarantee the browser has fully painted the "Last" state
    // before we move elements back and trigger the transition. This is the
    // key trick that makes animations reliable on all devices including mobile.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.combat.order.forEach((id, idx) => {
          /** @type {HTMLElement|null} */
          const item = combatBarTokens.querySelector(`[data-id="${id}"]`);
          if (!item) return;

          // New tokens just appear without animation
          if (item.dataset.isNew) {
            delete item.dataset.isNew;
            return;
          }

          const oldLeft = firstPositions[id];
          const newLeft = idx * SLOT_WIDTH + TOKEN_PADDING_LEFT;

          // No previous position recorded or no movement needed
          if (oldLeft === undefined || oldLeft === newLeft) return;

          // Invert: jump back to old position instantly
          item.style.transition = 'none';
          item.style.left = oldLeft + 'px';

          // Play: on next paint, animate smoothly to the final position
          requestAnimationFrame(() => {
            item.style.transition = 'left 0.4s ease-in-out';
            item.style.left = newLeft + 'px';
          });
        });
      });
    });
  }

  // ---------- Expose to window.RPG ----------
  /** @type {any} */ (window).RPG.renderCombatBar = renderCombatBar;
})();
