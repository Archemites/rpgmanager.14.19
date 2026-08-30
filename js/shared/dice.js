// @ts-ignore
import DiceBox from 'https://cdn.jsdelivr.net/npm/@drdreo/dice-box-threejs@1.1.0/dist/dice-box-threejs.es.js';
import { isAndroidOrIOS } from './mobile.js';

/* ============================================================
   Player & GM dice roller — motor 3D perfeitamente sincronizado via WebRTC
   - PC: layout clássico de gaveta inferior
   - Mobile (Android / iOS): Speed-Dial flutuante
   - Sincronização determinística: os dados 3D em TODAS as telas (Mestre e Jogadores)
     são armados para cair exatamente no mesmo lado/resultado apurado na rolagem!
   - Personalização completa: tamanho do dado (slider), cor do dado e cor dos números/texto.
   - Mestre (GM): opção de "Rolagem Secreta / Oculta" para rolar sem
     exibir aos jogadores quando desejar.
   ============================================================ */

(() => {
  'use strict';

  // ---- Identificação Mestre vs Jogador ----
  function checkIsGM() {
    return Boolean(
      (window.RPG && window.RPG.isGM) ||
      document.getElementById('openInviteBtn') ||
      document.getElementById('openDiceBtn')
    );
  }

  // ---- Configuração de dados ----
  const FACES = [4, 6, 8, 10, 12, 20, 100];
  let selectedFaces = 20;
  let currentRollMode = 'normal'; // 'normal' | 'adv' | 'dis'

  // ---- Rolagem Secreta / Oculta do Mestre ----
  const STORAGE_KEY_SECRET = 'rpg-gm-secret-dice';
  let isSecretRoll = false;
  try {
    isSecretRoll = localStorage.getItem(STORAGE_KEY_SECRET) === 'true';
  } catch (_) {}

  // ---- Paleta de Cores do Dado (Totalmente Independente do Tema) ----
  const DEFAULT_DICE_COLOR = '#e63946';
  const DEFAULT_TEXT_COLOR = 'auto';

  const COLOR_PALETTE = [
    { label: 'Vermelho Carmim', value: '#e63946' },
    { label: 'Dourado Imperial', value: '#f5b342' },
    { label: 'Verde Esmeralda', value: '#45ff78' },
    { label: 'Azul Glacial', value: '#38bdf8' },
    { label: 'Roxo Arcano', value: '#a855f7' },
    { label: 'Ciano Etéreo', value: '#06b6d4' },
    { label: 'Laranja Fogo', value: '#ff7b00' },
    { label: 'Rosa Neon', value: '#f43f5e' },
    { label: 'Branco Puro', value: '#ffffff' },
    { label: 'Preto Ônix', value: '#222222' }
  ];

  // ---- Paleta de Cores do Texto / Números ----
  const TEXT_COLOR_PALETTE = [
    { label: 'Auto (Contraste)', value: 'auto', color: 'transparent', isAuto: true },
    { label: 'Branco Puro', value: '#ffffff' },
    { label: 'Preto Ônix', value: '#111111' },
    { label: 'Dourado Imperial', value: '#f5b342' },
    { label: 'Amarelo Ouro', value: '#facc15' },
    { label: 'Verde Neon', value: '#45ff78' },
    { label: 'Ciano Etéreo', value: '#06b6d4' },
    { label: 'Azul Celeste', value: '#38bdf8' },
    { label: 'Vermelho Fogo', value: '#e63946' },
    { label: 'Rosa Magenta', value: '#f43f5e' },
    { label: 'Roxo Arcano', value: '#a855f7' }
  ];

  const STORAGE_KEY_COLOR = 'rpg-dice-color';
  const STORAGE_KEY_TEXT_COLOR = 'rpg-dice-text-color';
  const STORAGE_KEY_SCALE = 'rpg-dice-scale';

  let customColor = DEFAULT_DICE_COLOR;
  let customTextColor = DEFAULT_TEXT_COLOR;
  let customScale = 6;

  try {
    const savedColor = localStorage.getItem(STORAGE_KEY_COLOR);
    if (savedColor && savedColor !== 'theme' && /^#[0-9a-fA-F]{3,6}$/.test(savedColor)) {
      customColor = savedColor;
    } else {
      customColor = DEFAULT_DICE_COLOR;
    }
    customTextColor = localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || DEFAULT_TEXT_COLOR;
    const savedScale = localStorage.getItem(STORAGE_KEY_SCALE);
    if (savedScale) customScale = Math.min(14, Math.max(2, Number(savedScale) || 6));
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

  // ---- Injeta Canvas 3D Compartilhado em Tela Cheia ----
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
    document.body.appendChild(boxCanvas);
  }

  // Verifica se é estritamente Android ou iOS
  const isMobileOS = isAndroidOrIOS();
  const isGM = checkIsGM();

  // ============================================================
  // MODO 1: MOBILE (ANDROID / IOS) — SPEED-DIAL FLUTUANTE
  // ============================================================
  if (isMobileOS) {
    const mobileWrap = document.createElement('div');
    mobileWrap.id = 'playerDiceMobileWrap';
    mobileWrap.className = 'player-dice-mobile-wrap';
    mobileWrap.innerHTML = `
      <!-- Linha Superior: Controles à Esquerda + Bolinha -->
      <div class="player-dice-mobile-header">
        
        <!-- Controles à Esquerda da Bolinha -->
        <div id="mobileSideControls" class="player-dice-mobile-side collapsed">
          
          <!-- Botão Secreto/Oculto (apenas Mestre) -->
          ${isGM ? `
            <button type="button" id="mobileGmSecretBtn" class="mobile-control-btn secret-btn ${isSecretRoll ? 'secret' : 'public'}" title="Alternar visibilidade para os jogadores">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span id="mobileSecretLabel">${isSecretRoll ? 'OCULTO' : 'PÚBLICO'}</span>
            </button>
          ` : ''}

          <!-- Modo de Rolagem com Subdrop -->
          <div class="mobile-mode-dropdown-wrap">
            <button type="button" id="mobileModeBtn" class="mobile-control-btn mode-btn" title="Modo de Rolagem">
              <span id="mobileModeLabel">NORMAL</span>
              <svg class="mode-arrow" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            
            <!-- Menu do Subdrop de Modo -->
            <div id="mobileModeMenu" class="mobile-subdrop-menu hidden">
              <button type="button" class="mobile-subdrop-item active" data-mode="normal">
                <span class="mode-dot normal"></span>
                <span>Normal</span>
              </button>
              <button type="button" class="mobile-subdrop-item" data-mode="adv">
                <span class="mode-dot adv"></span>
                <span>Vantagem (ADV)</span>
              </button>
              <button type="button" class="mobile-subdrop-item" data-mode="dis">
                <span class="mode-dot dis"></span>
                <span>Desvantagem (DIS)</span>
              </button>
            </div>
          </div>

          <!-- Quantidade (Qtd) com Stepper -->
          <div class="mobile-stepper-pill" title="Quantidade de dados">
            <span class="pill-label">Qtd</span>
            <button type="button" id="mobileCountDec" class="pill-btn">−</button>
            <input type="number" id="mobileCountInput" min="1" max="20" value="1" title="Qtd">
            <button type="button" id="mobileCountInc" class="pill-btn">+</button>
          </div>

          <!-- Modificador (Mod) com Stepper -->
          <div class="mobile-stepper-pill" title="Modificador numérico">
            <span class="pill-label">Mod</span>
            <button type="button" id="mobileModDec" class="pill-btn">−</button>
            <input type="number" id="mobileModInput" min="-99" max="99" value="0" title="Mod">
            <button type="button" id="mobileModInc" class="pill-btn">+</button>
          </div>

        </div>

        <!-- A Bolinha (Botão Principal) -->
        <button type="button" id="mobileDiceBtn" class="player-dice-circle-btn" title="Rolar dados" aria-label="Rolar dados">
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

      <!-- Coluna Vertical de Dados (Abaixo da Bolinha) -->
      <div id="mobileDiceColumn" class="player-dice-mobile-column collapsed">
        ${FACES.map(f => `
          <button type="button" class="mobile-dice-col-btn" data-faces="${f}" title="Rolar d${f}">
            <span class="dice-col-svg">${DICE_SVGS[f]}</span>
            <span class="dice-col-label">d${f}</span>
          </button>
        `).join('')}

        <!-- Engrenagem no Final da Coluna -->
        <button type="button" id="mobileSettingsBtn" class="mobile-dice-col-btn settings-btn" title="Personalizar dados 3D">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <!-- Popover de Configurações da Engrenagem -->
      <div id="mobileSettingsPanel" class="mobile-settings-popover collapsed">
        <div class="settings-popover-header">
          <span>Aparência dos Dados 3D</span>
          <button type="button" id="mobileSettingsClose" class="settings-popover-close">✕</button>
        </div>

        <!-- 1. Tamanho -->
        <div class="settings-row">
          <div class="settings-label-row">
            <span class="settings-label">Tamanho do Dado</span>
            <span id="mobileScaleVal" class="settings-val">100%</span>
          </div>
          <input type="range" id="mobileScaleInput" min="2" max="14" value="6" step="0.5">
        </div>
        
        <!-- 2. Cor do Dado -->
        <div class="settings-row">
          <div class="settings-label-row">
            <span class="settings-label">Cor do Dado</span>
            <button type="button" id="mobileResetBtn" class="reset-theme-btn" title="Restaurar cor padrão do dado">Padrão</button>
          </div>
          <div class="settings-color-bar">
            <div class="color-picker-dot" title="Espectro de Cores">
              <input type="color" id="mobileColorPicker" value="#45ff78">
            </div>
            <div id="mobilePickerPreview" class="color-preview-dot"></div>
            <div class="color-hex-field">
              <span class="hex-prefix">#</span>
              <input type="text" id="mobileHexInput" maxlength="6" placeholder="45FF78" spellcheck="false">
            </div>
          </div>
          <div class="color-presets-grid" id="mobileColorGrid"></div>
        </div>

        <!-- 3. Cor dos Números / Texto -->
        <div class="settings-row">
          <div class="settings-label-row">
            <span class="settings-label">Cor dos Números / Texto</span>
            <button type="button" id="mobileTextAutoBtn" class="reset-theme-btn" title="Contraste automático">Auto</button>
          </div>
          <div class="settings-color-bar">
            <div class="color-picker-dot" title="Espectro de Cores dos Números">
              <input type="color" id="mobileTextColorPicker" value="#ffffff">
            </div>
            <div id="mobileTextPickerPreview" class="color-preview-dot"></div>
            <div class="color-hex-field">
              <span class="hex-prefix">#</span>
              <input type="text" id="mobileTextHexInput" maxlength="6" placeholder="FFFFFF" spellcheck="false">
            </div>
          </div>
          <div class="color-presets-grid" id="mobileTextColorGrid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(mobileWrap);

    // Referências DOM Mobile
    const mobileBtn = document.getElementById('mobileDiceBtn');
    const mobileSide = document.getElementById('mobileSideControls');
    const mobileCol = document.getElementById('mobileDiceColumn');
    const mSettingsBtn = document.getElementById('mobileSettingsBtn');
    const mSettingsPanel = document.getElementById('mobileSettingsPanel');
    const mSettingsClose = document.getElementById('mobileSettingsClose');

    const mModeBtn = document.getElementById('mobileModeBtn');
    const mModeLabel = document.getElementById('mobileModeLabel');
    const mModeMenu = document.getElementById('mobileModeMenu');
    const mModeItems = mobileWrap.querySelectorAll('.mobile-subdrop-item');

    const mCountInput = /** @type {HTMLInputElement} */ (document.getElementById('mobileCountInput'));
    const mCountDec = document.getElementById('mobileCountDec');
    const mCountInc = document.getElementById('mobileCountInc');

    const mModInput = /** @type {HTMLInputElement} */ (document.getElementById('mobileModInput'));
    const mModDec = document.getElementById('mobileModDec');
    const mModInc = document.getElementById('mobileModInc');

    const mColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('mobileColorPicker'));
    const mPreview = document.getElementById('mobilePickerPreview');
    const mHexInput = /** @type {HTMLInputElement} */ (document.getElementById('mobileHexInput'));
    const mScaleInput = /** @type {HTMLInputElement} */ (document.getElementById('mobileScaleInput'));
    const mScaleVal = document.getElementById('mobileScaleVal');
    const mColorGrid = document.getElementById('mobileColorGrid');
    const mResetBtn = document.getElementById('mobileResetBtn');

    const mTextColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('mobileTextColorPicker'));
    const mTextPreview = document.getElementById('mobileTextPickerPreview');
    const mTextHexInput = /** @type {HTMLInputElement} */ (document.getElementById('mobileTextHexInput'));
    const mTextColorGrid = document.getElementById('mobileTextColorGrid');
    const mTextAutoBtn = document.getElementById('mobileTextAutoBtn');

    const mGmSecretBtn = document.getElementById('mobileGmSecretBtn');
    const mSecretLabel = document.getElementById('mobileSecretLabel');

    if (mGmSecretBtn) {
      mGmSecretBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isSecretRoll = !isSecretRoll;
        try { localStorage.setItem(STORAGE_KEY_SECRET, String(isSecretRoll)); } catch (_) {}
        mGmSecretBtn.className = `mobile-control-btn secret-btn ${isSecretRoll ? 'secret' : 'public'}`;
        if (mSecretLabel) mSecretLabel.textContent = isSecretRoll ? 'OCULTO' : 'PÚBLICO';
      });
    }

    let isExpanded = false;
    function toggleMobileDrop(force) {
      isExpanded = typeof force === 'boolean' ? force : !isExpanded;
      mobileWrap.classList.toggle('open', isExpanded);
      mobileBtn.classList.toggle('active', isExpanded);
      mobileSide.classList.toggle('collapsed', !isExpanded);
      mobileCol.classList.toggle('collapsed', !isExpanded);

      if (!isExpanded) {
        mModeMenu.classList.add('hidden');
        mSettingsPanel.classList.add('collapsed');
        mSettingsBtn.classList.remove('active');
      }
    }

    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileDrop();
    });

    mModeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mModeMenu.classList.toggle('hidden');
    });

    function setMobileMode(mode) {
      currentRollMode = mode;
      mModeItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-mode') === mode);
      });

      if (mode === 'adv') {
        mModeLabel.textContent = 'VANTAGEM';
        mModeBtn.className = 'mobile-control-btn mode-btn adv';
        if (parseInt(mCountInput.value, 10) === 1) mCountInput.value = '2';
      } else if (mode === 'dis') {
        mModeLabel.textContent = 'DESVANTAGEM';
        mModeBtn.className = 'mobile-control-btn mode-btn dis';
        if (parseInt(mCountInput.value, 10) === 1) mCountInput.value = '2';
      } else {
        mModeLabel.textContent = 'NORMAL';
        mModeBtn.className = 'mobile-control-btn mode-btn normal';
      }
      mModeMenu.classList.add('hidden');
    }

    mModeItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setMobileMode(item.getAttribute('data-mode') || 'normal');
      });
    });

    mCountDec.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mCountInput.value, 10) || 1;
      if (val > 1) mCountInput.value = String(val - 1);
    });

    mCountInc.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mCountInput.value, 10) || 1;
      if (val < 20) mCountInput.value = String(val + 1);
    });

    mModDec.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mModInput.value, 10) || 0;
      if (val > -99) mModInput.value = String(val - 1);
    });

    mModInc.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mModInput.value, 10) || 0;
      if (val < 99) mModInput.value = String(val + 1);
    });

    mSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCol = mSettingsPanel.classList.toggle('collapsed');
      mSettingsBtn.classList.toggle('active', !isCol);
    });

    mSettingsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      mSettingsPanel.classList.add('collapsed');
      mSettingsBtn.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!mobileWrap.contains(/** @type {Node} */ (e.target))) {
        toggleMobileDrop(false);
      }
    });

    mobileWrap.querySelectorAll('.mobile-dice-col-btn[data-faces]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const faces = Number(/** @type {HTMLElement} */ (btn).dataset.faces);
        const count = Math.min(20, Math.max(1, parseInt(mCountInput.value, 10) || 1));
        const mod = parseInt(mModInput.value, 10) || 0;

        if (checkIsGM()) {
          gmRoll(faces, count, mod);
        } else {
          playerRoll(faces, count, mod);
        }
      });
    });

    mColorPicker?.addEventListener('input', () => {
      customColor = mColorPicker.value;
      saveAndApplyStyles();
    });

    mHexInput?.addEventListener('input', () => {
      let raw = mHexInput.value.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 6) {
        customColor = '#' + raw;
        saveAndApplyStyles();
      }
    });
    mHexInput?.addEventListener('change', () => {
      let raw = mHexInput.value.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 3) {
        customColor = '#' + raw.split('').map(c => c + c).join('');
        saveAndApplyStyles();
      } else if (raw.length === 6) {
        customColor = '#' + raw;
        saveAndApplyStyles();
      } else {
        applyCustomStyles();
      }
    });

    mTextColorPicker?.addEventListener('input', () => {
      customTextColor = mTextColorPicker.value;
      saveAndApplyStyles();
    });

    mTextHexInput?.addEventListener('input', () => {
      let val = mTextHexInput.value.trim().toLowerCase();
      if (val === 'auto') {
        customTextColor = 'auto';
        saveAndApplyStyles();
        return;
      }
      let raw = val.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 6) {
        customTextColor = '#' + raw;
        saveAndApplyStyles();
      }
    });
    mTextHexInput?.addEventListener('change', () => {
      let val = mTextHexInput.value.trim().toLowerCase();
      if (val === 'auto') {
        customTextColor = 'auto';
        saveAndApplyStyles();
        return;
      }
      let raw = val.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 3) {
        customTextColor = '#' + raw.split('').map(c => c + c).join('');
        saveAndApplyStyles();
      } else if (raw.length === 6) {
        customTextColor = '#' + raw;
        saveAndApplyStyles();
      } else {
        applyCustomStyles();
      }
    });

    mTextAutoBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      customTextColor = 'auto';
      saveAndApplyStyles();
    });

    mScaleInput?.addEventListener('input', () => {
      customScale = Number(mScaleInput.value) || 6;
      saveAndApplyStyles();
    });

    mResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      customColor = DEFAULT_DICE_COLOR;
      saveAndApplyStyles();
    });

    // GM vs Player no Mobile
    const gmBtn = document.getElementById('openDiceBtn');
    if (gmBtn) {
      gmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileDrop();
      });
    } else {
      document.addEventListener('rpg:connected', () => mobileWrap.classList.remove('hidden'));
      setTimeout(() => {
        const vp = document.getElementById('viewport');
        if (vp && !vp.classList.contains('hidden')) mobileWrap.classList.remove('hidden');
      }, 2500);
    }
  }

  // ============================================================
  // MODO 2: PC / DESKTOP — LAYOUT CLÁSSICO DE GAVETA INFERIOR
  // ============================================================
  let desktopOverlay = null;
  let desktopPanel = null;
  let desktopSettingsDrawer = null;
  let desktopSettingsBtn = null;
  let desktopColorPicker = null;
  let desktopActivePreview = null;
  let desktopHexInput = null;
  let desktopTextColorPicker = null;
  let desktopTextActivePreview = null;
  let desktopTextHexInput = null;
  let desktopTextColorGrid = null;
  let desktopTextAutoBtn = null;
  let desktopScaleInput = null;
  let desktopScaleVal = null;
  let desktopColorGrid = null;
  let desktopResetBtn = null;

  let desktopFaceButtons = null;
  let desktopCountInput = null;
  let desktopModeSelect = null;
  let desktopModInput = null;
  let desktopRollBtn = null;
  let desktopGmSecretCheck = null;

  if (!isMobileOS) {
    const pcDiceBtn = document.createElement('button');
    pcDiceBtn.id = 'playerDiceBtn';
    pcDiceBtn.title = 'Rolar dados';
    pcDiceBtn.innerHTML = `
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
    pcDiceBtn.classList.add('hidden');
    document.body.appendChild(pcDiceBtn);

    desktopOverlay = document.createElement('div');
    desktopOverlay.id = 'playerDiceOverlay';
    desktopOverlay.innerHTML = `
      <div id="playerDicePanel" class="player-dice-panel">
        <div class="player-dice-top-bar">
          <div class="player-dice-handle"></div>
          <button type="button" id="playerDiceSettingsBtn" class="player-dice-settings-btn" title="Personalizar cor e aparência dos dados 3D">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        <div id="playerDiceSettingsDrawer" class="player-dice-settings-drawer">
          <!-- 1. Tamanho do Dado -->
          <div class="player-dice-scale-row">
            <div class="player-dice-scale-header">
              <span class="player-dice-scale-title">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <input type="range" id="playerDiceScaleInput" min="2" max="14" value="6" step="0.5">
            </div>
          </div>

          <!-- 2. Cor do Dado -->
          <div class="player-dice-settings-title">
            <span>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2C6.49 2 2 6.49 2 12c0 3.87 2.33 7.2 5.67 8.65.6.26 1.33-.19 1.33-.85v-.8c0-.55.45-1 1-1h1.5c3.58 0 6.5-2.92 6.5-6.5 0-4.96-2.69-9.5-6-9.5z" />
                <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
                <circle cx="11" cy="7.5" r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="9" r="1.5" fill="currentColor" />
                <circle cx="16.5" cy="13.5" r="1.5" fill="currentColor" />
              </svg>
              Cor do Dado
            </span>
            <button type="button" class="player-dice-settings-reset" id="playerDiceResetBtn" title="Restaurar cor padrão do dado">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Padrão</span>
            </button>
          </div>

          <div class="player-dice-picker-row">
            <div class="player-dice-color-picker-wrap" title="Clique para abrir a paleta de cores do dado">
              <input type="color" id="playerDiceColorPicker" value="#45ff78">
            </div>
            <div class="player-dice-active-preview" id="playerDicePickerPreview" title="Cor ativa do dado"></div>
            <div class="player-dice-hex-wrap">
              <span class="player-dice-hex-prefix">#</span>
              <input type="text" id="playerDiceHexInput" class="player-dice-hex-input" maxlength="6" placeholder="45FF78" spellcheck="false" title="Código HEX">
            </div>
            <span class="player-dice-picker-hint">Código HEX</span>
          </div>
          <div class="player-dice-presets-label">Presets rápidos do dado:</div>
          <div class="player-dice-color-grid" id="playerDiceColorGrid"></div>

          <!-- 3. Cor dos Números / Texto -->
          <div class="player-dice-settings-title" style="margin-top: 14px;">
            <span>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 7 4 4 20 4 20 7"/>
                <line x1="9" y1="20" x2="15" y2="20"/>
                <line x1="12" y1="4" x2="12" y2="20"/>
              </svg>
              Cor dos Números / Texto
            </span>
            <button type="button" class="player-dice-settings-reset" id="playerDiceTextAutoBtn" title="Contraste automático com a cor do dado">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>
              </svg>
              <span>Auto</span>
            </button>
          </div>

          <div class="player-dice-picker-row">
            <div class="player-dice-color-picker-wrap" title="Clique para abrir a paleta de cores dos números">
              <input type="color" id="playerDiceTextColorPicker" value="#ffffff">
            </div>
            <div class="player-dice-active-preview" id="playerDiceTextPickerPreview" title="Cor ativa dos números"></div>
            <div class="player-dice-hex-wrap">
              <span class="player-dice-hex-prefix">#</span>
              <input type="text" id="playerDiceTextHexInput" class="player-dice-hex-input" maxlength="6" placeholder="FFFFFF" spellcheck="false" title="Código HEX dos números">
            </div>
            <span class="player-dice-picker-hint">Código HEX</span>
          </div>
          <div class="player-dice-presets-label">Presets rápidos dos números:</div>
          <div class="player-dice-color-grid" id="playerDiceTextColorGrid"></div>
        </div>

        <div class="player-dice-controls">
          <div id="playerDiceFaces" class="player-dice-faces">
            ${FACES.map(f => `
              <button type="button" class="player-dice-face-btn ${f === 20 ? 'active' : ''}" data-faces="${f}" title="Selecionar d${f}">
                <span class="player-dice-face-svg">${DICE_SVGS[f]}</span>
                <span class="player-dice-face-text">d${f}</span>
              </button>
            `).join('')}
          </div>

          <!-- Opção Secreta para o Mestre no PC -->
          <div id="gmSecretDiceRow" class="player-dice-secret-row ${isGM ? '' : 'hidden'}">
            <label class="player-dice-secret-toggle" title="Se marcado, a rolagem só aparece na tela do mestre (oculta dos jogadores)">
              <input type="checkbox" id="gmSecretDiceCheckbox" ${isSecretRoll ? 'checked' : ''}>
              <span class="secret-toggle-switch"></span>
              <span class="secret-toggle-text">Rolagem Secreta / Oculta (somente Mestre)</span>
            </label>
          </div>
          
          <div class="player-dice-row">
            <div class="player-dice-input-col left">
              <select id="playerDiceMode" class="player-dice-select" title="Modo de rolagem">
                <option value="normal">Normal</option>
                <option value="adv">Vantagem</option>
                <option value="dis">Desvantagem</option>
              </select>
              <div class="player-dice-input-group">
                <label for="playerDiceCount">Qtd</label>
                <input type="number" id="playerDiceCount" min="1" max="20" value="1">
              </div>
            </div>
            
            <button type="button" id="playerDiceRollBtn">
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
    document.body.appendChild(desktopOverlay);

    // Referências DOM Desktop
    desktopPanel = document.getElementById('playerDicePanel');
    desktopSettingsBtn = document.getElementById('playerDiceSettingsBtn');
    desktopSettingsDrawer = document.getElementById('playerDiceSettingsDrawer');
    
    // Cor do Dado
    desktopColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceColorPicker'));
    desktopActivePreview = document.getElementById('playerDicePickerPreview');
    desktopHexInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceHexInput'));
    desktopColorGrid = document.getElementById('playerDiceColorGrid');
    desktopResetBtn = document.getElementById('playerDiceResetBtn');

    // Cor dos Números
    desktopTextColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceTextColorPicker'));
    desktopTextActivePreview = document.getElementById('playerDiceTextPickerPreview');
    desktopTextHexInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceTextHexInput'));
    desktopTextColorGrid = document.getElementById('playerDiceTextColorGrid');
    desktopTextAutoBtn = document.getElementById('playerDiceTextAutoBtn');

    // Escala
    desktopScaleInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceScaleInput'));
    desktopScaleVal = document.getElementById('playerDiceScaleVal');

    desktopFaceButtons = desktopOverlay.querySelectorAll('.player-dice-face-btn');
    desktopCountInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceCount'));
    desktopModeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('playerDiceMode'));
    desktopModInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceMod'));
    desktopRollBtn = document.getElementById('playerDiceRollBtn');
    desktopGmSecretCheck = /** @type {HTMLInputElement} */ (document.getElementById('gmSecretDiceCheckbox'));

    desktopGmSecretCheck?.addEventListener('change', () => {
      isSecretRoll = desktopGmSecretCheck.checked;
      try { localStorage.setItem(STORAGE_KEY_SECRET, String(isSecretRoll)); } catch (_) {}
    });

    desktopModeSelect?.addEventListener('change', () => {
      currentRollMode = desktopModeSelect.value || 'normal';
      if ((currentRollMode === 'adv' || currentRollMode === 'dis') && parseInt(desktopCountInput.value, 10) === 1) {
        desktopCountInput.value = '2';
      }
    });

    desktopSettingsBtn?.addEventListener('click', () => {
      const isOpen = desktopSettingsDrawer?.classList.toggle('open');
      desktopSettingsBtn.classList.toggle('active', isOpen);
    });

    desktopColorPicker?.addEventListener('input', () => {
      customColor = desktopColorPicker.value;
      saveAndApplyStyles();
    });

    desktopHexInput?.addEventListener('input', () => {
      let raw = desktopHexInput.value.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 6) {
        customColor = '#' + raw;
        saveAndApplyStyles();
      }
    });
    desktopHexInput?.addEventListener('change', () => {
      let raw = desktopHexInput.value.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 3) {
        customColor = '#' + raw.split('').map(c => c + c).join('');
        saveAndApplyStyles();
      } else if (raw.length === 6) {
        customColor = '#' + raw;
        saveAndApplyStyles();
      } else {
        applyCustomStyles();
      }
    });

    desktopTextColorPicker?.addEventListener('input', () => {
      customTextColor = desktopTextColorPicker.value;
      saveAndApplyStyles();
    });

    desktopTextHexInput?.addEventListener('input', () => {
      let val = desktopTextHexInput.value.trim().toLowerCase();
      if (val === 'auto') {
        customTextColor = 'auto';
        saveAndApplyStyles();
        return;
      }
      let raw = val.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 6) {
        customTextColor = '#' + raw;
        saveAndApplyStyles();
      }
    });
    desktopTextHexInput?.addEventListener('change', () => {
      let val = desktopTextHexInput.value.trim().toLowerCase();
      if (val === 'auto') {
        customTextColor = 'auto';
        saveAndApplyStyles();
        return;
      }
      let raw = val.replace(/[^0-9a-fA-F]/g, '');
      if (raw.length === 3) {
        customTextColor = '#' + raw.split('').map(c => c + c).join('');
        saveAndApplyStyles();
      } else if (raw.length === 6) {
        customTextColor = '#' + raw;
        saveAndApplyStyles();
      } else {
        applyCustomStyles();
      }
    });

    desktopTextAutoBtn?.addEventListener('click', () => {
      customTextColor = 'auto';
      saveAndApplyStyles();
    });

    desktopScaleInput?.addEventListener('input', () => {
      customScale = Number(desktopScaleInput.value) || 6;
      saveAndApplyStyles();
    });

    desktopResetBtn?.addEventListener('click', () => {
      customColor = DEFAULT_DICE_COLOR;
      saveAndApplyStyles();
    });

    function selectFacesDesktop(faces) {
      selectedFaces = faces;
      desktopFaceButtons.forEach(btn => {
        btn.classList.toggle('active', Number(/** @type {HTMLElement} */ (btn).dataset.faces) === faces);
      });
    }

    desktopFaceButtons.forEach(btn => {
      btn.addEventListener('click', () => selectFacesDesktop(Number(/** @type {HTMLElement} */ (btn).dataset.faces)));
    });

    desktopRollBtn?.addEventListener('click', () => {
      const count = Math.min(20, Math.max(1, parseInt(desktopCountInput.value, 10) || 1));
      const mod = parseInt(desktopModInput.value, 10) || 0;
      currentRollMode = desktopModeSelect?.value || 'normal';

      if (checkIsGM()) {
        gmRoll(selectedFaces, count, mod);
      } else {
        playerRoll(selectedFaces, count, mod);
      }
    });

    function openDesktopDice() {
      applyCustomStyles();
      const isGMActive = checkIsGM();
      const secretRow = document.getElementById('gmSecretDiceRow');
      if (secretRow) secretRow.classList.toggle('hidden', !isGMActive);

      desktopOverlay.classList.add('open');
      initBox();
    }

    function closeDesktopDice() {
      desktopOverlay.classList.remove('open');
      clearSettledDice();
    }

    pcDiceBtn.addEventListener('click', openDesktopDice);
    desktopOverlay.addEventListener('click', (e) => {
      if (e.target === desktopOverlay) closeDesktopDice();
    });

    // GM vs Player no Desktop
    const gmBtn = document.getElementById('openDiceBtn');
    if (gmBtn) {
      gmBtn.addEventListener('click', openDesktopDice);
      if (pcDiceBtn.parentNode) pcDiceBtn.parentNode.removeChild(pcDiceBtn);
    } else {
      document.addEventListener('rpg:connected', () => pcDiceBtn.classList.remove('hidden'));
      setTimeout(() => {
        const vp = document.getElementById('viewport');
        if (vp && !vp.classList.contains('hidden')) pcDiceBtn.classList.remove('hidden');
      }, 2500);
    }
  }

  // ============================================================
  // MOTOR 3D & CONFIGURAÇÃO COMPARTILHADA
  // ============================================================
  let hasSettledDice = false;

  function clearSettledDice() {
    if (Box && isBoxReady) {
      try {
        Box.clearDice();
      } catch (_) {}
    }
    if (boxCanvas) {
      boxCanvas.classList.remove('settled');
    }
    hasSettledDice = false;
  }

  // Desaparece com os dados ao clicar em qualquer lugar da tela após a rolagem
  document.addEventListener('pointerdown', (e) => {
    if (!hasSettledDice || isRolling) return;
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target) return;

    const isDesktopPanel = desktopPanel && desktopPanel.contains(target);
    const mobilePanel = document.getElementById('playerDiceMobileWrap');
    const isMobileWrap = mobilePanel && mobilePanel.contains(target);
    const isPcBtn = document.getElementById('playerDiceBtn')?.contains(target);
    const isGmBtn = document.getElementById('openDiceBtn')?.contains(target);

    if (!isDesktopPanel && !isMobileWrap && !isPcBtn && !isGmBtn) {
      clearSettledDice();
    }
  }, true);

  function getLocalCharacterName() {
    if (checkIsGM()) return 'Mestre';
    let name = '';
    try {
      name = localStorage.getItem('rpg-player-name') || '';
    } catch (_) {}
    if (!name) {
      const el = /** @type {HTMLInputElement} */ (document.getElementById('entryNameInput'));
      if (el && el.value.trim()) name = el.value.trim();
    }
    return name || 'Jogador';
  }

  function getEffectiveDiceColor() {
    if (customColor && customColor !== 'theme') {
      let c = String(customColor).trim();
      if (!c.startsWith('#')) c = '#' + c;
      if (c.length === 4) {
        c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      }
      if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
    }
    return DEFAULT_DICE_COLOR;
  }

  function getContrastTextColor(hex) {
    if (!hex || hex === 'theme') return '#ffffff';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return '#ffffff';
    const r = parseInt(c.slice(0, 2), 16) || 0;
    const g = parseInt(c.slice(2, 4), 16) || 0;
    const b = parseInt(c.slice(4, 6), 16) || 0;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#111111' : '#ffffff';
  }

  function getEffectiveTextColor() {
    if (customTextColor && customTextColor !== 'auto') {
      let c = String(customTextColor).trim();
      if (!c.startsWith('#')) c = '#' + c;
      if (c.length === 4) {
        c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      }
      return c;
    }
    return getContrastTextColor(getEffectiveDiceColor());
  }

  function createBoxColorset(colorHex, textColorHex) {
    const effColor = colorHex || getEffectiveDiceColor();
    const effTextColor = textColorHex || getEffectiveTextColor();
    return {
      name: 'clr_' + effColor.replace(/[^a-zA-Z0-9]/g, '') + '_' + effTextColor.replace(/[^a-zA-Z0-9]/g, '') + '_' + Date.now(),
      foreground: effTextColor,
      background: effColor,
      outline: 'none',
      texture: 'none',
      material: 'plastic'
    };
  }

  function patchDiceFactory(factory) {
    if (!factory || factory.__dicePatched) return;
    factory.__dicePatched = true;

    // Garante que todas as definições de dados tenham uma família de fontes válida
    const diceKeys = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'd2'];
    diceKeys.forEach(k => {
      try {
        const def = factory.get(k);
        if (def && !def.font) def.font = 'sans-serif';
      } catch (_) {}
    });

    const origGet = factory.get.bind(factory);
    factory.get = function(type) {
      const def = origGet(type);
      if (def && !def.font) def.font = 'sans-serif';
      return def;
    };

    // Material neutro puro para manter 100% da saturação e fidelidade da cor selecionada
    factory.material_options = {
      specular: 0x111111,
      color: 0xffffff,
      shininess: 6,
      flatShading: false
    };
  }

  function calibrateSceneLighting(box) {
    if (!box) return;
    if (box.renderer) {
      // 0 = THREE.NoToneMapping: renderização 1:1 sem compressão de brilho ou desvio de matiz
      box.renderer.toneMapping = 0;
    }
    if (box.light_amb) {
      box.light_amb.color.setHex(0xffffff);
      if (box.light_amb.groundColor) box.light_amb.groundColor.setHex(0xffffff);
      box.light_amb.intensity = 1.35;
    }
    if (box.light) {
      box.light.color.setHex(0xffffff);
      box.light.intensity = 1.05;
    }
    if (box.scene) {
      box.scene.traverse((obj) => {
        if (obj.isLight) {
          if (obj.color && typeof obj.color.setHex === 'function') {
            obj.color.setHex(0xffffff); // Luz branca neutra pura (sem tons quentes/amarelados)
          }
          if (obj.groundColor && typeof obj.groundColor.setHex === 'function') {
            obj.groundColor.setHex(0xffffff);
          }
        }
      });
    }
  }

  function applyScaleToBox(scaleVal) {
    if (!Box) return;
    const s = scaleVal !== undefined ? scaleVal : customScale;
    const baseScaleVal = Math.round((s / 6) * 100);
    Box.baseScale = baseScaleVal;
    if (Box.DiceFactory) {
      Box.DiceFactory.baseScale = baseScaleVal;
      Box.DiceFactory.geometries = {};
      Box.DiceFactory.materials_cache = {};
    }
  }

  function saveAndApplyStyles() {
    try {
      localStorage.setItem(STORAGE_KEY_COLOR, customColor);
      localStorage.setItem(STORAGE_KEY_TEXT_COLOR, customTextColor);
      localStorage.setItem(STORAGE_KEY_SCALE, String(customScale));
    } catch (e) {}
    applyCustomStyles();
    updateBoxAppearance();
  }

  function applyCustomStyles() {
    const effColor = getEffectiveDiceColor();
    const effTextColor = getEffectiveTextColor();

    // 1. Desktop Panel
    if (desktopPanel) {
      desktopPanel.style.setProperty('--dice-active-color', effColor);
      
      // Dado preview & inputs
      if (desktopActivePreview) {
        desktopActivePreview.style.background = effColor;
        desktopActivePreview.style.boxShadow = `0 0 10px ${effColor}`;
      }
      if (desktopColorPicker && /^#[0-9a-fA-F]{6}$/.test(effColor)) {
        desktopColorPicker.value = effColor;
      }
      if (desktopHexInput && document.activeElement !== desktopHexInput) {
        desktopHexInput.value = effColor.replace(/^#/, '').toUpperCase();
      }

      // Números preview & inputs
      if (desktopTextActivePreview) {
        desktopTextActivePreview.style.background = effTextColor;
        desktopTextActivePreview.style.boxShadow = `0 0 10px ${effTextColor}`;
      }
      if (desktopTextColorPicker && /^#[0-9a-fA-F]{6}$/.test(effTextColor)) {
        desktopTextColorPicker.value = effTextColor;
      }
      if (desktopTextHexInput && document.activeElement !== desktopTextHexInput) {
        desktopTextHexInput.value = (customTextColor === 'auto' ? 'AUTO' : effTextColor.replace(/^#/, '').toUpperCase());
      }

      // Escala
      if (desktopScaleInput) desktopScaleInput.value = String(customScale);
      if (desktopScaleVal) desktopScaleVal.textContent = Math.round((customScale / 6) * 100) + '%';

      // Grid de presets de cor do dado
      if (desktopColorGrid) {
        desktopColorGrid.innerHTML = '';
        COLOR_PALETTE.forEach(p => {
          const swatch = document.createElement('div');
          swatch.className = 'player-dice-color-swatch';
          swatch.title = p.label;
          swatch.style.background = p.value;
          swatch.style.setProperty('--swatch-color', p.value);
          if (customColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
          swatch.addEventListener('click', () => {
            customColor = p.value;
            saveAndApplyStyles();
          });
          desktopColorGrid.appendChild(swatch);
        });
      }

      // Grid de presets de cor dos números
      if (desktopTextColorGrid) {
        desktopTextColorGrid.innerHTML = '';
        TEXT_COLOR_PALETTE.forEach(p => {
          const swatch = document.createElement('div');
          swatch.className = 'player-dice-color-swatch';
          swatch.title = p.label;
          if (p.isAuto) {
            swatch.style.background = `linear-gradient(135deg, #ffffff 50%, #111111 50%)`;
            swatch.style.setProperty('--swatch-color', '#ffffff');
            if (customTextColor === 'auto') swatch.classList.add('active');
            swatch.addEventListener('click', () => {
              customTextColor = 'auto';
              saveAndApplyStyles();
            });
          } else {
            swatch.style.background = p.value;
            swatch.style.setProperty('--swatch-color', p.value);
            if (customTextColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
            swatch.addEventListener('click', () => {
              customTextColor = p.value;
              saveAndApplyStyles();
            });
          }
          desktopTextColorGrid.appendChild(swatch);
        });
      }
    }

    // 2. Mobile Popover
    if (isMobileOS) {
      if (typeof mobileWrap !== 'undefined' && mobileWrap) {
        mobileWrap.style.setProperty('--dice-active-color', effColor);
      }
      if (mPreview) {
        mPreview.style.background = effColor;
        mPreview.style.boxShadow = `0 0 8px ${effColor}`;
      }
      if (mColorPicker && /^#[0-9a-fA-F]{6}$/.test(effColor)) {
        mColorPicker.value = effColor;
      }
      if (mHexInput && document.activeElement !== mHexInput) {
        mHexInput.value = effColor.replace(/^#/, '').toUpperCase();
      }

      if (mTextPreview) {
        mTextPreview.style.background = effTextColor;
        mTextPreview.style.boxShadow = `0 0 8px ${effTextColor}`;
      }
      if (mTextColorPicker && /^#[0-9a-fA-F]{6}$/.test(effTextColor)) {
        mTextColorPicker.value = effTextColor;
      }
      if (mTextHexInput && document.activeElement !== mTextHexInput) {
        mTextHexInput.value = (customTextColor === 'auto' ? 'AUTO' : effTextColor.replace(/^#/, '').toUpperCase());
      }

      if (mScaleInput) mScaleInput.value = String(customScale);
      if (mScaleVal) mScaleVal.textContent = Math.round((customScale / 6) * 100) + '%';

      if (mColorGrid) {
        mColorGrid.innerHTML = '';
        COLOR_PALETTE.forEach(p => {
          const swatch = document.createElement('div');
          swatch.className = 'player-dice-color-swatch';
          swatch.title = p.label;
          swatch.style.background = p.value;
          swatch.style.setProperty('--swatch-color', p.value);
          if (customColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
          swatch.addEventListener('click', () => {
            customColor = p.value;
            saveAndApplyStyles();
          });
          mColorGrid.appendChild(swatch);
        });
      }

      if (mTextColorGrid) {
        mTextColorGrid.innerHTML = '';
        TEXT_COLOR_PALETTE.forEach(p => {
          const swatch = document.createElement('div');
          swatch.className = 'player-dice-color-swatch';
          swatch.title = p.label;
          if (p.isAuto) {
            swatch.style.background = `linear-gradient(135deg, #fff 50%, #111 50%)`;
            if (customTextColor === 'auto') swatch.classList.add('active');
            swatch.addEventListener('click', () => {
              customTextColor = 'auto';
              saveAndApplyStyles();
            });
          } else {
            swatch.style.background = p.value;
            if (customTextColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
            swatch.addEventListener('click', () => {
              customTextColor = p.value;
              saveAndApplyStyles();
            });
          }
          mTextColorGrid.appendChild(swatch);
        });
      }
    }
  }

  let Box = null;
  let isBoxReady = false;
  let isRolling = false;
  let boxInitPromise = null;

  function initBox() {
    if (isBoxReady && Box) return Promise.resolve(Box);
    if (!boxInitPromise) {
      boxInitPromise = (async () => {
        try {
          let container = document.getElementById('dice-box-canvas');
          if (!container) {
            container = document.createElement('div');
            container.id = 'dice-box-canvas';
            document.body.appendChild(container);
          }

          const effColor = getEffectiveDiceColor();
          const effTextColor = getEffectiveTextColor();
          const baseScaleVal = Math.round((customScale / 6) * 100);

          Box = new DiceBox("#dice-box-canvas", {
            assetPath: "https://cdn.jsdelivr.net/npm/@drdreo/dice-box-threejs@1.1.0/dist",
            sounds: false,
            shadows: true,
            theme_surface: "green-felt",
            sound_dieMaterial: "plastic",
            theme_material: "plastic",
            color_spotlight: 0xffffff,
            theme_customColorset: createBoxColorset(effColor, effTextColor),
            light_intensity: 1.5,
            baseScale: baseScaleVal,
            gravity_multiplier: 400
          });

          await Box.initialize();
          isBoxReady = true;
          calibrateSceneLighting(Box);
          if (Box.DiceFactory) patchDiceFactory(Box.DiceFactory);
          await updateBoxAppearance(effColor, effTextColor, customScale);
          return Box;
        } catch (err) {
          console.error("Erro inicializando DiceBox 3D:", err);
          boxInitPromise = null;
          isBoxReady = false;
          throw err;
        }
      })();
    }
    return boxInitPromise;
  }

  async function updateBoxAppearance(diceColor, textColor, scale) {
    const effColor = diceColor || getEffectiveDiceColor();
    const effTextColor = textColor || getEffectiveTextColor();
    const effScale = scale !== undefined ? scale : customScale;
    const baseScaleVal = Math.round((effScale / 6) * 100);

    applyScaleToBox(effScale);

    if (!Box || !isBoxReady) return;

    try {
      calibrateSceneLighting(Box);
      const colorSet = createBoxColorset(effColor, effTextColor);
      Box.theme_customColorset = colorSet;
      Box.colorData = colorSet;
      Box.baseScale = baseScaleVal;

      if (Box.DiceFactory) {
        patchDiceFactory(Box.DiceFactory);
        Box.DiceFactory.baseScale = baseScaleVal;
        Box.DiceFactory.dice_material = 'none';
        Box.DiceFactory.applyColorSet(colorSet);
        Box.DiceFactory.label_color = effTextColor;
        Box.DiceFactory.dice_color = effColor;
        Box.DiceFactory.edge_color = effColor;
        Box.DiceFactory.geometries = {};
        Box.DiceFactory.materials_cache = {};
      }

      if (Box.DiceColors) {
        Box.DiceColors.colorsets[colorSet.name] = colorSet;
      }
    } catch (e) {
      console.warn("Erro atualizando aparência dos dados 3D:", e);
    }
  }

  // Efeito de brilho suave quando o dado para/assenta
  function onSettle(color) {
    isRolling = false;
    hasSettledDice = true;
    if (boxCanvas) {
      boxCanvas.style.setProperty('--dice-settle-color', color || getEffectiveDiceColor());
      boxCanvas.classList.remove('settled');
      void boxCanvas.offsetWidth;
      boxCanvas.classList.add('settled');
    }
  }

  // ---- Gera o resultado determinístico e arma a notação 3D ----
  function getRandomFace(faces) {
    if (faces === 100) {
      return (Math.floor(Math.random() * 10) + 1) * 10;
    }
    return Math.floor(Math.random() * faces) + 1;
  }

  function executeRoll(faces, count = 1, mod = 0, mode = 'normal') {
    let diceCount = count;
    if (mode === 'adv' || mode === 'dis') {
      diceCount = Math.max(2, count);
    }

    const rolls = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(getRandomFace(faces));
    }

    let finalDiceValue;
    if (mode === 'adv') {
      finalDiceValue = Math.max(...rolls);
    } else if (mode === 'dis') {
      finalDiceValue = Math.min(...rolls);
    } else {
      finalDiceValue = rolls.reduce((a, b) => a + b, 0);
    }

    const sum = finalDiceValue + mod;
    const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : '';
    let expr = '';
    if (mode === 'adv') {
      expr = `${diceCount}d${faces} [ADV: ${rolls.join(', ')}] → Maior: ${finalDiceValue}${modStr ? ' ' + modStr + ' = ' + sum : ''}`;
    } else if (mode === 'dis') {
      expr = `${diceCount}d${faces} [DIS: ${rolls.join(', ')}] → Menor: ${finalDiceValue}${modStr ? ' ' + modStr + ' = ' + sum : ''}`;
    } else if (mod !== 0) {
      expr = diceCount === 1 ? `Dado: ${rolls[0]} (${modStr}) = ${sum}` : `Dados: [${rolls.join(' + ')}] ${modStr} = ${sum}`;
    } else {
      expr = diceCount === 1 ? `1d${faces} → [${rolls[0]}]` : `${diceCount}d${faces} → [${rolls.join(' + ')}] = ${sum}`;
    }

    // Arma o DiceBox para que os dados caiam exatamente nas faces sorteadas
    const notation = `${diceCount}d${faces}@${rolls.join(',')}`;

    return {
      faces,
      count: diceCount,
      mod,
      mode,
      rolls,
      sum,
      expr,
      notation
    };
  }

  // ---- Rolagem do JOGADOR ----
  async function playerRoll(faces, count = 1, mod = 0) {
    if (isRolling) return;
    clearSettledDice();
    isRolling = true;
    const mode = currentRollMode || 'normal';
    const rollData = executeRoll(faces, count, mod, mode);
    const color = getEffectiveDiceColor();
    const textColor = getEffectiveTextColor();
    const senderName = getLocalCharacterName();

    // 1. Transmite imediatamente para o Mestre e demais jogadores na mesa
    if (window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll({
        faces: rollData.faces,
        count: rollData.count,
        mod: rollData.mod,
        mode: rollData.mode,
        rolls: rollData.rolls,
        sum: rollData.sum,
        expr: rollData.expr,
        notation: rollData.notation,
        senderName,
        themeColor: color,
        textColor: textColor,
        scale: customScale
      });
    }

    // 2. Anima fisicamente o dado na tela local
    try {
      await initBox();
      await updateBoxAppearance(color, textColor, customScale);
      applyScaleToBox(customScale);
      if (boxCanvas) boxCanvas.classList.remove('settled');
      await Box.roll(rollData.notation);
      onSettle(color);
    } catch (err) {
      console.warn("Fallback visual rolagem jogador:", err);
      onSettle(color);
    } finally {
      isRolling = false;
    }
  }

  // ---- Rolagem do MESTRE ----
  async function gmRoll(faces, count = 1, mod = 0) {
    if (isRolling) return;
    clearSettledDice();
    isRolling = true;
    const mode = currentRollMode || 'normal';
    const rollData = executeRoll(faces, count, mod, mode);
    const color = getEffectiveDiceColor();
    const textColor = getEffectiveTextColor();
    const senderName = isSecretRoll ? 'Mestre (Oculto)' : 'Mestre';

    // 1. Se não for oculto, transmite para todas as telas dos jogadores conectados
    if (!isSecretRoll && window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll({
        faces: rollData.faces,
        count: rollData.count,
        mod: rollData.mod,
        mode: rollData.mode,
        rolls: rollData.rolls,
        sum: rollData.sum,
        expr: rollData.expr,
        notation: rollData.notation,
        senderName: 'Mestre',
        themeColor: color,
        textColor: textColor,
        scale: customScale
      });
    }

    // 2. Anima fisicamente o dado na tela do Mestre
    try {
      await initBox();
      await updateBoxAppearance(color, textColor, customScale);
      applyScaleToBox(customScale);
      if (boxCanvas) boxCanvas.classList.remove('settled');
      await Box.roll(rollData.notation);
      onSettle(color);
    } catch (err) {
      console.warn("Fallback visual rolagem mestre:", err);
      onSettle(color);
    } finally {
      isRolling = false;
    }
  }

  // ---- Recepção de rolagem vinda remotamente ----
  window.RPG = window.RPG || {};
  window.RPG.onRemoteDiceRoll = async (data) => {
    if (!data) return;
    clearSettledDice();

    const color = data.themeColor || getEffectiveDiceColor();
    const textColor = data.textColor || getEffectiveTextColor();
    const scale = data.scale || customScale;
    const notation = data.notation || `${data.count || (data.rolls ? data.rolls.length : 1)}d${data.faces || 20}@${(data.rolls || [1]).join(',')}`;

    try {
      await initBox();
      await updateBoxAppearance(color, textColor, scale);
      applyScaleToBox(scale);
      if (boxCanvas) boxCanvas.classList.remove('settled');
      await Box.roll(notation);
      onSettle(color);
    } catch (err) {
      console.warn("Fallback visual rolagem remota:", err);
      onSettle(color);
    }
  };

  applyCustomStyles();
  initBox();

  // API pública: rollDice (uso via console/macros)
  // @ts-ignore
  window.RPG.rollDice = (faces, count = 1, mod = 0) => {
    if (checkIsGM()) {
      gmRoll(faces, count, mod);
    } else {
      playerRoll(faces, count, mod);
    }
  };
})();
