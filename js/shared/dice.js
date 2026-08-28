// @ts-ignore
import DiceBox from 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js';
/* ============================================================
   Player & GM dice roller — motor 3D com @3d-dice/dice-box
   e personalização de cores e 15 fontes dos números
   ============================================================ */

(() => {
  'use strict';

  // ---- Configuração de dados ----
  const FACES = [4, 6, 8, 10, 12, 20, 100];
  let selectedFaces = 20;

  // ---- Paleta de Cores ----
  const COLOR_PALETTE = [
    { label: 'Tema da Mesa', value: 'theme', color: 'transparent', isTheme: true },
    { label: 'Dourado Imperial', value: '#f5b342' },
    { label: 'Verde Cyberpunk', value: '#45ff78' },
    { label: 'Vermelho Sangue', value: '#e63946' },
    { label: 'Roxo Arcano', value: '#a855f7' },
    { label: 'Azul Glacial', value: '#38bdf8' },
    { label: 'Ciano Etéreo', value: '#06b6d4' },
    { label: 'Laranja Fogo', value: '#ff7b00' },
    { label: 'Rosa Neon', value: '#f43f5e' },
    { label: 'Branco Prata', value: '#e2e8f0' },
    { label: 'Preto Ônix', value: '#334155' }
  ];

  const STORAGE_KEY_COLOR = 'rpg-dice-color';

  let customColor = 'theme';

  try {
    customColor = localStorage.getItem(STORAGE_KEY_COLOR) || 'theme';
  } catch (e) {}

  // ---- SVGs Poliédricos para os Dados ----
  const DICE_SVGS = {
    4: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,3 2,20 22,20" fill="currentColor" fill-opacity="0.15"/><line x1="12" y1="3" x2="12" y2="14"/><line x1="2" y1="20" x2="12" y2="14"/><line x1="22" y1="20" x2="12" y2="14"/></svg>`,
    6: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,7 12,12 3,7" fill="currentColor" fill-opacity="0.25"/><polygon points="3,7 12,12 12,22 3,17" fill="currentColor" fill-opacity="0.1"/><polygon points="12,12 21,7 21,17 12,22" fill="currentColor" fill-opacity="0.18"/></svg>`,
    8: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,12 12,22 3,12" fill="currentColor" fill-opacity="0.15"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
    10: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,9 12,22 3,9" fill="currentColor" fill-opacity="0.15"/><line x1="12" y1="2" x2="12" y2="14"/><line x1="3" y1="9" x2="12" y2="14"/><line x1="21" y1="9" x2="12" y2="14"/><line x1="12" y1="22" x2="12" y2="14"/></svg>`,
    12: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21.5,8.9 17.9,20 6.1,20 2.5,8.9" fill="currentColor" fill-opacity="0.12"/><polygon points="12,7 16.5,10.3 14.8,15.5 9.2,15.5 7.5,10.3" fill="currentColor" fill-opacity="0.22"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="21.5" y1="8.9" x2="16.5" y2="10.3"/><line x1="17.9" y1="20" x2="14.8" y2="15.5"/><line x1="6.1" y1="20" x2="9.2" y2="15.5"/><line x1="2.5" y1="8.9" x2="7.5" y2="10.3"/></svg>`,
    20: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,7.5 21,16.5 12,22 3,16.5 3,7.5" fill="currentColor" fill-opacity="0.15"/><polygon points="12,7.5 18,17 6,17" fill="currentColor" fill-opacity="0.25"/><line x1="12" y1="2" x2="12" y2="7.5"/><line x1="21" y1="7.5" x2="18" y2="17"/><line x1="21" y1="16.5" x2="18" y2="17"/><line x1="12" y1="22" x2="18" y2="17"/><line x1="12" y1="22" x2="6" y2="17"/><line x1="3" y1="16.5" x2="6" y2="17"/><line x1="3" y1="7.5" x2="6" y2="17"/><line x1="12" y1="7.5" x2="21" y2="7.5"/><line x1="12" y1="7.5" x2="3" y2="7.5"/></svg>`,
    100: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="9,2 17,8 9,20 1,8" fill="currentColor" fill-opacity="0.12"/><line x1="9" y1="2" x2="9" y2="13"/><line x1="1" y1="8" x2="9" y2="13"/><line x1="17" y1="8" x2="9" y2="13"/><line x1="9" y1="20" x2="9" y2="13"/><circle cx="18" cy="5" r="2" stroke-width="1.4"/><line x1="22" y1="5" x2="14" y2="18" stroke-width="1.4"/><circle cx="20" cy="17" r="2" stroke-width="1.4"/></svg>`
  };

  // ---- DOM: botão flutuante ----
  const diceBtn = document.createElement('button');
  diceBtn.id = 'playerDiceBtn';
  diceBtn.title = 'Rolar dados';
  diceBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12,2 21,7.5 21,16.5 12,22 3,16.5 3,7.5" fill="currentColor" fill-opacity="0.15" />
      <polygon points="12,7.5 18,17 6,17" fill="currentColor" fill-opacity="0.25" />
      <line x1="12" y1="2" x2="12" y2="7.5" />
      <line x1="21" y1="7.5" x2="18" y2="17" />
      <line x1="21" y1="16.5" x2="18" y2="17" />
      <line x1="12" y1="22" x2="18" y2="17" />
      <line x1="12" y1="22" x2="6" y2="17" />
      <line x1="3" y1="16.5" x2="6" y2="17" />
      <line x1="3" y1="7.5" x2="6" y2="17" />
      <line x1="12" y1="7.5" x2="21" y2="7.5" />
      <line x1="12" y1="7.5" x2="3" y2="7.5" />
    </svg>
  `;
  diceBtn.classList.add('hidden'); // começa escondido, aparece ao conectar
  document.body.appendChild(diceBtn);

  // ---- DOM: overlay ----
  const overlay = document.createElement('div');
  overlay.id = 'playerDiceOverlay';
  overlay.innerHTML = `
    <div id="playerDicePanel">
      <div class="player-dice-top-bar">
        <div class="player-dice-handle"></div>
        <button type="button" id="playerDiceSettingsBtn" class="player-dice-settings-btn" title="Personalizar cor dos dados 3D">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <!-- Gaveta retrátil de personalização -->
      <div id="playerDiceSettingsDrawer" class="player-dice-settings-drawer">
        <div class="player-dice-settings-title">
          <span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C6.49 2 2 6.49 2 12c0 3.87 2.33 7.2 5.67 8.65.6.26 1.33-.19 1.33-.85v-.8c0-.55.45-1 1-1h1.5c3.58 0 6.5-2.92 6.5-6.5 0-4.96-2.69-9.5-6-9.5z" />
              <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
              <circle cx="11" cy="7.5" r="1.5" fill="currentColor" />
              <circle cx="15.5" cy="9" r="1.5" fill="currentColor" />
              <circle cx="16.5" cy="13.5" r="1.5" fill="currentColor" />
            </svg>
            Cor dos Dados 3D
          </span>
          <button type="button" class="player-dice-settings-reset" id="playerDiceResetBtn" title="Restaurar cor do tema da mesa">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Cor do Tema</span>
          </button>
        </div>

        <!-- Seletor com espectro/Hue e input para digitar código HEX -->
        <div class="player-dice-picker-row">
          <div class="player-dice-color-picker-wrap" title="Clique para abrir a paleta de cores (Hue / Espectro)">
            <input type="color" id="playerDiceColorPicker" value="#45ff78">
          </div>
          <div class="player-dice-active-preview" id="playerDicePickerPreview" title="Cor ativa"></div>
          <div class="player-dice-hex-wrap">
            <span class="player-dice-hex-prefix">#</span>
            <input type="text" id="playerDiceHexInput" class="player-dice-hex-input" maxlength="6" placeholder="45FF78" spellcheck="false" title="Digite o código HEX da cor">
          </div>
          <span class="player-dice-picker-hint">Código HEX</span>
        </div>

        <div class="player-dice-presets-label">Presets rápidos:</div>
        <div class="player-dice-color-grid" id="playerDiceColorGrid"></div>
      </div>

      <div id="playerDiceCanvas" style="display:none;"></div>
      <div class="player-dice-controls">
        <div id="playerDiceFaces" class="player-dice-faces">
          ${FACES.map(f => `
            <button class="player-dice-face-btn ${f === 20 ? 'active' : ''}" data-faces="${f}" title="Selecionar d${f}">
              <span class="player-dice-face-svg">${DICE_SVGS[f]}</span>
              <span class="player-dice-face-text">d${f}</span>
            </button>
          `).join('')}
        </div>
        <div id="playerDiceResult"></div>
        <div class="player-dice-row">
          <div class="player-dice-input-group left">
            <label for="playerDiceCount">Qtd</label>
            <input type="number" id="playerDiceCount" min="1" max="20" value="1">
          </div>
          <button id="playerDiceRollBtn">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12,2 21,7.5 21,16.5 12,22 3,16.5 3,7.5" fill="currentColor" fill-opacity="0.25" />
              <polygon points="12,7.5 18,17 6,17" />
              <line x1="12" y1="2" x2="12" y2="7.5" />
              <line x1="21" y1="7.5" x2="18" y2="17" />
              <line x1="21" y1="16.5" x2="18" y2="17" />
              <line x1="12" y1="22" x2="18" y2="17" />
              <line x1="12" y1="22" x2="6" y2="17" />
              <line x1="3" y1="16.5" x2="6" y2="17" />
              <line x1="3" y1="7.5" x2="6" y2="17" />
            </svg>
            <span>Rolar</span>
          </button>
          <div class="player-dice-input-group right">
            <label for="playerDiceMod">Mod</label>
            <input type="number" id="playerDiceMod" min="-99" max="99" value="0">
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Injetar também o div pro dice-box, se não existir (evitar duplicar)
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
    document.body.appendChild(boxCanvas);
  }

  // ---- Referências DOM ----
  const panel = document.getElementById('playerDicePanel');
  const settingsBtn = document.getElementById('playerDiceSettingsBtn');
  const settingsDrawer = document.getElementById('playerDiceSettingsDrawer');
  const colorPicker = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceColorPicker'));
  const activePreview = document.getElementById('playerDicePickerPreview');
  const hexInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceHexInput'));
  const colorGrid = document.getElementById('playerDiceColorGrid');
  const resetBtn = document.getElementById('playerDiceResetBtn');

  const faceButtons = overlay.querySelectorAll('.player-dice-face-btn');
  const countInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceCount'));
  const modInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceMod'));
  const rollBtn = document.getElementById('playerDiceRollBtn');
  const resultEl = document.getElementById('playerDiceResult');

  // ---- Gestão de Cores ----
  function getThemeColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || "#45ff78";
  }

  function getEffectiveDiceColor() {
    if (customColor && customColor !== 'theme') {
      let c = String(customColor).trim();
      if (!c.startsWith('#')) c = '#' + c;
      return c;
    }
    return getThemeColor();
  }

  function applyCustomStyles() {
    if (!panel) return;
    const effColor = getEffectiveDiceColor();
    panel.style.setProperty('--dice-custom-color', effColor);

    // Atualiza o preview e os inputs de cor
    if (activePreview) {
      activePreview.style.background = effColor;
      activePreview.style.boxShadow = `0 0 10px ${effColor}`;
    }

    if (colorPicker && /^#[0-9a-fA-F]{6}$/.test(effColor)) {
      colorPicker.value = effColor;
    }

    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = effColor.replace(/^#/, '').toUpperCase();
    }

    // Configura a cor padrão no Box sem recarregar o tema
    if (Box && Box.config) {
      Box.config.themeColor = effColor;
    }

    renderColorSwatches();
  }

  function renderColorSwatches() {
    if (!colorGrid) return;
    colorGrid.innerHTML = '';

    COLOR_PALETTE.forEach(p => {
      const swatch = document.createElement('div');
      swatch.className = 'player-dice-color-swatch';
      swatch.title = p.label;

      if (p.isTheme) {
        const tColor = getThemeColor();
        swatch.style.background = `linear-gradient(135deg, ${tColor} 50%, var(--panel, #000) 50%)`;
        swatch.style.setProperty('--swatch-color', tColor);
        if (customColor === 'theme') swatch.classList.add('active');
        swatch.addEventListener('click', () => {
          customColor = 'theme';
          try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (e) {}
          applyCustomStyles();
        });
      } else {
        swatch.style.background = p.value;
        swatch.style.setProperty('--swatch-color', p.value);
        if (customColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
        swatch.addEventListener('click', () => {
          customColor = p.value;
          try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (e) {}
          applyCustomStyles();
        });
      }

      colorGrid.appendChild(swatch);
    });
  }

  // Eventos de configurações
  settingsBtn?.addEventListener('click', () => {
    const isOpen = settingsDrawer?.classList.toggle('open');
    settingsBtn.classList.toggle('active', isOpen);
  });

  colorPicker?.addEventListener('input', () => {
    customColor = colorPicker.value;
    try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (err) {}
    applyCustomStyles();
  });

  hexInput?.addEventListener('input', () => {
    let raw = hexInput.value.replace(/[^0-9a-fA-F]/g, '');
    if (raw.length === 6) {
      customColor = '#' + raw;
      try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (err) {}
      applyCustomStyles();
    }
  });

  hexInput?.addEventListener('blur', () => {
    applyCustomStyles();
  });

  resetBtn?.addEventListener('click', () => {
    customColor = 'theme';
    try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (e) {}
    applyCustomStyles();
  });

  // ---- Seleção de face ----
  function selectFaces(faces) {
    selectedFaces = faces;
    faceButtons.forEach(btn => {
      btn.classList.toggle('active', Number(/** @type {HTMLElement} */ (btn).dataset.faces) === faces);
    });
  }

  faceButtons.forEach(btn => {
    btn.addEventListener('click', () => selectFaces(Number(/** @type {HTMLElement} */ (btn).dataset.faces)));
  });

  // ---- 3D Dice Box Setup ----
  let isBoxReady = false;
  let isRolling = false;
  let boxInitPromise = null;

  const Box = new DiceBox({
    container: "#dice-box-canvas",
    assetPath: "/assets/",
    origin: "https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist",
    theme: "default",
    themeColor: getEffectiveDiceColor(),
    scale: 12,
    gravity: 2.5,       // Gravidade reforçada para queda 2x mais rápida e sensação de peso
    mass: 2,            // Massa 2x maior para impacto sólido
    friction: 0.85,     // Atrito de rolagem na mesa
    restitution: 0.1,   // Rebote reduzido para o dado não quicar como borracha
    settleTimeout: 2500 // Assenta e estabiliza 2x mais rápido
  });

  // Inicializa lazy-loading sem chamadas conflitantes
  function initBox() {
    if (isBoxReady) return Promise.resolve();
    if (!boxInitPromise) {
      boxInitPromise = Box.init().then(() => {
        isBoxReady = true;
        if (Box.config) Box.config.themeColor = getEffectiveDiceColor();
      }).catch(err => {
        console.error("Erro inicializando DiceBox:", err);
        boxInitPromise = null;
      });
    }
    return boxInitPromise;
  }

  // ---- Resultado ----
  function showResult(rolls, mod, sum, expr) {
    if (!resultEl) return;
    
    resultEl.innerHTML = `
      <span class="dice-total">${sum}</span>
      <span class="dice-expr">${expr}</span>
    `;
  }

  // ---- Rolagem ----
  function roll() {
    if (isRolling) return;
    
    const count = Math.min(20, Math.max(1, parseInt(countInput.value, 10) || 1));
    const mod = parseInt(modInput.value, 10) || 0;
    
    if (resultEl) resultEl.innerHTML = '<span class="dice-expr">Rolando...</span>';

    initBox().then(() => {
      executeRoll(count, mod);
    });
  }

  function executeRoll(count, mod) {
    isRolling = true;

    const currentColor = getEffectiveDiceColor();
    if (Box && Box.config) {
      Box.config.themeColor = currentColor;
    }
    
    // Rola usando a string e passa o themeColor diretamente
    const notation = `${count}d${selectedFaces}`;
    
    Box.roll(notation, { themeColor: currentColor }).then(results => {
      isRolling = false;
      
      // O DiceBox pode retornar os resultados agrupados ou diretamente um array
      const group = results && results[0];
      const rollsData = group && group.rolls ? group.rolls : results;
      const rolls = Array.isArray(rollsData) ? rollsData.map(r => r.value) : [group ? group.value : 0];
      const groupSum = group && group.value !== undefined ? group.value : rolls.reduce((a,b) => a+b, 0);
      const finalSum = groupSum + mod;
      
      const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : '';
      const expr = `${count}d${selectedFaces}${modStr} → [${rolls.join(', ')}]`;
      
      showResult(rolls, mod, finalSum, expr);
    }).catch(err => {
      console.error("Erro na rolagem 3D:", err);
      isRolling = false;
    });
  }

  rollBtn?.addEventListener('click', roll);

  // ---- Abrir / fechar ----
  function openDice() { 
    applyCustomStyles();
    overlay.classList.add('open'); 
    initBox(); // Inicializa na primeira vez
  }
  
  function closeDice() {
    overlay.classList.remove('open');
    if (isBoxReady) Box.clear(); // Limpa dados da tela
  }

  diceBtn.addEventListener('click', openDice);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDice(); });

  // Touch swipe para fechar (desliza pra baixo)
  let touchStartY = 0;
  panel?.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  panel?.addEventListener('touchend', (e) => {
    if (e.changedTouches[0].clientY - touchStartY > 80) closeDice();
  }, { passive: true });

  // ---- Mostrar botão / Integrar ----
  const gmOpenBtn = document.getElementById('openDiceBtn');

  if (gmOpenBtn) {
    // Modo Mestre: usa o botão existente na sidebar
    gmOpenBtn.addEventListener('click', openDice);
    // Remove o botão flutuante
    if (diceBtn.parentNode) diceBtn.parentNode.removeChild(diceBtn);
  } else {
    // Modo Jogador: mostra o botão flutuante quando conectar
    document.addEventListener('rpg:connected', () => diceBtn.classList.remove('hidden'));
    // Fallback: mostra depois de 3s se viewport estiver visível (já conectado antes)
    setTimeout(() => {
      const vp = document.getElementById('viewport');
      if (vp && !vp.classList.contains('hidden')) diceBtn.classList.remove('hidden');
    }, 3000);
  }

  selectFaces(20);
  applyCustomStyles();

  // Observa troca de tema global da mesa para atualizar cor caso use 'theme'
  const themeObserver = new MutationObserver(() => {
    if (customColor === 'theme') applyCustomStyles();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', (e) => {
    if (e.key === 'rpg-table-theme' && customColor === 'theme') applyCustomStyles();
  });
})();

