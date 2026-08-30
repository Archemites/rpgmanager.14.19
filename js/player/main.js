/**
 * Ponto de entrada do Jogador — importa todos os módulos na ordem correta.
 * Os módulos compartilhados (shared/) rodam antes dos módulos player (player/).
 * Vendor libs (peerjs, qrcode, jsQR) são carregadas como scripts normais no HTML
 * e ficam disponíveis em window.*
 */
window.RPG = window.RPG || {};
window.RPG.isGM = false;

// --- Shared (infraestrutura comum entre GM e Jogador) ---
import '../shared/mobile.js';
import '../shared/webrtc.js';
import '../shared/camera.js';
import '../shared/photo-cache.js';
import '../shared/object-cache.js';
import '../shared/bars.js';
import '../shared/scene-render.js';
import '../shared/fx-trail.js';

// --- Player modules ---
import './state.js';
import './combat.js';
import './draw.js';
import './fullscreen.js';
import './sync.js';
