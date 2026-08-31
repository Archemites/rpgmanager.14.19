
(() => {
  'use strict';

  // ============================================================
  // Camera model: world coords → screen coords
  //   screenX = (worldX - cam.x) * cam.zoom
  //   screenY = (worldY - cam.y) * cam.zoom
  // cam.x/cam.y = world point at the top-left corner of the screen.
  // All drawing happens on ONE canvas sized to the viewport;
  // the camera is applied via ctx.setTransform. No CSS transforms.
  // ============================================================

  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 6;
  const BASE_TOKEN_RADIUS = 20;
  const MAX_ACTIVE_BARS = 2;   // how many party bars can render on the map at once

  // Vision / lighting defaults
  const DEFAULT_VISION_ANGLE = 120;   // cone width in degrees
  const DEFAULT_VISION_MULT = 1;      // per-token range multiplier
  // Global lighting factor → base vision reach in WORLD px. 0 = tokens see nothing
  // beyond their own body; higher = the cone reaches deeper into the fog.
  const BASE_VISION_RANGE = 320;      // world px at lighting = 1
  const ROTATE_HANDLE_R = 7;          // rotation knob radius in SCREEN px

  const cam = { x: 0, y: 0, zoom: 1 };

  // Master token list across ALL scenes — never filtered. `state.tokens` (below)
  // is always a recomputed view of just the tokens present in the open scene;
  // see `refreshVisibleTokens()`. Mutate `allTokens` (push/splice), not
  // `state.tokens` directly, then call `refreshVisibleTokens()`.
  const allTokens = [];

  const state = {
    grid: { show: true, size: 48, color: '#45ff78' },
    map: { img: null, scalePct: 100, dataUrl: null },  // image is centered on world origin (0,0)
    tokens: [],                          // VIEW: tokens present in the open scene — see refreshVisibleTokens()
    fog: [],                             // {id, x, y, w, h} rects hiding the map, world coords
    // Walls = GM-only line-of-sight blockers. {id, x1, y1, x2, y2} world-coord segments.
    // Never sent to the player visually — only used there to truncate vision cones
    // (raycasting), so occluded areas stay dark even inside a token's nominal reach.
    walls: [],
    // Party bars are UNIVERSAL: one shared definition list; every party member has all of them.
    // Each member keeps its own current/max per bar in token.barValues.
    // {id, name, color, defaultMax, active, display:'horizontal'|'vertical'|'radial', side:'left'|'right', direction:'ltr'|'rtl'}
    // Only up to MAX_ACTIVE_BARS bars with active:true render on the map.
    partyBars: [
      { id: 'bar-vida', name: 'Vida', color: '#e04b4b', defaultMax: 10, active: true, display: 'horizontal', side: 'left', direction: 'ltr' },
    ],
    // Effects glossary — GM-only reference notes. {id, name, desc, color, icon} (icon = optional emoji)
    glossary: [],
    // Fog of war = the area OUTSIDE the players' vision (not necessarily darkness).
    // `lighting` scales how far a token's vision cone reaches into the fog:
    //   reach(px) = BASE_VISION_RANGE * lighting * token.visionMult
    lighting: 1,
    // How walls occlude the player's vision cones (rendered client-side on the
    // player window): 'cell' snaps occlusion to the same 48px grid used for
    // exploration memory (cheap, blocky); 'raycast' builds a precise shadow
    // polygon from wall endpoints (sharper, costs more per frame).
    wallOcclusionMethod: 'cell',
    nextId: 1,
    nextFogId: 1,
    nextWallId: 1,
    nextBarId: 1,
    nextEffectId: 1,
    selectedTokenId: null,
    fogMode: false,
    wallMode: false,
    moveMode: false,  // when on, dragging a token never changes state.selectedTokenId
    combat: { active: false, order: [] },  // order: array of token ids, leftmost = current turn
  };

  // ============================================================
  // Scenes: each scene has its own map/fog/walls/grid/combat. Tokens are
  // GLOBAL (one shared list, in `state.tokens`) — a token's PRESENCE and
  // POSITION are per-scene, stored in `token.scenes[sceneId] = {x, y}`.
  // A token with no entry for a scene simply doesn't appear there.
  //
  // `state.{map,fog,walls,grid,combat}` above always reflect the CURRENTLY
  // OPEN scene (kept as top-level fields so the hundreds of existing
  // `state.fog`/`state.map` references throughout this file don't need to
  // change) — switching scenes snapshots them out to `scenes[]` and loads
  // the new scene's copies back in. `state.tokens` is filtered down to only
  // the tokens present in the open scene via `visibleTokens()`.
  // ============================================================
  let nextSceneId = 2;
  const scenes = [
    { id: 1, name: 'Cena 1', map: { img: null, scalePct: 100, dataUrl: null }, fog: [], walls: [],
      grid: { show: true, size: 48, color: '#45ff78' }, combat: { active: false, order: [] },
      nextFogId: 1, nextWallId: 1 },
  ];
  let currentSceneId = 1;

  function currentScene() {
    return scenes.find(s => s.id === currentSceneId);
  }

  // Tokens present in the currently open scene (have a position entry for it).
  function visibleTokens() {
    return allTokens.filter(t => t.scenes && t.scenes[currentSceneId]);
  }

  // Recompute `state.tokens` (the view) from `allTokens` — call after any
  // create/remove/scene-switch/bring-to-scene operation.
  function refreshVisibleTokens() {
    state.tokens = visibleTokens();
  }

  // Pull a token's cached scene-local x/y out into its per-scene position map —
  // called before switching away from a scene, for every token visible in it.
  function commitTokenPosition(t) {
    if (!t.scenes || !t.scenes[currentSceneId]) return;
    t.scenes[currentSceneId] = { x: t.x, y: t.y };
  }

  // Snapshot the open scene's mutable fields (fog/walls/map/grid/combat/id
  // counters) from `state` back into its `scenes[]` entry.
  function commitSceneFields() {
    const sc = currentScene();
    if (!sc) return;
    sc.map = state.map;
    sc.fog = state.fog;
    sc.walls = state.walls;
    sc.grid = state.grid;
    sc.combat = state.combat;
    sc.nextFogId = state.nextFogId;
    sc.nextWallId = state.nextWallId;
    for (const t of visibleTokens()) commitTokenPosition(t);
  }

  // Switch the open scene to `sceneId`: commit the current scene's fields +
  // token positions, then load the target scene's fields onto `state` and
  // sync each of its tokens' x/y from their per-scene position.
  function switchScene(sceneId) {
    const target = scenes.find(s => s.id === sceneId);
    if (!target || sceneId === currentSceneId) return;
    commitSceneFields();
    currentSceneId = sceneId;
    state.map = target.map;
    state.fog = target.fog;
    state.walls = target.walls;
    state.grid = target.grid;
    state.combat = target.combat;
    state.nextFogId = target.nextFogId;
    state.nextWallId = target.nextWallId;
    state.selectedTokenId = null;
    for (const t of allTokens) {
      const pos = t.scenes && t.scenes[sceneId];
      if (pos) { t.x = pos.x; t.y = pos.y; }
    }
    refreshVisibleTokens();
    syncSceneControlsFromState();
    renderSceneList();
    renderTokenList();
    renderParty();
    combatBar.classList.toggle('open', state.combat.active);
    if (state.combat.active) renderCombatBar();
    updateHud();
    draw();
    // hold back the player window until the GM explicitly confirms — they may
    // need to set up fog/tokens in the new scene before players see it
    sceneSyncPending = true;
    updatePlayerBtn.classList.add('pending');
  }

  // Reflect the (just-switched-to) scene's map/grid fields onto the top-bar
  // controls — those inputs are otherwise only ever set once, at load time.
  function syncSceneControlsFromState() {
    const hasMap = !!state.map.img;
    mapScale.value = state.map.scalePct;
    mapScaleVal.textContent = state.map.scalePct + '%';
    mapScale.disabled = !hasMap;
    removeMapBtn.disabled = !hasMap;
    mapLabel.textContent = hasMap ? (state.map.name || 'mapa') : 'nenhum';
    gridToggle.checked = state.grid.show;
    gridSize.value = state.grid.size;
    gridSizeVal.textContent = state.grid.size + 'px';
    gridColor.value = state.grid.color;
  }

  function createScene(name) {
    const sc = {
      id: nextSceneId++,
      name: name || `Cena ${scenes.length + 1}`,
      map: { img: null, scalePct: 100, dataUrl: null },
      fog: [], walls: [],
      grid: { show: true, size: 48, color: '#45ff78' },
      combat: { active: false, order: [] },
      nextFogId: 1, nextWallId: 1,
    };
    scenes.push(sc);
    renderSceneList();
    return sc;
  }

  // Start "carrying" a party member from another scene: it follows the cursor
  // (ghost preview, see draw()) until the next left-click on the map, which
  // drops it into the CURRENT scene at that spot. Any other click cancels.
  function startBringToken(t) {
    bringCarry.active = true;
    bringCarry.token = t;
    const c = screenToWorld(viewport.clientWidth / 2, viewport.clientHeight / 2);
    bringCarry.worldX = c.x;
    bringCarry.worldY = c.y;
    canvas.classList.add('bring-mode');
    draw();
  }

  // Move a token into the current scene at (x, y) — a FULL migration: the
  // token is removed from every other scene's presence map first, so it
  // exists in exactly one scene at a time (no leftover clone/duplicate on
  // the scene it came from).
  function bringTokenToCurrentScene(t, x, y) {
    t.scenes = { [currentSceneId]: { x, y } };
    t.x = x;
    t.y = y;
    refreshVisibleTokens();
    renderTokenList();
    renderParty();
    renderSceneList();
    draw();
    sendState();
  }

  // ---------- Player window sync ----------
  let playerWin = null;

  // Gate that holds back sendState() after a scene switch: the GM may need to
  // set up fog/tokens in the new scene before the players see it. While
  // pending, every sendState() call is silently dropped — the player window
  // keeps showing the OLD scene exactly as it was — until the GM clicks
  // "Atualizar tela do jogador", which clears the gate and force-sends.
  let sceneSyncPending = false;

  // includeMap: send the (heavy) map image too — only on map changes / player connect
  function sendState(includeMap) {
    if (!playerWin || playerWin.closed) return;
    if (sceneSyncPending) return;
    const map = { scalePct: state.map.scalePct };
    if (includeMap) map.dataUrl = state.map.dataUrl; // string or null (null = remove map)
    playerWin.postMessage({
      type: 'rpg-state',
      grid: state.grid,
      tokens: state.tokens,
      fog: state.fog,
      walls: state.walls,
      map,
      combat: state.combat,
      partyBars: state.partyBars,
      lighting: state.lighting,
      wallOcclusionMethod: state.wallOcclusionMethod,
      // Only this player token projects a vision cone / reveals fog on the
      // player window — lets the GM control which party member is "active"
      // when there are several, instead of all of them revealing at once.
      activeVisionTokenId: state.selectedTokenId,
    }, '*');
  }

  // Force-send regardless of the pending gate — used when the player window
  // just opened (it has nothing yet) and by the "update player view" button.
  function sendStateForced(includeMap) {
    sceneSyncPending = false;
    updatePlayerBtn.classList.remove('pending');
    sendState(includeMap);
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'rpg-player-ready') sendStateForced(true);
  });

  document.getElementById('openPlayerBtn').addEventListener('click', () => {
    if (playerWin && !playerWin.closed) { playerWin.focus(); return; }
    playerWin = window.open('player.html', 'rpg-player', 'width=1024,height=768');
  });

  const updatePlayerBtn = document.getElementById('updatePlayerBtn');
  updatePlayerBtn.addEventListener('click', () => sendStateForced(true));

  // Interaction state
  const drag = {
    mode: null,          // 'pan' | 'token' | null
    tokenId: null,
    offsetX: 0, offsetY: 0,      // token grab offset (world units)
    startScreenX: 0, startScreenY: 0,
    camStartX: 0, camStartY: 0,
  };

  const fogDraw = {
    active: false,
    startX: 0, startY: 0,   // world coords
    curX: 0, curY: 0,
  };

  const wallDraw = {
    active: false,
    startX: 0, startY: 0,   // world coords
    curX: 0, curY: 0,
  };
  const WALL_HIT_DIST = 8;  // screen px tolerance for right-click removal

  // "Bring to scene" carry: a party member from another scene follows the
  // cursor (ghost preview) until the GM clicks the map to drop it into the
  // currently open scene at that spot. See startBringToken()/draw()'s ghost.
  const bringCarry = {
    active: false,
    token: null,
    worldX: 0, worldY: 0,
  };

  let measureMode = false;
  let measureSelectedTokenId = null;  // para manter token selecionado na medição

  // ---------- Elements ----------
  const mapFileInput = document.getElementById('mapFileInput');
  const mapScale = document.getElementById('topMapScale');
  const mapScaleVal = document.getElementById('topMapScaleVal');
  const removeMapBtn = document.getElementById('topRemoveMapBtn');
  const mapLabel = document.getElementById('mapLabel');

  const gridToggle = document.getElementById('topGridToggle');
  const gridSize = document.getElementById('topGridSize');
  const gridSizeVal = document.getElementById('topGridSizeVal');
  const gridColor = document.getElementById('topGridColor');
  const gridLabel = document.getElementById('gridLabel');

  const addTokenBtn = document.getElementById('addTokenBtn');
  const tokenList = document.getElementById('tokenList');
  const tokenCount = document.getElementById('tokenCount');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const tokenNameInput = document.getElementById('tokenNameInput');
  const tokenPhotoInput = document.getElementById('tokenPhotoInput');
  const photoPreview = document.getElementById('photoPreview');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const tokenColorInput = document.getElementById('tokenColorInput');
  const modalSwatchRow = document.getElementById('modalSwatchRow');
  const cancelTokenBtn = document.getElementById('cancelTokenBtn');
  const saveTokenBtn = document.getElementById('saveTokenBtn');

  const zoomLabel = document.getElementById('zoomLabel');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');

  // ---------- Canvas sizing (handles devicePixelRatio) ----------
  let dpr = 1;
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw();
  }
  window.addEventListener('resize', resizeCanvas);

  // ---------- Sidebar resize (drag handle) ----------
  const sidebar = document.getElementById('sidebar');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const SIDEBAR_MIN = 220;
  const SIDEBAR_MAX = 600;
  let sidebarResizing = false;

  sidebarResizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sidebarResizing = true;
    sidebarResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!sidebarResizing) return;
    const rect = sidebar.getBoundingClientRect();
    const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX - rect.left));
    sidebar.style.width = w + 'px';
    resizeCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (!sidebarResizing) return;
    sidebarResizing = false;
    sidebarResizer.classList.remove('dragging');
    document.body.style.cursor = '';
  });

  // ---------- Scene sidebar resize (drag handle, right edge) ----------
  const sceneSidebar = document.getElementById('sceneSidebar');
  const sceneSidebarResizer = document.getElementById('sceneSidebarResizer');
  const SCENE_SIDEBAR_MIN = 160;
  const SCENE_SIDEBAR_MAX = 420;
  let sceneSidebarResizing = false;

  sceneSidebarResizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sceneSidebarResizing = true;
    sceneSidebarResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!sceneSidebarResizing) return;
    const rect = sceneSidebar.getBoundingClientRect();
    const w = Math.min(SCENE_SIDEBAR_MAX, Math.max(SCENE_SIDEBAR_MIN, rect.right - e.clientX));
    sceneSidebar.style.width = w + 'px';
    resizeCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (!sceneSidebarResizing) return;
    sceneSidebarResizing = false;
    sceneSidebarResizer.classList.remove('dragging');
    document.body.style.cursor = '';
  });

  // ---------- Coordinate conversion ----------
  function screenToWorld(sx, sy) {
    return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
  }
  function eventScreenPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ---------- Zoom (always anchored to a screen point) ----------
  function zoomAt(screenX, screenY, factor) {
    const before = screenToWorld(screenX, screenY);
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
    // keep the world point under (screenX, screenY) fixed
    cam.x = before.x - screenX / cam.zoom;
    cam.y = before.y - screenY / cam.zoom;
    updateHud();
    draw();
  }

  function centerView() {
    cam.zoom = 1;
    cam.x = -viewport.clientWidth / 2;
    cam.y = -viewport.clientHeight / 2;
    updateHud();
    draw();
  }

  function updateHud() {
    zoomLabel.textContent = Math.round(cam.zoom * 100) + '%';
    gridLabel.textContent = state.grid.size + 'px';
  }

  // ---------- Drawing ----------
  function draw() {
    effectDotHitboxes.length = 0;  // reset for this frame
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // background
    ctx.fillStyle = '#03140a';
    ctx.fillRect(0, 0, w, h);

    // camera transform (world → device pixels)
    const s = cam.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);

    // visible world bounds
    const wl = cam.x;
    const wt = cam.y;
    const wr = cam.x + (w / dpr) / cam.zoom;
    const wb = cam.y + (h / dpr) / cam.zoom;

    // map image centered on world origin
    if (state.map.img) {
      const img = state.map.img;
      const scale = state.map.scalePct / 100;
      const mw = img.naturalWidth * scale;
      const mh = img.naturalHeight * scale;
      ctx.drawImage(img, -mw / 2, -mh / 2, mw, mh);
    }

    // grid (only visible lines)
    if (state.grid.show) {
      const g = state.grid.size;
      ctx.strokeStyle = state.grid.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1 / cam.zoom;
      ctx.beginPath();
      const x0 = Math.floor(wl / g) * g;
      const y0 = Math.floor(wt / g) * g;
      for (let x = x0; x <= wr; x += g) {
        ctx.moveTo(x, wt);
        ctx.lineTo(x, wb);
      }
      for (let y = y0; y <= wb; y += g) {
        ctx.moveTo(wl, y);
        ctx.lineTo(wr, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // tokens
    for (const t of state.tokens) {
      const photo = getTokenPhotoImg(t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      if (photo) {
        ctx.clip();
        ctx.drawImage(photo, t.x - t.r, t.y - t.r, t.r * 2, t.r * 2);
      } else {
        ctx.fillStyle = t.color;
        ctx.fill();
      }
      ctx.restore();

      const isCurrentTurn = state.combat.active && state.combat.order[0] === t.id;

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.lineWidth = (isCurrentTurn ? 4 : (t.id === state.selectedTokenId ? 3 : 2)) / cam.zoom;
      ctx.strokeStyle = isCurrentTurn ? '#ff9f45' : (t.id === state.selectedTokenId ? '#ffffff' : (photo ? t.color : 'rgba(0,0,0,0.5)'));
      ctx.stroke();

      if (!photo && t.name) {
        ctx.font = `${Math.max(12, t.r * 0.7)}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = contrastColor(t.color);
        ctx.fillText(t.name.slice(0, 2).toUpperCase(), t.x, t.y);
      }

      // applied effects — a column of white dots at the token's top-right,
      // offset so they never overlap (or get hidden behind) its status bars
      if (t.effects && t.effects.length > 0) {
        drawEffectDots(t);
      }

      if (t.name) {
        ctx.font = `${Math.max(14, t.r * 0.6)}px "VT323", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = t.y + t.r + 4 / cam.zoom;
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(t.name, t.x, labelY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.name, t.x, labelY);
      }

      drawTokenBars(t);
    }

    // fog of war rects — kept lightly tinted on the master so the GM sees the
    // map clearly underneath while still knowing which areas are hidden.
    ctx.fillStyle = 'rgba(3, 20, 10, 0.32)';
    ctx.strokeStyle = 'rgba(69,255,120,0.35)';
    ctx.lineWidth = 1 / cam.zoom;
    for (const f of state.fog) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeRect(f.x, f.y, f.w, f.h);
    }

    // walls — GM-only line-of-sight blockers, never sent to the player visually
    if (state.walls.length > 0) {
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3 / cam.zoom;
      ctx.lineCap = 'round';
      for (const wall of state.walls) {
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
      }
    }

    // vision cones (master preview) — drawn on top of the light fog so the GM
    // can see exactly where each player token can see into the fog.
    for (const t of state.tokens) {
      if (!t.isPlayer) continue;
      drawVisionCone(ctx, t);
    }

    // facing indicators for every token
    for (const t of state.tokens) {
      drawFacingIndicator(ctx, t);
    }

    // rotation handle for the selected token
    const sel = state.tokens.find(t => t.id === state.selectedTokenId);
    if (sel && !state.fogMode && !state.wallMode && !measureMode) {
      const h = rotateHandlePos(sel);
      ctx.beginPath();
      ctx.moveTo(sel.x, sel.y);
      ctx.lineTo(h.x, h.y);
      ctx.strokeStyle = 'rgba(255,210,74,0.7)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, ROTATE_HANDLE_R / cam.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd24a';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.fill();
      ctx.stroke();
    }

    // in-progress fog rect being drawn
    if (fogDraw.active) {
      const rx = Math.min(fogDraw.startX, fogDraw.curX);
      const ry = Math.min(fogDraw.startY, fogDraw.curY);
      const rw = Math.abs(fogDraw.curX - fogDraw.startX);
      const rh = Math.abs(fogDraw.curY - fogDraw.startY);
      ctx.fillStyle = 'rgba(69,255,120,0.18)';
      ctx.strokeStyle = 'rgba(69,255,120,0.9)';
      ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }

    // in-progress wall segment being drawn
    if (wallDraw.active) {
      ctx.beginPath();
      ctx.moveTo(wallDraw.startX, wallDraw.startY);
      ctx.lineTo(wallDraw.curX, wallDraw.curY);
      ctx.strokeStyle = '#ff5a5a';
      ctx.lineWidth = 3 / cam.zoom;
      ctx.lineCap = 'round';
      ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // draw measurement
    if (window.RPG && window.RPG.drawMeasure) {
      window.RPG.drawMeasure(ctx, state, cam);
    }

    // ghost preview of a token being "brought" from another scene — follows
    // the cursor until the GM clicks to drop it into the open scene
    if (bringCarry.active) {
      const t = bringCarry.token;
      const gx = bringCarry.worldX, gy = bringCarry.worldY;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(gx, gy, t.r, 0, Math.PI * 2);
      const photo = getTokenPhotoImg(t);
      if (photo) {
        ctx.clip();
        ctx.drawImage(photo, gx - t.r, gy - t.r, t.r * 2, t.r * 2);
      } else {
        ctx.fillStyle = t.color;
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(gx, gy, t.r, 0, Math.PI * 2);
      ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeStyle = '#ffd24a';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // cache decoded <img> elements per token photo dataUrl
  const photoImgCache = new Map();

  // track effect dot positions for tooltip hit-testing
  const effectDotHitboxes = [];  // {cx, cy, r, effectId}
  function getTokenPhotoImg(t) {
    if (!t.photoDataUrl) return null;
    let img = photoImgCache.get(t.photoDataUrl);
    if (!img) {
      img = new Image();
      img.onload = () => draw();
      img.src = t.photoDataUrl;
      photoImgCache.set(t.photoDataUrl, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  function contrastColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#ffffff';
  }

  // ---------- Vision helpers ----------
  // Total world-px reach of a token's vision cone, including its own body radius.
  function tokenVisionReach(t) {
    const mult = (typeof t.visionMult === 'number') ? t.visionMult : DEFAULT_VISION_MULT;
    return t.r + BASE_VISION_RANGE * state.lighting * mult;
  }
  // Fill in vision fields on tokens that predate this feature.
  function ensureTokenVision(t) {
    if (typeof t.facing !== 'number') t.facing = -Math.PI / 2;
    if (typeof t.visionAngle !== 'number') t.visionAngle = DEFAULT_VISION_ANGLE;
    if (typeof t.visionMult !== 'number') t.visionMult = DEFAULT_VISION_MULT;
  }

  // Build a conic gradient centered on `facing` that is fully opaque across the
  // cone's core and smoothly (smoothstep) fades to transparent toward each
  // straight edge — used as an angular mask so the sides feather with no seams.
  // Returns null when the browser lacks createConicGradient (caller falls back).
  function makeAngularMask(octx, cx, cy, facing, half, featherFrac) {
    if (typeof octx.createConicGradient !== 'function') return null;
    // conic gradient param t (0..1) maps to angle offset from `facing`:
    //   t=0/1 = facing (straight ahead), t=0.5 = directly behind.
    const g = octx.createConicGradient(facing, cx, cy);
    const featherStart = half * (1 - featherFrac);   // where the side fade begins
    const N = 24;                                     // smoothstep resolution
    // walk the full circle; alpha = 1 inside the core, smoothstep across the
    // feather band, 0 outside the cone. Sampled on both sides symmetrically.
    for (let i = 0; i <= N * 2; i++) {
      const t = i / (N * 2);                          // 0..1 around the circle
      const ang = t * Math.PI * 2;                    // offset from facing (0..2π)
      const off = ang <= Math.PI ? ang : (Math.PI * 2 - ang);  // 0..π, symmetric
      let a;
      if (off <= featherStart) a = 1;
      else if (off >= half) a = 0;
      else { const x = 1 - (off - featherStart) / (half - featherStart); a = x * x * (3 - 2 * x); }
      g.addColorStop(t, `rgba(0,0,0,${a.toFixed(4)})`);
    }
    return g;
  }

  // Paint a token's vision cone onto `octx` (an otherwise-empty layer) as a soft
  // alpha envelope that fades on EVERY side — radially toward the rim (front)
  // and angularly toward both straight edges. The radial fade is a gradient; the
  // angular fade is a conic-gradient mask applied with 'destination-in', so the
  // result is perfectly smooth (no wedge seams). `rgb`/`peak` set the colour.
  function paintConeEnvelope(octx, t, rgb, peak) {
    const reach = tokenVisionReach(t);
    const facing = t.facing;
    const radial = octx.createRadialGradient(t.x, t.y, t.r * 0.5, t.x, t.y, reach);
    radial.addColorStop(0, `rgba(${rgb},${peak})`);
    radial.addColorStop(0.82, `rgba(${rgb},${peak})`);
    radial.addColorStop(1, `rgba(${rgb},0)`);

    if (t.visionAngle >= 360) {
      octx.fillStyle = radial;
      octx.beginPath();
      octx.arc(t.x, t.y, reach, 0, Math.PI * 2);
      octx.fill();
      return;
    }

    const half = (t.visionAngle * Math.PI / 180) / 2;
    const featherFrac = 0.5;
    const mask = makeAngularMask(octx, t.x, t.y, facing, half, featherFrac);

    if (mask) {
      // full disc with the radial fade, then keep only the cone's angular slice
      octx.fillStyle = radial;
      octx.beginPath();
      octx.arc(t.x, t.y, reach, 0, Math.PI * 2);
      octx.fill();
      octx.save();
      octx.globalCompositeOperation = 'destination-in';
      octx.fillStyle = mask;
      octx.beginPath();
      octx.arc(t.x, t.y, reach, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    } else {
      // fallback: hard-sided sector with the radial front fade only
      octx.fillStyle = radial;
      octx.beginPath();
      octx.moveTo(t.x, t.y);
      octx.arc(t.x, t.y, reach, facing - half, facing + half);
      octx.closePath();
      octx.fill();
    }
  }

  // reusable offscreen layer for the master's cone glow
  let coneLayer = null, coneLayerCtx = null;
  function getConeLayer(w, h) {
    if (!coneLayer) { coneLayer = document.createElement('canvas'); coneLayerCtx = coneLayer.getContext('2d'); }
    if (coneLayer.width !== w || coneLayer.height !== h) { coneLayer.width = w; coneLayer.height = h; }
    return coneLayerCtx;
  }

  // Master preview of a token's vision cone: a soft green glow feathered on all
  // sides. Rendered on its own layer then composited over the scene.
  function drawVisionCone(ctx, t) {
    if (state.lighting <= 0) return;
    ensureTokenVision(t);
    const s = cam.zoom * dpr;
    const octx = getConeLayer(canvas.width, canvas.height);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, coneLayer.width, coneLayer.height);
    octx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    paintConeEnvelope(octx, t, '120,255,170', 0.22);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(coneLayer, 0, 0);
    ctx.restore();
  }

  // World position of the rotation handle (a fixed screen distance beyond the rim).
  function rotateHandlePos(t) {
    ensureTokenVision(t);
    const dist = t.r + 26 / cam.zoom;
    return { x: t.x + Math.cos(t.facing) * dist, y: t.y + Math.sin(t.facing) * dist };
  }
  // Hit-test the selected token's rotation handle (world coords in, bool out).
  function rotateHandleAt(wx, wy) {
    const t = state.tokens.find(tk => tk.id === state.selectedTokenId);
    if (!t) return null;
    const h = rotateHandlePos(t);
    const rr = (ROTATE_HANDLE_R + 4) / cam.zoom;
    const dx = wx - h.x, dy = wy - h.y;
    return (dx * dx + dy * dy <= rr * rr) ? t : null;
  }

  // Small triangular arrow on the token's rim showing which way it faces.
  function drawFacingIndicator(ctx, t) {
    ensureTokenVision(t);
    const a = t.facing;
    const tip = t.r + Math.max(6 / cam.zoom, t.r * 0.45);
    const baseA = t.r * 0.9;
    const spread = 0.42;
    const tx = t.x + Math.cos(a) * tip;
    const ty = t.y + Math.sin(a) * tip;
    const l1x = t.x + Math.cos(a - spread) * baseA;
    const l1y = t.y + Math.sin(a - spread) * baseA;
    const l2x = t.x + Math.cos(a + spread) * baseA;
    const l2y = t.y + Math.sin(a + spread) * baseA;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(l1x, l1y);
    ctx.lineTo(l2x, l2y);
    ctx.closePath();
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1 / cam.zoom;
    ctx.fill();
    ctx.stroke();
  }

  // mini status bars for a player token; only "active" universal bars render, each in its own display mode
  function drawTokenBars(t) {
    if (!t.isPlayer || !state.partyBars) return;
    const vals = t.barValues || {};
    const activeBars = state.partyBars.filter(d => d.active).slice(0, MAX_ACTIVE_BARS);
    if (activeBars.length === 0) return;

    const barPct = (def) => {
      const v = vals[def.id] || { current: def.defaultMax, max: def.defaultMax };
      return v.max > 0 ? Math.max(0, Math.min(1, v.current / v.max)) : 0;
    };

    // group by display mode so multiples of the same mode stack correctly
    let horizIdx = 0, vertLeftIdx = 0, vertRightIdx = 0, radialIdx = 0;
    for (const def of activeBars) {
      const pct = barPct(def);
      if (def.display === 'radial') {
        drawRadialBar(t, def, pct, radialIdx++);
      } else if (def.display === 'vertical') {
        const onLeft = def.side === 'left';
        drawVerticalBar(t, def, pct, onLeft ? vertLeftIdx++ : vertRightIdx++, onLeft);
      } else {
        drawHorizontalBar(t, def, pct, horizIdx++);
      }
    }
  }

  // how far the token's status bars extend past its radius on each side (world units).
  // used to keep the effect dots clear of them.
  function tokenBarExtents(t) {
    const ext = { top: 0, right: 0 };
    if (!t.isPlayer || !state.partyBars) return ext;
    const activeBars = state.partyBars.filter(d => d.active).slice(0, MAX_ACTIVE_BARS);
    let horiz = 0, vertRight = 0, radial = 0;
    for (const def of activeBars) {
      if (def.display === 'radial') radial++;
      else if (def.display === 'vertical') { if (def.side !== 'left') vertRight++; }
      else horiz++;
    }
    // horizontal bars stack above the token
    if (horiz > 0) {
      const barH = 5 / cam.zoom, gap = 2 / cam.zoom;
      ext.top = Math.max(ext.top, 2 / cam.zoom + horiz * (barH + gap));
    }
    // right-side vertical bars extend to the right
    if (vertRight > 0) {
      const barW = 5 / cam.zoom, gap = 2 / cam.zoom;
      ext.right = Math.max(ext.right, 2 / cam.zoom + vertRight * (barW + gap));
    }
    // radial rings grow the effective radius in every direction
    if (radial > 0) {
      const ringGap = 4 / cam.zoom, ringW = 3 / cam.zoom;
      const ring = 4 / cam.zoom + radial * (ringW + ringGap);
      ext.top = Math.max(ext.top, ring);
      ext.right = Math.max(ext.right, ring);
    }
    return ext;
  }

  // status dots stacked at the token's top-right corner, clear of its bars, colored by effect
  function drawEffectDots(t) {
    const dotR = Math.max(2.5 / cam.zoom, t.r * 0.16);
    const gap = dotR * 0.9;
    const ext = tokenBarExtents(t);
    const pad = 3 / cam.zoom;
    // anchor just outside the top-right of the token (past any bars there)
    const cx = t.x + t.r + ext.right + dotR + pad;
    let cy = t.y - t.r - ext.top - dotR - pad;
    for (const id of t.effects) {
      const eff = state.glossary.find(e => e.id === id);
      if (!eff) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = eff.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.fill();
      ctx.stroke();
      // track for hit-testing
      effectDotHitboxes.push({ cx, cy, r: dotR, effectId: id });
      cy += dotR * 2 + gap; // stack downward
    }
  }

  function drawHorizontalBar(t, def, pct, idx) {
    const barW = t.r * 2;
    const barH = 5 / cam.zoom;
    const gap = 2 / cam.zoom;
    const x = t.x - t.r;
    const y = t.y - t.r - 2 / cam.zoom - (idx + 1) * (barH + gap);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = def.color;
    if (def.direction === 'rtl') {
      ctx.fillRect(x + barW * (1 - pct), y, barW * pct, barH); // empties toward the left
    } else {
      ctx.fillRect(x, y, barW * pct, barH);
    }
    ctx.lineWidth = 1 / cam.zoom;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(x, y, barW, barH);
  }

  function drawVerticalBar(t, def, pct, idx, onLeft) {
    const barH = t.r * 2;
    const barW = 5 / cam.zoom;
    const gap = 2 / cam.zoom;
    const x = onLeft
      ? (t.x - t.r - 2 / cam.zoom - (idx + 1) * (barW + gap))
      : (t.x + t.r + 2 / cam.zoom + idx * (barW + gap));
    const y = t.y - t.r;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = def.color;
    // direction ltr = fills from bottom up; rtl = fills from top down
    if (def.direction === 'rtl') {
      ctx.fillRect(x, y, barW, barH * pct);
    } else {
      ctx.fillRect(x, y + barH * (1 - pct), barW, barH * pct);
    }
    ctx.lineWidth = 1 / cam.zoom;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(x, y, barW, barH);
  }

  function drawRadialBar(t, def, pct, idx) {
    const ringGap = 4 / cam.zoom;
    const ringW = 3 / cam.zoom;
    const radius = t.r + 4 / cam.zoom + idx * (ringW + ringGap);
    const start = -Math.PI / 2; // 12 o'clock
    // track
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
    ctx.lineWidth = ringW;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    // progress arc (clockwise)
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius, start, start + Math.PI * 2 * pct);
    ctx.lineWidth = ringW;
    ctx.strokeStyle = def.color;
    ctx.stroke();
  }

  // ---------- Hit testing ----------
  function tokenAt(wx, wy) {
    for (let i = state.tokens.length - 1; i >= 0; i--) {
      const t = state.tokens[i];
      const dx = wx - t.x, dy = wy - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) return t;
    }
    return null;
  }

  function fogRectAt(wx, wy) {
    for (let i = state.fog.length - 1; i >= 0; i--) {
      const f = state.fog[i];
      if (wx >= f.x && wx <= f.x + f.w && wy >= f.y && wy <= f.y + f.h) return f;
    }
    return null;
  }

  // distance from point (px,py) to segment (x1,y1)-(x2,y2)
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function wallAt(wx, wy) {
    const tol = WALL_HIT_DIST / cam.zoom;
    for (let i = state.walls.length - 1; i >= 0; i--) {
      const wall = state.walls[i];
      if (distToSegment(wx, wy, wall.x1, wall.y1, wall.x2, wall.y2) <= tol) return wall;
    }
    return null;
  }

  // Snap the point (wx,wy) so the segment from (x0,y0) follows the nearest
  // cardinal/diagonal direction (0°, 45°, 90°, ... every 45°) — used to draw
  // perfectly straight walls while holding Shift. Preserves the drag length.
  function snapToCardinal(x0, y0, wx, wy) {
    const dx = wx - x0, dy = wy - y0;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { x: wx, y: wy };
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4;  // 45°
    const snappedAngle = Math.round(angle / step) * step;
    return { x: x0 + Math.cos(snappedAngle) * dist, y: y0 + Math.sin(snappedAngle) * dist };
  }

  // Snap a new wall endpoint onto any existing wall endpoint within
  // WALL_ENDPOINT_SNAP world px — closes gaps smaller than that between two
  // segments (e.g. a corner drawn in two strokes) so the player-side raycast
  // occlusion can't leak light through a sliver too thin to see.
  const WALL_ENDPOINT_SNAP = 2;
  function snapWallEndpoint(x, y) {
    let best = null, bestDist = WALL_ENDPOINT_SNAP;
    for (const wall of state.walls) {
      for (const [ex, ey] of [[wall.x1, wall.y1], [wall.x2, wall.y2]]) {
        const d = Math.hypot(x - ex, y - ey);
        if (d < bestDist) { bestDist = d; best = { x: ex, y: ey }; }
      }
    }
    return best || { x, y };
  }

  function effectDotAt(wx, wy) {
    for (let i = effectDotHitboxes.length - 1; i >= 0; i--) {
      const dot = effectDotHitboxes[i];
      const dx = wx - dot.cx, dy = wy - dot.cy;
      if (dx * dx + dy * dy <= dot.r * dot.r) return dot;
    }
    return null;
  }

  // ---------- Mouse: pan (middle), tokens (left), remove (right) ----------
  canvas.addEventListener('mousedown', (e) => {
    const sp = eventScreenPos(e);

    if (e.button === 1) {
      // middle button → pan
      e.preventDefault();
      drag.mode = 'pan';
      drag.startScreenX = sp.x;
      drag.startScreenY = sp.y;
      drag.camStartX = cam.x;
      drag.camStartY = cam.y;
      canvas.classList.add('panning');
      return;
    }

    const wp = screenToWorld(sp.x, sp.y);

    if (bringCarry.active) {
      if (e.button === 0) {
        bringTokenToCurrentScene(bringCarry.token, wp.x, wp.y);
        state.selectedTokenId = bringCarry.token.id;
        renderTokenList();
      }
      // left click drops it; any other click (right/middle) just cancels the carry
      bringCarry.active = false;
      bringCarry.token = null;
      canvas.classList.remove('bring-mode');
      draw();
      return;
    }

    if (measureMode) {
      if (e.button === 0) {
        const hit = tokenAt(wp.x, wp.y);
        window.RPG.measureClick(wp.x, wp.y, hit);
        measureSelectedTokenId = window.RPG.measureState.active ? window.RPG.measureState.startTokenId : null;
        state.selectedTokenId = measureSelectedTokenId;
        renderTokenList();
        draw();
      }
      return;
    }

    if (state.fogMode) {
      if (e.button === 2) {
        const f = fogRectAt(wp.x, wp.y);
        if (f) {
          state.fog = state.fog.filter(r => r.id !== f.id);
          draw();
          sendState();
        }
        return;
      }
      if (e.button === 0) {
        fogDraw.active = true;
        fogDraw.startX = fogDraw.curX = wp.x;
        fogDraw.startY = fogDraw.curY = wp.y;
      }
      return;
    }

    if (state.wallMode) {
      if (e.button === 2) {
        const wall = wallAt(wp.x, wp.y);
        if (wall) {
          state.walls = state.walls.filter(w => w.id !== wall.id);
          draw();
          sendState();
        }
        return;
      }
      if (e.button === 0) {
        wallDraw.active = true;
        wallDraw.startX = wallDraw.curX = wp.x;
        wallDraw.startY = wallDraw.curY = wp.y;
      }
      return;
    }

    // rotation handle of the selected token takes priority over token grabbing
    if (e.button === 0) {
      const rot = rotateHandleAt(wp.x, wp.y);
      if (rot) {
        drag.mode = 'rotate';
        drag.tokenId = rot.id;
        canvas.classList.add('panning');
        return;
      }
    }

    const hit = tokenAt(wp.x, wp.y);

    if (e.button === 2) {
      if (hit) removeToken(hit.id);
      return;
    }

    if (e.button === 0 && hit) {
      drag.mode = 'token';
      drag.tokenId = hit.id;
      drag.offsetX = wp.x - hit.x;
      drag.offsetY = wp.y - hit.y;
      if (!state.moveMode) {
        state.selectedTokenId = hit.id;
        renderTokenList();
        sendState();
      }
      draw();
    }
  });

  window.addEventListener('mousemove', (e) => {
    const sp = eventScreenPos(e);

    if (bringCarry.active) {
      const wp = screenToWorld(sp.x, sp.y);
      bringCarry.worldX = wp.x;
      bringCarry.worldY = wp.y;
      draw();
      return;
    }

    if (window.RPG && window.RPG.measureState && window.RPG.measureState.active) {
      const wp = screenToWorld(sp.x, sp.y);
      window.RPG.measureUpdate(wp.x, wp.y);
      draw();
      return;
    }

    if (fogDraw.active) {
      const wp = screenToWorld(sp.x, sp.y);
      fogDraw.curX = wp.x;
      fogDraw.curY = wp.y;
      draw();
      return;
    }

    if (wallDraw.active) {
      const wp = screenToWorld(sp.x, sp.y);
      const snapped = e.shiftKey ? snapToCardinal(wallDraw.startX, wallDraw.startY, wp.x, wp.y) : wp;
      wallDraw.curX = snapped.x;
      wallDraw.curY = snapped.y;
      draw();
      return;
    }

    if (drag.mode === 'pan') {
      cam.x = drag.camStartX - (sp.x - drag.startScreenX) / cam.zoom;
      cam.y = drag.camStartY - (sp.y - drag.startScreenY) / cam.zoom;
      draw();
      return;
    }

    if (drag.mode === 'rotate') {
      const wp = screenToWorld(sp.x, sp.y);
      const t = state.tokens.find(t => t.id === drag.tokenId);
      if (t) {
        t.facing = Math.atan2(wp.y - t.y, wp.x - t.x);
        draw();
        sendState();
      }
      return;
    }

    if (drag.mode === 'token') {
      const wp = screenToWorld(sp.x, sp.y);
      const t = state.tokens.find(t => t.id === drag.tokenId);
      if (t) {
        t.x = wp.x - drag.offsetX;
        t.y = wp.y - drag.offsetY;
        draw();
        sendState();
      }
      return;
    }

    // hover cursor feedback
    const wp = screenToWorld(sp.x, sp.y);
    const overGrab = !state.fogMode && !state.wallMode && (!!rotateHandleAt(wp.x, wp.y) || !!tokenAt(wp.x, wp.y));
    canvas.classList.toggle('over-token', overGrab);
  });

  window.addEventListener('mouseup', () => {
    if (measureMode && window.RPG.measureState.active) {
      window.RPG.measureRelease();
      if (!window.RPG.measureState.active) {
        measureSelectedTokenId = null;
        state.selectedTokenId = null;
        renderTokenList();
      }
      draw();
    }

    if (fogDraw.active) {
      fogDraw.active = false;
      const rx = Math.min(fogDraw.startX, fogDraw.curX);
      const ry = Math.min(fogDraw.startY, fogDraw.curY);
      const rw = Math.abs(fogDraw.curX - fogDraw.startX);
      const rh = Math.abs(fogDraw.curY - fogDraw.startY);
      if (rw > 4 && rh > 4) {
        state.fog.push({ id: state.nextFogId++, x: rx, y: ry, w: rw, h: rh });
        sendState();
      }
      draw();
    }

    if (wallDraw.active) {
      wallDraw.active = false;
      const dx = wallDraw.curX - wallDraw.startX;
      const dy = wallDraw.curY - wallDraw.startY;
      if (Math.hypot(dx, dy) > 4) {
        const p1 = snapWallEndpoint(wallDraw.startX, wallDraw.startY);
        const p2 = snapWallEndpoint(wallDraw.curX, wallDraw.curY);
        state.walls.push({ id: state.nextWallId++, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        sendState();
      }
      draw();
    }
    drag.mode = null;
    drag.tokenId = null;
    canvas.classList.remove('panning');
  });


  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // effect dot tooltip
  const effectTooltip = document.getElementById('effectTooltip');
  canvas.addEventListener('mousemove', (e) => {
    const sp = eventScreenPos(e);
    const wp = screenToWorld(sp.x, sp.y);
    const dot = effectDotAt(wp.x, wp.y);
    if (dot) {
      const eff = state.glossary.find(e => e.id === dot.effectId);
      if (eff) {
        effectTooltip.innerHTML = `<div class="eff-name">${eff.name}</div>` +
          (eff.desc ? `<div class="eff-desc">${eff.desc.split('\n').join('<br>')}</div>` : '');
        effectTooltip.classList.add('show');
        effectTooltip.style.left = (sp.x + 12) + 'px';
        effectTooltip.style.top = (sp.y + 12) + 'px';
      }
    } else {
      effectTooltip.classList.remove('show');
    }
  });
  canvas.addEventListener('mouseleave', () => {
    effectTooltip.classList.remove('show');
  });

  // ---------- Scroll wheel = zoom, anchored at cursor ----------
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sp = eventScreenPos(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(sp.x, sp.y, factor);
  }, { passive: false });

  // ---------- Arrow keys rotate the selected token ----------
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    // don't hijack typing in inputs / textareas
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const t = state.tokens.find(tk => tk.id === state.selectedTokenId);
    if (!t) return;
    e.preventDefault();
    ensureTokenVision(t);
    const step = (e.shiftKey ? 15 : 5) * Math.PI / 180;
    t.facing += (e.key === 'ArrowLeft' ? -step : step);
    draw();
    sendState();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !bringCarry.active) return;
    bringCarry.active = false;
    bringCarry.token = null;
    canvas.classList.remove('bring-mode');
    draw();
  });

  // ---------- Zoom buttons ----------
  function viewportCenter() {
    return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  }
  zoomInBtn.addEventListener('click', () => {
    const c = viewportCenter();
    zoomAt(c.x, c.y, 1.25);
  });
  zoomOutBtn.addEventListener('click', () => {
    const c = viewportCenter();
    zoomAt(c.x, c.y, 1 / 1.25);
  });
  zoomResetBtn.addEventListener('click', centerView);

  // ---------- Map import ----------
  mapFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        state.map.img = img;
        state.map.dataUrl = dataUrl;
        state.map.scalePct = 100;
        state.map.name = file.name;
        mapScale.value = 100;
        mapScaleVal.textContent = '100%';
        mapScale.disabled = false;
        removeMapBtn.disabled = false;
        mapLabel.textContent = file.name;
        draw();
        renderSceneList();
        sendState(true);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  removeMapBtn.addEventListener('click', () => {
    state.map.img = null;
    state.map.dataUrl = null;
    mapScale.disabled = true;
    removeMapBtn.disabled = true;
    mapLabel.textContent = 'nenhum';
    mapFileInput.value = '';
    draw();
    renderSceneList();
    sendState(true);
  });

  function setMapScale(val) {
    const v = Math.min(400, Math.max(10, val || 100));
    state.map.scalePct = v;
    mapScale.value = v;
    mapScaleVal.textContent = v + '%';
    draw();
    renderSceneList();
    sendState();
  }
  mapScale.addEventListener('input', () => setMapScale(Number(mapScale.value)));

  // ---------- Grid controls ----------
  gridToggle.addEventListener('change', () => {
    state.grid.show = gridToggle.checked;
    draw();
    sendState();
  });
  function setGridSize(val) {
    const v = Math.min(128, Math.max(16, val || 48));
    state.grid.size = v;
    gridSize.value = v;
    gridSizeVal.textContent = v + 'px';
    updateHud();
    draw();
    sendState();
  }
  gridSize.addEventListener('input', () => setGridSize(Number(gridSize.value)));
  gridColor.addEventListener('input', () => {
    state.grid.color = gridColor.value;
    draw();
    sendState();
  });

  // ---------- Global lighting (vision reach into fog) ----------
  const lightingInput = document.getElementById('topLighting');
  const lightingVal = document.getElementById('topLightingVal');
  lightingInput.addEventListener('input', () => {
    const pct = Number(lightingInput.value);
    state.lighting = pct / 100;
    lightingVal.textContent = pct + '%';
    draw();
    sendState();
  });

  // ---------- Wall occlusion method (rendered on the player window) ----------
  const wallMethodSelect = document.getElementById('topWallMethod');
  wallMethodSelect.value = state.wallOcclusionMethod;
  wallMethodSelect.addEventListener('change', () => {
    state.wallOcclusionMethod = wallMethodSelect.value;
    sendState();
  });

  // ---------- Tokens ----------
  const PRESET_COLORS = ['#e04b4b','#4b8ee0','#4be08f','#e0c94b','#a04be0','#e08a4b','#4be0d8','#e04ba0','#ffffff','#333333'];
  PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      tokenColorInput.value = c;
      modalSwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    modalSwatchRow.appendChild(sw);
  });

  // ---------- Token modal ----------
  let modalMode = 'create'; // 'create' | 'edit'
  let modalEditingId = null;
  let modalPhotoDataUrl = null;

  function updatePhotoPreview() {
    if (modalPhotoDataUrl) {
      photoPreview.src = modalPhotoDataUrl;
      photoPreview.classList.remove('empty');
      removePhotoBtn.style.display = '';
    } else {
      photoPreview.removeAttribute('src');
      photoPreview.classList.add('empty');
      removePhotoBtn.style.display = 'none';
    }
  }

  const tokenIsPlayerInput = document.getElementById('tokenIsPlayerInput');
  const tokenVisionAngleInput = document.getElementById('tokenVisionAngleInput');
  const tokenVisionAngleVal = document.getElementById('tokenVisionAngleVal');
  const tokenVisionMultInput = document.getElementById('tokenVisionMultInput');
  const tokenVisionMultVal = document.getElementById('tokenVisionMultVal');

  function setModalVision(angleDeg, multPct) {
    tokenVisionAngleInput.value = angleDeg;
    tokenVisionAngleVal.textContent = angleDeg + '°';
    tokenVisionMultInput.value = multPct;
    tokenVisionMultVal.textContent = multPct + '%';
  }
  tokenVisionAngleInput.addEventListener('input', () => {
    tokenVisionAngleVal.textContent = tokenVisionAngleInput.value + '°';
  });
  tokenVisionMultInput.addEventListener('input', () => {
    tokenVisionMultVal.textContent = tokenVisionMultInput.value + '%';
  });

  function openModalForCreate() {
    modalMode = 'create';
    modalEditingId = null;
    modalPhotoDataUrl = null;
    tokenNameInput.value = '';
    tokenColorInput.value = PRESET_COLORS[state.tokens.length % PRESET_COLORS.length];
    tokenIsPlayerInput.checked = false;
    setModalVision(DEFAULT_VISION_ANGLE, Math.round(DEFAULT_VISION_MULT * 100));
    modalTitle.textContent = 'Novo token';
    saveTokenBtn.textContent = 'Adicionar';
    updatePhotoPreview();
    modalOverlay.classList.add('open');
    tokenNameInput.focus();
  }

  function openModalForEdit(t) {
    modalMode = 'edit';
    modalEditingId = t.id;
    modalPhotoDataUrl = t.photoDataUrl || null;
    tokenNameInput.value = t.name || '';
    tokenColorInput.value = t.color;
    tokenIsPlayerInput.checked = !!t.isPlayer;
    ensureTokenVision(t);
    setModalVision(t.visionAngle, Math.round(t.visionMult * 100));
    modalTitle.textContent = 'Editar token';
    saveTokenBtn.textContent = 'Salvar';
    updatePhotoPreview();
    modalOverlay.classList.add('open');
    tokenNameInput.focus();
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  const fogModeBtn = document.getElementById('topFogBtn');
  const clearFogBtn = document.getElementById('topClearFogBtn');
  const wallModeBtn = document.getElementById('topWallBtn');
  const clearWallsBtn = document.getElementById('topClearWallsBtn');
  const moveModeBtn = document.getElementById('topMoveBtn');
  const measureBtn = document.getElementById('topMeasureBtn');

  function toggleFogMode() {
    state.fogMode = !state.fogMode;
    if (state.fogMode) {
      state.wallMode = false; wallModeBtn.classList.remove('active');
      state.moveMode = false; moveModeBtn.classList.remove('active');
    }
    fogModeBtn.classList.toggle('active', state.fogMode);
    canvas.classList.toggle('fog-mode', state.fogMode);
    canvas.classList.remove('over-token');
  }
  fogModeBtn.addEventListener('click', toggleFogMode);

  clearFogBtn.addEventListener('click', () => {
    if (state.fog.length === 0) return;
    state.fog = [];
    draw();
    sendState();
  });

  function toggleWallMode() {
    state.wallMode = !state.wallMode;
    if (state.wallMode) {
      state.fogMode = false; fogModeBtn.classList.remove('active');
      state.moveMode = false; moveModeBtn.classList.remove('active');
    }
    wallModeBtn.classList.toggle('active', state.wallMode);
    canvas.classList.toggle('fog-mode', state.fogMode);
    canvas.classList.remove('over-token');
  }
  wallModeBtn.addEventListener('click', toggleWallMode);

  clearWallsBtn.addEventListener('click', () => {
    if (state.walls.length === 0) return;
    state.walls = [];
    draw();
    sendState();
  });

  function toggleMoveMode() {
    state.moveMode = !state.moveMode;
    if (state.moveMode) {
      state.fogMode = false; fogModeBtn.classList.remove('active');
      state.wallMode = false; wallModeBtn.classList.remove('active');
      canvas.classList.remove('fog-mode');
    }
    moveModeBtn.classList.toggle('active', state.moveMode);
  }
  moveModeBtn.addEventListener('click', toggleMoveMode);

  function toggleMeasureMode() {
    measureMode = !measureMode;
    measureBtn.classList.toggle('active', measureMode);
    if (!measureMode) {
      window.RPG.measureEnd();
      measureSelectedTokenId = null;
      state.selectedTokenId = null;
      renderTokenList();
      draw();
    }
  }
  measureBtn.addEventListener('click', toggleMeasureMode);

  // ---------- Top toolbar tools ----------
  const topImportBtn = document.getElementById('topImportBtn');
  const topSlidersBtn = document.getElementById('topSlidersBtn');
  const topSlidersPanel = document.getElementById('topSlidersPanel');

  topImportBtn.addEventListener('click', () => mapFileInput.click());
  topSlidersBtn.addEventListener('click', () => topSlidersPanel.classList.toggle('open'));

  // ---------- Combat ----------
  const startCombatBtn = document.getElementById('startCombatBtn');
  const stopCombatBtn = document.getElementById('stopCombatBtn');
  const nextTurnBtn = document.getElementById('nextTurnBtn');
  const combatControls = document.getElementById('combatControls');
  const combatBar = document.getElementById('combatBar');
  const combatBarTrack = document.getElementById('combatBar-track');
  const combatBarTokens = document.getElementById('combatBar-tokens');

  function startCombat() {
    if (state.tokens.length === 0) return;
    const existing = state.combat.order.filter(id => state.tokens.some(t => t.id === id));
    const newIds = state.tokens.map(t => t.id).filter(id => !existing.includes(id));
    state.combat.order = existing.concat(newIds);
    state.combat.active = true;
    startCombatBtn.classList.add('active');
    combatControls.classList.add('open');
    combatBar.classList.add('open');
    renderCombatBar();
    draw();
    sendState();
  }

  function stopCombat() {
    state.combat.active = false;
    startCombatBtn.classList.remove('active');
    combatControls.classList.remove('open');
    combatBar.classList.remove('open');
    draw();
    sendState();
  }

  function nextTurn() {
    if (state.combat.order.length === 0) return;
    const first = state.combat.order.shift();
    state.combat.order.push(first);

    // Animate first token sliding right
    const firstItem = combatBarTokens.querySelector(`[data-id="${first}"]`);
    if (firstItem) {
      const trackWidth = combatBarTrack.clientWidth;
      firstItem.style.transition = 'none';
      firstItem.style.left = TOKEN_PADDING_LEFT + 'px';
      setTimeout(() => {
        firstItem.style.transition = 'left 0.6s ease-out';
        firstItem.style.left = (state.combat.order.length * SLOT_WIDTH + TOKEN_PADDING_LEFT) + 'px';
      }, 16);
    }

    renderCombatBar();
    draw();
    sendState();
  }

  startCombatBtn.addEventListener('click', startCombat);
  stopCombatBtn.addEventListener('click', stopCombat);
  nextTurnBtn.addEventListener('click', nextTurn);

  let combatDragId = null;
  let combatDragStart = null;

  function renderCombatBar() {
    combatBarTokens.innerHTML = '';
    const TOKEN_SIZE = 48;
    const TOKEN_SPACING = 10;  // gap between tokens
    const TOKEN_PADDING_LEFT = 12;

    const count = state.combat.order.length;
    const neededWidth = count > 0 ? (count * (TOKEN_SIZE + TOKEN_SPACING) + TOKEN_PADDING_LEFT + 6) : 60;
    if (combatBarTrack) {
      combatBarTrack.style.width = neededWidth + 'px';
    }

    state.combat.order.forEach((id, idx) => {
      const t = state.tokens.find(t => t.id === id);
      if (!t) return;

      const item = document.createElement('div');
      item.className = 'combat-token' + (idx === 0 ? ' current' : '');
      item.dataset.id = id;
      // Compact layout: left-aligned with 10px gap
      const left = idx * (TOKEN_SIZE + TOKEN_SPACING) + TOKEN_PADDING_LEFT;
      item.style.left = left + 'px';
      item.style.marginLeft = '0';

      // Render token circle with same clipping as map canvas
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      canvas.className = 'dot';
      const c = canvas.getContext('2d');
      const photo = getTokenPhotoImg(t);

      c.beginPath();
      c.arc(24, 24, 24, 0, Math.PI * 2);
      if (photo) {
        c.clip();
        c.drawImage(photo, 0, 0, 48, 48);
      } else {
        c.fillStyle = t.color;
        c.fill();
      }

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = t.name || `Token ${t.id}`;

      item.appendChild(canvas);
      item.appendChild(name);

      item.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        combatDragId = id;
        combatDragStart = e.clientX;
        combatDragInitialLeft = parseFloat(item.style.left);
        item.classList.add('dragging');
      });

      combatBarTokens.appendChild(item);
    });
  }

  // Drag horizontal on timeline (raw logic only)
  const TOKEN_SIZE = 48;
  const TOKEN_SPACING = 10;
  const TOKEN_PADDING_LEFT = 12;
  const SLOT_WIDTH = TOKEN_SIZE + TOKEN_SPACING;

  let combatDragInitialLeft = 0;

  window.addEventListener('mousemove', (e) => {
    if (combatDragId === null) return;
    e.preventDefault();

    const delta = e.clientX - combatDragStart;
    const item = combatBarTokens.querySelector(`[data-id="${combatDragId}"]`);
    if (!item) return;

    const trackWidth = combatBarTrack.clientWidth;
    let left = combatDragInitialLeft + delta;
    left = Math.max(0, Math.min(trackWidth - TOKEN_SIZE, left));

    // Snap to nearest slot
    const order = state.combat.order;
    const idx = order.indexOf(combatDragId);
    const tokenCount = order.length;

    let snapIdx = idx;
    for (let i = 0; i < tokenCount; i++) {
      if (i === idx) continue;
      const snapX = i * SLOT_WIDTH + TOKEN_PADDING_LEFT;
      if (Math.abs(left - snapX) < SLOT_WIDTH * 0.4) {
        snapIdx = i;
        break;
      }
    }

    if (snapIdx !== idx) {
      order.splice(idx, 1);
      order.splice(snapIdx, 0, combatDragId);
      renderCombatBar();
      return;
    }

    item.style.left = left + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (combatDragId === null) return;

    const item = combatBarTokens.querySelector(`[data-id="${combatDragId}"]`);
    if (item) item.classList.remove('dragging');

    combatDragId = null;
    combatDragStart = null;
    renderCombatBar();
    draw();
    sendState();
  });

  addTokenBtn.addEventListener('click', openModalForCreate);
  cancelTokenBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  // ---------- Help modal ----------
  const helpOverlay = document.getElementById('helpOverlay');
  const helpBtn = document.getElementById('helpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  function openHelp() {
    helpOverlay.classList.add('open');
  }

  function closeHelp() {
    helpOverlay.classList.remove('open');
  }

  helpBtn.addEventListener('click', openHelp);
  closeHelpBtn.addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) closeHelp(); });

  tokenPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      openCropEditor(ev.target.result, (croppedDataUrl) => {
        modalPhotoDataUrl = croppedDataUrl;
        updatePhotoPreview();
      });
    };
    reader.readAsDataURL(file);
    tokenPhotoInput.value = '';
  });

  removePhotoBtn.addEventListener('click', () => {
    modalPhotoDataUrl = null;
    tokenPhotoInput.value = '';
    updatePhotoPreview();
  });

  saveTokenBtn.addEventListener('click', () => {
    const name = tokenNameInput.value.trim();
    const color = tokenColorInput.value;
    const isPlayer = tokenIsPlayerInput.checked;
    const visionAngle = Number(tokenVisionAngleInput.value);
    const visionMult = Number(tokenVisionMultInput.value) / 100;

    if (modalMode === 'create') {
      const c = screenToWorld(viewport.clientWidth / 2, viewport.clientHeight / 2);
      const x = c.x + (Math.random() * 40 - 20);
      const y = c.y + (Math.random() * 40 - 20);
      const token = {
        id: state.nextId++,
        x, y,
        // presence is per-scene — a new token only exists in the scene open
        // when it was created, until dragged to another via its thumbnail
        scenes: { [currentSceneId]: { x, y } },
        r: BASE_TOKEN_RADIUS,
        color,
        name,
        photoDataUrl: modalPhotoDataUrl,
        createdAt: Date.now(),
        isPlayer,
        barValues: {},
        effects: [],   // GM-only: array of glossary effect ids applied to this token
        facing: -Math.PI / 2,   // orientation angle (radians); default = up
        visionAngle,            // cone width in degrees
        visionMult,             // per-token range multiplier
      };
      if (isPlayer) syncTokenBarValues(token);
      allTokens.push(token);
      refreshVisibleTokens();
      state.selectedTokenId = token.id;
    } else {
      const t = allTokens.find(t => t.id === modalEditingId);
      if (t) {
        t.name = name;
        t.color = color;
        t.photoDataUrl = modalPhotoDataUrl;
        t.isPlayer = isPlayer;
        t.visionAngle = visionAngle;
        t.visionMult = visionMult;
        if (isPlayer) syncTokenBarValues(t);
      }
    }

    closeModal();
    renderTokenList();
    renderParty();
    draw();
    sendState();
  });

  function removeToken(id) {
    const idx = allTokens.findIndex(t => t.id === id);
    if (idx !== -1) allTokens.splice(idx, 1);
    refreshVisibleTokens();
    if (state.selectedTokenId === id) state.selectedTokenId = null;
    state.combat.order = state.combat.order.filter(oid => oid !== id);
    renderTokenList();
    renderParty();
    renderSceneList();
    if (state.combat.active) renderCombatBar();
    draw();
    sendState();
  }

  // ---------- Token list sorting ----------
  const tokenSortSelect = document.getElementById('tokenSortSelect');
  let tokenSortMode = 'added';
  tokenSortSelect.addEventListener('change', () => {
    tokenSortMode = tokenSortSelect.value;
    renderTokenList();
  });

  function getSortedTokens() {
    const list = state.tokens.slice();
    if (tokenSortMode === 'name') {
      list.sort((a, b) => (a.name || `Token ${a.id}`).localeCompare(b.name || `Token ${b.id}`, 'pt-BR', { sensitivity: 'base' }));
    } else {
      list.sort((a, b) => (a.createdAt || a.id) - (b.createdAt || b.id));
    }
    return list;
  }

  // ---------- Delete confirmation ----------
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmTokenName = document.getElementById('confirmTokenName');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  let pendingDeleteId = null;

  function askRemoveToken(t) {
    pendingDeleteId = t.id;
    confirmTokenName.textContent = t.name || `Token ${t.id}`;
    confirmOverlay.classList.add('open');
  }

  function closeConfirm() {
    confirmOverlay.classList.remove('open');
    pendingDeleteId = null;
  }

  confirmCancelBtn.addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeConfirm(); });
  confirmDeleteBtn.addEventListener('click', () => {
    if (pendingDeleteId !== null) removeToken(pendingDeleteId);
    closeConfirm();
  });

  // ---------- Scene sidebar ----------
  const sceneListEl = document.getElementById('sceneList');
  const addSceneBtn = document.getElementById('addSceneBtn');
  const THUMB_W = 200, THUMB_H = 150;  // logical size of each mini-map canvas

  addSceneBtn.addEventListener('click', () => {
    const sc = createScene();
    switchScene(sc.id);
  });

  // World-space window a scene's thumbnail renders: the map's own bounding box
  // (centered on world origin, same convention as the main canvas), falling
  // back to a generic square if the scene has no map yet.
  function sceneWorldBounds(sc) {
    if (sc.map.img) {
      const scale = sc.map.scalePct / 100;
      const mw = sc.map.img.naturalWidth * scale;
      const mh = sc.map.img.naturalHeight * scale;
      return { w: mw, h: mh };
    }
    return { w: 800, h: 600 };
  }

  function drawSceneThumb(canvas, sc) {
    const tctx = canvas.getContext('2d');
    tctx.clearRect(0, 0, THUMB_W, THUMB_H);
    tctx.fillStyle = '#03140a';
    tctx.fillRect(0, 0, THUMB_W, THUMB_H);
    if (sc.map.img) {
      const scale = sc.map.scalePct / 100;
      const mw = sc.map.img.naturalWidth * scale;
      const mh = sc.map.img.naturalHeight * scale;
      const fit = Math.min(THUMB_W / mw, THUMB_H / mh);
      const dw = mw * fit, dh = mh * fit;
      tctx.drawImage(sc.map.img, (THUMB_W - dw) / 2, (THUMB_H - dh) / 2, dw, dh);
    }
  }

  // Convert a scene-local world point to thumbnail-canvas pixel coords (the
  // same fit/center math as drawSceneThumb, so token dots align with the map).
  function sceneWorldToThumbPx(sc, wx, wy) {
    const b = sceneWorldBounds(sc);
    const fit = Math.min(THUMB_W / b.w, THUMB_H / b.h);
    const originX = THUMB_W / 2, originY = THUMB_H / 2;
    return { x: originX + wx * fit, y: originY + wy * fit };
  }
  function thumbPxToSceneWorld(sc, px, py) {
    const b = sceneWorldBounds(sc);
    const fit = Math.min(THUMB_W / b.w, THUMB_H / b.h);
    const originX = THUMB_W / 2, originY = THUMB_H / 2;
    return { x: (px - originX) / fit, y: (py - originY) / fit };
  }

  function renderSceneList() {
    sceneListEl.innerHTML = '';
    for (const sc of scenes) {
      const card = document.createElement('div');
      card.className = 'scene-card' + (sc.id === currentSceneId ? ' active' : '');

      const nameEl = document.createElement('div');
      nameEl.className = 'scene-card-name';
      nameEl.textContent = sc.name;

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'scene-card-thumb';
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = THUMB_W;
      thumbCanvas.height = THUMB_H;
      thumbWrap.appendChild(thumbCanvas);
      drawSceneThumb(thumbCanvas, sc);

      // token dots — the token being viewed here may be the live-edited copy
      // (if this is the open scene) or its committed per-scene position
      const isOpenScene = sc.id === currentSceneId;
      for (const t of allTokens) {
        const pos = isOpenScene ? (t.scenes && t.scenes[sc.id] ? { x: t.x, y: t.y } : null) : (t.scenes && t.scenes[sc.id]);
        if (!pos) continue;
        const dot = document.createElement('div');
        dot.className = 'scene-token-dot';
        const ppx = sceneWorldToThumbPx(sc, pos.x, pos.y);
        const dotSize = 10;
        dot.style.left = (ppx.x - dotSize / 2) + 'px';
        dot.style.top = (ppx.y - dotSize / 2) + 'px';
        dot.style.width = dotSize + 'px';
        dot.style.height = dotSize + 'px';
        dot.style.background = t.color;
        dot.title = t.name || `Token ${t.id}`;
        attachSceneDotHandlers(dot, thumbWrap, sc, t);
        thumbWrap.appendChild(dot);
      }

      card.appendChild(nameEl);
      card.appendChild(thumbWrap);
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('scene-token-dot')) return;
        switchScene(sc.id);
      });
      sceneListEl.appendChild(card);
    }
  }

  // Drag a token's dot within its scene's thumbnail to reposition it there
  // (without opening that scene); double-click brings it into the CURRENT
  // scene, at the same relative spot, and switches selection to it.
  function attachSceneDotHandlers(dot, thumbWrap, sc, t) {
    let dragging = false;
    dot.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      const onMove = (ev) => {
        if (!dragging) return;
        const rect = thumbWrap.getBoundingClientRect();
        const px = Math.max(0, Math.min(THUMB_W, ev.clientX - rect.left));
        const py = Math.max(0, Math.min(THUMB_H, ev.clientY - rect.top));
        dot.style.left = (px - 5) + 'px';
        dot.style.top = (py - 5) + 'px';
      };
      const onUp = (ev) => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const rect = thumbWrap.getBoundingClientRect();
        const px = Math.max(0, Math.min(THUMB_W, ev.clientX - rect.left));
        const py = Math.max(0, Math.min(THUMB_H, ev.clientY - rect.top));
        const world = thumbPxToSceneWorld(sc, px, py);
        if (sc.id === currentSceneId) {
          // live scene — update the token's cached x/y directly
          t.x = world.x;
          t.y = world.y;
          refreshVisibleTokens();
          draw();
          sendState();
        } else {
          t.scenes[sc.id] = { x: world.x, y: world.y };
        }
        renderSceneList();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
    dot.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sc.id === currentSceneId) return;  // already in the open scene
      const pos = t.scenes[sc.id];
      bringTokenToCurrentScene(t, pos.x, pos.y);
      state.selectedTokenId = t.id;
    });
  }

  function renderTokenList() {
    tokenCount.textContent = state.tokens.length;
    tokenList.innerHTML = '';
    for (const t of getSortedTokens()) {
      const item = document.createElement('div');
      item.className = 'token-item';
      if (t.id === state.selectedTokenId) item.classList.add('selected');

      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.background = t.color;
      if (t.photoDataUrl) {
        dot.style.backgroundImage = `url(${t.photoDataUrl})`;
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = t.name || `Token ${t.id}`;
      nameSpan.style.flex = '1';
      nameSpan.style.overflow = 'hidden';
      nameSpan.style.textOverflow = 'ellipsis';
      nameSpan.style.whiteSpace = 'nowrap';

      const badges = buildEffectBadges(t);

      const effectsBtn = document.createElement('button');
      effectsBtn.className = 'icon-btn effects-btn';
      effectsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>';
      effectsBtn.title = 'Aplicar efeitos';
      effectsBtn.addEventListener('click', (e) => { e.stopPropagation(); openEffectsPicker(t); });

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn edit-btn';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.title = 'Editar token';
      editBtn.addEventListener('click', () => openModalForEdit(t));

      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn remove-btn';
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeBtn.title = 'Excluir token';
      removeBtn.addEventListener('click', () => askRemoveToken(t));

      item.appendChild(dot);
      item.appendChild(nameSpan);
      if (badges) item.appendChild(badges);
      item.appendChild(effectsBtn);
      item.appendChild(editBtn);
      item.appendChild(removeBtn);
      item.addEventListener('mouseenter', () => { state.selectedTokenId = t.id; draw(); });
      tokenList.appendChild(item);
    }
  }

  // small colored icon chips shown next to a token name for its applied effects
  function buildEffectBadges(token) {
    if (!token.effects || token.effects.length === 0) return null;
    const wrap = document.createElement('div');
    wrap.className = 'effect-badges';
    for (const id of token.effects) {
      const eff = state.glossary.find(e => e.id === id);
      if (!eff) continue;
      const badge = document.createElement('span');
      badge.className = 'effect-badge';
      badge.style.background = eff.color;
      badge.title = eff.name + (eff.desc ? ' — ' + eff.desc : '');
      badge.textContent = eff.icon || eff.name.slice(0, 1).toUpperCase();
      wrap.appendChild(badge);
    }
    return wrap.children.length ? wrap : null;
  }

  // ---------- Apply-effects picker (glossary checklist w/ search) ----------
  const effectsPickerOverlay = document.getElementById('effectsPickerOverlay');
  const effectsPickerTitle = document.getElementById('effectsPickerTitle');
  const effectsSearchInput = document.getElementById('effectsSearchInput');
  const effectsPickerList = document.getElementById('effectsPickerList');
  let effectsPickerToken = null;

  function openEffectsPicker(token) {
    effectsPickerToken = token;
    if (!token.effects) token.effects = [];
    effectsPickerTitle.textContent = `Efeitos — ${token.name || 'Token ' + token.id}`;
    effectsSearchInput.value = '';
    renderEffectsPicker();
    effectsPickerOverlay.classList.add('open');
    effectsSearchInput.focus();
  }

  function renderEffectsPicker() {
    const q = effectsSearchInput.value.trim().toLowerCase();
    effectsPickerList.innerHTML = '';

    if (state.glossary.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Glossário vazio. Cadastre efeitos no Glossário de efeitos.';
      effectsPickerList.appendChild(empty);
      return;
    }

    const matches = state.glossary.filter(eff =>
      !q || eff.name.toLowerCase().includes(q) || (eff.desc || '').toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Nenhum efeito encontrado.';
      effectsPickerList.appendChild(empty);
      return;
    }

    for (const eff of matches) {
      const applied = effectsPickerToken.effects.includes(eff.id);
      const row = document.createElement('label');
      row.className = 'effects-pick-row';
      row.style.borderLeftColor = eff.color;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = applied;
      cb.addEventListener('change', () => {
        const set = new Set(effectsPickerToken.effects);
        if (cb.checked) set.add(eff.id); else set.delete(eff.id);
        // keep glossary order
        effectsPickerToken.effects = state.glossary.filter(e => set.has(e.id)).map(e => e.id);
        renderTokenList();
        draw();
      });

      const icon = document.createElement('span');
      icon.className = 'ep-icon';
      icon.style.color = eff.color;
      icon.textContent = eff.icon || '';

      const body = document.createElement('div');
      body.className = 'ep-body';
      const name = document.createElement('div');
      name.className = 'ep-name';
      name.textContent = eff.name;
      name.style.color = eff.color;
      body.appendChild(name);
      if (eff.desc) {
        const desc = document.createElement('div');
        desc.className = 'ep-desc';
        desc.textContent = eff.desc;
        body.appendChild(desc);
      }

      row.appendChild(cb);
      if (eff.icon) row.appendChild(icon);
      row.appendChild(body);
      effectsPickerList.appendChild(row);
    }
  }

  effectsSearchInput.addEventListener('input', renderEffectsPicker);
  document.getElementById('effectsPickerCloseBtn').addEventListener('click', () => {
    effectsPickerOverlay.classList.remove('open');
    effectsPickerToken = null;
  });
  effectsPickerOverlay.addEventListener('click', (e) => {
    if (e.target === effectsPickerOverlay) {
      effectsPickerOverlay.classList.remove('open');
      effectsPickerToken = null;
    }
  });

  // ---------- Party panel + universal bars ----------
  const partyList = document.getElementById('partyList');
  const partyCount = document.getElementById('partyCount');

  // Ensure a token has a value entry for every universal bar; drop stale ones.
  function syncTokenBarValues(t) {
    if (!t.barValues) t.barValues = {};
    for (const def of state.partyBars) {
      if (!t.barValues[def.id]) {
        t.barValues[def.id] = { current: def.defaultMax, max: def.defaultMax };
      }
    }
    // remove values for bars that no longer exist
    for (const id of Object.keys(t.barValues)) {
      if (!state.partyBars.some(d => d.id === id)) delete t.barValues[id];
    }
  }

  function syncAllPartyBarValues() {
    // runs over ALL tokens (every scene) — barValues are global per-token,
    // not per-scene, so a bar created while another scene is open must still
    // apply to players sitting in that other scene.
    for (const t of allTokens) {
      if (t.isPlayer) syncTokenBarValues(t);
    }
  }

  function renderParty() {
    syncAllPartyBarValues();
    // Party spans ALL scenes (not just the open one) — members from other
    // scenes show which scene they're in and a button to bring them here.
    const members = allTokens.filter(t => t.isPlayer);
    partyCount.textContent = members.length;
    partyList.innerHTML = '';

    // universal bar toolbar (define which bars everyone has)
    const toolbar = document.createElement('div');
    toolbar.className = 'party-toolbar';
    const toolbarHint = document.createElement('div');
    toolbarHint.className = 'party-toolbar-title';
    const activeCount = state.partyBars.filter(d => d.active).length;
    toolbarHint.textContent = `Barras universais — ativas no mapa: ${activeCount}/${MAX_ACTIVE_BARS}`;
    toolbar.appendChild(toolbarHint);

    for (const def of state.partyBars) {
      const chip = document.createElement('div');
      chip.className = 'bar-def-chip';

      // active checkbox — limited to MAX_ACTIVE_BARS
      const activeCb = document.createElement('input');
      activeCb.type = 'checkbox';
      activeCb.className = 'bar-active-cb';
      activeCb.checked = !!def.active;
      activeCb.title = 'Exibir esta barra no mapa';
      activeCb.disabled = !def.active && activeCount >= MAX_ACTIVE_BARS;
      activeCb.addEventListener('change', () => {
        if (activeCb.checked && state.partyBars.filter(d => d.active).length >= MAX_ACTIVE_BARS) {
          activeCb.checked = false;
          return;
        }
        def.active = activeCb.checked;
        renderParty();
        draw();
        sendState();
      });

      const swatch = document.createElement('span');
      swatch.className = 'bar-def-swatch';
      swatch.style.background = def.color;
      const nm = document.createElement('span');
      nm.className = 'bar-def-name';
      nm.textContent = def.name;
      const mode = document.createElement('span');
      mode.className = 'bar-def-mode';
      mode.textContent = { horizontal: 'H', vertical: 'V', radial: 'O' }[def.display] || 'H';
      mode.title = 'Exibição: ' + (def.display || 'horizontal');
      const editB = document.createElement('button');
      editB.className = 'icon-btn';
      editB.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editB.title = 'Editar barra (universal)';
      editB.addEventListener('click', () => openBarDefEditor(def));
      const delB = document.createElement('button');
      delB.className = 'icon-btn';
      delB.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      delB.title = 'Remover barra de todos';
      delB.addEventListener('click', () => removeBarDef(def));
      chip.appendChild(activeCb);
      chip.appendChild(swatch);
      chip.appendChild(nm);
      chip.appendChild(mode);
      chip.appendChild(editB);
      chip.appendChild(delB);
      toolbar.appendChild(chip);
    }

    const addDef = document.createElement('button');
    addDef.className = 'secondary add-bar-btn';
    addDef.textContent = '+ Nova barra universal';
    addDef.addEventListener('click', () => openBarDefEditor(null));
    toolbar.appendChild(addDef);
    partyList.appendChild(toolbar);

    if (members.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'party-nobars';
      empty.style.textAlign = 'center';
      empty.textContent = 'Marque um token como jogador para vê-lo aqui.';
      partyList.appendChild(empty);
    }

    // each member: all universal bars, per-member values
    for (const t of members) {
      const card = document.createElement('div');
      card.className = 'party-member';

      const head = document.createElement('div');
      head.className = 'party-member-head';
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.background = t.color;
      dot.style.color = t.color;
      if (t.photoDataUrl) dot.style.backgroundImage = `url(${t.photoDataUrl})`;
      const nameEl = document.createElement('div');
      nameEl.className = 'pm-name';
      nameEl.textContent = t.name || `Token ${t.id}`;
      head.appendChild(dot);
      head.appendChild(nameEl);

      // scene indicator + "bring here" — only party members carry this,
      // since only they can be moved between scenes from this list
      const inCurrentScene = t.scenes && t.scenes[currentSceneId];
      const sceneTag = document.createElement('span');
      sceneTag.className = 'pm-scene-tag';
      head.appendChild(sceneTag);
      if (inCurrentScene) {
        sceneTag.textContent = 'Nesta cena';
        sceneTag.classList.add('here');
      } else {
        const homeSceneId = t.scenes ? Object.keys(t.scenes)[0] : null;
        const homeScene = homeSceneId ? scenes.find(s => s.id === Number(homeSceneId)) : null;
        sceneTag.textContent = homeScene ? homeScene.name : 'Sem cena';
        const bringBtn = document.createElement('button');
        bringBtn.className = 'icon-btn pm-bring-btn';
        bringBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
        bringBtn.title = 'Trazer para a cena atual (clique no mapa para posicionar)';
        bringBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          startBringToken(t);
        });
        head.appendChild(bringBtn);
      }
      card.appendChild(head);

      if (state.partyBars.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'party-nobars';
        empty.textContent = 'Nenhuma barra definida.';
        card.appendChild(empty);
      } else {
        for (const def of state.partyBars) {
          card.appendChild(buildBarElement(t, def));
        }
      }

      partyList.appendChild(card);
    }
  }

  function buildBarElement(token, def) {
    const val = token.barValues[def.id] || { current: def.defaultMax, max: def.defaultMax };

    const wrap = document.createElement('div');
    wrap.className = 'party-bar';

    const labelRow = document.createElement('div');
    labelRow.className = 'party-bar-labelrow';

    const nm = document.createElement('span');
    nm.className = 'pb-name';
    nm.textContent = def.name;

    const valEl = document.createElement('span');
    valEl.className = 'pb-val';
    valEl.textContent = `${val.current}/${val.max}`;

    const editB = document.createElement('button');
    editB.className = 'icon-btn';
    editB.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    editB.title = 'Editar valor deste membro';
    editB.addEventListener('click', () => openBarValueEditor(token, def));

    labelRow.appendChild(nm);
    labelRow.appendChild(valEl);
    labelRow.appendChild(editB);

    const track = document.createElement('div');
    track.className = 'party-bar-track';
    const fill = document.createElement('div');
    fill.className = 'party-bar-fill';
    const pct = val.max > 0 ? Math.max(0, Math.min(100, (val.current / val.max) * 100)) : 0;
    fill.style.width = pct + '%';
    fill.style.background = def.color;
    fill.style.boxShadow = `0 0 6px ${def.color}`;
    track.appendChild(fill);

    wrap.appendChild(labelRow);
    wrap.appendChild(track);
    return wrap;
  }

  function removeBarDef(def) {
    state.partyBars = state.partyBars.filter(d => d.id !== def.id);
    for (const t of allTokens) {
      if (t.barValues) delete t.barValues[def.id];
    }
    renderParty();
    draw();
    sendState();
  }

  // ---------- Effects glossary (GM-only reference) ----------
  const GLOSSARY_PRESET_COLORS = ['#4be08f','#e04b4b','#4b8ee0','#a04be0','#e0c94b','#e08a4b','#4be0d8','#e04ba0'];
  const glossaryOverlay = document.getElementById('glossaryOverlay');
  const glossaryList = document.getElementById('glossaryList');
  const glossaryForm = document.getElementById('glossaryForm');
  const glossaryFormTitle = document.getElementById('glossaryFormTitle');
  const glossaryNameInput = document.getElementById('glossaryNameInput');
  const glossaryDescInput = document.getElementById('glossaryDescInput');
  const glossaryColorInput = document.getElementById('glossaryColorInput');
  const glossaryIconInput = document.getElementById('glossaryIconInput');
  const glossarySwatchRow = document.getElementById('glossarySwatchRow');
  const glossarySaveBtn = document.getElementById('glossarySaveBtn');
  const glossaryClearBtn = document.getElementById('glossaryClearBtn');

  let glossaryEditId = null; // id of effect being edited, or null when adding

  GLOSSARY_PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      glossaryColorInput.value = c;
      glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    glossarySwatchRow.appendChild(sw);
  });

  function resetGlossaryForm() {
    glossaryEditId = null;
    glossaryFormTitle.textContent = 'Novo efeito';
    glossarySaveBtn.textContent = 'Adicionar';
    glossaryNameInput.value = '';
    glossaryDescInput.value = '';
    glossaryIconInput.value = '';
    glossaryColorInput.value = GLOSSARY_PRESET_COLORS[state.glossary.length % GLOSSARY_PRESET_COLORS.length];
    glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  }

  function renderGlossary() {
    glossaryList.innerHTML = '';
    if (state.glossary.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Nenhum efeito cadastrado ainda.';
      glossaryList.appendChild(empty);
      return;
    }
    for (const eff of state.glossary) {
      const item = document.createElement('div');
      item.className = 'glossary-item';
      item.style.borderLeftColor = eff.color;

      const icon = document.createElement('div');
      icon.className = 'gi-icon';
      icon.textContent = eff.icon || '';
      icon.style.color = eff.color;

      const body = document.createElement('div');
      body.className = 'gi-body';
      const name = document.createElement('div');
      name.className = 'gi-name';
      name.textContent = eff.name;
      name.style.color = eff.color;
      const desc = document.createElement('div');
      desc.className = 'gi-desc';
      desc.textContent = eff.desc || '';
      body.appendChild(name);
      if (eff.desc) body.appendChild(desc);

      const actions = document.createElement('div');
      actions.className = 'gi-actions';
      const editBtn = document.createElement('button');
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      editBtn.title = 'Editar';
      editBtn.addEventListener('click', () => startEditEffect(eff.id));
      const delBtn = document.createElement('button');
      delBtn.className = 'gi-del';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      delBtn.title = 'Remover';
      delBtn.addEventListener('click', () => {
        state.glossary = state.glossary.filter(e => e.id !== eff.id);
        // drop this effect from any token that had it applied (across all scenes)
        for (const t of allTokens) {
          if (t.effects) t.effects = t.effects.filter(id => id !== eff.id);
        }
        if (glossaryEditId === eff.id) resetGlossaryForm();
        renderGlossary();
        renderTokenList();
        draw();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(actions);
      glossaryList.appendChild(item);
    }
  }

  function startEditEffect(id) {
    const eff = state.glossary.find(e => e.id === id);
    if (!eff) return;
    glossaryEditId = id;
    glossaryFormTitle.textContent = 'Editar efeito';
    glossarySaveBtn.textContent = 'Salvar';
    glossaryNameInput.value = eff.name;
    glossaryDescInput.value = eff.desc || '';
    glossaryIconInput.value = eff.icon || '';
    glossaryColorInput.value = eff.color;
    glossarySwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    glossaryNameInput.focus();
  }

  glossarySaveBtn.addEventListener('click', () => {
    const name = glossaryNameInput.value.trim();
    if (!name) { glossaryNameInput.focus(); return; }
    const data = {
      name,
      desc: glossaryDescInput.value.trim(),
      color: glossaryColorInput.value,
      icon: glossaryIconInput.value.trim(),
    };
    if (glossaryEditId != null) {
      const eff = state.glossary.find(e => e.id === glossaryEditId);
      if (eff) Object.assign(eff, data);
    } else {
      state.glossary.push({ id: state.nextEffectId++, ...data });
    }
    resetGlossaryForm();
    renderGlossary();
  });

  glossaryClearBtn.addEventListener('click', resetGlossaryForm);

  document.getElementById('openGlossaryBtn').addEventListener('click', () => {
    resetGlossaryForm();
    renderGlossary();
    glossaryOverlay.classList.add('open');
  });
  document.getElementById('glossaryCloseBtn').addEventListener('click', () => {
    glossaryOverlay.classList.remove('open');
  });
  glossaryOverlay.addEventListener('click', (e) => {
    if (e.target === glossaryOverlay) glossaryOverlay.classList.remove('open');
  });

  // ---------- Bar editor modal (two modes) ----------
  const BAR_PRESET_COLORS = ['#e04b4b','#4b8ee0','#a04be0','#4be08f','#e0c94b','#e08a4b','#4be0d8','#e04ba0'];
  const barOverlay = document.getElementById('barOverlay');
  const barModalTitle = document.getElementById('barModalTitle');
  const barNameInput = document.getElementById('barNameInput');
  const barNameField = barNameInput.closest('.field');
  const barCurrentInput = document.getElementById('barCurrentInput');
  const barMaxInput = document.getElementById('barMaxInput');
  const barColorInput = document.getElementById('barColorInput');
  const barColorField = barColorInput.closest('.field');
  const barSwatchRow = document.getElementById('barSwatchRow');
  const barDisplayFields = document.getElementById('barDisplayFields');
  const barDisplaySelect = document.getElementById('barDisplaySelect');
  const barSideField = document.getElementById('barSideField');
  const barSideSelect = document.getElementById('barSideSelect');
  const barDirectionField = document.getElementById('barDirectionField');
  const barDirectionSelect = document.getElementById('barDirectionSelect');
  const barCancelBtn = document.getElementById('barCancelBtn');
  const barSaveBtn = document.getElementById('barSaveBtn');

  // show/hide side & direction depending on the chosen display mode
  function updateBarDisplayFieldsVisibility() {
    const mode = barDisplaySelect.value;
    // side only matters for vertical; direction matters for horizontal & vertical (not radial)
    barSideField.style.display = (mode === 'vertical') ? '' : 'none';
    barDirectionField.style.display = (mode === 'radial') ? 'none' : '';
  }
  barDisplaySelect.addEventListener('change', updateBarDisplayFieldsVisibility);

  BAR_PRESET_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      barColorInput.value = c;
      barSwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    barSwatchRow.appendChild(sw);
  });

  // mode: 'def' (universal name+color) | 'value' (per-member current/max)
  let barEditMode = null;
  let barEditDef = null;   // def being created/edited
  let barEditToken = null; // token when editing a value

  function openBarDefEditor(def) {
    barEditMode = 'def';
    barEditDef = def;
    barEditToken = null;
    barNameField.style.display = '';
    barColorField.style.display = '';
    barDisplayFields.style.display = '';
    if (def) {
      barModalTitle.textContent = 'Editar barra universal';
      barNameInput.value = def.name;
      barColorInput.value = def.color;
      barCurrentInput.value = def.defaultMax;
      barMaxInput.value = def.defaultMax;
      barDisplaySelect.value = def.display || 'horizontal';
      barSideSelect.value = def.side || 'left';
      barDirectionSelect.value = def.direction || 'ltr';
    } else {
      barModalTitle.textContent = 'Nova barra universal';
      barNameInput.value = '';
      barColorInput.value = BAR_PRESET_COLORS[state.partyBars.length % BAR_PRESET_COLORS.length];
      barCurrentInput.value = 10;
      barMaxInput.value = 10;
      barDisplaySelect.value = 'horizontal';
      barSideSelect.value = 'left';
      barDirectionSelect.value = 'ltr';
    }
    updateBarDisplayFieldsVisibility();
    barSwatchRow.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    barOverlay.classList.add('open');
    barNameInput.focus();
  }

  function openBarValueEditor(token, def) {
    barEditMode = 'value';
    barEditDef = def;
    barEditToken = token;
    const val = token.barValues[def.id] || { current: def.defaultMax, max: def.defaultMax };
    barModalTitle.textContent = `${def.name} — ${token.name || 'Token ' + token.id}`;
    // hide name, color & display (those are universal); show only current/max
    barNameField.style.display = 'none';
    barColorField.style.display = 'none';
    barDisplayFields.style.display = 'none';
    barCurrentInput.value = val.current;
    barMaxInput.value = val.max;
    barOverlay.classList.add('open');
    barCurrentInput.focus();
  }

  function closeBarEditor() {
    barOverlay.classList.remove('open');
    barEditMode = null;
    barEditDef = null;
    barEditToken = null;
  }

  barCancelBtn.addEventListener('click', closeBarEditor);
  barOverlay.addEventListener('click', (e) => { if (e.target === barOverlay) closeBarEditor(); });

  barSaveBtn.addEventListener('click', () => {
    const max = Math.max(1, Number(barMaxInput.value) || 1);
    const current = Math.max(0, Math.min(max, Number(barCurrentInput.value) || 0));

    if (barEditMode === 'def') {
      const name = barNameInput.value.trim() || 'Barra';
      const color = barColorInput.value;
      const display = barDisplaySelect.value;
      const side = barSideSelect.value;
      const direction = barDirectionSelect.value;
      if (barEditDef) {
        barEditDef.name = name;
        barEditDef.color = color;
        barEditDef.defaultMax = max;
        barEditDef.display = display;
        barEditDef.side = side;
        barEditDef.direction = direction;
      } else {
        state.partyBars.push({ id: 'bar-' + (state.nextBarId++), name, color, defaultMax: max, active: false, display, side, direction });
      }
      syncAllPartyBarValues();
    } else if (barEditMode === 'value' && barEditToken && barEditDef) {
      if (!barEditToken.barValues) barEditToken.barValues = {};
      barEditToken.barValues[barEditDef.id] = { current, max };
    }

    closeBarEditor();
    renderParty();
    draw();
    sendState();
  });

  // ---------- Photo crop editor ----------
  const cropOverlay = document.getElementById('cropOverlay');
  const cropCanvasWrap = document.getElementById('cropCanvasWrap');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropCtx = cropCanvas.getContext('2d');
  const cropZoomSlider = document.getElementById('cropZoomSlider');
  const cropCancelBtn = document.getElementById('cropCancelBtn');
  const cropApplyBtn = document.getElementById('cropApplyBtn');

  const CROP_OUTPUT_SIZE = 256; // final exported square image, in px

  const cropState = {
    img: null,
    minZoom: 1,       // zoom at which the image just covers the crop circle
    zoom: 1,           // user zoom multiplier on top of minZoom
    offsetX: 0,         // image-space pan offset (in source image pixels)
    offsetY: 0,
    onDone: null,
  };

  const cropDrag = { active: false, startX: 0, startY: 0, offX: 0, offY: 0 };

  function openCropEditor(srcDataUrl, onDone) {
    const img = new Image();
    img.onload = () => {
      cropState.img = img;
      cropState.onDone = onDone;
      cropState.offsetX = img.naturalWidth / 2;
      cropState.offsetY = img.naturalHeight / 2;
      cropState.minZoom = 1;
      cropState.zoom = 1;
      cropZoomSlider.value = 1;
      cropOverlay.classList.add('open');
      resizeCropCanvas();
    };
    img.src = srcDataUrl;
  }

  function resizeCropCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = cropCanvasWrap.clientWidth;
    cropCanvas.width = Math.round(size * dpr);
    cropCanvas.height = Math.round(size * dpr);
    drawCrop();
  }
  window.addEventListener('resize', () => {
    if (cropOverlay.classList.contains('open')) resizeCropCanvas();
  });

  function drawCrop() {
    const img = cropState.img;
    if (!img) return;
    const dpr = window.devicePixelRatio || 1;
    const size = cropCanvas.width; // square, device px
    cropCtx.setTransform(1, 0, 0, 1, 0, 0);
    cropCtx.clearRect(0, 0, size, size);
    cropCtx.fillStyle = '#111';
    cropCtx.fillRect(0, 0, size, size);

    // "cover" scale: image fills the square crop area at zoom=1
    const coverScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = coverScale * cropState.zoom;

    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = size / 2 - cropState.offsetX * scale;
    const cy = size / 2 - cropState.offsetY * scale;

    cropCtx.drawImage(img, cx, cy, drawW, drawH);

    // dim outside the circular crop area
    cropCtx.save();
    cropCtx.fillStyle = 'rgba(0,0,0,0.55)';
    cropCtx.beginPath();
    cropCtx.rect(0, 0, size, size);
    cropCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
    cropCtx.fill('evenodd');
    cropCtx.restore();

    cropCtx.beginPath();
    cropCtx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    cropCtx.lineWidth = 2;
    cropCtx.strokeStyle = 'rgba(255,255,255,0.8)';
    cropCtx.stroke();
  }

  function clampCropOffset() {
    const img = cropState.img;
    if (!img) return;
    const size = cropCanvas.width;
    const coverScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = coverScale * cropState.zoom;
    // visible half-extent in image space
    const halfW = (size / scale) / 2;
    const halfH = (size / scale) / 2;
    cropState.offsetX = Math.min(img.naturalWidth - halfW, Math.max(halfW, cropState.offsetX));
    cropState.offsetY = Math.min(img.naturalHeight - halfH, Math.max(halfH, cropState.offsetY));
  }

  cropZoomSlider.addEventListener('input', () => {
    cropState.zoom = Number(cropZoomSlider.value);
    clampCropOffset();
    drawCrop();
  });

  cropCanvasWrap.addEventListener('mousedown', (e) => {
    cropDrag.active = true;
    cropCanvasWrap.classList.add('dragging');
    cropDrag.startX = e.clientX;
    cropDrag.startY = e.clientY;
    cropDrag.offX = cropState.offsetX;
    cropDrag.offY = cropState.offsetY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!cropDrag.active) return;
    const img = cropState.img;
    const size = cropCanvas.width;
    const coverScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const scale = coverScale * cropState.zoom;
    const dpr = window.devicePixelRatio || 1;
    const dx = (e.clientX - cropDrag.startX) * dpr;
    const dy = (e.clientY - cropDrag.startY) * dpr;
    cropState.offsetX = cropDrag.offX - dx / scale;
    cropState.offsetY = cropDrag.offY - dy / scale;
    clampCropOffset();
    drawCrop();
  });
  window.addEventListener('mouseup', () => {
    cropDrag.active = false;
    cropCanvasWrap.classList.remove('dragging');
  });

  cropCanvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    cropState.zoom = Math.min(4, Math.max(1, cropState.zoom * delta));
    cropZoomSlider.value = cropState.zoom;
    clampCropOffset();
    drawCrop();
  }, { passive: false });

  function closeCropEditor() {
    cropOverlay.classList.remove('open');
    cropState.img = null;
    cropState.onDone = null;
  }

  cropCancelBtn.addEventListener('click', closeCropEditor);
  cropOverlay.addEventListener('click', (e) => { if (e.target === cropOverlay) closeCropEditor(); });

  cropApplyBtn.addEventListener('click', () => {
    const img = cropState.img;
    if (!img) return;

    const out = document.createElement('canvas');
    out.width = CROP_OUTPUT_SIZE;
    out.height = CROP_OUTPUT_SIZE;
    const octx = out.getContext('2d');

    const coverScale = Math.max(cropCanvas.width / img.naturalWidth, cropCanvas.width / img.naturalHeight);
    const scale = coverScale * cropState.zoom;
    // source rect (in original image pixels) that maps to the crop square
    const srcHalf = (cropCanvas.width / scale) / 2;
    const sx = cropState.offsetX - srcHalf;
    const sy = cropState.offsetY - srcHalf;
    const sSize = srcHalf * 2;

    octx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

    const resultUrl = out.toDataURL('image/png');
    const cb = cropState.onDone;
    closeCropEditor();
    if (cb) cb(resultUrl);
  });

  // ---------- Expose to window.RPG ----------
  window.RPG = window.RPG || {};
  window.RPG.cam = cam;
  window.RPG.draw = draw;
  window.RPG.getTokenPhotoImg = getTokenPhotoImg;
  window.RPG.tokenBarExtents = tokenBarExtents;
  window.RPG.drawTokenBars = drawTokenBars;
  window.RPG.fogDraw = fogDraw;

  // ---------- Init ----------
  resizeCanvas();
  centerView();
  renderParty();
  renderSceneList();
})();
