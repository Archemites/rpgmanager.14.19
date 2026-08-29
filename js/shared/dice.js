// @ts-ignore
import DiceBox from 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js';
import { isMobile } from './mobile.js';

/* ============================================================
   Player & GM dice roller — motor 3D com @3d-dice/dice-box,
   UI adaptativa para Mobile (Drop + Sub-Aba + Sub-Subaba) e Desktop
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

  // ---- DOM: botão flutuante ("bolinha") ----
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

  // ---- DOM: overlay & painel ----
  const overlay = document.createElement('div');
  overlay.id = 'playerDiceOverlay';
  overlay.innerHTML = `
    <div id="playerDicePanel" class="player-dice-panel">
      
      <!-- Barra superior / Header -->
      <div class="player-dice-top-bar">
        <div class="player-dice-title-wrap">
          <span class="player-dice-title-dot"></span>
          <span class="player-dice-title-text">ROLAR DADOS</span>
        </div>
        <div class="player-dice-handle"></div>
        <button type="button" id="playerDiceCloseBtn" class="player-dice-close-btn" title="Fechar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="player-dice-controls">
        
        <!-- Nível 1: Faces dos Dados (d4 a d100) -->
        <div id="playerDiceFaces" class="player-dice-faces">
          ${FACES.map(f => `
            <button type="button" class="player-dice-face-btn ${f === 20 ? 'active' : ''}" data-faces="${f}" title="Selecionar d${f}">
              <span class="player-dice-face-svg">${DICE_SVGS[f]}</span>
              <span class="player-dice-face-text">d${f}</span>
            </button>
          `).join('')}
        </div>

        <!-- Área de Resultado com animação Pop -->
        <div id="playerDiceResult"></div>

        <!-- Botão Rolar Principal em Destaque -->
        <div class="player-dice-main-action">
          <button id="playerDiceRollBtn" type="button">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
            <span id="playerDiceRollBtnText">ROLAR d20</span>
          </button>
        </div>

        <!-- Sub-Seta para a Sub-Aba (Vantagem, Desvantagem, Quantidade, Modificadores) -->
        <button type="button" id="playerDiceSubTabToggle" class="player-dice-subtab-toggle" title="Abrir opções de vantagem, quantidade e modificadores">
          <div class="player-dice-subtab-toggle-left">
            <svg class="player-dice-subtab-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span>Opções Avançadas</span>
          </div>
          <span id="playerDiceConfigBadge" class="player-dice-config-badge">1d20</span>
        </button>

        <!-- Sub-Aba: Opções de Rolagem -->
        <div id="playerDiceSubTab" class="player-dice-subtab">
          <div class="player-dice-subtab-inner">
            
            <!-- Modo: Normal / Vantagem / Desvantagem -->
            <div class="player-dice-mode-row">
              <div class="player-dice-field-label">Modo de Rolagem</div>
              <div class="player-dice-mode-pills" id="playerDiceModePills">
                <button type="button" class="player-dice-pill active" data-mode="normal">Normal</button>
                <button type="button" class="player-dice-pill" data-mode="adv" title="Rola 2 dados e escolhe o maior">Vantagem</button>
                <button type="button" class="player-dice-pill" data-mode="dis" title="Rola 2 dados e escolhe o menor">Desvantagem</button>
              </div>
              <select id="playerDiceMode" class="hidden">
                <option value="normal" selected>Normal</option>
                <option value="adv">Vantagem</option>
                <option value="dis">Desvantagem</option>
              </select>
            </div>

            <!-- Steppers: Quantidade e Modificador -->
            <div class="player-dice-stepper-grid">
              
              <!-- Quantidade (Qtd) -->
              <div class="player-dice-stepper-box">
                <label for="playerDiceCount" class="player-dice-field-label">Qtd de Dados</label>
                <div class="player-dice-stepper-control">
                  <button type="button" class="player-dice-stepper-btn" id="playerDiceCountDec" title="Diminuir quantidade">−</button>
                  <input type="number" id="playerDiceCount" min="1" max="20" value="1" title="Quantidade de dados">
                  <button type="button" class="player-dice-stepper-btn" id="playerDiceCountInc" title="Aumentar quantidade">+</button>
                </div>
              </div>

              <!-- Modificador (Mod) -->
              <div class="player-dice-stepper-box">
                <label for="playerDiceMod" class="player-dice-field-label">Modificador</label>
                <div class="player-dice-stepper-control">
                  <button type="button" class="player-dice-stepper-btn" id="playerDiceModDec" title="Diminuir modificador">−</button>
                  <input type="number" id="playerDiceMod" min="-99" max="99" value="0" title="Modificador numérico">
                  <button type="button" class="player-dice-stepper-btn" id="playerDiceModInc" title="Aumentar modificador">+</button>
                </div>
              </div>

            </div>

            <!-- Engrenagem: Botão para abrir a Sub-Subaba -->
            <button type="button" id="playerDiceSettingsBtn" class="player-dice-subsubtab-toggle" title="Personalizar aparência e cor dos dados 3D">
              <div class="player-dice-subsubtab-left">
                <svg class="player-dice-gear-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Aparência dos Dados 3D</span>
              </div>
              <svg class="player-dice-subsubtab-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <!-- Sub-Subaba: Gaveta da Engrenagem (Cor e Tamanho) -->
            <div id="playerDiceSettingsDrawer" class="player-dice-settings-drawer">
              <div class="player-dice-settings-title">
                <span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

              <!-- Seletor de Cor (Hue) e HEX -->
              <div class="player-dice-picker-row">
                <div class="player-dice-color-picker-wrap" title="Clique para abrir o espectro de cores (Hue)">
                  <input type="color" id="playerDiceColorPicker" value="#45ff78">
                </div>
                <div class="player-dice-active-preview" id="playerDicePickerPreview" title="Cor ativa"></div>
                <div class="player-dice-hex-wrap">
                  <span class="player-dice-hex-prefix">#</span>
                  <input type="text" id="playerDiceHexInput" class="player-dice-hex-input" maxlength="6" placeholder="45FF78" spellcheck="false" title="Digite o código HEX">
                </div>
              </div>

              <!-- Tamanho do Dado -->
              <div class="player-dice-scale-row">
                <div class="player-dice-scale-header">
                  <span class="player-dice-scale-title">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                    <span>Tamanho do Dado</span>
                  </span>
                  <span id="playerDiceScaleVal" class="player-dice-scale-val">100%</span>
                </div>
                <div class="player-dice-scale-slider-wrap">
                  <input type="range" id="playerDiceScaleInput" min="3" max="9" value="6" step="0.5">
                </div>
              </div>

              <!-- Presets Rápidos -->
              <div class="player-dice-presets-label">Presets Rápidos:</div>
              <div class="player-dice-color-grid" id="playerDiceColorGrid"></div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Injeta o container para o DiceBox (canvas 3D)
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
  }
  overlay.insertBefore(boxCanvas, overlay.firstChild);

  // ---- Referências DOM ----
  const panel = document.getElementById('playerDicePanel');
  const closeBtn = document.getElementById('playerDiceCloseBtn');
  
  // Sub-Aba
  const subTabToggle = document.getElementById('playerDiceSubTabToggle');
  const subTab = document.getElementById('playerDiceSubTab');
  const configBadge = document.getElementById('playerDiceConfigBadge');

  // Sub-Subaba (Engrenagem)
  const settingsBtn = document.getElementById('playerDiceSettingsBtn');
  const settingsDrawer = document.getElementById('playerDiceSettingsDrawer');
  
  // Inputs de Configuração
  const colorPicker = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceColorPicker'));
  const activePreview = document.getElementById('playerDicePickerPreview');
  const hexInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceHexInput'));
  const scaleInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceScaleInput'));
  const scaleVal = document.getElementById('playerDiceScaleVal');
  const colorGrid = document.getElementById('playerDiceColorGrid');
  const resetBtn = document.getElementById('playerDiceResetBtn');

  // Controles de Rolagem
  const faceButtons = overlay.querySelectorAll('.player-dice-face-btn');
  const countInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceCount'));
  const countDecBtn = document.getElementById('playerDiceCountDec');
  const countIncBtn = document.getElementById('playerDiceCountInc');
  
  const modInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceMod'));
  const modDecBtn = document.getElementById('playerDiceModDec');
  const modIncBtn = document.getElementById('playerDiceModInc');

  const modeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('playerDiceMode'));
  const modePills = overlay.querySelectorAll('.player-dice-pill');

  const rollBtn = document.getElementById('playerDiceRollBtn');
  const rollBtnText = document.getElementById('playerDiceRollBtnText');
  const resultEl = document.getElementById('playerDiceResult');

  // ---- Atualização do Badge e Texto do Botão ----
  function updateConfigBadge() {
    const count = parseInt(countInput?.value, 10) || 1;
    const mod = parseInt(modInput?.value, 10) || 0;
    const mode = modeSelect?.value || 'normal';

    const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : '';
    let notation = `${count}d${selectedFaces}${modStr ? ' ' + modStr : ''}`;

    if (mode === 'adv') notation = `ADV • ${notation}`;
    else if (mode === 'dis') notation = `DIS • ${notation}`;

    if (configBadge) configBadge.textContent = notation;
    if (rollBtnText) rollBtnText.textContent = `ROLAR ${count > 1 ? count : ''}d${selectedFaces}${modStr ? ' ' + modStr : ''}`;
  }

  // ---- Modo de Rolagem (Pills + Select) ----
  function setRollMode(mode) {
    if (modeSelect) modeSelect.value = mode;
    modePills.forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-mode') === mode);
    });

    if ((mode === 'adv' || mode === 'dis') && parseInt(countInput.value, 10) === 1) {
      countInput.value = '2';
    }
    updateConfigBadge();
  }

  modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const m = pill.getAttribute('data-mode') || 'normal';
      setRollMode(m);
    });
  });

  modeSelect?.addEventListener('change', () => {
    setRollMode(modeSelect.value);
  });

  // ---- Stepper de Quantidade ----
  countDecBtn?.addEventListener('click', () => {
    let val = parseInt(countInput.value, 10) || 1;
    if (val > 1) {
      countInput.value = String(val - 1);
      updateConfigBadge();
    }
  });

  countIncBtn?.addEventListener('click', () => {
    let val = parseInt(countInput.value, 10) || 1;
    if (val < 20) {
      countInput.value = String(val + 1);
      updateConfigBadge();
    }
  });

  countInput?.addEventListener('input', () => {
    let val = parseInt(countInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 20) val = 20;
    countInput.value = String(val);
    updateConfigBadge();
  });

  // ---- Stepper de Modificador ----
  modDecBtn?.addEventListener('click', () => {
    let val = parseInt(modInput.value, 10) || 0;
    if (val > -99) {
      modInput.value = String(val - 1);
      updateConfigBadge();
    }
  });

  modIncBtn?.addEventListener('click', () => {
    let val = parseInt(modInput.value, 10) || 0;
    if (val < 99) {
      modInput.value = String(val + 1);
      updateConfigBadge();
    }
  });

  modInput?.addEventListener('input', () => {
    let val = parseInt(modInput.value, 10);
    if (isNaN(val)) val = 0;
    if (val < -99) val = -99;
    if (val > 99) val = 99;
    modInput.value = String(val);
    updateConfigBadge();
  });

  // ---- Sub-Aba Toggle (Sub-Seta) ----
  subTabToggle?.addEventListener('click', () => {
    const isOpen = subTab?.classList.toggle('open');
    subTabToggle.classList.toggle('active', isOpen);
  });

  // ---- Sub-Subaba Toggle (Engrenagem) ----
  settingsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = settingsDrawer?.classList.toggle('open');
    settingsBtn.classList.toggle('active', isOpen);
  });

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

  resetBtn?.addEventListener('click', () => {
    customColor = 'theme';
    customScale = 6;
    try {
      localStorage.setItem(STORAGE_KEY_COLOR, customColor);
      localStorage.setItem(STORAGE_KEY_SCALE, String(customScale));
    } catch (e) {}
    applyCustomStyles();
  });

  // ---- Seleção de Face dos Dados ----
  function selectFaces(faces) {
    selectedFaces = faces;
    faceButtons.forEach(btn => {
      btn.classList.toggle('active', Number(/** @type {HTMLElement} */ (btn).dataset.faces) === faces);
    });
    updateConfigBadge();
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
    light_intensity: 1.2,
    scale: customScale,
    gravity: 2.5,       // Gravidade reforçada para sensação de peso
    mass: 2,            // Massa sólida
    friction: 0.85,     // Atrito na mesa
    restitution: 0.1,   // Rebote reduzido
    settleTimeout: 2500 // Estabiliza rápido
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

  // ---- Exibição do Resultado ----
  function showResult(rolls, mod, sum, expr) {
    if (!resultEl) return;
    resultEl.innerHTML = `
      <span class="dice-total">${sum}</span>
      <span class="dice-expr">${expr}</span>
    `;
  }

  // ---- Execução da Rolagem ----
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
    if (isBoxReady && typeof Box.updateConfig === 'function') {
      try {
        Box.updateConfig({ scale: customScale, themeColor: currentColor });
      } catch (e) {}
    }
    
    const notation = `${count}d${selectedFaces}`;
    const mode = modeSelect ? modeSelect.value : 'normal';
    
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
          expr = `${count}d${selectedFaces}${modStr} (Vantagem) → [${rolls.join(', ')}] → Maior: ${highest}${mod !== 0 ? ` (${highest}${modStr})` : ''}`;
        } else {
          expr = `${count}d${selectedFaces}${modStr} → [${highest}]${mod !== 0 ? ` (${highest}${modStr})` : ''}`;
        }
        showResult(rolls, mod, finalSum, expr);
      } else if (mode === 'dis') {
        const lowest = Math.min(...rolls);
        chosenValue = lowest;
        const finalSum = chosenValue + mod;
        if (rolls.length > 1) {
          expr = `${count}d${selectedFaces}${modStr} (Desvantagem) → [${rolls.join(', ')}] → Menor: ${lowest}${mod !== 0 ? ` (${lowest}${modStr})` : ''}`;
        } else {
          expr = `${count}d${selectedFaces}${modStr} → [${lowest}]${mod !== 0 ? ` (${lowest}${modStr})` : ''}`;
        }
        showResult(rolls, mod, finalSum, expr);
      } else {
        const sumOfDice = rolls.reduce((a, b) => a + b, 0);
        chosenValue = sumOfDice;
        const finalSum = chosenValue + mod;
        if (rolls.length > 1) {
          expr = `${count}d${selectedFaces}${modStr} → [${rolls.join(' + ')}] = ${sumOfDice}${mod !== 0 ? ` (${sumOfDice}${modStr})` : ''}`;
        } else {
          expr = `${count}d${selectedFaces}${modStr} → [${rolls[0]}]${mod !== 0 ? ` (${rolls[0]}${modStr})` : ''}`;
        }
        showResult(rolls, mod, finalSum, expr);
      }
    }).catch(err => {
      console.error("Erro na rolagem 3D:", err);
      isRolling = false;
    });
  }

  rollBtn?.addEventListener('click', roll);

  // ---- Abrir / Fechar e Posicionamento Adaptativo ----
  function positionMobileDrop(triggerEl) {
    if (!panel || !isMobile()) {
      if (panel) {
        panel.style.top = '';
        panel.style.right = '';
        panel.style.left = '';
        panel.style.bottom = '';
        panel.style.maxHeight = '';
      }
      return;
    }

    const trigger = triggerEl || (gmOpenBtn && gmOpenBtn.offsetParent ? gmOpenBtn : diceBtn);
    if (!trigger || !trigger.getBoundingClientRect) return;

    const rect = trigger.getBoundingClientRect();
    const isRightSide = rect.left > window.innerWidth / 2;
    const topPos = Math.max(10, Math.min(window.innerHeight - 200, rect.bottom + 8));

    panel.style.top = `${topPos}px`;
    panel.style.bottom = 'auto';

    if (isRightSide) {
      panel.style.right = `${Math.max(10, window.innerWidth - rect.right)}px`;
      panel.style.left = 'auto';
    } else {
      panel.style.left = `${Math.max(10, rect.left)}px`;
      panel.style.right = 'auto';
    }

    const maxH = window.innerHeight - topPos - 16;
    panel.style.maxHeight = `${Math.max(260, maxH)}px`;
  }

  function openDice(e) { 
    applyCustomStyles();
    positionMobileDrop(e && e.currentTarget ? e.currentTarget : null);
    overlay.classList.add('open'); 
    initBox();
  }
  
  function closeDice() {
    overlay.classList.remove('open');
    if (isBoxReady) Box.clear();
  }

  function toggleDice(e) {
    if (overlay.classList.contains('open')) {
      closeDice();
    } else {
      openDice(e);
    }
  }

  diceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDice(e);
  });
  
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDice();
  });

  overlay.addEventListener('click', (e) => { 
    if (e.target === overlay) closeDice(); 
  });

  // Touch swipe para fechar (desliza pra baixo)
  let touchStartY = 0;
  panel?.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  panel?.addEventListener('touchend', (e) => {
    if (e.changedTouches[0].clientY - touchStartY > 70) closeDice();
  }, { passive: true });

  // Reposiciona o drop no resize/orientação se estiver aberto no mobile
  window.addEventListener('resize', () => {
    if (overlay.classList.contains('open') && isMobile()) {
      positionMobileDrop();
    }
  }, { passive: true });

  // ---- Integração GM vs Player ----
  const gmOpenBtn = document.getElementById('openDiceBtn');

  if (gmOpenBtn) {
    // Modo Mestre: usa o botão existente no painel / barra
    gmOpenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDice(e);
    });
    // Remove o botão flutuante no desktop do mestre, mas mantém compatibilidade
    if (diceBtn.parentNode && !isMobile()) {
      diceBtn.parentNode.removeChild(diceBtn);
    }
  } else {
    // Modo Jogador: mostra o botão flutuante ("bolinha") quando conectar
    document.addEventListener('rpg:connected', () => diceBtn.classList.remove('hidden'));
    setTimeout(() => {
      const vp = document.getElementById('viewport');
      if (vp && !vp.classList.contains('hidden')) diceBtn.classList.remove('hidden');
    }, 2500);
  }

  selectFaces(20);
  applyCustomStyles();
  updateConfigBadge();

  // Observa troca de tema global da mesa
  const themeObserver = new MutationObserver(() => {
    if (customColor === 'theme') applyCustomStyles();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', (e) => {
    if (e.key === 'rpg-table-theme' && customColor === 'theme') applyCustomStyles();
  });

  // Expõe API para abrir rolagem programaticamente
  // @ts-ignore
  window.RPG = window.RPG || {};
  // @ts-ignore
  window.RPG.openDice = openDice;
  // @ts-ignore
  window.RPG.closeDice = closeDice;
  // @ts-ignore
  window.RPG.toggleDice = toggleDice;
})();
