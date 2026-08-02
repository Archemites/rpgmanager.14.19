/* ============================================================
   GM canvas mouse/keyboard interaction dispatch: pan (middle), tokens
   (left/right), fog/wall drawing, rotate handle, bring-carry, measure,
   scroll-wheel zoom, arrow-key rotation, effect-dot tooltip.
   Loads last among interaction files — reaches into nearly every other GM
   module (scenes, hit-test, tools, token-modal, crop-editor via token-modal).
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const cam = window.RPG.cam;
  const canvas = window.RPG.canvas;
  const screenToWorld = window.RPG.screenToWorld;
  const eventScreenPos = window.RPG.eventScreenPos;
  const zoomAt = window.RPG.zoomAt;
  const drag = window.RPG.drag;
  const fogDraw = window.RPG.fogDraw;
  const wallDraw = window.RPG.wallDraw;
  const tokenAt = window.RPG.tokenAt;
  const fogRectAt = window.RPG.fogRectAt;
  const wallAt = window.RPG.wallAt;
  const effectDotAt = window.RPG.effectDotAt;
  const snapToCardinal = window.RPG.snapToCardinal;
  const snapWallEndpoint = window.RPG.snapWallEndpoint;
  const rotateHandleAt = window.RPG.rotateHandleAt;
  const ensureTokenVision = window.RPG.ensureTokenVision;
  const noteAt = window.RPG.noteAt;
  const objectAt = window.RPG.objectAt;
  const objectRotateHandleAt = window.RPG.objectRotateHandleAt;

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
    const bringCarry = window.RPG.bringCarry;

    if (bringCarry.active) {
      if (e.button === 0) {
        window.RPG.bringTokenToCurrentScene(bringCarry.token, wp.x, wp.y);
        state.selectedTokenId = bringCarry.token.id;
        window.RPG.renderTokenList();
      }
      // left click drops it; any other click (right/middle) just cancels the carry
      bringCarry.active = false;
      bringCarry.token = null;
      canvas.classList.remove('bring-mode');
      window.RPG.draw();
      return;
    }

    if (window.RPG.getFxMode()) {
      // left-click (spawn picker) handled on 'click' (see bottom of file) —
      // opening a context-menu here, inside 'mousedown', races the menu's
      // own document-level mousedown-to-close listener and closes it in the
      // same tick. Right-click opens the size/duration popup instead.
      if (e.button === 2) {
        window.RPG.openFxSettings();
      }
      return;
    }

    if (window.RPG.getMeasureMode()) {
      if (e.button === 0) {
        const hit = tokenAt(wp.x, wp.y);
        window.RPG.measureClick(wp.x, wp.y, hit);
        const selId = window.RPG.measureState.active ? window.RPG.measureState.startTokenId : null;
        window.RPG.setMeasureSelectedTokenId(selId);
        state.selectedTokenId = selId;
        window.RPG.renderTokenList();
        window.RPG.draw();
      }
      return;
    }

    if (state.fogMode) {
      if (e.button === 2) {
        const f = fogRectAt(wp.x, wp.y);
        if (f) {
          window.RPG.captureBeforeChange('Removeu retângulo de névoa');
          state.fog = state.fog.filter(r => r.id !== f.id);
          window.RPG.draw();
          window.RPG.sendState();
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
          window.RPG.captureBeforeChange('Removeu parede');
          state.walls = state.walls.filter(w => w.id !== wall.id);
          window.RPG.draw();
          window.RPG.sendState();
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

    // rotation handle of the selected token/object takes priority over grabbing
    if (e.button === 0) {
      const rot = rotateHandleAt(wp.x, wp.y);
      if (rot) {
        drag.mode = 'rotate';
        drag.tokenId = rot.id;
        canvas.classList.add('panning');
        return;
      }
      const objRot = objectRotateHandleAt(wp.x, wp.y);
      if (objRot) {
        drag.mode = 'object-rotate';
        drag.objectId = objRot.id;
        canvas.classList.add('panning');
        return;
      }
    }

    const hit = tokenAt(wp.x, wp.y);

    if (e.button === 2) {
      window.RPG.closeContextMenu();
      if (hit) {
        state.selectedTokenId = hit.id;
        window.RPG.renderTokenList();
        window.RPG.draw();
        window.RPG.openContextMenu(e.clientX, e.clientY, [
          { label: '✎ Renomear', onClick: () => window.RPG.openModalForEdit(hit) },
          { label: '📝 Anotação' + (hit.note ? ' •' : ''), onClick: () => window.RPG.openTokenNote(hit) },
          { label: '✕ Excluir', danger: true, onClick: () => window.RPG.removeToken(hit.id) },
        ]);
        return;
      }
      const obj = objectAt(wp.x, wp.y);
      if (obj) {
        state.selectedObjectId = obj.id;
        window.RPG.renderObjectList();
        window.RPG.draw();
        window.RPG.openContextMenu(e.clientX, e.clientY, [
          { label: '✎ Editar', onClick: () => window.RPG.openObjectModalForEdit(obj) },
          { label: '✕ Excluir', danger: true, onClick: () => window.RPG.removeObject(obj.id) },
        ]);
        return;
      }
      const note = noteAt(wp.x, wp.y);
      if (note) {
        window.RPG.openContextMenu(e.clientX, e.clientY, [
          { label: '📝 Abrir anotação', onClick: () => window.RPG.openBackgroundNoteEdit(note) },
          { label: '✕ Excluir anotação', danger: true, onClick: () => window.RPG.removeBackgroundNote(note) },
        ]);
        return;
      }
      window.RPG.openContextMenu(e.clientX, e.clientY, [
        { label: '📝 Criar anotação', onClick: () => window.RPG.openBackgroundNoteCreate(wp.x, wp.y) },
      ]);
      return;
    }

    if (e.button === 0 && hit) {
      window.RPG.captureBeforeChange();
      drag.mode = 'token';
      drag.tokenId = hit.id;
      drag.offsetX = wp.x - hit.x;
      drag.offsetY = wp.y - hit.y;
      drag.moved = false;
      if (!state.moveMode) {
        // dragging a token that's already part of a multi-selection moves
        // the whole group; otherwise it becomes the new (single) selection
        if (!state.selectedTokenIds.includes(hit.id)) {
          state.selectedTokenIds = [hit.id];
        }
        state.selectedTokenId = hit.id;
        window.RPG.renderTokenList();
        window.RPG.sendState();
      }
      if (state.selectedTokenIds.length > 1 && state.selectedTokenIds.includes(hit.id)) {
        drag.groupOffsets = state.selectedTokenIds
          .filter(id => id !== hit.id)
          .map(id => {
            const t = state.tokens.find(tk => tk.id === id);
            return t ? { id, dx: t.x - hit.x, dy: t.y - hit.y } : null;
          })
          .filter(Boolean);
      } else {
        drag.groupOffsets = null;
      }
      window.RPG.draw();
      return;
    }

    // left-click on an object grabs/selects it (no multi-select — objects are
    // scenery, not a combat roster)
    if (e.button === 0 && !hit) {
      const obj = objectAt(wp.x, wp.y);
      if (obj) {
        window.RPG.captureBeforeChange();
        drag.mode = 'object';
        drag.objectId = obj.id;
        drag.moved = false;
        drag.offsetX = wp.x - obj.x;
        drag.offsetY = wp.y - obj.y;
        state.selectedObjectId = obj.id;
        window.RPG.renderObjectList();
        window.RPG.draw();
        return;
      }
    }

    // left-click on a background note marker opens its floating post-it
    // instead of starting a box-select
    if (e.button === 0 && !hit) {
      const note = noteAt(wp.x, wp.y);
      if (note) {
        window.RPG.openNotePostitForNote(note);
        return;
      }
    }

    // left-click on empty space (not fog/wall/measure/rotate/token/note) starts a
    // box-select drag; shift held adds to the existing selection instead of
    // replacing it
    if (e.button === 0 && !hit) {
      drag.mode = 'box';
      drag.boxStartX = drag.boxCurX = wp.x;
      drag.boxStartY = drag.boxCurY = wp.y;
      drag.boxAdditive = e.shiftKey;
      if (!e.shiftKey) {
        state.selectedTokenIds = [];
        state.selectedTokenId = null;
        window.RPG.renderTokenList();
      }
      window.RPG.draw();
    }
  });

  window.addEventListener('mousemove', (e) => {
    const sp = eventScreenPos(e);
    const bringCarry = window.RPG.bringCarry;

    if (bringCarry.active) {
      const wp = screenToWorld(sp.x, sp.y);
      bringCarry.worldX = wp.x;
      bringCarry.worldY = wp.y;
      window.RPG.draw();
      return;
    }

    if (window.RPG && window.RPG.measureState && window.RPG.measureState.active) {
      const wp = screenToWorld(sp.x, sp.y);
      window.RPG.measureUpdate(wp.x, wp.y);
      window.RPG.draw();
      return;
    }

    if (fogDraw.active) {
      const wp = screenToWorld(sp.x, sp.y);
      fogDraw.curX = wp.x;
      fogDraw.curY = wp.y;
      window.RPG.draw();
      return;
    }

    if (wallDraw.active) {
      const wp = screenToWorld(sp.x, sp.y);
      const snapped = e.shiftKey ? snapToCardinal(wallDraw.startX, wallDraw.startY, wp.x, wp.y) : wp;
      wallDraw.curX = snapped.x;
      wallDraw.curY = snapped.y;
      window.RPG.draw();
      return;
    }

    if (drag.mode === 'pan') {
      cam.x = drag.camStartX - (sp.x - drag.startScreenX) / cam.zoom;
      cam.y = drag.camStartY - (sp.y - drag.startScreenY) / cam.zoom;
      window.RPG.draw();
      return;
    }

    if (drag.mode === 'rotate') {
      const wp = screenToWorld(sp.x, sp.y);
      const t = state.tokens.find(t => t.id === drag.tokenId);
      if (t) {
        t.facing = Math.atan2(wp.y - t.y, wp.x - t.x);
        window.RPG.draw();
        window.RPG.sendState();
      }
      return;
    }

    if (drag.mode === 'token') {
      const wp = screenToWorld(sp.x, sp.y);
      const t = state.tokens.find(t => t.id === drag.tokenId);
      if (t) {
        let nx = wp.x - drag.offsetX;
        let ny = wp.y - drag.offsetY;
        if (state.snapToGrid) {
          const g = state.grid.size;
          nx = Math.round(nx / g) * g;
          ny = Math.round(ny / g) * g;
        }
        t.x = nx;
        t.y = ny;
        if (drag.groupOffsets) {
          for (const go of drag.groupOffsets) {
            const gt = state.tokens.find(tk => tk.id === go.id);
            if (gt) { gt.x = nx + go.dx; gt.y = ny + go.dy; }
          }
        }
        drag.moved = true;
        window.RPG.draw();
        window.RPG.sendState();
      }
      return;
    }

    if (drag.mode === 'box') {
      const wp = screenToWorld(sp.x, sp.y);
      drag.boxCurX = wp.x;
      drag.boxCurY = wp.y;
      window.RPG.draw();
      return;
    }

    if (drag.mode === 'object') {
      const wp = screenToWorld(sp.x, sp.y);
      const o = state.objects.find(ob => ob.id === drag.objectId);
      if (o) {
        let nx = wp.x - drag.offsetX;
        let ny = wp.y - drag.offsetY;
        if (state.snapToGrid) {
          const g = state.grid.size;
          nx = Math.round(nx / g) * g;
          ny = Math.round(ny / g) * g;
        }
        o.x = nx;
        o.y = ny;
        drag.moved = true;
        window.RPG.draw();
        window.RPG.sendState();
      }
      return;
    }

    if (drag.mode === 'object-rotate') {
      const wp = screenToWorld(sp.x, sp.y);
      const o = state.objects.find(ob => ob.id === drag.objectId);
      if (o) {
        o.rotation = Math.atan2(wp.y - o.y, wp.x - o.x) + Math.PI / 2;
        window.RPG.draw();
        window.RPG.sendState();
      }
      return;
    }

    // hover cursor feedback
    const wp = screenToWorld(sp.x, sp.y);
    const overGrab = !state.fogMode && !state.wallMode && (!!rotateHandleAt(wp.x, wp.y) || !!tokenAt(wp.x, wp.y));
    canvas.classList.toggle('over-token', overGrab);
  });

  window.addEventListener('mouseup', () => {
    if (window.RPG.getMeasureMode() && window.RPG.measureState.active) {
      window.RPG.measureRelease();
      if (!window.RPG.measureState.active) {
        window.RPG.setMeasureSelectedTokenId(null);
        state.selectedTokenId = null;
        window.RPG.renderTokenList();
      }
      window.RPG.draw();
    }

    if (fogDraw.active) {
      fogDraw.active = false;
      const rx = Math.min(fogDraw.startX, fogDraw.curX);
      const ry = Math.min(fogDraw.startY, fogDraw.curY);
      const rw = Math.abs(fogDraw.curX - fogDraw.startX);
      const rh = Math.abs(fogDraw.curY - fogDraw.startY);
      if (rw > 4 && rh > 4) {
        window.RPG.captureBeforeChange('Desenhou retângulo de névoa');
        state.fog.push({ id: state.nextFogId++, x: rx, y: ry, w: rw, h: rh });
        window.RPG.sendState();
      }
      window.RPG.draw();
    }

    if (wallDraw.active) {
      wallDraw.active = false;
      const dx = wallDraw.curX - wallDraw.startX;
      const dy = wallDraw.curY - wallDraw.startY;
      if (Math.hypot(dx, dy) > 4) {
        window.RPG.captureBeforeChange('Desenhou parede');
        const p1 = snapWallEndpoint(wallDraw.startX, wallDraw.startY);
        const p2 = snapWallEndpoint(wallDraw.curX, wallDraw.curY);
        state.walls.push({ id: state.nextWallId++, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        window.RPG.sendState();
      }
      window.RPG.draw();
    }
    if (drag.mode === 'box') {
      const rx = Math.min(drag.boxStartX, drag.boxCurX);
      const ry = Math.min(drag.boxStartY, drag.boxCurY);
      const rw = Math.abs(drag.boxCurX - drag.boxStartX);
      const rh = Math.abs(drag.boxCurY - drag.boxStartY);
      if (rw > 4 || rh > 4) {
        const hits = state.tokens
          .filter(t => t.x >= rx && t.x <= rx + rw && t.y >= ry && t.y <= ry + rh)
          .map(t => t.id);
        state.selectedTokenIds = drag.boxAdditive
          ? Array.from(new Set([...state.selectedTokenIds, ...hits]))
          : hits;
        state.selectedTokenId = state.selectedTokenIds.length > 0
          ? state.selectedTokenIds[state.selectedTokenIds.length - 1]
          : null;
        window.RPG.renderTokenList();
        window.RPG.sendState();
      }
      window.RPG.draw();
    }

    if (drag.mode === 'token') {
      if (drag.moved) {
        window.RPG.logEvent(drag.groupOffsets && drag.groupOffsets.length > 0 ? 'Moveu tokens' : 'Moveu token');
      } else {
        window.RPG.discardLastCapture();
      }
    }

    if (drag.mode === 'object') {
      if (drag.moved) {
        window.RPG.logEvent('Moveu objeto');
      } else {
        window.RPG.discardLastCapture();
      }
    }

    drag.mode = null;
    drag.tokenId = null;
    drag.objectId = null;
    drag.groupOffsets = null;
    canvas.classList.remove('panning');
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // FX-mode click: opens the effect-type picker. Deliberately on 'click' (not
  // 'mousedown', where every other tool-mode branch above lives) — opening a
  // context-menu from inside 'mousedown' races openContextMenu's own
  // document-level mousedown-to-close listener and closes it in the same tick.
  canvas.addEventListener('click', (e) => {
    if (!window.RPG.getFxMode() || window.RPG.bringCarry.active) return;
    const sp = eventScreenPos(e);
    const wp = screenToWorld(sp.x, sp.y);
    const items = Object.entries(window.RPG.FX_TYPES).map(([key, def]) => ({
      label: def.label,
      onClick: () => {
        const opts = window.RPG.getFxSettings();
        window.RPG.spawnFx(key, wp.x, wp.y, opts);
        window.RPG.sendFx(key, wp.x, wp.y, opts);
        window.RPG.logEvent(`Efeito: ${def.label}`);
      },
    }));
    window.RPG.openContextMenu(e.clientX, e.clientY, items);
  });

  // double-click a token opens its annotation post-it
  canvas.addEventListener('dblclick', (e) => {
    const sp = eventScreenPos(e);
    const wp = screenToWorld(sp.x, sp.y);
    const hit = tokenAt(wp.x, wp.y);
    if (hit) window.RPG.openNotePostitForToken(hit);
  });

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
    window.RPG.draw();
    window.RPG.sendState();
  });

  window.addEventListener('keydown', (e) => {
    const bringCarry = window.RPG.bringCarry;
    if (e.key !== 'Escape' || !bringCarry.active) return;
    bringCarry.active = false;
    bringCarry.token = null;
    canvas.classList.remove('bring-mode');
    window.RPG.draw();
  });
})();
