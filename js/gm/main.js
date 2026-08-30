/**
 * Ponto de entrada do GM — importa todos os módulos na ordem correta.
 * Os módulos compartilhados (shared/) rodam antes dos módulos GM (gm/).
 * Vendor libs (peerjs, qrcode) são carregadas como scripts normais no HTML
 * e ficam disponíveis em window.* quando estes imports executam.
 */

window.RPG = window.RPG || {};
window.RPG.isGM = true;

// --- Shared (infraestrutura comum entre GM e Jogador) ---
import '../shared/mobile.js';
import '../shared/webrtc.js';
import '../shared/camera.js';
import '../shared/photo-cache.js';
import '../shared/object-cache.js';
import '../shared/bars.js';
import '../shared/scene-render.js';
import '../shared/fx-trail.js';

// --- GM core ---
import './state.js';
import './history.js';
import './scenes.js';
import './sync.js';
import './hit-test.js';
import './draw.js';
import './map-grid-lighting.js';

// --- GM UI ---
import './token-modal.js';
import './crop-editor.js';
import './context-menu.js';
import './note-modal.js';
import './note-postit.js';
import './token-list.js';
import './objects.js';
import './effects-picker.js';
import './glossary.js';
import './bar-editor.js';
import './party.js';

document.dispatchEvent(new CustomEvent('rpg:connected'));
import './combat.js';
import './tools.js';
import './fx-settings.js';
import './session-io.js';
import './theme.js';
import './mouse.js';
import './hotkeys.js';

// --- Features extras ---
import '../features/measure.js';

// --- Init (deve rodar por último, quando tudo já está registrado em window.RPG) ---
import './init.js';
