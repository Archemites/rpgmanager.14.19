// @ts-ignore
import DiceBox from 'https://cdn.jsdelivr.net/npm/@drdreo/dice-box-threejs@1.1.0/dist/dice-box-threejs.es.js';
import { isAndroidOrIOS } from './mobile.js';

/* ============================================================
   Player & GM dice roller — Foundry VTT / Dice So Nice! Style
   - Three.js + Cannon-es 100% Client-Side no GitHub Pages
   - Customização de Cores (Dado, Números), Escala e Iluminação sRGB
   - Sorteio determinístico no algoritmo + simulação 3D armada
   - Pop-up HUD moderno pós-assentamento dos dados
   - Sincronização WebRTC em tempo real
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
  let boxCanvas = document.getElementById('dice-box-canvas');
  if (!boxCanvas) {
    boxCanvas = document.createElement('div');
    boxCanvas.id = 'dice-box-canvas';
    document.body.appendChild(boxCanvas);
  }

  // ---- Container HUD de Pop-ups ----
  let hudContainer = document.getElementById('diceResultHudContainer');
  if (!hudContainer) {
    hudContainer = document.createElement('div');
    hudContainer.id = 'diceResultHudContainer';
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
  // MOTOR 3D (THREE.JS + CANNON-ES)
  // ============================================================
  let Box = null;
  let isBoxReady = false;
  let isRolling = false;
  let hasSettledDice = false;
  let boxInitPromise = null;

  function clearSettledDice() {
    if (Box && isBoxReady) {
      try {
        Box.clearDice();
      } catch (_) {}
    }
    hasSettledDice = false;
  }

  // Limpa os dados ao clicar em qualquer lugar da tela após a rolagem
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

  function patchDiceFactory(factory) {
    if (!factory || factory.__dicePatched) return;
    factory.__dicePatched = true;

    const diceKeys = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'd2'];
    diceKeys.forEach(k => {
      try {
        const def = factory.get(k);
        if (def && !def.font) def.font = 'sans-serif';
      } catch (_) {}
    });

    try {
      const d100Def = factory.get('d100');
      if (d100Def && Array.isArray(d100Def.values)) {
        if (!d100Def.font) d100Def.font = 'sans-serif';
        const zeroIdx = d100Def.values.findIndex(v => v === 0 || v === '0' || v === '00' || v === 100);
        const targetZeroIdx = zeroIdx !== -1 ? zeroIdx : 0;
        if (!d100Def.values.includes(100)) {
          d100Def.values.push(100);
          if (Array.isArray(d100Def.normals)) d100Def.normals.push(d100Def.normals[targetZeroIdx]);
        }
        if (!d100Def.values.includes(0)) {
          d100Def.values.push(0);
          if (Array.isArray(d100Def.normals)) d100Def.normals.push(d100Def.normals[targetZeroIdx]);
        }
      }
    } catch (_) {}

    const origGet = factory.get.bind(factory);
    factory.get = function(type) {
      const def = origGet(type);
      if (def && !def.font) def.font = 'sans-serif';
      return def;
    };

    // Remove traçado/borda artificial dos dados (definição 100% por luz e geometria)
    factory.margin = 0;
    factory.edge_color = '';

    // Sobrescreve draw_face_texture para criar o material visual de RESINA FÍSICA
    // (Translúcido, com profundidade óptica interna, micropartículas e contraste nítido)
    const origDrawFaceTexture = factory.draw_face_texture?.bind(factory);
    if (origDrawFaceTexture) {
      factory.draw_face_texture = function(canvas, text, color, margin) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const diceColor = factory.dice_color || (Box && Box.themeColor) || '#45ff78';
        const textColor = factory.label_color || (Box && Box.labelColor) || '#ffffff';

        ctx.save();
        
        // 1. Cor base profunda da resina
        ctx.fillStyle = diceColor;
        ctx.fillRect(0, 0, w, h);

        // 2. Gradiente óptico de refração e profundidade translúcida no centro da face
        const grad = ctx.createRadialGradient(w * 0.45, h * 0.42, w * 0.08, w * 0.5, h * 0.5, w * 0.65);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
        grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.1)');
        grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 3. Micropartículas e glitter suspensos no interior da resina
        const str = String(text || '1');
        const seed = (str.charCodeAt(0) || 1) * 37 + (str.length * 13);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        for (let i = 0; i < 7; i++) {
          const px = ((seed * (i + 1) * 19) % (w - 24)) + 12;
          const py = ((seed * (i + 2) * 29) % (h - 24)) + 12;
          const pr = ((seed * (i + 3)) % 2) + 1.2;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. Desenha o número com nitidez máxima e relevo
        origDrawFaceTexture(canvas, text, textColor, 0);
        ctx.restore();
      };
    }

    const origCreateMaterials = factory.create_materials?.bind(factory);
    if (origCreateMaterials) {
      factory.create_materials = function(dice, margin, before_face, after_face) {
        return origCreateMaterials(dice, 0, before_face, after_face);
      };
    }

    const origCreateMaterial = factory.create_material?.bind(factory);
    if (origCreateMaterial) {
      factory.create_material = function(dice, margin, before_face, after_face) {
        const mat = origCreateMaterial(dice, 0, before_face, after_face);
        if (mat) {
          if (mat.map) {
            if ('colorSpace' in mat.map) mat.map.colorSpace = 'srgb';
            else if ('encoding' in mat.map) mat.map.encoding = 3001; // sRGBEncoding
            mat.map.needsUpdate = true;
          }
          mat.color?.setHex(0xffffff);
          mat.flatShading = true;
          mat.shininess = 135;
          mat.specular?.setHex(0xffffff);
          mat.needsUpdate = true;
        }
        return mat;
      };
    }

    // Material de Resina com flatShading puro e verniz de alto brilho
    factory.material_options = {
      specular: 0xffffff,
      color: 0xffffff,
      shininess: 135,
      flatShading: true
    };
  }

  function calibrateSceneLighting(box) {
    if (!box) return;
    if (box.renderer) {
      if ('outputColorSpace' in box.renderer) {
        box.renderer.outputColorSpace = 'srgb';
      } else if ('outputEncoding' in box.renderer) {
        box.renderer.outputEncoding = 3001; // sRGBEncoding
      }
      box.renderer.toneMapping = 0; // Linear para fidelidade total
      box.renderer.toneMappingExposure = 1.35;
      if (box.renderer.shadowMap) {
        box.renderer.shadowMap.enabled = true;
        box.renderer.shadowMap.type = 2; // THREE.PCFSoftShadowMap
      }
    }

    // Luz Ambiente: Base limpa para que todas as faces mantenham a cor do picker
    if (box.light_amb) {
      box.light_amb.color.setHex(0xffffff);
      if (box.light_amb.groundColor) box.light_amb.groundColor.setHex(0xffffff);
      box.light_amb.intensity = 1.1;
    }

    // LÂMPADA CENTRAL SUSPENSA NO CENTRO DA TELA (Ponto de luz acima do tabuleiro)
    if (box.light) {
      box.light.color.setHex(0xffffff);
      box.light.intensity = 4.2;
      box.light.castShadow = true;
      if (box.light.position) box.light.position.set(0, 190, 35);
      if (box.light.target && box.light.target.position) box.light.target.position.set(0, 0, 0);
      if (box.light.shadow) {
        box.light.shadow.mapSize.width = 2048;
        box.light.shadow.mapSize.height = 2048;
        box.light.shadow.camera.near = 10;
        box.light.shadow.camera.far = 500;
        box.light.shadow.bias = -0.0012;
      }
    }

    // Halo secundário da lâmpada central para irradiação e brilho radial
    if (box.spotlight) {
      box.spotlight.color.setHex(0xffffff);
      box.spotlight.intensity = 2.2;
      box.spotlight.castShadow = false;
      if (box.spotlight.position) box.spotlight.position.set(0, 150, 20);
      if (box.spotlight.target && box.spotlight.target.position) box.spotlight.target.position.set(0, 0, 0);
    }

    // Desk / Chão: Configurado para receber a sombra projetada
    if (box.desk) {
      box.desk.receiveShadow = true;
    }
  }

  function getSystemAccent() {
    const rootStyle = getComputedStyle(document.documentElement);
    let accent = rootStyle.getPropertyValue('--accent').trim();
    if (!accent || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) {
      accent = '#45ff78';
    }
    return accent;
  }

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

  const DEFAULT_PERCENT = 100;

  function to3dScale(percent) {
    const p = Math.max(1, Math.min(100, Number(percent) || DEFAULT_PERCENT));
    return Math.max(20, Math.round(p * 1.8));
  }

  function applyCustomStyles(themeColor, textColor, scaleVal) {
    const diceColor = themeColor || localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent();
    const isAutoText = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false';
    const finalTextColor = isAutoText ? getContrastColor(diceColor) : (textColor || localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff');
    
    let percent = Number(scaleVal || localStorage.getItem(STORAGE_KEY_SCALE) || '0');
    if (!percent || percent < 1 || percent > 100) percent = DEFAULT_PERCENT;

    const baseScale3d = to3dScale(percent);

    if (Box && isBoxReady) {
      try {
        Box.themeColor = diceColor;
        Box.labelColor = finalTextColor;
        Box.dice_color = diceColor;
        Box.label_color = finalTextColor;
        Box.baseScale = baseScale3d;
        if (Box.DiceFactory) {
          Box.DiceFactory.dice_color = diceColor;
          Box.DiceFactory.label_color = finalTextColor;
          Box.DiceFactory.materials = {};
          Box.DiceFactory.cache = {};
          Box.DiceFactory.dice = {};
          Box.DiceFactory.geometries = {};
          if (Box.DiceFactory.material_options) {
            Box.DiceFactory.material_options.shininess = 135;
            Box.DiceFactory.material_options.flatShading = true;
            Box.DiceFactory.material_options.specular = 0xffffff;
          }
        }
      } catch (_) {}
    }

    // Atualiza controles Desktop
    if (desktopColorPicker) desktopColorPicker.value = diceColor;
    if (desktopActivePreview) desktopActivePreview.style.background = diceColor;
    if (desktopHexInput) desktopHexInput.value = diceColor.toUpperCase();
    if (desktopTextColorPicker) desktopTextColorPicker.value = finalTextColor;
    if (desktopTextActivePreview) desktopTextActivePreview.style.background = finalTextColor;
    if (desktopTextHexInput) desktopTextHexInput.value = finalTextColor.toUpperCase();
    if (desktopScaleInput) desktopScaleInput.value = String(percent);
    if (desktopScaleVal) desktopScaleVal.textContent = `${percent}%`;

    if (desktopTextAutoBtn) {
      desktopTextAutoBtn.classList.toggle('active', isAutoText);
      desktopTextAutoBtn.textContent = isAutoText ? 'Auto: Ativo' : 'Auto: Desat.';
    }

    if (desktopColorGrid) {
      desktopColorGrid.querySelectorAll('.dice-color-swatch').forEach(swatch => {
        const c = /** @type {HTMLElement} */ (swatch).dataset.color;
        swatch.classList.toggle('active', c?.toLowerCase() === diceColor.toLowerCase());
      });
    }

    if (desktopTextColorGrid) {
      desktopTextColorGrid.querySelectorAll('.dice-color-swatch').forEach(swatch => {
        const c = /** @type {HTMLElement} */ (swatch).dataset.color;
        swatch.classList.toggle('active', !isAutoText && c?.toLowerCase() === finalTextColor.toLowerCase());
      });
    }
  }

  function initBox() {
    if (isBoxReady && Box) return Promise.resolve(Box);
    if (!boxInitPromise) {
      boxInitPromise = (async () => {
        try {
          const storedColor = localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent();
          const isAutoText = localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false';
          const storedText = isAutoText ? getContrastColor(storedColor) : (localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff');
          let storedPercent = Number(localStorage.getItem(STORAGE_KEY_SCALE) || '0');
          if (!storedPercent || storedPercent < 1 || storedPercent > 100) {
            storedPercent = DEFAULT_PERCENT;
            try { localStorage.setItem(STORAGE_KEY_SCALE, String(DEFAULT_PERCENT)); } catch (_) {}
          }

          const baseScale3d = to3dScale(storedPercent);

          Box = new DiceBox("#dice-box-canvas", {
            assetPath: "https://cdn.jsdelivr.net/npm/@drdreo/dice-box-threejs@1.1.0/dist",
            sounds: false,
            shadows: false,
            theme_surface: "green-felt",
            sound_dieMaterial: "plastic",
            theme_material: "plastic",
            themeColor: storedColor,
            labelColor: storedText,
            color_spotlight: 0xffffff,
            light_intensity: 1.4,
            baseScale: baseScale3d,
            gravity_multiplier: 400
          });

          await Box.initialize();
          isBoxReady = true;
          calibrateSceneLighting(Box);
          if (Box.DiceFactory) patchDiceFactory(Box.DiceFactory);
          applyCustomStyles(storedColor, storedText, storedPercent);
          return Box;
        } catch (err) {
          console.error("Erro inicializando Foundry / Dice So Nice 3D:", err);
          boxInitPromise = null;
          isBoxReady = false;
          throw err;
        }
      })();
    }
    return boxInitPromise;
  }

  const isMobileOS = isAndroidOrIOS();
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
                  <span class="dice-color-swatch" data-color="#45ff78" style="background: #45ff78;" title="Neon"></span>
                </div>
              </div>
            </div>

            <div class="dice-settings-row">
              <div class="dice-scale-row">
                <span class="dice-settings-label">Tamanho dos Dados 3D</span>
                <input type="range" id="desktopScaleInput" class="dice-scale-slider" min="1" max="100" value="100" step="1">
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
      e.stopPropagation();
      const isOpen = desktopSettingsDrawer?.classList.toggle('open');
      desktopSettingsBtn?.classList.toggle('active', isOpen);
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
      localStorage.setItem(STORAGE_KEY_DICE_COLOR, sysAccent);
      localStorage.setItem(STORAGE_KEY_TEXT_AUTO, 'true');
      localStorage.setItem(STORAGE_KEY_SCALE, String(DEFAULT_PERCENT));
      applyCustomStyles(sysAccent, null, DEFAULT_PERCENT);
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
  // CÁLCULO E ROLAGEM DETERMINÍSTICA ARMADA
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

  function get3dTargetNotation(faces, count, rolls) {
    if (faces === 100) {
      const targets = rolls.map(r => {
        if (r === 100) return 0;
        return Math.floor(r / 10) * 10;
      });
      return `${count}d100@${targets.join(',')}`;
    }
    return `${count}d${faces}@${rolls.join(',')}`;
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
      expr = `[ADV: ${rolls.join(', ')}] → Maior: ${finalDiceValue}${modStr ? ' ' + modStr + ' = ' + sum : ''}`;
    } else if (mode === 'dis') {
      expr = `[DIS: ${rolls.join(', ')}] → Menor: ${finalDiceValue}${modStr ? ' ' + modStr + ' = ' + sum : ''}`;
    } else if (mod !== 0) {
      expr = diceCount === 1 ? `Dado: [${rolls[0]}] ${modStr} = ${sum}` : `Dados: [${rolls.join(' + ')}] ${modStr} = ${sum}`;
    } else {
      expr = diceCount === 1 ? `Dado: [${rolls[0]}]` : `Dados: [${rolls.join(' + ')}] = ${sum}`;
    }

    const notation = get3dTargetNotation(faces, diceCount, rolls);

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
    const senderName = getLocalCharacterName();

    const payload = {
      ...rollData,
      senderName,
      diceColor: localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent(),
      labelColor: localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false' ? getContrastColor(localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent()) : (localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff')
    };

    if (window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll(payload);
    }

    try {
      await initBox();
      applyCustomStyles(payload.diceColor, payload.labelColor, null);
      await Box.roll(rollData.notation);
      hasSettledDice = true;
    } catch (err) {
      console.warn("Fallback rolagem 3D:", err);
    } finally {
      isRolling = false;
      showDiceResultPopup(payload);
    }
  }

  // ---- Rolagem do MESTRE ----
  async function gmRoll(faces, count = 1, mod = 0) {
    if (isRolling) return;
    clearSettledDice();
    isRolling = true;
    const mode = currentRollMode || 'normal';
    const rollData = executeRoll(faces, count, mod, mode);

    const payload = {
      ...rollData,
      senderName: 'Mestre',
      diceColor: localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent(),
      labelColor: localStorage.getItem(STORAGE_KEY_TEXT_AUTO) !== 'false' ? getContrastColor(localStorage.getItem(STORAGE_KEY_DICE_COLOR) || getSystemAccent()) : (localStorage.getItem(STORAGE_KEY_TEXT_COLOR) || '#ffffff')
    };

    if (!isSecretRoll && window.RPG && typeof window.RPG.sendDiceRoll === 'function') {
      window.RPG.sendDiceRoll(payload);
    }

    try {
      await initBox();
      applyCustomStyles(payload.diceColor, payload.labelColor, null);
      await Box.roll(rollData.notation);
      hasSettledDice = true;
    } catch (err) {
      console.warn("Fallback rolagem 3D mestre:", err);
    } finally {
      isRolling = false;
      showDiceResultPopup(payload);
    }
  }

  // ---- Recepção de rolagem remota ----
  window.RPG = window.RPG || {};
  window.RPG.onRemoteDiceRoll = async (data) => {
    if (!data) return;
    clearSettledDice();
    const notation = data.notation || get3dTargetNotation(data.faces || 20, data.count || (data.rolls ? data.rolls.length : 1), data.rolls || [1]);

    try {
      await initBox();
      if (data.diceColor || data.labelColor) {
        applyCustomStyles(data.diceColor, data.labelColor, null);
      }
      await Box.roll(notation);
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
