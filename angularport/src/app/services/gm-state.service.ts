import { Injectable, signal } from '@angular/core';
import {
  CombatState,
  Effect,
  FogRect,
  GmState,
  GridSettings,
  MapObject,
  MapSettings,
  Note,
  PartyBar,
  Scene,
  SceneFolder,
  Token
} from '../models/rpg.models';
import { PhotoCacheService } from './photo-cache.service';

const SESSION_STORAGE_KEY = 'rpg-autosave-session';

@Injectable({
  providedIn: 'root'
})
export class GmStateService {
  readonly scenes = signal<Scene[]>([]);
  readonly currentSceneId = signal<number>(1);
  readonly folders = signal<SceneFolder[]>([]);
  readonly allTokens = signal<Token[]>([]);

  // Current scene working state (view)
  readonly state: GmState = {
    grid: { show: true, size: 48, color: null, opacity: 30 },
    map: { img: null, scalePct: 100, dataUrl: null, bgColor: null },
    tokens: [],
    fog: [],
    notes: [],
    objects: [],
    partyBars: [
      { id: '1', name: 'Vida', color: '#e04b4b', defaultMax: 10, active: true, display: 'horizontal', side: 'left', direction: 'ltr' },
      { id: '2', name: 'Mana', color: '#4b7be0', defaultMax: 10, active: false, display: 'horizontal', side: 'left', direction: 'ltr' }
    ],
    glossary: [
      { id: '1', name: 'Envenenado', desc: 'Perde vida a cada turno.', color: '#4be08f', icon: 'ENV', narrative: false, duration: 3, barMods: [{ barId: '1', delta: -1 }] },
      { id: '2', name: 'Atordoado', desc: 'Não pode realizar ações.', color: '#e0c24b', icon: 'ATOR', narrative: true, duration: 1 }
    ],
    snapToGrid: false,
    nextFogId: 1,
    nextNoteId: 1,
    nextObjectId: 1,
    nextBarId: 3,
    nextEffectId: 3,
    selectedTokenId: null,
    selectedTokenIds: [],
    selectedObjectId: null,
    fogMode: false,
    moveMode: false,
    measureMode: false,
    fxMode: false,
    combat: { active: false, order: [] }
  };

  readonly eventLogs = signal<string[]>([]);
  readonly sceneSyncPending = signal<boolean>(false);

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private autosaveTimer: any = null;

  constructor(private photoCache: PhotoCacheService) {
    this.initDefaultSession();
    this.loadFromAutosave();
  }

  private initDefaultSession(): void {
    const defaultScene: Scene = {
      id: 1,
      name: 'Cena 1',
      map: { img: null, scalePct: 100, dataUrl: null, bgColor: null },
      fog: [],
      notes: [],
      objects: [],
      grid: { show: true, size: 48, color: null, opacity: 30 },
      combat: { active: false, order: [] },
      nextFogId: 1,
      nextNoteId: 1,
      nextObjectId: 1,
      folderId: null
    };
    this.scenes.set([defaultScene]);
    this.currentSceneId.set(1);
    this.folders.set([]);
    this.allTokens.set([]);
    this.syncStateWithCurrentScene();
  }

  getCurrentScene(): Scene | undefined {
    return this.scenes().find(s => s.id === this.currentSceneId());
  }

  visibleTokens(): Token[] {
    const cid = this.currentSceneId();
    return this.allTokens().filter(t => t.scenes && t.scenes[cid]);
  }

  refreshVisibleTokens(): void {
    this.state.tokens = this.visibleTokens();
  }

  commitTokenPosition(t: Token): void {
    const cid = this.currentSceneId();
    if (!t.scenes || !t.scenes[cid]) return;
    t.scenes[cid] = { x: t.x, y: t.y };
  }

