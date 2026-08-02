/* ============================================================
   GM init: final init calls to kick off the first render. Loads absolute
   last — calls functions from every other GM file.
   ============================================================ */

(() => {
  'use strict';

  window.RPG.resizeCanvas();
  window.RPG.centerView();
  window.RPG.renderParty();
  window.RPG.renderSceneList();
  window.RPG.renderObjectList();
})();
