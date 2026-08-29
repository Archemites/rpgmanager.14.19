// @ts-ignore
import DiceBox from 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js';
import { isMobile } from './mobile.js';

/* ============================================================
   Player & GM dice roller — Speed-dial mobile flutuante
   - Expansão de dados abaixo da bolinha
   - Controles de Qtd, Mod e Subdrop de Modo (Adv/Dis/Normal) à esquerda
   - Engrenagem no final da coluna com slider de tamanho e cores
   ============================================================ */

(() => {
  'use strict';

  // ---- Configuração de dados ----
  const FACES = [4, 6, 8, 10, 12, 20, 100];
  let selectedFaces = 20;
  let currentRollMode = 'normal'; // 'normal' | 'adv' | 'dis'

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
  const STORAGE_KEY_SCALE = 'rpg-dice-scale';

  let customColor = 'theme';
  let customScale = 6;

  try {
    customColor = localStorage.getItem(STORAGE_KEY_COLOR) || 'theme';
    const savedScale = localStorage.getItem(STORAGE_KEY_SCALE);
    if (savedScale) customScale = Math.min(9, Math.max(3, Number(savedScale) || 6));
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

  // ---- Injeta estrutura DOM Principal ----
  const wrap = document.createElement('div');
  wrap.id = 'playerDiceWrap';
  wrap.className = 'player-dice-wrap';
  wrap.innerHTML = `
    <!-- Linha Superior / Botão Principal -->
    <div class="player-dice-header-row">
      
      <!-- Controles à Esquerda da Bolinha: Modo (Vantagem/Desvantagem/Normal), Qtd e Mod -->
      <div id="playerDiceSideControls" class="player-dice-side-controls collapsed">
        
        <!-- Modo de Rolagem com Subdrop -->
        <div class="player-dice-mode-dropdown-wrap">
          <button type="button" id="playerDiceModeBtn" class="player-dice-control-btn mode-btn" title="Modo de Rolagem">
            <span id="playerDiceModeLabel">NORMAL</span>
            <svg class="mode-arrow" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          
          <!-- Subdrop de seleção de modo -->
          <div id="playerDiceModeMenu" class="player-dice-subdrop-menu hidden">
            <button type="button" class="player-dice-subdrop-item active" data-mode="normal">
              <span class="mode-dot normal"></span>
              <span>Normal</span>
            </button>
            <button type="button" class="player-dice-subdrop-item" data-mode="adv">
              <span class="mode-dot adv"></span>
              <span>Vantagem (ADV)</span>
            </button>
            <button type="button" class="player-dice-subdrop-item" data-mode="dis">
              <span class="mode-dot dis"></span>
              <span>Desvantagem (DIS)</span>
            </button>
          </div>
        </div>

        <!-- Quantidade (Qtd) com Stepper -->
        <div class="player-dice-stepper-pill" title="Quantidade de dados">
          <span class="pill-label">Qtd</span>
          <button type="button" id="playerDiceCountDec" class="pill-btn">−</button>
          <input type="number" id="playerDiceCount" min="1" max="20" value="1" title="Qtd de dados">
          <button type="button" id="playerDiceCountInc" class="pill-btn">+</button>
        </div>

        <!-- Modificador (Mod) com Stepper -->
        <div class="player-dice-stepper-pill" title="Modificador numérico">
          <span class="pill-label">Mod</span>
          <button type="button" id="playerDiceModDec" class="pill-btn">−</button>
          <input type="number" id="playerDiceMod" min="-99" max="99" value="0" title="Modificador">
          <button type="button" id="playerDiceModInc" class="pill-btn">+</button>
        </div>

      </div>

      <!-- A Bolinha (Botão Principal) -->
      <button type="button" id="playerDiceBtn" class="player-dice-circle-btn" title="Rolar dados" aria-label="Rolar dados">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
      </button>

    </div>

    <!-- Coluna Vertical de Dados (Expande Abaixo da Bolinha) -->
    <div id="playerDiceColumn" class="player-dice-column collapsed">
      ${FACES.map(f => `
        <button type="button" class="player-dice-col-btn" data-faces="${f}" title="Rolar d${f}">
          <span class="dice-col-svg">${DICE_SVGS[f]}</span>
          <span class="dice-col-label">d${f}</span>
        </button>
      `).join('')}

      <!-- Engrenagem no Final da Coluna -->
      <button type="button" id="playerDiceSettingsBtn" class="player-dice-col-btn settings-btn" title="Personalizar cor e tamanho dos dados 3D">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>

    <!-- Painel da Engrenagem (Slider de tamanho e Seletor de cor) -->
    <div id="playerDiceSettingsPanel" class="player-dice-settings-popover collapsed">
      <div class="settings-popover-header">
        <span>Aparência dos Dados 3D</span>
        <button type="button" id="playerDiceSettingsClose" class="settings-popover-close">✕</button>
      </div>

      <!-- Slider de Tamanho -->
      <div class="settings-row">
        <div class="settings-label-row">
          <span class="settings-label">Tamanho do Dado</span>
          <span id="playerDiceScaleVal" class="settings-val">100%</span>
        </div>
        <input type="range" id="playerDiceScaleInput" min="3" max="9" value="6" step="0.5">
      </div>
      
      <!-- Seletor de Cor -->
      <div class="settings-row">
        <div class="settings-label-row">
          <span class="settings-label">Cor dos Dados</span>
          <button type="button" id="playerDiceResetBtn" class="reset-theme-btn" title="Restaurar cor do tema da mesa">Cor do Tema</button>
        </div>
        <div class="settings-color-bar">
          <div class="color-picker-dot" title="Clique para abrir o espectro de cores">
            <input type="color" id="playerDiceColorPicker" value="#45ff78">
          </div>
          <div id="playerDicePickerPreview" class="color-preview-dot" title="Cor ativa"></div>
          <div class="color-hex-field">
            <span class="hex-prefix">#</span>
            <input type="text" id="playerDiceHexInput" maxlength="6" placeholder="45FF78" spellcheck="false" title="Código HEX">
          </div>
        </div>
        <div class="color-presets-grid" id="playerDiceColorGrid"></div>
      </div>
    </div>

    <!-- Banner / Toast de Resultado Flutuante no Topo -->
    <div id="playerDiceResultToast" class="player-dice-result-toast hidden">
      <div class="toast-content">
        <span class="toast-total" id="playerDiceResultTotal">20</span>
        <span class="toast-formula" id="playerDiceResultFormula">1d20 → [20]</span>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  // Injeta o container para o DiceBox (canvas 3D) em tela cheia
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
    document.body.appendChild(boxCanvas);
  }

  // ---- Referências DOM ----
  const diceBtn = document.getElementById('playerDiceBtn');
  const sideControls = document.getElementById('playerDiceSideControls');
  const diceColumn = document.getElementById('playerDiceColumn');
  const settingsBtn = document.getElementById('playerDiceSettingsBtn');
  const settingsPanel = document.getElementById('playerDiceSettingsPanel');
  const settingsClose = document.getElementById('playerDiceSettingsClose');

  // Modo
  const modeBtn = document.getElementById('playerDiceModeBtn');
  const modeLabel = document.getElementById('playerDiceModeLabel');
  const modeMenu = document.getElementById('playerDiceModeMenu');
  const modeItems = wrap.querySelectorAll('.player-dice-subdrop-item');

  // Steppers Qtd e Mod
  const countInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceCount'));
  const countDecBtn = document.getElementById('playerDiceCountDec');
  const countIncBtn = document.getElementById('playerDiceCountInc');

  const modInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceMod'));
  const modDecBtn = document.getElementById('playerDiceModDec');
  const modIncBtn = document.getElementById('playerDiceModInc');

  // Configurações
  const colorPicker = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceColorPicker'));
  const activePreview = document.getElementById('playerDicePickerPreview');
  const hexInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceHexInput'));
  const scaleInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceScaleInput'));
  const scaleVal = document.getElementById('playerDiceScaleVal');
  const colorGrid = document.getElementById('playerDiceColorGrid');
  const resetBtn = document.getElementById('playerDiceResetBtn');

  // Toast de Resultado
  const resultToast = document.getElementById('playerDiceResultToast');
  const resultTotal = document.getElementById('playerDiceResultTotal');
  const resultFormula = document.getElementById('playerDiceResultFormula');

  let toastTimeout = null;

  // ---- Alternar Expansão do Drop (A Bolinha) ----
  let isExpanded = false;

  function toggleDiceDrop(forceState) {
    isExpanded = typeof forceState === 'boolean' ? forceState : !isExpanded;
    
    wrap.classList.toggle('open', isExpanded);
    diceBtn.classList.toggle('active', isExpanded);
    sideControls.classList.toggle('collapsed', !isExpanded);
    diceColumn.classList.toggle('collapsed', !isExpanded);

    if (!isExpanded) {
      // Fecha submenus caso estejam abertos
      modeMenu.classList.add('hidden');
      settingsPanel.classList.add('collapsed');
      settingsBtn.classList.remove('active');
    }
  }

  diceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDiceDrop();
  });

  // ---- Subdrop de Modo (Normal / Vantagem / Desvantagem) ----
  modeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modeMenu.classList.toggle('hidden');
  });

  function setRollMode(mode) {
    currentRollMode = mode;
    modeItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-mode') === mode);
    });

    if (mode === 'adv') {
      modeLabel.textContent = 'VANTAGEM';
      modeBtn.className = 'player-dice-control-btn mode-btn adv';
      if (parseInt(countInput.value, 10) === 1) countInput.value = '2';
    } else if (mode === 'dis') {
      modeLabel.textContent = 'DESVANTAGEM';
      modeBtn.className = 'player-dice-control-btn mode-btn dis';
      if (parseInt(countInput.value, 10) === 1) countInput.value = '2';
    } else {
      modeLabel.textContent = 'NORMAL';
      modeBtn.className = 'player-dice-control-btn mode-btn normal';
    }

    modeMenu.classList.add('hidden');
  }

  modeItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = item.getAttribute('data-mode') || 'normal';
      setRollMode(m);
    });
  });

  // ---- Steppers Qtd ----
  countDecBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let val = parseInt(countInput.value, 10) || 1;
    if (val > 1) countInput.value = String(val - 1);
  });

  countIncBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let val = parseInt(countInput.value, 10) || 1;
    if (val < 20) countInput.value = String(val + 1);
  });

  countInput.addEventListener('input', () => {
    let val = parseInt(countInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 20) val = 20;
    countInput.value = String(val);
  });

  // ---- Steppers Mod ----
  modDecBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let val = parseInt(modInput.value, 10) || 0;
    if (val > -99) modInput.value = String(val - 1);
  });

  modIncBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let val = parseInt(modInput.value, 10) || 0;
    if (val < 99) modInput.value = String(val + 1);
  });

  modInput.addEventListener('input', () => {
    let val = parseInt(modInput.value, 10);
    if (isNaN(val)) val = 0;
    if (val < -99) val = -99;
    if (val > 99) val = 99;
    modInput.value = String(val);
  });

  // ---- Engrenagem / Painel de Configurações ----
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = settingsPanel.classList.toggle('collapsed');
    settingsBtn.classList.toggle('active', !isCollapsed);
  });

  settingsClose.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel.classList.add('collapsed');
    settingsBtn.classList.remove('active');
  });

  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    if (!wrap.contains(/** @type {Node} */ (e.target))) {
      toggleDiceDrop(false);
    }
  });

  // ---- Gestão de Cores e Estilos ----
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
    const effColor = getEffectiveDiceColor();
    wrap.style.setProperty('--dice-active-color', effColor);

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

    if (scaleInput) {
      scaleInput.value = String(customScale);
    }
    if (scaleVal) {
      scaleVal.textContent = Math.round((customScale / 6) * 100) + '%';
    }

    if (Box && Box.config) {
      Box.config.themeColor = effColor;
      Box.config.scale = customScale;
    }

    if (isBoxReady && Box && typeof Box.updateConfig === 'function') {
      try {
        Box.updateConfig({ scale: customScale, themeColor: effColor });
      } catch (e) {
        console.warn("DiceBox updateConfig aviso:", e);
      }
    }

    renderColorSwatches();
  }

  function renderColorSwatches() {
    if (!colorGrid) return;
    colorGrid.innerHTML = '';

    COLOR_PALETTE.forEach(p => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch-dot';
      swatch.title = p.label;

      if (p.isTheme) {
        const tColor = getThemeColor();
        swatch.style.background = `linear-gradient(135deg, ${tColor} 50%, var(--panel, #000) 50%)`;
        swatch.style.setProperty('--swatch-color', tColor);
        if (customColor === 'theme') swatch.classList.add('active');
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          customColor = 'theme';
          try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (err) {}
          applyCustomStyles();
        });
      } else {
        swatch.style.background = p.value;
        swatch.style.setProperty('--swatch-color', p.value);
        if (customColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          customColor = p.value;
          try { localStorage.setItem(STORAGE_KEY_COLOR, customColor); } catch (err) {}
          applyCustomStyles();
        });
      }

      colorGrid.appendChild(swatch);
    });
  }

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

  scaleInput?.addEventListener('input', () => {
    customScale = Number(scaleInput.value) || 6;
    try { localStorage.setItem(STORAGE_KEY_SCALE, String(customScale)); } catch (err) {}
    applyCustomStyles();
  });

  resetBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    customColor = 'theme';
    customScale = 6;
    try {
      localStorage.setItem(STORAGE_KEY_COLOR, customColor);
      localStorage.setItem(STORAGE_KEY_SCALE, String(customScale));
    } catch (err) {}
    applyCustomStyles();
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
    light_intensity: 1.2,
    scale: customScale,
    gravity: 2.5,
    mass: 2,
    friction: 0.85,
    restitution: 0.1,
    settleTimeout: 2500
  });

  function initBox() {
    if (isBoxReady) return Promise.resolve();
    if (!boxInitPromise) {
      if (Box.config) {
        Box.config.themeColor = getEffectiveDiceColor();
        Box.config.scale = customScale;
      }
      boxInitPromise = Box.init().then(() => {
        isBoxReady = true;
        if (typeof Box.updateConfig === 'function') {
          try {
            Box.updateConfig({ scale: customScale, themeColor: getEffectiveDiceColor() });
          } catch (e) {}
        }
      }).catch(err => {
        console.error("Erro inicializando DiceBox:", err);
        boxInitPromise = null;
        isBoxReady = false;
      });
    }
    return boxInitPromise;
  }

  // ---- Toast de Resultado ----
  function showToastResult(sum, formula) {
    if (!resultToast || !resultTotal || !resultFormula) return;
    
    resultTotal.textContent = String(sum);
    resultFormula.textContent = formula;

    resultToast.classList.remove('hidden');
    resultToast.classList.add('pop');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      resultToast.classList.remove('pop');
      setTimeout(() => resultToast.classList.add('hidden'), 300);
    }, 6000);
  }

  // ---- Rolagem de um Dado da Coluna ----
  function rollDiceFace(faces) {
    if (isRolling) return;
    selectedFaces = faces;

    const count = Math.min(20, Math.max(1, parseInt(countInput.value, 10) || 1));
    const mod = parseInt(modInput.value, 10) || 0;

    initBox().then(() => {
      executeRoll(count, mod, faces);
    });
  }

  function executeRoll(count, mod, faces) {
    isRolling = true;

    const currentColor = getEffectiveDiceColor();
    if (isBoxReady && typeof Box.updateConfig === 'function') {
      try {
        Box.updateConfig({ scale: customScale, themeColor: currentColor });
      } catch (e) {}
    }
    
    const notation = `${count}d${faces}`;
    const mode = currentRollMode;
    
    Box.roll(notation, { themeColor: currentColor }).then(results => {
      isRolling = false;
      
      const group = results && results[0];
      const rollsData = group && group.rolls ? group.rolls : results;
      const rolls = Array.isArray(rollsData) ? rollsData.map(r => r.value) : [group ? group.value : 0];
      
      const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : '';
      let chosenValue = 0;
      let expr = '';

      if (mode === 'adv') {
        const highest = Math.max(...rolls);
        chosenValue = highest;
        const finalSum = chosenValue + mod;
        if (rolls.length > 1) {
          expr = `${count}d${faces}${modStr} (Vantagem) → [${rolls.join(', ')}] → Maior: ${highest}${mod !== 0 ? ` (${highest}${modStr})` : ''}`;
        } else {
          expr = `${count}d${faces}${modStr} → [${highest}]${mod !== 0 ? ` (${highest}${modStr})` : ''}`;
        }
        showToastResult(finalSum, expr);
      } else if (mode === 'dis') {
        const lowest = Math.min(...rolls);
        chosenValue = lowest;
        const finalSum = chosenValue + mod;
        if (rolls.length > 1) {
          expr = `${count}d${faces}${modStr} (Desvantagem) → [${rolls.join(', ')}] → Menor: ${lowest}${mod !== 0 ? ` (${lowest}${modStr})` : ''}`;
        } else {
          expr = `${count}d${faces}${modStr} → [${lowest}]${mod !== 0 ? ` (${lowest}${modStr})` : ''}`;
        }
        showToastResult(finalSum, expr);
      } else {
        const sumOfDice = rolls.reduce((a, b) => a + b, 0);
        chosenValue = sumOfDice;
        const finalSum = chosenValue + mod;
        if (rolls.length > 1) {
          expr = `${count}d${faces}${modStr} → [${rolls.join(' + ')}] = ${sumOfDice}${mod !== 0 ? ` (${sumOfDice}${modStr})` : ''}`;
        } else {
          expr = `${count}d${faces}${modStr} → [${rolls[0]}]${mod !== 0 ? ` (${rolls[0]}${modStr})` : ''}`;
        }
        showToastResult(finalSum, expr);
      }
    }).catch(err => {
      console.error("Erro na rolagem 3D:", err);
      isRolling = false;
    });
  }

  // Eventos de clique nas faces dos dados da coluna
  wrap.querySelectorAll('.player-dice-col-btn[data-faces]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const faces = Number(/** @type {HTMLElement} */ (btn).dataset.faces);
      rollDiceFace(faces);
    });
  });

  // ---- Integração GM vs Player ----
  const gmOpenBtn = document.getElementById('openDiceBtn');

  if (gmOpenBtn) {
    // No Mestre: sincroniza com o botão do topo da barra
    gmOpenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDiceDrop();
    });
  } else {
    // No Jogador: mostra o botão flutuante quando conectado
    document.addEventListener('rpg:connected', () => wrap.classList.remove('hidden'));
    setTimeout(() => {
      const vp = document.getElementById('viewport');
      if (vp && !vp.classList.contains('hidden')) wrap.classList.remove('hidden');
    }, 2500);
  }

  applyCustomStyles();
  initBox();

  // Observa troca de tema global da mesa
  const themeObserver = new MutationObserver(() => {
    if (customColor === 'theme') applyCustomStyles();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', (e) => {
    if (e.key === 'rpg-table-theme' && customColor === 'theme') applyCustomStyles();
  });

  // Expõe API para rolagem programática
  // @ts-ignore
  window.RPG = window.RPG || {};
  // @ts-ignore
  window.RPG.toggleDice = toggleDiceDrop;
  // @ts-ignore
  window.RPG.rollDice = rollDiceFace;
})();
