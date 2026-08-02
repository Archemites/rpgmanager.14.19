/* ============================================================
   Shared: vision-reach formula, identical on both windows.
   ============================================================ */

(function() {
  'use strict';

  const BASE_VISION_RANGE = 320;  // world px at lighting = 1
  const DEFAULT_VISION_ANGLE = 120;   // cone width in degrees
  const DEFAULT_VISION_MULT = 1;      // per-token range multiplier

  // Total world-px reach of a token's vision cone, including its own body radius.
  // reach(px) = token.r + BASE_VISION_RANGE * state.lighting * token.visionMult
  function tokenVisionReach(t, lighting) {
    const mult = (typeof t.visionMult === 'number') ? t.visionMult : DEFAULT_VISION_MULT;
    return t.r + BASE_VISION_RANGE * lighting * mult;
  }

  window.RPG = window.RPG || {};
  window.RPG.BASE_VISION_RANGE = BASE_VISION_RANGE;
  window.RPG.DEFAULT_VISION_ANGLE = DEFAULT_VISION_ANGLE;
  window.RPG.DEFAULT_VISION_MULT = DEFAULT_VISION_MULT;
  window.RPG.tokenVisionReach = tokenVisionReach;
})();
