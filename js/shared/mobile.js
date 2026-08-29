/**
 * ============================================================
 * RPG VTT — Módulo de Reconhecimento Mobile & Touch
 * ============================================================
 * Detecta dinamicamente se o dispositivo é Android ou iOS,
 * atualiza classes no HTML/DOM e dispara eventos reativos.
 */

// Lista de ouvintes de mudança de estado mobile
const changeListeners = new Set();

let lastIsMobile = null;
let lastIsTouch = null;

/**
 * Verifica estritamente se o dispositivo é Android ou iOS (iPhone, iPad, iPod)
 * @returns {boolean}
 */
export function isAndroidOrIOS() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isAndroid || isIOS;
}

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
 * Retorna true se for um dispositivo móvel (Android ou iOS)
 * @returns {boolean}
 */
export function isMobile() {
  return isAndroidOrIOS();
}

/**
 * Retorna o estado detalhado do dispositivo
 */
export function getDeviceInfo() {
  const mobile = isAndroidOrIOS();
  const touch = isTouchDevice();
  const isPortrait = window.innerHeight >= window.innerWidth;

  return {
    isMobile: mobile,
    isAndroidOrIOS: mobile,
    isTouch: touch,
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
 * @returns {() => void} Função de cleanup
 */
export function onMobileChange(callback) {
  if (typeof callback === 'function') {
    changeListeners.add(callback);
  }
  return () => changeListeners.delete(callback);
}

/**
 * Atualiza classes no elemento raiz (<html> e <body>)
 */
export function updateMobileClasses() {
  const mobile = isAndroidOrIOS();
  const touch = isTouchDevice();
  const isPortrait = window.innerHeight >= window.innerWidth;

  const docEl = document.documentElement;
  const body = document.body;

  docEl.classList.toggle('is-mobile', mobile);
  docEl.classList.toggle('is-desktop', !mobile);
  docEl.classList.toggle('is-touch', touch);
  docEl.classList.toggle('is-portrait', isPortrait);
  docEl.classList.toggle('is-landscape', !isPortrait);

  if (body) {
    body.classList.toggle('is-mobile', mobile);
    body.classList.toggle('is-desktop', !mobile);
    body.classList.toggle('is-touch', touch);
    body.classList.toggle('is-portrait', isPortrait);
    body.classList.toggle('is-landscape', !isPortrait);
  }

  if (mobile !== lastIsMobile || touch !== lastIsTouch) {
    lastIsMobile = mobile;
    lastIsTouch = touch;

    const info = getDeviceInfo();
    const event = new CustomEvent('rpg:mobile-change', {
      bubbles: true,
      detail: info
    });
    window.dispatchEvent(event);
    document.dispatchEvent(event);

    changeListeners.forEach(cb => {
      try { cb(info); } catch (err) { console.error('[mobile.js] Erro no listener:', err); }
    });
  }
}

// ---- Inicialização Automática ----
(() => {
  if (typeof window === 'undefined') return;

  updateMobileClasses();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateMobileClasses, { once: true });
  }

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

  // @ts-ignore
  window.RPG = window.RPG || {};
  // @ts-ignore
  window.RPG.isMobile = isMobile;
  // @ts-ignore
  window.RPG.isAndroidOrIOS = isAndroidOrIOS;
  // @ts-ignore
  window.RPG.isTouch = isTouchDevice;
  // @ts-ignore
  window.RPG.getDeviceInfo = getDeviceInfo;
  // @ts-ignore
  window.RPG.onMobileChange = onMobileChange;

  // @ts-ignore
  window.isMobileDevice = isMobile;
})();
