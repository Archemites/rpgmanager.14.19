/**
 * Este arquivo contém apenas definições de tipos usando JSDoc.
 * Ele não executa código algum e é totalmente ignorado pelo navegador.
 * O VSCode (e outros editores compatíveis) usam este arquivo para prover
 * autocompletar (IntelliSense) e validação de erros (`// @ts-check`).
 */

/**
 * @typedef {Object} Token
 * @property {string} id
 * @property {number} x - Posição X em coordenadas do mundo
 * @property {number} y - Posição Y em coordenadas do mundo
 * @property {number} w - Largura do token
 * @property {number} h - Altura do token
 * @property {string} color - Cor padrão caso não haja imagem
 * @property {string} [name] - Nome do personagem (opcional)
 * @property {string} [img] - URL da imagem do token (base64 ou caminho)
 * @property {boolean} isEnemy - Verdadeiro se for um inimigo (borda vermelha)
 * @property {number} visionRadius - Raio de visão em unidades do mundo
 * @property {boolean} hasVision - Se o token emite visão (true/false)
 * @property {boolean} isSecret - Se o token é invisível para os jogadores
 * @property {Object.<string, {current: number, max: number}>} barValues - Valores atuais/máximos das barras de status indexados pelo ID da barra
 * @property {Array<{id: string, remaining: number|null}>} effects - Efeitos ativos no token
 */

/**
 * @typedef {Object} GridSettings
 * @property {boolean} show - Se o grid está visível
 * @property {number} size - Tamanho de cada célula do grid em px
 * @property {string|null} color - Cor do grid (null usa a cor do tema)
 */

/**
 * @typedef {Object} MapSettings
 * @property {string|null} img - URL da imagem do mapa
 * @property {number} scalePct - Escala da imagem do mapa (porcentagem)
 * @property {string|null} dataUrl - Imagem otimizada/recortada (usada internamente)
 * @property {string|null} bgColor - Cor de fundo (null usa a cor do tema)
 */

/**
 * @typedef {Object} FogRect
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {string} text
 */

/**
 * @typedef {Object} MapObject
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} rotation - Rotação em radianos
 * @property {string} dataUrl - URL da imagem do objeto
 * @property {string} [name] - Nome do objeto
 */

/**
 * @typedef {Object} PartyBar
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} defaultMax
 * @property {boolean} active - Se a barra está ativa (visível no mapa)
 * @property {'horizontal'|'vertical'|'radial'} display
 * @property {'left'|'right'} side
 * @property {'ltr'|'rtl'} direction
 */

/**
 * @typedef {Object} Effect
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {string} color
 * @property {string} icon
 * @property {boolean} narrative - Apenas uma tag narrativa, sem duração ou barras
 * @property {number|null} duration - Duração em turnos
 * @property {Array<{barId: string, delta: string}>} barMods - Modificações aplicadas a cada turno
 */

/**
 * @typedef {Object} CombatState
 * @property {boolean} active
 * @property {string[]} order - IDs dos tokens em ordem de iniciativa
 */

/**
 * @typedef {Object} State
 * @property {GridSettings} grid
 * @property {MapSettings} map
 * @property {Token[]} tokens - VIEW: tokens presentes na cena atual
 * @property {FogRect[]} fog
 * @property {Note[]} notes
 * @property {MapObject[]} objects
 * @property {PartyBar[]} partyBars
 * @property {Effect[]} glossary
 * @property {boolean} snapToGrid
 * @property {number} nextId
 * @property {number} nextFogId
 * @property {number} nextNoteId
 * @property {number} nextObjectId
 * @property {number} nextBarId
 * @property {number} nextEffectId
 * @property {string|null} selectedTokenId
 * @property {string[]} selectedTokenIds
 * @property {string|null} selectedObjectId
 * @property {boolean} fogMode
 * @property {boolean} moveMode
 * @property {CombatState} combat
 */

/**
 * @typedef {Object} RPGApp
 * @property {State} [state]
 * @property {Token[]} [allTokens]
 * @property {Function} [draw]
 * @property {Function} [sendState]
 * @property {Function} [getTokenPhotoImg]
 * @property {Function} [drawTokenBars]
 * @property {Function} [tokenBarExtents]
 * @property {Function} [drawMapAndGrid]
 * @property {Function} [drawTokenBasic]
 * @property {Function} [getObjectImg]
 * @property {Function} [contrastColor]
 * @property {Object} [drag]
 * @property {Object} [cam]
 * @property {Function} [getCam]
 * @property {Function} [screenToWorld]
 * @property {Function} [eventScreenPos]
 * @property {Function} [zoomAt]
 * @property {Function} [centerView]
 * @property {Function} [updateHud]
 * @property {Function} [resizeCanvas]
 * @property {HTMLElement} [combatBar]
 * @property {Function} [renderCombatBar]
 * @property {Function} [startCombat]
 * @property {Function} [stopCombat]
 * @property {Function} [nextTurn]
 * @property {Function} [showStatus]
 * @property {Function} [setMyTokenId]
 * @property {Function} [getMyTokenId]
 * @property {Function} [setActiveConnection]
 * @property {Function} [getActiveConnection]
 * @property {Function} [getThemeMapBg]
 * @property {Function} [getThemeGridColor]
 * @property {Function} [createCamera]
 * @property {Function} [createPhotoCache]
 * @property {Function} [createObjectImgCache]
 * @property {Function} [createBarRenderer]
 * @property {Function} [createSceneRenderer]
 * @property {number} [BASE_TOKEN_RADIUS]
 * @property {number} [MAX_ACTIVE_BARS]
 * @property {number} [ROTATE_HANDLE_R]
 */

/**
 * @global
 * @type {RPGApp}
 */
window.RPG = window.RPG || {};
