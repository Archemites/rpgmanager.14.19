// @ts-ignore
import DiceBox from '../../assets/dice-box/dice-box.es.js';
import { isAndroidOrIOS } from './mobile.js';

/* ============================================================
   Player & GM dice roller — Foundry VTT / Dice So Nice! Style
   - Motor: @3d-dice/dice-box 1.1.4 (BabylonJS + AmmoJS por baixo)
   - Tema "gemstone": mesh poliédrico facetado com material translúcido
     tingido por themeColor — o efeito visual mais próximo de resina
     colorida que a biblioteca oferece nativamente
   - Luz e sombra reais via config nativa (lightIntensity, enableShadows,
     shadowTransparency) — nada de hooks inventados em cima da lib
   - Cada tela roda sua própria simulação física (queda visualmente
     diferente em cada cliente) mas o VALOR do resultado é sempre o
     valor real que a física decidiu em quem rolou; esse valor é
     sincronizado via WebRTC e exibido igual em todas as telas
   - Pop-up HUD moderno pós-assentamento dos dados
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

  // ---- Injeta Canvas 3D de Tela Cheia ----
  let diceCanvasContainer = document.getElementById('dice-box-canvas');
  if (!diceCanvasContainer) {
    diceCanvasContainer = document.createElement('div');
    diceCanvasContainer.id = 'dice-box-canvas';
    document.body.appendChild(diceCanvasContainer);
  }

  // ---- Container HUD de Pop-ups ----
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

    // Fecha ao clicar no pop-up
    popup.addEventListener('click', () => {
      popup.classList.add('dismissing');
      setTimeout(() => popup.remove(), 250);
    });

    // Auto-remove após 4.5 segundos
    setTimeout(() => {
      if (popup.parentNode) {
        popup.classList.add('dismissing');
        setTimeout(() => popup.remove(), 250);
      }
    }, 4500);

    hudContainer.appendChild(popup);
  }

  // ============================================================
  // MOTOR 3D (@3d-dice/dice-box — BabylonJS + AmmoJS internamente)
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

  // Limpa os dados ao clicar em qualquer lugar da tela após a rolagem
  document.addEventListener('pointerdown', (e) => {
    if (!hasSettledDice || isRolling) return;
    const target = /** @type {HTMLElement} */ (e.target);
    if (!target) return;

    // Nota: desktopPanel e outros seletores de UI devem estar definidos em escopo global
    // ou acessíveis conforme a implementação da sua interface desktop.
    const isMobileWrap = document.getElementById('playerDiceMobileWrap')?.contains(target);
    const isPcBtn = document.getElementById('playerDiceBtn')?.contains(target);
    const isGmBtn = document.getElementById('openDiceBtn')?.contains(target);

    if (!isMobileWrap && !isPcBtn && !isGmBtn) {
      clearSettledDice();
    }
  }, true);

  // Ajusta a cor do texto/números pro contraste automático nos
  // controles de UI (a própria lib já faz esse cálculo internamente
  // pro tema gemstone, mas reaproveitamos aqui pros previews de cor).
  function getContrastColor(hex) {
    if (!hex || hex[0] !== '#') return '#ffffff';
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#000000' : '#ffffff';
  }

  function getSystemAccent() {
    let accent = '#45ff78';
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (v) accent = v;
    } catch (_) {}
    return accent;
  }

  const DEFAULT_PERCENT = 100;

  // Config real de @3d-dice/dice-box: "scale" vai de ~2 a 9 (não %).
  // Convertemos o slider 30–200% da UI existente pra essa faixa.
  function to3dScale(percent) {
    const p = Math.max(30, Math.min(200, Number(percent) || DEFAULT_PERCENT));
    return Number((2 + (p / 100) * 5).toFixed(2)); // 30% -> ~3.5 | 100% -> 7 | 200% -> ~12 (clamp da lib)
  }

  // Aplica cor/escala usando SOMENTE a API pública real de updateConfig().
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
      applyDiceTextColor(finalTextColor, storedTheme);
    }

    // Atualiza controles Desktop
    if (typeof desktopThemeSelect !== 'undefined' && desktopThemeSelect) desktopThemeSelect.value = storedTheme;
    if (typeof desktopGeometrySelect !== 'undefined' && desktopGeometrySelect) desktopGeometrySelect.value = storedGeometry;
    if (typeof desktopColorPicker !== 'undefined' && desktopColorPicker) desktopColorPicker.value = diceColor;
    if (typeof desktopActivePreview !== 'undefined' && desktopActivePreview) desktopActivePreview.style.background = diceColor;
    if (typeof desktopHexInput !== 'undefined' && desktopHexInput) desktopHexInput.value = diceColor.toUpperCase();
    if (typeof desktopTextColorPicker !== 'undefined' && desktopTextColorPicker) desktopTextColorPicker.value = finalTextColor;
    if (typeof desktopTextActivePreview !== 'undefined' && desktopTextActivePreview) desktopTextActivePreview.style.background = finalTextColor;
    if (typeof desktopTextHexInput !== 'undefined' && desktopTextHexInput) desktopTextHexInput.value = finalTextColor.toUpperCase();
    if (typeof desktopScaleInput !== 'undefined' && desktopScaleInput) desktopScaleInput.value = String(percent);
    if (typeof desktopScaleVal !== 'undefined' && desktopScaleVal) desktopScaleVal.textContent = `${percent}%`;

    if (typeof desktopTextAutoBtn !== 'undefined' && desktopTextAutoBtn) {
      desktopTextAutoBtn.classList.toggle('active', isAutoText);
      desktopTextAutoBtn.textContent = isAutoText ? 'Auto: Ativo' : 'Auto: Desat.';
    }

    if (typeof desktopColorGrid !== 'undefined' && desktopColorGrid) {
      desktopColorGrid.querySelectorAll('.dice-color-swatch').forEach(swatch => {
        const c = /** @type {HTMLElement} */ (swatch).dataset.color;
        swatch.classList.toggle('active', c?.toLowerCase() === diceColor.toLowerCase());
      });
    }

    if (typeof desktopTextColorGrid !== 'undefined' && desktopTextColorGrid) {
      desktopTextColorGrid.querySelectorAll('.dice-color-swatch').forEach(swatch => {
        const c = /** @type {HTMLElement} */ (swatch).dataset.color;
        swatch.classList.toggle('active', !isAutoText && c?.toLowerCase() === finalTextColor.toLowerCase());
      });
    }
  }

  // ---- Sistema Dinâmico de Tintura dos Números 3D ----
  const themeNumberImgs = {};

  function loadBaseNumberImg(themeName = 'default') {
    if (themeNumberImgs[themeName]) return Promise.resolve(themeNumberImgs[themeName]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        themeNumberImgs[themeName] = img;
        resolve(img);
      };
      img.onerror = () => {
        if (themeName !== 'default') {
          loadBaseNumberImg('default').then(resolve);
        } else {
          resolve(null);
        }
      };
      let filename = 'diffuse-light.png';
      if (themeName === 'gemstone') filename = 'gemstone-light.png';
      img.src = `${resolveAssetPath()}themes/${themeName}/${filename}`;
    });
  }

  async function applyDiceTextColor(textColor, themeName = 'default') {
    if (!textColor) return;
    try {
      const img = await loadBaseNumberImg(themeName);
      if (!img) return;

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = textColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');

      // 1. Atualiza via cena do BabylonJS se acessível
      if (window.__diceBoxScene && window.__diceBoxScene.materials) {
        window.__diceBoxScene.materials.forEach(mat => {
          if (mat && mat.name && (mat.name.includes('_light') || mat.name.includes('_dark'))) {
            if (mat.diffuseTexture && typeof mat.diffuseTexture.updateURL === 'function') {
              mat.diffuseTexture.updateURL(dataUrl);
            }
          }
        });
      }

      // 2. Fallback para instâncias globais do Babylon se presentes
      // @ts-ignore
      const engines = window.BABYLON?.Engine?.Instances || [];
      for (const engine of engines) {
        if (!engine.scenes) continue;
        for (const scene of engine.scenes) {
          const mats = scene.materials || [];
          for (const mat of mats) {
            if (mat && mat.name && (mat.name.includes('_light') || mat.name.includes('_dark'))) {
              if (mat.diffuseTexture && typeof mat.diffuseTexture.updateURL === 'function') {
                mat.diffuseTexture.updateURL(dataUrl);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Falha ao aplicar cor customizada do texto nos dados 3D:', err);
    }
  }

  // Caminho absoluto a partir da raiz (ou subpasta), garantindo que sempre
  // comece e termine com barra para que a concatenação origin + assetPath
  // no Web Worker do @3d-dice/dice-box produza uma URL válida.
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
          const isAutoText = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false';
          const storedText = isAutoText ? getContrastColor(storedColor) : (localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff');
          let storedPercent = Number(localStorage.getItem(STORAGE_KEY_SCALE) || '100');
          if (!storedPercent || storedPercent < 30 || storedPercent > 200) {
            storedPercent = DEFAULT_PERCENT;
            try { localStorage.setItem(STORAGE_KEY_SCALE, String(DEFAULT_PERCENT)); } catch (_) {}
          }

          const baseScale3d = to3dScale(storedPercent);

          Box = new DiceBox({
            container: '#dice-box-canvas',
            assetPath: resolveAssetPath(),
            theme: storedTheme,
            geometry: storedGeometry,
            themeColor: storedColor,
            scale: baseScale3d,
            offscreen: false,       // renderiza no canvas principal para permitir tintura em tempo real dos números

            // Iluminação e sombra reais (config oficial, não hooks inventados)
            lightIntensity: 1.0,        // máximo suportado — brilho especular bem visível
            enableShadows: true,        // sombra projetada no tampo, ligada
            shadowTransparency: 0.75,   // sombra bem definida, não "lavada"

            // Física: leve ajuste pra queda mais "pesada" de resina física
            gravity: 1,
            mass: 1,
            friction: 0.8,
            restitution: 0.15,          // pequeno quique, como resina real batendo na mesa
            angularDamping: 0.4,
            linearDamping: 0.4,
            settleTimeout: 5000,

            suspendSimulation: false    // física real sempre ligada — nunca "fingir" a queda
          });

          await Box.init();
          isBoxReady = true;
          await Box.loadTheme(storedTheme);
          applyCustomStyles(storedColor, storedText, storedPercent, storedTheme, storedGeometry);
          return Box;
        } catch (err) {
          console.error("Erro inicializando dados 3D (Dice-Box):", err);
          boxInitPromise = null;
          isBoxReady = false;
          throw err;
        }
      })();
    }
    return boxInitPromise;
  }

  const isMobileOS = isAndroidOrIOS() || (typeof window !== 'undefined' && (window.innerWidth <= 768 || document.body?.classList.contains('is-mobile') || document.documentElement?.classList.contains('is-mobile')));
  const isGM = checkIsGM();

  // ============================================================
  // MODO 1: MOBILE (SPEED-DIAL FLUTUANTE)
  // ============================================================
  if (isMobileOS) {
    const mobileWrap = document.createElement('div');
    mobileWrap.id = 'playerDiceMobileWrap';
    mobileWrap.className = 'player-dice-mobile-wrap';
    mobileWrap.innerHTML = `
      <div class="player-dice-mobile-header">
        <div id="mobileSideControls" class="player-dice-mobile-side collapsed">
          ${isGM ? `
            <button type="button" id="mobileGmSecretBtn" class="mobile-control-btn secret-btn ${isSecretRoll ? 'secret' : 'public'}" title="Alternar visibilidade para os jogadores">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span id="mobileSecretLabel">${isSecretRoll ? 'OCULTO' : 'PÚBLICO'}</span>
            </button>
          ` : ''}

          <div class="mobile-mode-dropdown-wrap">
            <button type="button" id="mobileModeBtn" class="mobile-control-btn mode-btn" title="Modo de Rolagem">
              <span id="mobileModeLabel">NORMAL</span>
              <svg class="mode-arrow" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
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

          <div class="mobile-stepper-pill" title="Quantidade de dados">
            <span class="pill-label">Qtd</span>
            <button type="button" id="mobileCountDec" class="pill-btn">−</button>
            <input type="number" id="mobileCountInput" min="1" max="20" value="1" title="Qtd">
            <button type="button" id="mobileCountInc" class="pill-btn">+</button>
          </div>

          <div class="mobile-stepper-pill" title="Modificador numérico">
            <span class="pill-label">Mod</span>
            <button type="button" id="mobileModDec" class="pill-btn">−</button>
            <input type="number" id="mobileModInput" min="-99" max="99" value="0" title="Mod">
            <button type="button" id="mobileModInc" class="pill-btn">+</button>
          </div>
        </div>

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

      <div id="mobileDiceColumn" class="player-dice-mobile-column collapsed">
        ${FACES.map(f => `
          <button type="button" class="mobile-dice-col-btn" data-faces="${f}" title="Rolar d${f}">
            <span class="dice-col-svg">${DICE_SVGS[f]}</span>
            <span class="dice-col-label">d${f}</span>
          </button>
        `).join('')}
      </div>
    `;
    document.body.appendChild(mobileWrap);

    const mobileBtn = document.getElementById('mobileDiceBtn');
    const mobileSide = document.getElementById('mobileSideControls');
    const mobileCol = document.getElementById('mobileDiceColumn');

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
      mobileBtn?.classList.toggle('active', isExpanded);
      mobileSide?.classList.toggle('collapsed', !isExpanded);
      mobileCol?.classList.toggle('collapsed', !isExpanded);

      if (!isExpanded) {
        mModeMenu?.classList.add('hidden');
      }
    }

    mobileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileDrop();
    });

    mModeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      mModeMenu?.classList.toggle('hidden');
    });

    function setMobileMode(mode) {
      currentRollMode = mode;
      mModeItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-mode') === mode);
      });

      if (mode === 'adv') {
        if (mModeLabel) mModeLabel.textContent = 'VANTAGEM';
        if (mCountInput && parseInt(mCountInput.value, 10) === 1) mCountInput.value = '2';
      } else if (mode === 'dis') {
        if (mModeLabel) mModeLabel.textContent = 'DESVANTAGEM';
        if (mCountInput && parseInt(mCountInput.value, 10) === 1) mCountInput.value = '2';
      } else {
        if (mModeLabel) mModeLabel.textContent = 'NORMAL';
      }
      mModeMenu?.classList.add('hidden');
    }

    mModeItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setMobileMode(item.getAttribute('data-mode') || 'normal');
      });
    });

    mCountDec?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mCountInput.value, 10) || 1;
      if (val > 1) mCountInput.value = String(val - 1);
    });

    mCountInc?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mCountInput.value, 10) || 1;
      if (val < 20) mCountInput.value = String(val + 1);
    });

    mModDec?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mModInput.value, 10) || 0;
      if (val > -99) mModInput.value = String(val - 1);
    });

    mModInc?.addEventListener('click', (e) => {
      e.stopPropagation();
      let val = parseInt(mModInput.value, 10) || 0;
      if (val < 99) mModInput.value = String(val + 1);
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
  let desktopThemeSelect = null;
  let desktopGeometrySelect = null;
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
              <span class="dice-settings-label">Material / Textura 3D</span>
              <div class="dice-texture-picker-wrap">
                <select id="desktopThemeSelect" class="dice-theme-select" title="Selecione o material ou textura dos dados 3D">
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
              <span class="dice-settings-label">Formato / Geometria 3D</span>
              <div class="dice-texture-picker-wrap">
                <select id="desktopGeometrySelect" class="dice-theme-select" title="Selecione o formato geométrico dos dados">
                  <option value="auto">Padrão do Material (Automático)</option>
                  <option value="default">Padrão Tradicional (Icosaedro)</option>
                  <option value="gemstone">D20 Alongado / Cristal (Spindle)</option>
                  <option value="smooth">Arredondado (Bordas Suaves)</option>
                </select>
              </div>
            </div>

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
                  <span class="dice-color-swatch" data-color="#ff7a00" style="background: #ff7a00;" title="Âmbar"></span>
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
    desktopThemeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('desktopThemeSelect'));
    desktopGeometrySelect = /** @type {HTMLSelectElement} */ (document.getElementById('desktopGeometrySelect'));
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
      e.stopPropagation();
      const isOpen = desktopSettingsDrawer?.classList.toggle('open');
      desktopSettingsBtn?.classList.toggle('active', isOpen);
    });

    desktopThemeSelect?.addEventListener('change', async () => {
      const val = desktopThemeSelect.value || 'default';
      localStorage.setItem(STORAGE_KEY_THEME, val);
      const storedGeom = localStorage.getItem(STORAGE_KEY_GEOMETRY) || 'auto';
      if (Box && isBoxReady) {
        try {
          await Box.loadTheme(val);
        } catch (_) {}
      }
      applyCustomStyles(null, null, null, val, storedGeom);
    });

    desktopGeometrySelect?.addEventListener('change', async () => {
      const val = desktopGeometrySelect.value || 'auto';
      localStorage.setItem(STORAGE_KEY_GEOMETRY, val);
      const storedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'default';
      if (Box && isBoxReady) {
        try {
          await Box.updateConfig({ geometry: val, theme: storedTheme });
        } catch (_) {}
      }
      applyCustomStyles(null, null, null, storedTheme, val);
    });

    desktopColorPicker?.addEventListener('input', (e) => {
      const hex = /** @type {HTMLInputElement} */ (e.target).value;
      localStorage.setItem(STORAGE_KEY_DICE_COLOR, hex);
      applyCustomStyles(hex, null, null);
    });

    desktopHexInput?.addEventListener('change', (e) => {
      let val = /** @type {HTMLInputElement} */ (e.target).value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        localStorage.setItem(STORAGE_KEY_DICE_COLOR, val);
        applyCustomStyles(val, null, null);
      }
    });

    desktopColorGrid?.querySelectorAll('.dice-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const hex = /** @type {HTMLElement} */ (swatch).dataset.color;
        if (hex) {
          localStorage.setItem(STORAGE_KEY_DICE_COLOR, hex);
          applyCustomStyles(hex, null, null);
        }
      });
    });

    desktopTextColorPicker?.addEventListener('input', (e) => {
      const hex = /** @type {HTMLInputElement} */ (e.target).value;
      localStorage.setItem(STORAGE_KEY_TEXT_COLOR, hex);
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'false');
      applyCustomStyles(null, hex, null);
    });

    desktopTextHexInput?.addEventListener('change', (e) => {
      let val = /** @type {HTMLInputElement} */ (e.target).value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        localStorage.setItem(STORAGE_KEY_TEXT_COLOR, val);
        localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'false');
        applyCustomStyles(null, val, null);
      }
    });

    desktopTextAutoBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false';
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, current ? 'false' : 'true');
      applyCustomStyles(null, null, null);
    });

    desktopTextColorGrid?.querySelectorAll('.dice-color-swatch').forEach(swatch => {
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

    desktopScaleInput?.addEventListener('input', (e) => {
      const val = /** @type {HTMLInputElement} */ (e.target).value;
      localStorage.setItem(STORAGE_KEY_SCALE, val);
      applyCustomStyles(null, null, val);
    });

    desktopResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const sysAccent = getSystemAccent();
      localStorage.setItem(STORAGE_KEY_THEME, 'default');
      localStorage.setItem(STORAGE_KEY_GEOMETRY, 'auto');
      localStorage.setItem(STORAGE_KEY_DICE_COLOR, sysAccent);
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'true');
      localStorage.setItem(STORAGE_KEY_SCALE, String(DEFAULT_PERCENT));
      applyCustomStyles(sysAccent, null, DEFAULT_PERCENT, 'default', 'auto');
    });

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

    function selectFacesDesktop(faces) {
      selectedFaces = faces;
      desktopFaceButtons?.forEach(btn => {
        btn.classList.toggle('active', Number(/** @type {HTMLElement} */ (btn).dataset.faces) === faces);
      });
    }

    desktopFaceButtons?.forEach(btn => {
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
      const isGMActive = checkIsGM();
      const secretRow = document.getElementById('gmSecretDiceRow');
      if (secretRow) secretRow.classList.toggle('hidden', !isGMActive);
      desktopOverlay?.classList.add('open');
      initBox();
    }

    function closeDesktopDice() {
      desktopOverlay?.classList.remove('open');
      desktopSettingsDrawer?.classList.remove('open');
      desktopSettingsBtn?.classList.remove('active');
      clearSettledDice();
    }

    pcDiceBtn?.addEventListener('click', openDesktopDice);
    const handleEl = desktopOverlay?.querySelector('.player-dice-handle-wrap');
    handleEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDesktopDice();
    });
    desktopOverlay?.addEventListener('click', (e) => {
      if (e.target === desktopOverlay) closeDesktopDice();
    });

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
  // CÁLCULO FÍSICO REAL E DETERMINAÇÃO DA FACE SUPERIOR (MÉTODO 1)
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

  // Extrai os valores REAIS das faces que ficaram voltadas para cima
  // após a simulação física do @3d-dice/dice-box. O formato retornado
  // por Box.roll() é um array de "roll groups", cada um com um array
  // `rolls` de Die Result Objects ({ value, sides, groupId, rollId... }).
  // Ver: https://fantasticdice.games/docs/usage/objects
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

    // Fallback de segurança apenas se a física genuinamente não
    // retornou nada legível (ex.: erro de carregamento de assets) —
    // nunca usado quando a simulação real funcionou.
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

    // Notação simples (sem target/@ — essa lib não suporta forçar
    // face de queda). Guardamos para exibição/depuração apenas.
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
      // Roda a simulação física 3D real no canvas com o tema e geometria selecionados
      const rollResult = await Box.roll(naturalNotation, { theme: storedTheme, geometry: storedGeometry, themeColor: diceColor });
      // Extrai os valores exatos das faces que ficaram voltadas para cima
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

    if (window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll(payload);
    }

    showDiceResultPopup(payload);
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
      const rollResult = await Box.roll(naturalNotation, { theme: storedTheme, geometry: storedGeometry, themeColor: diceColor });
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

    showDiceResultPopup(payload);
  }

  // ---- Recepção de rolagem remota ----
  // Esta biblioteca não suporta "target notation" (forçar a face de
  // queda). Por isso, quem RECEBE a rolagem via WebRTC roda sua PRÓPRIA
  // simulação física independente — visualmente diferente da tela de
  // quem rolou — apenas como espetáculo decorativo. O número que
  // importa (data.rolls / data.sum) já veio pronto de quem realmente
  // rolou e é o que aparece no popup do HUD, idêntico em todas as telas.
  window.RPG = window.RPG || {};
  window.RPG.onRemoteDiceRoll = async (data) => {
    if (!data) return;
    clearSettledDice();
    const faces = data.faces || 20;
    const count = data.count || (Array.isArray(data.rolls) ? data.rolls.length : 1);
    const notation = `${count}d${faces}`;
    const remoteTheme = data.theme || 'default';
    const remoteGeometry = data.geometry || 'auto';

    try {
      await initBox();
      if (data.diceColor || data.labelColor || data.theme || data.geometry) {
        applyCustomStyles(data.diceColor, data.labelColor, null, remoteTheme, remoteGeometry);
      }
      // Roda a física de verdade na tela de quem recebeu com a mesma textura e geometria
      await Box.roll(notation, { theme: remoteTheme, geometry: remoteGeometry, themeColor: data.diceColor });
      hasSettledDice = true;
    } catch (err) {
      console.warn("Fallback rolagem remota 3D:", err);
    } finally {
      showDiceResultPopup(data);
    }
  };

  initBox();

  // API pública
  // @ts-ignore
  window.RPG.rollDice = (faces, count = 1, mod = 0) => {
    if (checkIsGM()) {
      gmRoll(faces, count, mod);
    } else {
      playerRoll(faces, count, mod);
    }
  };
})();