  commitSceneFields(): void {
    const sc = this.getCurrentScene();
    if (!sc) return;
    sc.map = { ...this.state.map };
    sc.fog = [...this.state.fog];
    sc.notes = [...this.state.notes];
    sc.objects = [...this.state.objects];
    sc.grid = { ...this.state.grid };
    sc.combat = { ...this.state.combat };
    sc.nextFogId = this.state.nextFogId;
    sc.nextNoteId = this.state.nextNoteId;
    sc.nextObjectId = this.state.nextObjectId;

    for (const t of this.visibleTokens()) {
      this.commitTokenPosition(t);
    }
  }

  syncStateWithCurrentScene(): void {
    const sc = this.getCurrentScene();
    if (!sc) return;
    this.state.map = { ...sc.map };
    this.state.fog = [...sc.fog];
    this.state.notes = [...sc.notes];
    this.state.objects = [...sc.objects];
    this.state.grid = { ...sc.grid };
    this.state.combat = { ...sc.combat };
    this.state.nextFogId = sc.nextFogId;
    this.state.nextNoteId = sc.nextNoteId;
    this.state.nextObjectId = sc.nextObjectId;
    this.state.selectedTokenId = null;
    this.state.selectedTokenIds = [];
    this.state.selectedObjectId = null;

    const cid = sc.id;
    for (const t of this.allTokens()) {
      const pos = t.scenes && t.scenes[cid];
      if (pos) {
        t.x = pos.x;
        t.y = pos.y;
      }
    }
    this.refreshVisibleTokens();
  }

  switchScene(sceneId: number): void {
    if (sceneId === this.currentSceneId()) return;
    const target = this.scenes().find(s => s.id === sceneId);
    if (!target) return;

    this.commitSceneFields();
    this.currentSceneId.set(sceneId);
    this.syncStateWithCurrentScene();
    this.sceneSyncPending.set(true);
    this.logEvent(`Mudou para a cena: ${target.name}`);
    this.triggerAutosave();
  }

  createScene(name?: string): Scene {
    this.commitSceneFields();
    const nextId = Math.max(0, ...this.scenes().map(s => s.id)) + 1;
    const newScene: Scene = {
      id: nextId,
      name: name || `Cena ${nextId}`,
      map: { img: null, scalePct: 100, dataUrl: null, bgColor: null },
      fog: [],
      notes: [],
      objects: [],
      grid: { show: true, size: 48, color: null, opacity: 30 },
      combat: { active: false, order: [] },
      nextFogId: 1,
      nextNoteId: 1,
      nextObjectId: 1,
      folderId: null
    };

    this.scenes.update(list => [...list, newScene]);
    this.logEvent(`Criou a cena: ${newScene.name}`);
    this.triggerAutosave();
    return newScene;
  }

  renameScene(sceneId: number, name: string): void {
    const sc = this.scenes().find(s => s.id === sceneId);
    if (!sc) return;
    sc.name = name.trim() || sc.name;
    this.scenes.update(s => [...s]);
    this.triggerAutosave();
  }

  deleteScene(sceneId: number): void {
    if (this.scenes().length <= 1) return;
    const sc = this.scenes().find(s => s.id === sceneId);
    if (!sc) return;

    this.scenes.update(list => list.filter(s => s.id !== sceneId));
    if (this.currentSceneId() === sceneId) {
      const nextActive = this.scenes()[0].id;
      this.currentSceneId.set(nextActive);
      this.syncStateWithCurrentScene();
    }
    this.logEvent(`Excluiu a cena: ${sc.name}`);
    this.triggerAutosave();
  }

  // Token methods
  addToken(token: Omit<Token, 'id' | 'scenes' | 'barValues' | 'effects'>): Token {
    this.captureSnapshot();
    const id = 't_' + Math.random().toString(36).substring(2, 9);
    const cid = this.currentSceneId();
    const barValues: Record<string, { current: number; max: number }> = {};
    for (const b of this.state.partyBars) {
      barValues[b.id] = { current: b.defaultMax, max: b.defaultMax };
    }

    const newToken: Token = {
      ...token,
      id,
      scenes: { [cid]: { x: token.x, y: token.y } },
      barValues,
      effects: [],
      addedAt: Date.now()
    };

    this.allTokens.update(list => [...list, newToken]);
    this.refreshVisibleTokens();
    this.logEvent(`Adicionou token: ${newToken.name || 'Sem nome'}`);
    this.triggerAutosave();
    return newToken;
  }

