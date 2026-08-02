/* ============================================================
   GM Party panel: universal bars toolbar, per-member values, cross-scene
   "bring here". See ARCHITECTURE.md "Scenes" > "Bring to scene carry".
   ============================================================ */

(() => {
  'use strict';

  const state = window.RPG.state;
  const allTokens = window.RPG.allTokens;
  const MAX_ACTIVE_BARS = window.RPG.MAX_ACTIVE_BARS;

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
        window.RPG.draw();
        window.RPG.sendState();
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
      editB.textContent = '✎';
      editB.title = 'Editar barra (universal)';
      editB.addEventListener('click', () => window.RPG.openBarDefEditor(def));
      const delB = document.createElement('button');
      delB.className = 'icon-btn';
      delB.textContent = '✕';
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
    addDef.addEventListener('click', () => window.RPG.openBarDefEditor(null));
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
      const currentSceneId = window.RPG.getCurrentSceneId();
      const inCurrentScene = t.scenes && t.scenes[currentSceneId];
      const sceneTag = document.createElement('span');
      sceneTag.className = 'pm-scene-tag';
      head.appendChild(sceneTag);
      if (inCurrentScene) {
        sceneTag.textContent = 'Nesta cena';
        sceneTag.classList.add('here');
      } else {
        const homeSceneId = t.scenes ? Object.keys(t.scenes)[0] : null;
        const homeScene = homeSceneId ? window.RPG.scenes.find(s => s.id === Number(homeSceneId)) : null;
        sceneTag.textContent = homeScene ? homeScene.name : 'Sem cena';
        const bringBtn = document.createElement('button');
        bringBtn.className = 'icon-btn pm-bring-btn';
        bringBtn.textContent = '🎯';
        bringBtn.title = 'Trazer para a cena atual (clique no mapa para posicionar)';
        bringBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.RPG.startBringToken(t);
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
    editB.textContent = '✎';
    editB.title = 'Editar valor deste membro';
    editB.addEventListener('click', () => window.RPG.openBarValueEditor(token, def));

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
    window.RPG.draw();
    window.RPG.sendState();
  }

  // ---------- Expose to window.RPG ----------
  window.RPG.syncTokenBarValues = syncTokenBarValues;
  window.RPG.syncAllPartyBarValues = syncAllPartyBarValues;
  window.RPG.renderParty = renderParty;
})();
