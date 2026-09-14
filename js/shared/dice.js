// @ts-ignore
import DiceBox from '../../assets/dice-box/dice-box.es.js';
import { isAndroidOrIOS } from './mobile.js';

/* ============================================================
<<<<<<< HEAD
   Player & GM dice roller ÔÇö Foundry VTT / Dice So Nice! Style
   - Motor: @3d-dice/dice-box 1.1.4 (BabylonJS + AmmoJS por baixo)
   - Tema "gemstone": mesh poli├®drico facetado com material transl├║cido
     tingido por themeColor ÔÇö o efeito visual mais pr├│ximo de resina
     colorida que a biblioteca oferece nativamente
   - Luz e sombra reais via config nativa (lightIntensity, enableShadows,
     shadowTransparency) ÔÇö nada de hooks inventados em cima da lib
   - Cada tela roda sua pr├│pria simula├º├úo f├¡sica (queda visualmente
     diferente em cada cliente) mas o VALOR do resultado ├® sempre o
     valor real que a f├¡sica decidiu em quem rolou; esse valor ├®
     sincronizado via WebRTC e exibido igual em todas as telas
   - Pop-up HUD moderno p├│s-assentamento dos dados
=======
   Player & GM dice roller — Foundry VTT / Dice So Nice! Style
   - Motor: @3d-dice/dice-box (BabylonJS + AmmoJS oficial)
   - Modelos e Geometrias Convencionais: d4, d6, d8, d10, d12, d20, d100
   - Interface Unificada: Barra Vertical + Controles Horizontais + Popout
   - Temas Oficiais: Resina Clássica, Mármore, Metal, Rústico, Rocha, Madeira, Acrílico, Gemstone
   - Suporte a Mestre, Jogador, Modos (Normal / Vantagem / Desvantagem / Oculto)
   - Sincronização WebRTC e Pop-up HUD
>>>>>>> branch-cores
   ============================================================ */