  removeToken(tokenId: string): void {
    this.captureSnapshot();
    const t = this.allTokens().find(tok => tok.id === tokenId);
    this.allTokens.update(list => list.filter(tok => tok.id !== tokenId));
    this.refreshVisibleTokens();
    if (this.state.selectedTokenId === tokenId) {
      this.state.selectedTokenId = null;
    }
    this.state.selectedTokenIds = this.state.selectedTokenIds.filter(id => id !== tokenId);
    this.state.combat.order = this.state.combat.order.filter(id => id !== tokenId);
    this.logEvent(`Removeu token: ${t?.name || tokenId}`);
    this.triggerAutosave();
  }

  bringTokenToCurrentScene(token: Token, x: number, y: number): void {
    const cid = this.currentSceneId();
    if (!token.scenes) token.scenes = {};
    token.scenes[cid] = { x, y };
    token.x = x;
    token.y = y;
    this.refreshVisibleTokens();
    this.triggerAutosave();
  }

  // Objects
  addObject(dataUrl: string, name?: string, x: number = 0, y: number = 0): MapObject {
    this.captureSnapshot();
    const obj: MapObject = {
      id: 'obj_' + this.state.nextObjectId++,
      x,
      y,
      w: 100,
      h: 100,
      rotation: 0,
      dataUrl,
      name
    };
    this.state.objects.push(obj);
    this.commitSceneFields();
    this.logEvent(`Adicionou objeto: ${name || 'Objeto'}`);
    this.triggerAutosave();
    return obj;
  }

  removeObject(id: string): void {
    this.captureSnapshot();
    this.state.objects = this.state.objects.filter(o => o.id !== id);
    if (this.state.selectedObjectId === id) this.state.selectedObjectId = null;
    this.commitSceneFields();
    this.triggerAutosave();
  }

  // Fog
  addFogRect(x: number, y: number, w: number, h: number): FogRect {
    this.captureSnapshot();
    const rect: FogRect = {
      id: 'fog_' + this.state.nextFogId++,
      x: w < 0 ? x + w : x,
      y: h < 0 ? y + h : y,
      w: Math.abs(w),
      h: Math.abs(h)
    };
    this.state.fog.push(rect);
    this.commitSceneFields();
    this.triggerAutosave();
    return rect;
  }

  removeFogRect(id: string): void {
    this.captureSnapshot();
    this.state.fog = this.state.fog.filter(f => f.id !== id);
    this.commitSceneFields();
    this.triggerAutosave();
  }

  clearFog(): void {
    if (this.state.fog.length === 0) return;
    this.captureSnapshot();
    this.state.fog = [];
    this.commitSceneFields();
    this.logEvent('Limpou toda a névoa');
    this.triggerAutosave();
  }

  // Combat
  startCombat(): void {
    const visible = this.visibleTokens();
    if (visible.length === 0) return;
    this.state.combat.active = true;
    this.state.combat.order = visible.map(t => t.id);
    this.commitSceneFields();
    this.logEvent('Iniciou combate');
    this.triggerAutosave();
  }

  stopCombat(): void {
    this.state.combat.active = false;
    this.state.combat.order = [];
    this.commitSceneFields();
    this.logEvent('Encerrou combate');
    this.triggerAutosave();
  }

  nextTurn(): void {
    if (!this.state.combat.active || this.state.combat.order.length <= 1) return;
    const first = this.state.combat.order.shift();
    if (first) this.state.combat.order.push(first);
    this.commitSceneFields();
    this.logEvent('Avançou o turno');
    this.triggerAutosave();
  }

