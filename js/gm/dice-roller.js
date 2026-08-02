/* ============================================================
   Dice roller — d4 through d100, quantity + modifier, self-contained.
   No shared state dependency; history kept in-memory only (not persisted).
   ============================================================ */

(() => {
  'use strict';

  const MAX_HISTORY = 20;

  const diceOverlay = document.getElementById('diceOverlay');
  const diceFaceRow = document.getElementById('diceFaceRow');
  const diceCountInput = document.getElementById('diceCountInput');
  const diceModInput = document.getElementById('diceModInput');
  const diceRollBtn = document.getElementById('diceRollBtn');
  const diceResult = document.getElementById('diceResult');
  const diceHistory = document.getElementById('diceHistory');
  const diceClearHistoryBtn = document.getElementById('diceClearHistoryBtn');
  const diceCloseBtn = document.getElementById('diceCloseBtn');

  let selectedFaces = 20;
  const history = [];

  function selectFaces(faces) {
    selectedFaces = faces;
    diceFaceRow.querySelectorAll('.dice-face-btn').forEach(btn => {
      btn.classList.toggle('selected', Number(btn.dataset.faces) === faces);
    });
  }

  function roll() {
    const count = Math.min(20, Math.max(1, parseInt(diceCountInput.value, 10) || 1));
    const mod = parseInt(diceModInput.value, 10) || 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(1 + Math.floor(Math.random() * selectedFaces));
    }
    const sum = rolls.reduce((a, b) => a + b, 0) + mod;

    const modStr = mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : '';
    const label = `${count}d${selectedFaces}${modStr}`;
    const rollsStr = rolls.join(', ');

    diceResult.innerHTML = `<span class="dice-result-total">${sum}</span> <span class="dice-result-label">${label} → [${rollsStr}]</span>`;

    history.unshift({ label, rollsStr, sum });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    renderHistory();
  }

  function renderHistory() {
    diceHistory.innerHTML = '';
    for (const entry of history) {
      const item = document.createElement('div');
      item.className = 'dice-history-item';
      item.textContent = `${entry.label} → [${entry.rollsStr}] = ${entry.sum}`;
      diceHistory.appendChild(item);
    }
  }

  diceFaceRow.querySelectorAll('.dice-face-btn').forEach(btn => {
    btn.addEventListener('click', () => selectFaces(Number(btn.dataset.faces)));
  });

  diceRollBtn.addEventListener('click', roll);
  diceClearHistoryBtn.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
  });

  document.getElementById('openDiceBtn').addEventListener('click', () => {
    diceOverlay.classList.add('open');
  });
  diceCloseBtn.addEventListener('click', () => {
    diceOverlay.classList.remove('open');
  });
  diceOverlay.addEventListener('click', (e) => {
    if (e.target === diceOverlay) diceOverlay.classList.remove('open');
  });

  selectFaces(20);
})();
