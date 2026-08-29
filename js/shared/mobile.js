/**
 * ============================================================
 * RPG VTT — Módulo de Reconhecimento Mobile & Touch
 * ============================================================
 * Detecta dinamicamente se o dispositivo é mobile / touch / tela pequena,
 * atualiza classes no HTML/DOM e dispara eventos reativos.
 */

// Regex para detecção abrangente de navegadores e dispositivos móveis
const MOBILE_UA_REGEX = /Mobile|Android|iP(hone|od|ad)|Silk|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i;

// Lista de ouvintes de mudança de estado mobile
const changeListeners = new Set();

let lastIsMobile = null;
let lastIsTouch = null;
let lastIsSmallScreen = null;

/**
 * Verifica se o dispositivo possui capacidades touch
 * @returns {boolean}
 */
export function isTouchDevice() {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Verifica se a tela atual é considerada de tamanho móvel (<= 768px)
 * @returns {boolean}
 */
export function isSmallScreen() {
  return window.innerWidth <= 768 || window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Reconhece se o usuário está em um dispositivo móvel
 * Critérios:
 * 1. User Agent mobile OU
 * 2. Largura de tela <= 768px OU
 * 3. Tela de toque combinada com tela <= 900px ou ponteiro grosso (coarse)
 * @returns {boolean}
 */
export function isMobile() {
  const uaMatch = MOBILE_UA_REGEX.test(navigator.userAgent || '');
  const small = isSmallScreen();
  const touch = isTouchDevice();
  const pointerCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hoverNone = window.matchMedia('(hover: none)').matches;

  return uaMatch || small || (touch && (window.innerWidth <= 900 || pointerCoarse || hoverNone));
}

/**
 * Retorna o estado detalhado do dispositivo
 */
export function getDeviceInfo() {
  const mobile = isMobile();
  const touch = isTouchDevice();
  const small = isSmallScreen();
  const isPortrait = window.innerHeight >= window.innerWidth;

  return {
    isMobile: mobile,
    isTouch: touch,
    isSmallScreen: small,
    isPortrait,
    isLandscape: !isPortrait,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent
  };
}

/**
 * Registra um callback para ser notificado quando o estado mobile/tela mudar
 * @param {(info: ReturnType<typeof getDeviceInfo>) => void} callback
 * @returns {() => void} Função de cleanup / cancelamento
 */
export function onMobileChange(callback) {
  if (typeof callback === 'function') {
    changeListeners.add(callback);
  }
  return () => changeListeners.delete(callback);
}

/**
 * Atualiza classes no elemento raiz (<html> e <body>) e notifica ouvintes se houve alteração
 */
export function updateMobileClasses() {
  const mobile = isMobile();
  const touch = isTouchDevice();
  const small = isSmallScreen();
  const isPortrait = window.innerHeight >= window.innerWidth;

  const docEl = document.documentElement;
  const body = document.body;

  // Atualiza classes no HTML
  docEl.classList.toggle('is-mobile', mobile);
  docEl.classList.toggle('is-desktop', !mobile);
  docEl.classList.toggle('is-touch', touch);
  docEl.classList.toggle('is-small-screen', small);
  docEl.classList.toggle('is-portrait', isPortrait);
  docEl.classList.toggle('is-landscape', !isPortrait);

  // Também no body para máxima compatibilidade com seletores CSS
  if (body) {
    body.classList.toggle('is-mobile', mobile);
    body.classList.toggle('is-desktop', !mobile);
    body.classList.toggle('is-touch', touch);
    body.classList.toggle('is-small-screen', small);
    body.classList.toggle('is-portrait', isPortrait);
    body.classList.toggle('is-landscape', !isPortrait);
  }

  // Se houve alteração em algum dos estados principais, dispara evento e callbacks
  if (mobile !== lastIsMobile || touch !== lastIsTouch || small !== lastIsSmallScreen) {
    lastIsMobile = mobile;
    lastIsTouch = touch;
    lastIsSmallScreen = small;

    const info = getDeviceInfo();

    // Evento CustomEvent no DOM
    const event = new CustomEvent('rpg:mobile-change', {
      bubbles: true,
      detail: info
    });
    window.dispatchEvent(event);
    document.dispatchEvent(event);

    // Callbacks registrados
    changeListeners.forEach(cb => {
      try {
        cb(info);
      } catch (err) {
        console.error('[mobile.js] Erro no listener onMobileChange:', err);
      }
    });
  }
}

// ---- Inicialização Automática ----
(() => {
  if (typeof window === 'undefined') return;

  // Executa imediatamente
  updateMobileClasses();

  // Executa no DOMContentLoaded se necessário
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateMobileClasses, { once: true });
  }

  // Throttle para redimensionamento suave
  let resizeTimer = null;
  const onResize = () => {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(() => {
      updateMobileClasses();
      resizeTimer = null;
    });
  };

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(updateMobileClasses, 100);
  }, { passive: true });

  // Ouvinte para media query
  try {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.addEventListener) {
      mq.addEventListener('change', onResize);
    } else if (mq.addListener) {
      mq.addListener(onResize);
    }
  } catch (e) {}

  // Expõe na API global window.RPG
  // @ts-ignore
  window.RPG = window.RPG || {};
  // @ts-ignore
  window.RPG.isMobile = isMobile;
  // @ts-ignore
  window.RPG.isTouch = isTouchDevice;
  // @ts-ignore
  window.RPG.isSmallScreen = isSmallScreen;
  // @ts-ignore
  window.RPG.getDeviceInfo = getDeviceInfo;
  // @ts-ignore
  window.RPG.onMobileChange = onMobileChange;

  // Global direta para conveniência
  // @ts-ignore
  window.isMobileDevice = isMobile;
})();
