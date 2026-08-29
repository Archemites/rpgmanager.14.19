// @ts-ignore
import DiceBox from 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js';
import { isAndroidOrIOS } from './mobile.js';

/* ============================================================
   Player & GM dice roller — motor 3D sincronizado via WebRTC
   - PC: layout clássico de gaveta inferior
   - Mobile (Android / iOS): Speed-Dial flutuante
   - Sincronização em tempo real: a rolagem 3D e o resultado aparecem
     instantaneamente na tela de todos os presentes na mesa!
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

  // ---- Injeta Canvas 3D Compartilhado em Tela Cheia ----
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
    document.body.appendChild(boxCanvas);
  }

  // ---- Injeta Banner / Toast Compartilhado de Resultado ----
  let sharedToast = document.getElementById('playerDiceSharedToast');
  if (!sharedToast) {
    sharedToast = document.createElement('div');
    sharedToast.id = 'playerDiceSharedToast';
    sharedToast.className = 'player-dice-shared-toast hidden';
    sharedToast.innerHTML = `
      <div class="shared-toast-content" id="sharedToastContent">
        <div class="shared-toast-header">
          <span class="shared-toast-icon">🎲</span>
          <span class="shared-toast-user" id="sharedToastUser">Jogador</span>
          <span class="shared-toast-action" id="sharedToastAction">rolou:</span>
        </div>
        <div class="shared-toast-body">
          <span class="shared-toast-total" id="sharedToastTotal">20</span>
          <span class="shared-toast-formula" id="sharedToastFormula">1d20 → [20]</span>
        </div>
      </div>
    `;
    document.body.appendChild(sharedToast);
  }

  const toastUser = document.getElementById('sharedToastUser');
  const toastAction = document.getElementById('sharedToastAction');
  const toastTotal = document.getElementById('sharedToastTotal');
  const toastFormula = document.getElementById('sharedToastFormula');
  const toastContent = document.getElementById('sharedToastContent');
  let toastTimer = null;

  function showSharedResultToast(senderName, sum, formula, themeColor) {
    if (!sharedToast || !toastTotal || !toastFormula) return;
    
    if (toastUser) toastUser.textContent = senderName || 'Jogador';
    if (toastAction) toastAction.textContent = senderName === 'Você' ? 'rolou:' : 'rolou:';
    toastTotal.textContent = String(sum);
    toastFormula.textContent = formula;

    if (toastContent && themeColor) {
      toastContent.style.setProperty('--toast-accent', themeColor);
    }

    sharedToast.classList.remove('hidden');
    sharedToast.classList.add('pop');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      sharedToast.classList.remove('pop');
      setTimeout(() => sharedToast.classList.add('hidden'), 350);
    }, 6000);
  }

  sharedToast.addEventListener('click', () => {
    sharedToast.classList.remove('pop');
    setTimeout(() => sharedToast.classList.add('hidden'), 300);
  });

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

        <div class="settings-row">
          <div class="settings-label-row">
            <span class="settings-label">Tamanho do Dado</span>
            <span id="mobileScaleVal" class="settings-val">100%</span>
          </div>
          <input type="range" id="mobileScaleInput" min="3" max="9" value="6" step="0.5">
        </div>
        
        <div class="settings-row">
          <div class="settings-label-row">
            <span class="settings-label">Cor dos Dados</span>
            <button type="button" id="mobileResetBtn" class="reset-theme-btn" title="Restaurar cor do tema">Cor do Tema</button>
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

        rollDiceEngine(faces, count, mod, currentRollMode, (sum, expr) => {
          const isGMActive = checkIsGM();
          if (isGMActive && isSecretRoll) {
            showSharedResultToast('Mestre (Oculto)', sum, expr + ' [Oculto]', getEffectiveDiceColor());
          } else {
            showSharedResultToast('Você', sum, expr, getEffectiveDiceColor());
          }
        });
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

    mScaleInput?.addEventListener('input', () => {
      customScale = Number(mScaleInput.value) || 6;
      saveAndApplyStyles();
    });

    mResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      customColor = 'theme';
      customScale = 6;
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
  // MODO 2: PC / DESKTOP — LAYOUT CLÁSSICO ORIGINAL DE GAVETA
  // ============================================================
  let desktopOverlay = null;
  let desktopPanel = null;
  let desktopSettingsDrawer = null;
  let desktopSettingsBtn = null;
  let desktopColorPicker = null;
  let desktopActivePreview = null;
  let desktopHexInput = null;
  let desktopScaleInput = null;
  let desktopScaleVal = null;
  let desktopColorGrid = null;
  let desktopResetBtn = null;

  let desktopFaceButtons = null;
  let desktopCountInput = null;
  let desktopModeSelect = null;
  let desktopModInput = null;
  let desktopRollBtn = null;
  let desktopResultEl = null;
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
          <button type="button" id="playerDiceSettingsBtn" class="player-dice-settings-btn" title="Personalizar cor dos dados 3D">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

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
              <input type="range" id="playerDiceScaleInput" min="3" max="9" value="6" step="0.5">
            </div>
          </div>

          <div class="player-dice-presets-label">Presets rápidos:</div>
          <div class="player-dice-color-grid" id="playerDiceColorGrid"></div>
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
    desktopColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceColorPicker'));
    desktopActivePreview = document.getElementById('playerDicePickerPreview');
    desktopHexInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceHexInput'));
    desktopScaleInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceScaleInput'));
    desktopScaleVal = document.getElementById('playerDiceScaleVal');
    desktopColorGrid = document.getElementById('playerDiceColorGrid');
    desktopResetBtn = document.getElementById('playerDiceResetBtn');

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
      if ((desktopModeSelect.value === 'adv' || desktopModeSelect.value === 'dis') && parseInt(desktopCountInput.value, 10) === 1) {
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

    desktopScaleInput?.addEventListener('input', () => {
      customScale = Number(desktopScaleInput.value) || 6;
      saveAndApplyStyles();
    });

    desktopResetBtn?.addEventListener('click', () => {
      customColor = 'theme';
      customScale = 6;
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
      const mode = desktopModeSelect ? desktopModeSelect.value : 'normal';

      rollDiceEngine(selectedFaces, count, mod, mode, (sum, expr) => {
        const isGMActive = checkIsGM();
        if (isGMActive && isSecretRoll) {
          showSharedResultToast('Mestre (Oculto)', sum, expr + ' [Oculto dos jogadores]', getEffectiveDiceColor());
        } else {
          showSharedResultToast('Você', sum, expr, getEffectiveDiceColor());
        }
      });
    });

    function openDesktopDice() {
      applyCustomStyles();
      // Atualiza visibilidade do toggle secreto do mestre
      const isGMActive = checkIsGM();
      const secretRow = document.getElementById('gmSecretDiceRow');
      if (secretRow) secretRow.classList.toggle('hidden', !isGMActive);

      desktopOverlay.classList.add('open');
      initBox();
    }

    function closeDesktopDice() {
      desktopOverlay.classList.remove('open');
      if (isBoxReady) Box.clear();
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
  // MOTOR 3D COMPARTILHADO & CONFIGURAÇÃO
  // ============================================================
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

  function saveAndApplyStyles() {
    try {
      localStorage.setItem(STORAGE_KEY_COLOR, customColor);
      localStorage.setItem(STORAGE_KEY_SCALE, String(customScale));
    } catch (e) {}
    applyCustomStyles();
  }

  function applyCustomStyles() {
    const effColor = getEffectiveDiceColor();

    if (desktopPanel) {
      desktopPanel.style.setProperty('--dice-custom-color', effColor);
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
      if (desktopScaleInput) desktopScaleInput.value = String(customScale);
      if (desktopScaleVal) desktopScaleVal.textContent = Math.round((customScale / 6) * 100) + '%';

      if (desktopColorGrid) {
        desktopColorGrid.innerHTML = '';
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
              saveAndApplyStyles();
            });
          } else {
            swatch.style.background = p.value;
            swatch.style.setProperty('--swatch-color', p.value);
            if (customColor.toLowerCase() === p.value.toLowerCase()) swatch.classList.add('active');
            swatch.addEventListener('click', () => {
              customColor = p.value;
              saveAndApplyStyles();
            });
          }
          desktopColorGrid.appendChild(swatch);
        });
      }
    }

    if (Box && Box.config) {
      Box.config.themeColor = effColor;
      Box.config.scale = customScale;
    }

    if (isBoxReady && Box && typeof Box.updateConfig === 'function') {
      try {
        Box.updateConfig({ scale: customScale, themeColor: effColor });
      } catch (e) {}
    }
  }

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

  function rollDiceEngine(faces, count, mod, mode, onComplete) {
    if (isRolling) return;
    isRolling = true;

    initBox().then(() => {
      const currentColor = getEffectiveDiceColor();
      if (isBoxReady && typeof Box.updateConfig === 'function') {
        try {
          Box.updateConfig({ scale: customScale, themeColor: currentColor });
        } catch (e) {}
      }

      const notation = `${count}d${faces}`;

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
          finishRoll(faces, count, mod, mode, currentColor, rolls, finalSum, expr, onComplete);
        } else if (mode === 'dis') {
          const lowest = Math.min(...rolls);
          chosenValue = lowest;
          const finalSum = chosenValue + mod;
          if (rolls.length > 1) {
            expr = `${count}d${faces}${modStr} (Desvantagem) → [${rolls.join(', ')}] → Menor: ${lowest}${mod !== 0 ? ` (${lowest}${modStr})` : ''}`;
          } else {
            expr = `${count}d${faces}${modStr} → [${lowest}]${mod !== 0 ? ` (${lowest}${modStr})` : ''}`;
          }
          finishRoll(faces, count, mod, mode, currentColor, rolls, finalSum, expr, onComplete);
        } else {
          const sumOfDice = rolls.reduce((a, b) => a + b, 0);
          chosenValue = sumOfDice;
          const finalSum = chosenValue + mod;
          if (rolls.length > 1) {
            expr = `${count}d${faces}${modStr} → [${rolls.join(' + ')}] = ${sumOfDice}${mod !== 0 ? ` (${sumOfDice}${modStr})` : ''}`;
          } else {
            expr = `${count}d${faces}${modStr} → [${rolls[0]}]${mod !== 0 ? ` (${rolls[0]}${modStr})` : ''}`;
          }
          finishRoll(faces, count, mod, mode, currentColor, rolls, finalSum, expr, onComplete);
        }
      }).catch(err => {
        console.error("Erro na rolagem 3D:", err);
        isRolling = false;
      });
    });
  }

  function finishRoll(faces, count, mod, mode, currentColor, rolls, finalSum, expr, onComplete) {
    if (typeof onComplete === 'function') onComplete(finalSum, expr, rolls);

    const isGMActive = checkIsGM();

    // Se for o Mestre com rolagem secreta ativada, NÃO transmite para os jogadores
    if (isGMActive && isSecretRoll) {
      return;
    }

    // Envia a rolagem via WebRTC para todos na mesa
    if (window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll({
        faces,
        count,
        mod,
        mode,
        themeColor: currentColor,
        scale: customScale,
        rolls,
        sum: finalSum,
        expr
      });
    }
  }

  // ---- Recepção de Rolagem Remota via WebRTC ----
  window.RPG = window.RPG || {};
  window.RPG.onRemoteDiceRoll = (data) => {
    if (!data) return;

    initBox().then(() => {
      if (isBoxReady) {
        const notation = `${data.count || 1}d${data.faces || 20}`;
        const color = data.themeColor || '#45ff78';
        Box.roll(notation, { themeColor: color }).catch(() => {});
      }
      showSharedResultToast(data.senderName || 'Jogador', data.sum, data.expr, data.themeColor || '#45ff78');
    });
  };

  applyCustomStyles();
  initBox();

  const themeObserver = new MutationObserver(() => {
    if (customColor === 'theme') applyCustomStyles();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', (e) => {
    if (e.key === 'rpg-table-theme' && customColor === 'theme') applyCustomStyles();
  });

  // @ts-ignore
  window.RPG.rollDice = (faces, count = 1, mod = 0, mode = 'normal') => {
    rollDiceEngine(faces, count, mod, mode, (sum, expr) => {
      const isGMActive = checkIsGM();
      if (isGMActive && isSecretRoll) {
        showSharedResultToast('Mestre (Oculto)', sum, expr + ' [Oculto]', getEffectiveDiceColor());
      } else {
        showSharedResultToast('Você', sum, expr, getEffectiveDiceColor());
      }
    });
  };
})();