  // History Undo/Redo
  captureSnapshot(): void {
    this.commitSceneFields();
    const snap = JSON.stringify({
      scenes: this.scenes(),
      allTokens: this.allTokens(),
      currentSceneId: this.currentSceneId(),
      partyBars: this.state.partyBars,
      glossary: this.state.glossary
    });
    this.undoStack.push(snap);
    if (this.undoStack.length > 20) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.commitSceneFields();
    const current = JSON.stringify({
      scenes: this.scenes(),
      allTokens: this.allTokens(),
      currentSceneId: this.currentSceneId(),
      partyBars: this.state.partyBars,
      glossary: this.state.glossary
    });
    this.redoStack.push(current);

    const prev = this.undoStack.pop();
    if (prev) {
      this.restoreSnapshot(prev);
      this.logEvent('Desfez ação (Undo)');
    }
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    if (next) {
      this.captureSnapshot();
      this.restoreSnapshot(next);
      this.logEvent('Refez ação (Redo)');
    }
  }

  private restoreSnapshot(raw: string): void {
    try {
      const data = JSON.parse(raw);
      this.scenes.set(data.scenes || []);
      this.allTokens.set(data.allTokens || []);
      this.currentSceneId.set(data.currentSceneId || 1);
      this.state.partyBars = data.partyBars || [];
      this.state.glossary = data.glossary || [];
      this.syncStateWithCurrentScene();
    } catch (e) {
      console.error('Falha ao restaurar snapshot:', e);
    }
  }

  logEvent(msg: string): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.eventLogs.update(logs => [`[${timestamp}] ${msg}`, ...logs.slice(0, 99)]);
  }

  triggerAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.saveToAutosave();
    }, 1500);
  }

  saveToAutosave(): void {
    try {
      this.commitSceneFields();
      const payload = {
        savedAt: new Date().toISOString(),
        currentSceneId: this.currentSceneId(),
        scenes: this.scenes(),
        folders: this.folders(),
        allTokens: this.allTokens(),
        partyBars: this.state.partyBars,
        glossary: this.state.glossary
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Falha no autosave:', e);
    }
  }

  loadFromAutosave(): void {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
        this.scenes.set(data.scenes);
        this.currentSceneId.set(data.currentSceneId || data.scenes[0].id);
        this.folders.set(data.folders || []);
        this.allTokens.set(data.allTokens || []);
        if (data.partyBars) this.state.partyBars = data.partyBars;
        if (data.glossary) this.state.glossary = data.glossary;

        for (const sc of data.scenes) {
          if (sc.map && sc.map.dataUrl) {
            const img = new Image();
            img.src = sc.map.dataUrl;
            sc.map.img = img;
          }
        }
        this.syncStateWithCurrentScene();
      }
    } catch (e) {
      console.warn('Falha ao restaurar autosave:', e);
    }
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    this.initDefaultSession();
    this.logEvent('Sessão resetada para o padrão');
  }

  exportSession(): string {
    this.commitSceneFields();
    const payload = {
      formatVersion: 1,
      savedAt: new Date().toISOString(),
      currentSceneId: this.currentSceneId(),
      scenes: this.scenes().map(s => ({
        ...s,
        map: { scalePct: s.map.scalePct, dataUrl: s.map.dataUrl, bgColor: s.map.bgColor }
      })),
      folders: this.folders(),
      allTokens: this.allTokens(),
      partyBars: this.state.partyBars,
      glossary: this.state.glossary
    };
    return JSON.stringify(payload, null, 2);
  }

  importSession(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data.scenes || !Array.isArray(data.scenes)) return false;
      this.scenes.set(data.scenes);
      this.currentSceneId.set(data.currentSceneId || data.scenes[0].id);
      this.folders.set(data.folders || []);
      this.allTokens.set(data.allTokens || []);
      if (data.partyBars) this.state.partyBars = data.partyBars;
      if (data.glossary) this.state.glossary = data.glossary;

      for (const sc of data.scenes) {
        if (sc.map && sc.map.dataUrl) {
          const img = new Image();
          img.src = sc.map.dataUrl;
          sc.map.img = img;
        }
      }
      this.syncStateWithCurrentScene();
      this.logEvent('Sessão importada de arquivo');
      this.triggerAutosave();
      return true;
    } catch (e) {
      console.error('Erro ao importar sessão:', e);
      return false;
    }
  }
}