(() => {
  'use strict';

  // ---- Identifica├º├úo Mestre vs Jogador ----
  function checkIsGM() {
    return Boolean(
      (window.RPG && window.RPG.isGM) ||
      document.getElementById('openInviteBtn') ||
      document.getElementById('sidebarWrap') ||
      document.getElementById('sceneSidebar')
    );
  }

  // ---- Configura├º├úo de dados ----
  const FACES = [4, 6, 8, 10, 12, 20, 100];
  let currentRollMode = 'normal'; // 'normal' | 'adv' | 'dis'

  // ---- Chaves de LocalStorage ----
  const STORAGE_KEY_SECRET = 'rpg-gm-secret-dice';
  const STORAGE_KEY_THEME = 'rpg-dice-theme';
  const STORAGE_KEY_GEOMETRY = 'rpg-dice-geometry';
  const STORAGE_KEY_DICE_COLOR = 'rpg-dice-color';
  const STORAGE_KEY_TEXT_COLOR = 'rpg-dice-text-color';
  const STORAGE_KEY_TEXT_AUTO = 'rpg-dice-text-auto';
  const STORAGE_KEY_SCALE = 'rpg-dice-scale';

  let isSecretRoll = false;
  try {
    isSecretRoll = localStorage.getItem(STORAGE_KEY_SECRET) === 'true';
  } catch (_) {}

<<<<<<< HEAD
  // ---- SVGs Poli├®dricos para os Dados ----
=======
  function hexToRgb(hex) {
    if (!hex) return { r: 69, g: 255, b: 120 };
    let str = String(hex).trim();
    if (str.startsWith('rgb')) {
      const m = str.match(/\d+/g);
      if (m && m.length >= 3) {
        return { r: parseInt(m[0], 10), g: parseInt(m[1], 10), b: parseInt(m[2], 10) };
      }
    }
    let c = str.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return { r: 69, g: 255, b: 120 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function toHex7(color) {
    const rgb = hexToRgb(color);
    const r = rgb.r.toString(16).padStart(2, '0');
    const g = rgb.g.toString(16).padStart(2, '0');
    const b = rgb.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  function getSystemAccent() {
    try {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (raw) return raw;
    } catch (_) {}
    return '#45ff78';
  }

  function getContrastColor(hex) {
    const rgb = hexToRgb(hex);
    const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return yiq >= 140 ? '#111827' : '#ffffff';
  }

  // ---- SVGs Poliédricos para os Dados ----
>>>>>>> branch-cores
  const DICE_SVGS = {
    4: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,3 2,20 22,20" fill="currentColor" fill-opacity="0.15"/><line x1="12" y1="3" x2="12" y2="14"/><line x1="2" y1="20" x2="12" y2="14"/><line x1="22" y1="20" x2="12" y2="14"/></svg>`,
    6: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,7 12,12 3,7" fill="currentColor" fill-opacity="0.25"/><polygon points="3,7 12,12 12,22 3,17" fill="currentColor" fill-opacity="0.1"/><polygon points="12,12 21,7 21,17 12,22" fill="currentColor" fill-opacity="0.18"/></svg>`,
    8: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,12 12,22 3,12" fill="currentColor" fill-opacity="0.15"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
    10: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,9 12,22 3,9" fill="currentColor" fill-opacity="0.15"/><line x1="12" y1="2" x2="12" y2="14"/><line x1="3" y1="9" x2="12" y2="14"/><line x1="21" y1="9" x2="12" y2="14"/><line x1="12" y1="22" x2="12" y2="14"/></svg>`,
    12: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21.5,8.9 17.9,20 6.1,20 2.5,8.9" fill="currentColor" fill-opacity="0.12"/><polygon points="12,7 16.5,10.3 14.8,15.5 9.2,15.5 7.5,10.3" fill="currentColor" fill-opacity="0.22"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="21.5" y1="8.9" x2="16.5" y2="10.3"/><line x1="17.9" y1="20" x2="14.8" y2="15.5"/><line x1="6.1" y1="20" x2="9.2" y2="15.5"/><line x1="2.5" y1="8.9" x2="7.5" y2="10.3"/></svg>`,
    20: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2 21,7.5 21,16.5 12,22 3,16.5 3,7.5" fill="currentColor" fill-opacity="0.15"/><polygon points="12,7.5 18,17 6,17" fill="currentColor" fill-opacity="0.25"/><line x1="12" y1="2" x2="12" y2="7.5"/><line x1="21" y1="7.5" x2="18" y2="17"/><line x1="21" y1="16.5" x2="18" y2="17"/><line x1="12" y1="22" x2="18" y2="17"/><line x1="12" y1="22" x2="6" y2="17"/><line x1="3" y1="16.5" x2="6" y2="17"/><line x1="3" y1="7.5" x2="6" y2="17"/><line x1="12" y1="7.5" x2="21" y2="7.5"/><line x1="12" y1="7.5" x2="3" y2="7.5"/></svg>`,
    100: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="9,2 17,8 9,20 1,8" fill="currentColor" fill-opacity="0.12"/><line x1="9" y1="2" x2="9" y2="13"/><line x1="1" y1="8" x2="9" y2="13"/><line x1="17" y1="8" x2="9" y2="13"/><line x1="9" y1="20" x2="9" y2="13"/><circle cx="18" cy="5" r="2" stroke-width="1.4"/><line x1="22" y1="5" x2="14" y2="18" stroke-width="1.4"/><circle cx="20" cy="17" r="2" stroke-width="1.4"/></svg>`
  };

<<<<<<< HEAD
  // ---- Injeta Canvas 3D de Tela Cheia ----
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
    document.body.appendChild(boxCanvas);
=======
  // ---- Injeta Container HUD de Pop-ups ----
  let hudContainer = document.getElementById('dice-results-hud-container');
  if (!hudContainer) {
    hudContainer = document.createElement('div');
    hudContainer.id = 'dice-results-hud-container';
    hudContainer.className = 'dice-hud-container';
    document.body.appendChild(hudContainer);
  }

  function showDiceResultPopup(data) {
    if (!data) return;
    const { senderName, expr, sum, mode, rolls, faces, count, mod } = data;

    const popup = document.createElement('div');
    popup.className = 'dice-result-popup';

    // Highlight para Crítico no d20
    let critTag = '';
    if (faces === 20 && count === 1) {
      if (rolls[0] === 20) {
        critTag = `<div class="dice-popup-crit-tag crit-success">✦ Sucesso Crítico (Nat 20)! ✦</div>`;
      } else if (rolls[0] === 1) {
        critTag = `<div class="dice-popup-crit-tag crit-fail">✖ Falha Crítica (Nat 1)! ✖</div>`;
      }
    }

    const formulaLabel = mode === 'adv' ? `${count}d${faces} [ADV]` : (mode === 'dis' ? `${count}d${faces} [DIS]` : `${count}d${faces}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ''}`);

    popup.innerHTML = `
      <div class="dice-popup-header">
        <span class="dice-popup-sender">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${senderName || 'Jogador'}
        </span>
        <span class="dice-popup-formula-badge">${formulaLabel}</span>
      </div>
      ${critTag}
      <div class="dice-popup-main-val">${sum}</div>
      <div class="dice-popup-details">${expr || ''}</div>
    `;

    popup.addEventListener('click', () => {
      popup.classList.add('dismissing');
      setTimeout(() => popup.remove(), 250);
    });

    setTimeout(() => {
      if (popup.parentNode) {
        popup.classList.add('dismissing');
        setTimeout(() => popup.remove(), 250);
      }
    }, 4500);

    hudContainer.appendChild(popup);
>>>>>>> branch-cores
  }

  // ============================================================
  // MOTOR 3D (@3d-dice/dice-box)
  // ============================================================
  let Box = null;
  let isBoxReady = false;
  let isRolling = false;
  let hasSettledDice = false;
  let boxInitPromise = null;

  function clearSettledDice() {
    if (Box && isBoxReady) {
      try {
        Box.clear();
      } catch (_) {}
    }
    hasSettledDice = false;
  }

  document.addEventListener('pointerdown', (e) => {
    if (!hasSettledDice || isRolling) return;
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target) return;

    const isUnifiedWrap = document.getElementById('unifiedDiceWrap')?.contains(target);
    const isPcBtn = document.getElementById('playerDiceBtn')?.contains(target);
    const isPopout = document.getElementById('diceSettingsPopout')?.contains(target);

    if (!isUnifiedWrap && !isPcBtn && !isPopout) {
      clearSettledDice();
    }
  }, true);

  const DEFAULT_PERCENT = 100;

  function to3dScale(percent) {
    const p = Math.max(30, Math.min(200, Number(percent) || DEFAULT_PERCENT));
    return Number((2 + (p / 100) * 5).toFixed(2));
  }

  function resolveAssetPath() {
    let path = window.location.pathname || '/';
    if (!path.endsWith('/')) {
      path = path.substring(0, path.lastIndexOf('/') + 1);
    }
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return `${path}assets/dice-box/`.replace(/\/+/g, '/');
  }

  function initBox() {
    if (isBoxReady && Box) return Promise.resolve(Box);
    if (!boxInitPromise) {
      boxInitPromise = (async () => {
        try {
          const storedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'default';
          const storedGeometry = localStorage.getItem(STORAGE_KEY_GEOMETRY) || 'auto';
          const storedColor = localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent();
          let storedPercent = Number(localStorage.getItem(STORAGE_KEY_SCALE) || '100');
          if (!storedPercent || storedPercent < 30 || storedPercent > 200) {
            storedPercent = DEFAULT_PERCENT;
          }

          const baseScale3d = to3dScale(storedPercent);

          Box = new DiceBox({
            container: '#dice-box-canvas',
            assetPath: resolveAssetPath(),
            theme: storedTheme,
            geometry: storedGeometry,
            themeColor: storedColor,
            scale: baseScale3d,
            offscreen: false,
            lightIntensity: 1.0,
            enableShadows: true,
            shadowTransparency: 0.75,
            gravity: 1.5,
            mass: 1,
            friction: 0.8,
            restitution: 0.15,
            angularDamping: 0.4,
            linearDamping: 0.4,
            settleTimeout: 4000,
            suspendSimulation: false
          });

          await Box.init();
          isBoxReady = true;
          await Box.loadTheme(storedTheme);
          applyCustomStyles(storedColor, null, storedPercent, storedTheme, storedGeometry);
          return Box;
        } catch (err) {
          console.error("Erro inicializando dados 3D (DiceBox):", err);
          boxInitPromise = null;
          isBoxReady = false;
          throw err;
        }
      })();
    }
    return boxInitPromise;
  }

  function applyCustomStyles(themeColor, textColor, scaleVal, themeName, geometryName) {
    const storedTheme = themeName || localStorage.getItem(STORAGE_KEY_THEME) || 'default';
    const storedGeometry = geometryName || localStorage.getItem(STORAGE_KEY_GEOMETRY) || 'auto';
    const diceColor = themeColor || localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent();
    const isAutoText = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false';
    const finalTextColor = isAutoText ? getContrastColor(diceColor) : (textColor || localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff');

    let percent = Number(scaleVal !== null && scaleVal !== undefined ? scaleVal : (localStorage.getItem(STORAGE_KEY_SCALE) || '100'));
    if (!percent || percent < 30 || percent > 200) percent = DEFAULT_PERCENT;

    const baseScale3d = to3dScale(percent);

    if (Box && isBoxReady) {
      try {
        Box.loadTheme(storedTheme);
        Box.updateConfig({
          theme: storedTheme,
          geometry: storedGeometry,
          themeColor: diceColor,
          scale: baseScale3d
        });
      } catch (err) {
        console.warn('Falha ao atualizar tema do DiceBox:', err);
      }
    }

    // Atualiza controles da interface
    const themeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('diceThemeSelect'));
    const colorPicker = /** @type {HTMLInputElement} */ (document.getElementById('diceColorPicker'));
    const colorPreview = document.getElementById('diceColorPreview');
    const hexInput = /** @type {HTMLInputElement} */ (document.getElementById('diceHexInput'));
    const textColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('diceTextColorPicker'));
    const textColorPreview = document.getElementById('diceTextColorPreview');
    const textHexInput = /** @type {HTMLInputElement} */ (document.getElementById('diceTextHexInput'));
    const textAutoBtn = document.getElementById('diceTextAutoBtn');
    const scaleInput = /** @type {HTMLInputElement} */ (document.getElementById('diceScaleInput'));
    const scaleValEl = document.getElementById('diceScaleVal');
    const colorGrid = document.getElementById('diceColorGrid');
    const textColorGrid = document.getElementById('diceTextColorGrid');

    if (themeSelect) themeSelect.value = storedTheme;
    if (colorPicker) colorPicker.value = toHex7(diceColor);
    if (colorPreview) colorPreview.style.background = diceColor;
    if (hexInput) hexInput.value = diceColor.toUpperCase();
    if (textColorPicker) textColorPicker.value = toHex7(finalTextColor);
    if (textColorPreview) textColorPreview.style.background = finalTextColor;
    if (textHexInput) textHexInput.value = finalTextColor.toUpperCase();
    if (scaleInput) scaleInput.value = String(percent);
    if (scaleValEl) scaleValEl.textContent = `${percent}%`;

    if (textAutoBtn) {
      textAutoBtn.classList.toggle('active', isAutoText);
      textAutoBtn.textContent = isAutoText ? 'Auto: Ativo' : 'Auto: Desat.';
    }

    if (colorGrid) {
      colorGrid.querySelectorAll('.dice-color-swatch').forEach(swatch => {
        const c = /** @type {HTMLElement} */ (swatch).dataset.color;
        swatch.classList.toggle('active', c?.toLowerCase() === diceColor.toLowerCase());
      });
    }

    if (textColorGrid) {
      textColorGrid.querySelectorAll('.dice-color-swatch').forEach(swatch => {
        const c = /** @type {HTMLElement} */ (swatch).dataset.color;
        swatch.classList.toggle('active', !isAutoText && c?.toLowerCase() === finalTextColor.toLowerCase());
      });
    }
  }

  // ============================================================
  // CONSTRUÇÃO DA INTERFACE UNIFICADA (DESKTOP & MOBILE)
  // ============================================================
  function setupUnifiedUI() {
    if (document.getElementById('unifiedDiceWrap')) return;

    // Garante o container canvas do DiceBox
    let diceCanvasContainer = document.getElementById('dice-box-canvas');
    if (!diceCanvasContainer) {
      diceCanvasContainer = document.createElement('div');
      diceCanvasContainer.id = 'dice-box-canvas';
      document.body.appendChild(diceCanvasContainer);
    }

    const isGM = checkIsGM();
    const gmBtn = document.getElementById('openDiceBtn');

    // Remove qualquer botão duplicado que possa ter sido criado
    const existingPlayerBtn = document.getElementById('playerDiceBtn');
    if (gmBtn && existingPlayerBtn) {
      existingPlayerBtn.remove();
    }

    // Cria o botão circular apenas no Player View (onde não existe #openDiceBtn na barra)
    let pcDiceBtn = null;
    if (!gmBtn) {
      pcDiceBtn = document.getElementById('playerDiceBtn');
      if (!pcDiceBtn) {
        pcDiceBtn = document.createElement('button');
        pcDiceBtn.id = 'playerDiceBtn';
        pcDiceBtn.type = 'button';
        pcDiceBtn.className = 'top-circle-btn';
        pcDiceBtn.title = 'Rolar dados';
        pcDiceBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
        document.body.appendChild(pcDiceBtn);
      }
    }

    // Cria container principal do menu de dados
    const unifiedWrap = document.createElement('div');
    unifiedWrap.id = 'unifiedDiceWrap';
    unifiedWrap.className = 'unified-dice-wrap collapsed';
    unifiedWrap.innerHTML = `
      <!-- Controles Horizontais (Qtd, Mod, Modo, Oculto) saindo para a direita -->
      <div id="diceSideControls" class="dice-side-controls collapsed">
        ${isGM ? `
          <button type="button" id="diceGmSecretBtn" class="dice-control-pill secret-btn ${isSecretRoll ? 'secret' : 'public'}" title="Alternar visibilidade para os jogadores">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span id="diceSecretLabel">${isSecretRoll ? 'OCULTO' : 'PÚBLICO'}</span>
          </button>
        ` : ''}

        <div class="dice-mode-dropdown-wrap">
          <button type="button" id="diceModeBtn" class="dice-control-pill mode-btn" title="Modo de Rolagem">
            <span id="diceModeLabel">NORMAL</span>
            <svg class="mode-arrow" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div id="diceModeMenu" class="dice-subdrop-menu hidden">
            <button type="button" class="dice-subdrop-item active" data-mode="normal">
              <span class="mode-dot normal"></span>
              <span>Normal</span>
            </button>
            <button type="button" class="dice-subdrop-item" data-mode="adv">
              <span class="mode-dot adv"></span>
              <span>Vantagem (ADV)</span>
            </button>
            <button type="button" class="dice-subdrop-item" data-mode="dis">
              <span class="mode-dot dis"></span>
              <span>Desvantagem (DIS)</span>
            </button>
          </div>
        </div>

        <div class="dice-stepper-pill" title="Quantidade de dados">
          <span class="pill-label">Qtd</span>
          <button type="button" id="diceCountDec" class="pill-btn">−</button>
          <input type="number" id="diceCountInput" min="1" max="20" value="1" title="Quantidade de dados">
          <button type="button" id="diceCountInc" class="pill-btn">+</button>
        </div>

        <div class="dice-stepper-pill" title="Modificador numérico">
          <span class="pill-label">Mod</span>
          <button type="button" id="diceModDec" class="pill-btn">−</button>
          <input type="number" id="diceModInput" min="-99" max="99" value="0" title="Modificador">
          <button type="button" id="diceModInc" class="pill-btn">+</button>
        </div>
      </div>

      <!-- Coluna Vertical de Dados + Botão de Configuração -->
      <div id="diceVerticalColumn" class="dice-vertical-column collapsed">
        ${FACES.map(f => `
          <button type="button" class="dice-col-btn" data-faces="${f}" title="Rolar d${f}">
            <span class="dice-col-svg">${DICE_SVGS[f]}</span>
            <span class="dice-col-label">d${f}</span>
          </button>
        `).join('')}

        <button type="button" id="diceSettingsToggleBtn" class="dice-col-btn settings-btn" title="Personalizar Dados 3D (Cores, Textura, Tamanho)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span class="dice-col-label">Config</span>
        </button>
      </div>

      <!-- Popout de Configurações 3D -->
      <div id="diceSettingsPopout" class="dice-settings-popout hidden">
        <div class="dice-settings-popout-header">
          <span class="dice-settings-popout-title">Configurações dos Dados 3D</span>
          <button type="button" id="diceSettingsCloseBtn" class="dice-settings-close-btn" title="Fechar">✕</button>
        </div>

        <div class="dice-settings-grid">
          <div class="dice-settings-row">
            <span class="dice-settings-label">Material / Textura 3D</span>
            <div class="dice-texture-picker-wrap">
              <select id="diceThemeSelect" class="dice-theme-select" title="Selecione o material ou textura dos dados 3D">
                <option value="default">Resina Clássica</option>
                <option value="gemstoneMarble">Mármore Nobre</option>
                <option value="blueGreenMetal">Metal Bronze / Aço</option>
                <option value="rust">Ferro Oxidado / Rústico</option>
                <option value="rock">Pedra Vulcânica / Rocha</option>
                <option value="wooden">Madeira Entalhada</option>
                <option value="smooth">Resina Lisa / Acrílico</option>
                <option value="gemstone">Cristal / Gemstone</option>
              </select>
            </div>
          </div>

          <div class="dice-settings-row">
            <span class="dice-settings-label">Cor do Dado (Material 3D)</span>
            <div class="dice-color-picker-wrap">
              <div class="circular-picker-container">
                <div id="diceColorPreview" class="circular-picker-preview"></div>
                <input type="color" id="diceColorPicker" class="circular-picker-input" value="#45ff78">
              </div>
              <input type="text" id="diceHexInput" class="dice-hex-input" value="#45FF78" maxlength="7">
              <div id="diceColorGrid" class="dice-color-grid">
                <span class="dice-color-swatch" data-color="#45ff78" style="background: #45ff78;" title="Neon Verde"></span>
                <span class="dice-color-swatch" data-color="#00f0ff" style="background: #00f0ff;" title="Ciano"></span>
                <span class="dice-color-swatch" data-color="#a855f7" style="background: #a855f7;" title="Roxo Arcano"></span>
                <span class="dice-color-swatch" data-color="#f43f5e" style="background: #f43f5e;" title="Rubi"></span>
                <span class="dice-color-swatch" data-color="#fbbf24" style="background: #fbbf24;" title="Ouro"></span>
                <span class="dice-color-swatch" data-color="#ffffff" style="background: #ffffff;" title="Branco"></span>
                <span class="dice-color-swatch" data-color="#111827" style="background: #111827;" title="Obsidiana"></span>
              </div>
            </div>
          </div>

          <div class="dice-settings-row">
            <span class="dice-settings-label">Cor do Texto (Números)</span>
            <div class="dice-color-picker-wrap">
              <div class="circular-picker-container">
                <div id="diceTextColorPreview" class="circular-picker-preview"></div>
                <input type="color" id="diceTextColorPicker" class="circular-picker-input" value="#ffffff">
              </div>
              <input type="text" id="diceTextHexInput" class="dice-hex-input" value="#FFFFFF" maxlength="7">
              <button type="button" id="diceTextAutoBtn" class="dice-auto-btn active" title="Alternar entre cor de texto automática (alto contraste) ou manual">Auto: Ativo</button>
              <div id="diceTextColorGrid" class="dice-color-grid">
                <span class="dice-color-swatch" data-color="#ffffff" style="background: #ffffff;" title="Branco"></span>
                <span class="dice-color-swatch" data-color="#000000" style="background: #000000;" title="Preto"></span>
                <span class="dice-color-swatch" data-color="#fbbf24" style="background: #fbbf24;" title="Dourado"></span>
                <span class="dice-color-swatch" data-color="#45ff78" style="background: #45ff78;" title="Verde"></span>
                <span class="dice-color-swatch" data-color="#00f0ff" style="background: #00f0ff;" title="Ciano"></span>
                <span class="dice-color-swatch" data-color="#ff4444" style="background: #ff4444;" title="Vermelho"></span>
              </div>
            </div>
          </div>

          <div class="dice-settings-row">
            <span class="dice-settings-label">Tamanho dos Dados 3D (<span id="diceScaleVal">100%</span>)</span>
            <div class="dice-scale-wrap">
              <input type="range" id="diceScaleInput" class="dice-scale-slider" min="30" max="200" step="5" value="100">
            </div>
          </div>

          <div class="dice-settings-actions">
            <button type="button" id="diceResetBtn" class="dice-reset-btn" title="Restaurar padrões de cores e escala">
              Restaurar Padrão
            </button>
          </div>
        </div>
      </div>
    `;

    const topLeftTools = document.getElementById('topLeftTools');
    if (topLeftTools) {
      topLeftTools.appendChild(unifiedWrap);
    } else {
      document.body.appendChild(unifiedWrap);
    }

    // Mapeamento dos elementos
    const sideControls = document.getElementById('diceSideControls');
    const verticalColumn = document.getElementById('diceVerticalColumn');
    const settingsPopout = document.getElementById('diceSettingsPopout');

    const modeBtn = document.getElementById('diceModeBtn');
    const modeLabel = document.getElementById('diceModeLabel');
    const modeMenu = document.getElementById('diceModeMenu');
    const modeItems = unifiedWrap.querySelectorAll('.dice-subdrop-item');

    const countInput = /** @type {HTMLInputElement} */ (document.getElementById('diceCountInput'));
    const countDec = document.getElementById('diceCountDec');
    const countInc = document.getElementById('diceCountInc');

    const modInput = /** @type {HTMLInputElement} */ (document.getElementById('diceModInput'));
    const modDec = document.getElementById('diceModDec');
    const modInc = document.getElementById('diceModInc');

    const gmSecretBtn = document.getElementById('diceGmSecretBtn');
    const secretLabel = document.getElementById('diceSecretLabel');

    const settingsToggleBtn = document.getElementById('diceSettingsToggleBtn');
    const settingsCloseBtn = document.getElementById('diceSettingsCloseBtn');

    const themeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('diceThemeSelect'));
    const colorPicker = /** @type {HTMLInputElement} */ (document.getElementById('diceColorPicker'));
    const hexInput = /** @type {HTMLInputElement} */ (document.getElementById('diceHexInput'));
    const textColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('diceTextColorPicker'));
    const textHexInput = /** @type {HTMLInputElement} */ (document.getElementById('diceTextHexInput'));
    const textAutoBtn = document.getElementById('diceTextAutoBtn');
    const scaleInput = /** @type {HTMLInputElement} */ (document.getElementById('diceScaleInput'));
    const resetBtn = document.getElementById('diceResetBtn');

    let isExpanded = false;
    function toggleDiceMenu(force) {
      isExpanded = typeof force === 'boolean' ? force : !isExpanded;
      unifiedWrap.classList.toggle('open', isExpanded);
      unifiedWrap.classList.toggle('collapsed', !isExpanded);
      pcDiceBtn?.classList.toggle('active', isExpanded);
      gmBtn?.classList.toggle('active', isExpanded);
      sideControls?.classList.toggle('collapsed', !isExpanded);
      verticalColumn?.classList.toggle('collapsed', !isExpanded);

      if (!isExpanded) {
        modeMenu?.classList.add('hidden');
        settingsPopout?.classList.add('hidden');
        settingsToggleBtn?.classList.remove('active');
      } else {
        initBox();
      }
    }

    // Toggle ao clicar no botão do Player
    pcDiceBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDiceMenu();
    });

    // Toggle ao clicar no botão original da barra do GM
    if (gmBtn) {
      gmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDiceMenu();
      });
    }

    // Alternar modo de rolagem
    modeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      modeMenu?.classList.toggle('hidden');
    });

    function setRollMode(mode) {
      currentRollMode = mode;
      modeItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-mode') === mode);
      });

      if (mode === 'adv') {
        if (modeLabel) modeLabel.textContent = 'VANTAGEM';
        if (countInput && parseInt(countInput.value, 10) === 1) countInput.value = '2';
      } else if (mode === 'dis') {
        if (modeLabel) modeLabel.textContent = 'DESVANTAGEM';
        if (countInput && parseInt(countInput.value, 10) === 1) countInput.value = '2';
      } else {
        if (modeLabel) modeLabel.textContent = 'NORMAL';
      }
      modeMenu?.classList.add('hidden');
    }

    modeItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setRollMode(item.getAttribute('data-mode') || 'normal');
      });
    });

    // Quantidade Stepper
    countDec?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(countInput.value, 10) || 1;
      if (val > 1) countInput.value = String(val - 1);
    });

    countInc?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(countInput.value, 10) || 1;
      if (val < 20) countInput.value = String(val + 1);
    });

    // Modificador Stepper
    modDec?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(modInput.value, 10) || 0;
      if (val > -99) modInput.value = String(val - 1);
    });

    modInc?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(modInput.value, 10) || 0;
      if (val < 99) modInput.value = String(val + 1);
    });

    // Oculto (Mestre)
    if (gmSecretBtn) {
      gmSecretBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isSecretRoll = !isSecretRoll;
        try { localStorage.setItem(STORAGE_KEY_SECRET, String(isSecretRoll)); } catch (_) {}
        gmSecretBtn.className = `dice-control-pill secret-btn ${isSecretRoll ? 'secret' : 'public'}`;
        if (secretLabel) secretLabel.textContent = isSecretRoll ? 'OCULTO' : 'PÚBLICO';
      });
    }

    // Clique em qualquer dado para rolar
    unifiedWrap.querySelectorAll('.dice-col-btn[data-faces]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const faces = Number(/** @type {HTMLElement} */ (btn).dataset.faces);
        const count = Math.min(20, Math.max(1, parseInt(countInput.value, 10) || 1));
        const mod = parseInt(modInput.value, 10) || 0;

        if (checkIsGM()) {
          gmRoll(faces, count, mod);
        } else {
          playerRoll(faces, count, mod);
        }
      });
    });

<<<<<<< HEAD
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
  // MODO 2: PC / DESKTOP (GAVETA INFERIOR)
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
          <div class="player-dice-top-spacer"></div>
          <div class="player-dice-handle-wrap" title="Clique para recolher">
            <div class="player-dice-handle"></div>
          </div>
          <button type="button" id="playerDiceSettingsBtn" class="player-dice-settings-toggle" title="Personalizar Cores e Dados 3D">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
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

          <div id="gmSecretDiceRow" class="player-dice-secret-row ${isGM ? '' : 'hidden'}">
            <label class="player-dice-secret-toggle" title="Se marcado, a rolagem só aparece na tela do mestre">
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
              <span>Rolar</span>
            </button>
            
            <div class="player-dice-input-group right">
              <label for="playerDiceMod">Mod</label>
              <input type="number" id="playerDiceMod" min="-99" max="99" value="0">
            </div>
          </div>
        </div>

        <!-- Gaveta de Configurações 3D (Estilo Foundry VTT) -->
        <div id="playerDiceSettingsDrawer" class="player-dice-settings-drawer">
          <div class="dice-settings-grid">
            <div class="dice-settings-row">
              <span class="dice-settings-label">Cor do Dado (Material 3D)</span>
              <div class="dice-color-picker-wrap">
                <div class="circular-picker-container">
                  <div id="desktopColorPreview" class="circular-picker-preview"></div>
                  <input type="color" id="desktopColorPicker" class="circular-picker-input" value="#45ff78">
                </div>
                <input type="text" id="desktopHexInput" class="dice-hex-input" value="#45FF78" maxlength="7">
                <div id="desktopColorGrid" class="dice-color-grid">
                  <span class="dice-color-swatch" data-color="#45ff78" style="background: #45ff78;" title="Neon Verde"></span>
                  <span class="dice-color-swatch" data-color="#00f0ff" style="background: #00f0ff;" title="Ciano"></span>
                  <span class="dice-color-swatch" data-color="#a855f7" style="background: #a855f7;" title="Roxo Arcano"></span>
                  <span class="dice-color-swatch" data-color="#f43f5e" style="background: #f43f5e;" title="Rubi"></span>
                  <span class="dice-color-swatch" data-color="#fbbf24" style="background: #fbbf24;" title="Ouro"></span>
                  <span class="dice-color-swatch" data-color="#ffffff" style="background: #ffffff;" title="Branco"></span>
                  <span class="dice-color-swatch" data-color="#111827" style="background: #111827;" title="Obsidiana"></span>
                </div>
              </div>
            </div>

            <div class="dice-settings-row">
              <span class="dice-settings-label">Cor dos Números</span>
              <div class="dice-color-picker-wrap">
                <div class="circular-picker-container">
                  <div id="desktopTextColorPreview" class="circular-picker-preview"></div>
                  <input type="color" id="desktopTextColorPicker" class="circular-picker-input" value="#ffffff">
                </div>
                <input type="text" id="desktopTextHexInput" class="dice-hex-input" value="#FFFFFF" maxlength="7">
                <button type="button" id="desktopTextAutoBtn" class="dice-auto-btn active" title="Alternar contraste automático">Auto: Ativo</button>
                <div id="desktopTextColorGrid" class="dice-color-grid">
                  <span class="dice-color-swatch" data-color="#ffffff" style="background: #ffffff;" title="Branco"></span>
                  <span class="dice-color-swatch" data-color="#000000" style="background: #000000;" title="Preto"></span>
                  <span class="dice-color-swatch" data-color="#fbbf24" style="background: #fbbf24;" title="Dourado"></span>
                  <span class="dice-color-swatch" data-color="#45ff78" style="background: #45ff78;" title="Neon Verde"></span>
                  <span class="dice-color-swatch" data-color="#00f0ff" style="background: #00f0ff;" title="Ciano"></span>
                  <span class="dice-color-swatch" data-color="#f43f5e" style="background: #f43f5e;" title="Rubi"></span>
                  <span class="dice-color-swatch" data-color="#a855f7" style="background: #a855f7;" title="Ametista"></span>
                  <span class="dice-color-swatch" data-color="#ff7a00" style="background: #ff7a00;" title="Êmbar"></span>
                </div>
              </div>
            </div>

            <div class="dice-settings-row">
              <div class="dice-scale-row">
                <span class="dice-settings-label">Tamanho dos Dados 3D</span>
                <input type="range" id="desktopScaleInput" class="dice-scale-slider" min="30" max="200" value="100" step="5">
                <span id="desktopScaleVal" class="dice-scale-val">100%</span>
              </div>
            </div>

            <button type="button" id="desktopResetBtn" class="dice-reset-btn">Restaurar Padrão do Tema</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(desktopOverlay);

    desktopPanel = document.getElementById('playerDicePanel');
    desktopFaceButtons = desktopOverlay.querySelectorAll('.player-dice-face-btn');
    desktopCountInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceCount'));
    desktopModeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('playerDiceMode'));
    desktopModInput = /** @type {HTMLInputElement} */ (document.getElementById('playerDiceMod'));
    desktopRollBtn = document.getElementById('playerDiceRollBtn');
    desktopGmSecretCheck = /** @type {HTMLInputElement} */ (document.getElementById('gmSecretDiceCheckbox'));

    desktopSettingsDrawer = document.getElementById('playerDiceSettingsDrawer');
    desktopSettingsBtn = document.getElementById('playerDiceSettingsBtn');
    desktopColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('desktopColorPicker'));
    desktopActivePreview = document.getElementById('desktopColorPreview');
    desktopHexInput = /** @type {HTMLInputElement} */ (document.getElementById('desktopHexInput'));
    desktopTextColorPicker = /** @type {HTMLInputElement} */ (document.getElementById('desktopTextColorPicker'));
    desktopTextActivePreview = document.getElementById('desktopTextColorPreview');
    desktopTextHexInput = /** @type {HTMLInputElement} */ (document.getElementById('desktopTextHexInput'));
    desktopTextColorGrid = document.getElementById('desktopTextColorGrid');
    desktopTextAutoBtn = document.getElementById('desktopTextAutoBtn');
    desktopScaleInput = /** @type {HTMLInputElement} */ (document.getElementById('desktopScaleInput'));
    desktopScaleVal = document.getElementById('desktopScaleVal');
    desktopColorGrid = document.getElementById('desktopColorGrid');
    desktopResetBtn = document.getElementById('desktopResetBtn');

    desktopSettingsBtn?.addEventListener('click', (e) => {
=======
    // Popout de configurações 3D
    settingsToggleBtn?.addEventListener('click', (e) => {
>>>>>>> branch-cores
      e.stopPropagation();
      const isHidden = settingsPopout?.classList.toggle('hidden');
      settingsToggleBtn.classList.toggle('active', !isHidden);
    });

    settingsCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPopout?.classList.add('hidden');
      settingsToggleBtn?.classList.remove('active');
    });

    themeSelect?.addEventListener('change', async () => {
      const val = themeSelect.value || 'default';
      localStorage.setItem(STORAGE_KEY_THEME, val);
      if (Box && isBoxReady) {
        try {
          await Box.loadTheme(val);
        } catch (_) {}
      }
      applyCustomStyles(null, null, null, val);
    });

    colorPicker?.addEventListener('input', (e) => {
      const hex = /** @type {HTMLInputElement} */ (e.target).value;
      localStorage.setItem(STORAGE_KEY_DICE_COLOR, hex);
      applyCustomStyles(hex, null, null);
    });

    hexInput?.addEventListener('change', (e) => {
      let val = /** @type {HTMLInputElement} */ (e.target).value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        localStorage.setItem(STORAGE_KEY_DICE_COLOR, val);
        applyCustomStyles(val, null, null);
      }
    });

    unifiedWrap.querySelectorAll('#diceColorGrid .dice-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const hex = /** @type {HTMLElement} */ (swatch).dataset.color;
        if (hex) {
          localStorage.setItem(STORAGE_KEY_DICE_COLOR, hex);
          applyCustomStyles(hex, null, null);
        }
      });
    });

    textColorPicker?.addEventListener('input', (e) => {
      const hex = /** @type {HTMLInputElement} */ (e.target).value;
      localStorage.setItem(STORAGE_KEY_TEXT_COLOR, hex);
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'false');
      applyCustomStyles(null, hex, null);
    });

    textHexInput?.addEventListener('change', (e) => {
      let val = /** @type {HTMLInputElement} */ (e.target).value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        localStorage.setItem(STORAGE_KEY_TEXT_COLOR, val);
        localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'false');
        applyCustomStyles(null, val, null);
      }
    });

    textAutoBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false';
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, current ? 'false' : 'true');
      applyCustomStyles(null, null, null);
    });

    unifiedWrap.querySelectorAll('#diceTextColorGrid .dice-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const hex = /** @type {HTMLElement} */ (swatch).dataset.color;
        if (hex) {
          localStorage.setItem(STORAGE_KEY_TEXT_COLOR, hex);
          localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'false');
          applyCustomStyles(null, hex, null);
        }
      });
    });

    scaleInput?.addEventListener('input', (e) => {
      const val = /** @type {HTMLInputElement} */ (e.target).value;
      localStorage.setItem(STORAGE_KEY_SCALE, val);
      applyCustomStyles(null, null, val);
    });

    resetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const sysAccent = getSystemAccent();
      localStorage.setItem(STORAGE_KEY_THEME, 'default');
      localStorage.setItem(STORAGE_KEY_GEOMETRY, 'auto');
      localStorage.setItem(STORAGE_KEY_DICE_COLOR, sysAccent);
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'true');
      localStorage.setItem(STORAGE_KEY_SCALE, String(DEFAULT_PERCENT));
      applyCustomStyles(sysAccent, null, DEFAULT_PERCENT, 'default', 'auto');
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      const target = /** @type {Node} */ (e.target);
      if (!unifiedWrap.contains(target) && !pcDiceBtn?.contains(target)) {
        toggleDiceMenu(false);
      }
    });

    // Aplica estilos iniciais salvos
    applyCustomStyles(null, null, null);
  }

  // ============================================================
  // FUNÇÕES DE EXECUÇÃO DE ROLAGEM
  // ============================================================
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

  function getRandomFace(faces) {
    if (faces === 100) return Math.floor(Math.random() * 100) + 1;
    return Math.floor(Math.random() * faces) + 1;
  }

  function extractSettledValues(rollResult, count, faces) {
    let values = [];
    try {
      if (Array.isArray(rollResult)) {
        rollResult.forEach(group => {
          if (group && Array.isArray(group.rolls)) {
            group.rolls.forEach(r => {
              const v = typeof r.value === 'number' ? r.value : r.result;
              if (typeof v === 'number' && !isNaN(v)) values.push(v);
            });
          } else if (typeof group?.value === 'number') {
            values.push(group.value);
          }
        });
      }
    } catch (_) {}

    while (values.length < count) {
      values.push(getRandomFace(faces));
    }
    return values.slice(0, count);
  }

  function formatRollSummary(rolls, faces, count, mod = 0, mode = 'normal') {
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
      expr = `[ADV: ${rolls.join(', ')}] → Maior: ${finalDiceValue}${modStr ? ' ' + modStr + ' = ' + sum : ''}`;
    } else if (mode === 'dis') {
      expr = `[DIS: ${rolls.join(', ')}] → Menor: ${finalDiceValue}${modStr ? ' ' + modStr + ' = ' + sum : ''}`;
    } else if (mod !== 0) {
      expr = count === 1 ? `Dado: [${rolls[0]}] ${modStr} = ${sum}` : `Dados: [${rolls.join(' + ')}] ${modStr} = ${sum}`;
    } else {
      expr = count === 1 ? `Dado: [${rolls[0]}]` : `Dados: [${rolls.join(' + ')}] = ${sum}`;
    }

    const notation = `${count}d${faces}`;

    return {
      faces,
      count,
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
    const diceCount = (mode === 'adv' || mode === 'dis') ? Math.max(2, count) : count;
    const naturalNotation = `${diceCount}d${faces}`;
    const senderName = getLocalCharacterName();
    const storedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'default';
    const storedGeometry = localStorage.getItem(STORAGE_KEY_GEOMETRY) || 'auto';
    const diceColor = localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent();
    const labelColor = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false'
      ? getContrastColor(diceColor)
      : (localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff');

    let physicalRolls = [];
    try {
      await initBox();
      applyCustomStyles(diceColor, labelColor, null, storedTheme, storedGeometry);
      const rollResult = await Box.roll(naturalNotation, {
        theme: storedTheme,
        geometry: storedGeometry,
        themeColor: diceColor
      });
      physicalRolls = extractSettledValues(rollResult, diceCount, faces);
      hasSettledDice = true;
    } catch (err) {
      console.warn("Fallback rolagem 3D física:", err);
      for (let i = 0; i < diceCount; i++) physicalRolls.push(getRandomFace(faces));
    } finally {
      isRolling = false;
    }

    const rollData = formatRollSummary(physicalRolls, faces, diceCount, mod, mode);

    const payload = {
      ...rollData,
      senderName,
      theme: storedTheme,
      geometry: storedGeometry,
      diceColor,
      labelColor
    };

    // Transmite o resultado numérico via WebRTC para todos na mesa verem no HUD
    if (window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll(payload);
    }
  }

  // ---- Rolagem do MESTRE ----
  async function gmRoll(faces, count = 1, mod = 0) {
    if (isRolling) return;
    clearSettledDice();
    isRolling = true;
    const mode = currentRollMode || 'normal';
    const diceCount = (mode === 'adv' || mode === 'dis') ? Math.max(2, count) : count;
    const naturalNotation = `${diceCount}d${faces}`;
    const storedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'default';
    const storedGeometry = localStorage.getItem(STORAGE_KEY_GEOMETRY) || 'auto';
    const diceColor = localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent();
    const labelColor = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false'
      ? getContrastColor(diceColor)
      : (localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff');

    let physicalRolls = [];
    try {
      await initBox();
      applyCustomStyles(diceColor, labelColor, null, storedTheme, storedGeometry);
      const rollResult = await Box.roll(naturalNotation, {
        theme: storedTheme,
        geometry: storedGeometry,
        themeColor: diceColor
      });
      physicalRolls = extractSettledValues(rollResult, diceCount, faces);
      hasSettledDice = true;
    } catch (err) {
      console.warn("Fallback rolagem 3D mestre física:", err);
      for (let i = 0; i < diceCount; i++) physicalRolls.push(getRandomFace(faces));
    } finally {
      isRolling = false;
    }

    const rollData = formatRollSummary(physicalRolls, faces, diceCount, mod, mode);

    const payload = {
      ...rollData,
      senderName: 'Mestre',
      theme: storedTheme,
      geometry: storedGeometry,
      diceColor,
      labelColor
    };

    if (!isSecretRoll && window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll(payload);
    }
  }

<<<<<<< HEAD
  // ---- Recepção de rolagem remota ----
  window.RPG = window.RPG || {};
  window.RPG.onRemoteDiceRoll = async (data) => {
    // "remove a função de rodar um dado pra todos, tira esse popup da tela e coloca pra só quem rodou o dado ver o 3Dzinho"
    // Nenhum HUD ou simulação 3D é mostrada na tela dos outros
    return;
=======
  // ---- Recepção de rolagem remota sincronizada ----
  window.RPG = window.RPG || {};
  window.RPG.onRemoteDiceRoll = async (data) => {
    if (!data) return;
    // Exibe o pop-up com o resultado exato na tela de todos os outros jogadores/mestre
    showDiceResultPopup(data);
>>>>>>> branch-cores
  };

  // Inicializa a interface assim que o DOM estiver disponível
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUnifiedUI);
  } else {
    setupUnifiedUI();
  }

  // API p├║blica
  // @ts-ignore
  window.RPG.rollDice = (faces, count = 1, mod = 0) => {
    if (checkIsGM()) {
      gmRoll(faces, count, mod);
    } else {
      playerRoll(faces, count, mod);
    }
  };
})();
