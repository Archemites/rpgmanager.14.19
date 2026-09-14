export interface Token {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  r: number;
  photoDataUrl?: string | null;
  photoImg?: HTMLImageElement | null;
  isPlayer?: boolean;
  note?: string;
  scenes?: Record<number, { x: number; y: number }>;
  barValues?: Record<string, { current: number; max: number }>;
  effects?: Array<{ id: string; duration?: number | null; count?: number }>;
  addedAt?: number;
}

export interface PartyBar {
  id: string;
  name: string;
  color: string;
  defaultMax: number;
  active: boolean;
  display: 'horizontal' | 'vertical' | 'radial';
  side: 'left' | 'right';
  direction: 'ltr' | 'rtl';
}

export interface Effect {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon?: string;
  narrative?: boolean;
  duration?: number | null;
  barMods?: Array<{ barId: string; delta: number | string }>;
}

export interface MapObject {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  dataUrl: string;
  name?: string;
  img?: HTMLImageElement | null;
}

export interface FogRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface GridSettings {
  show: boolean;
  size: number;
  color: string | null;
  opacity: number;
}

export interface MapSettings {
  img: HTMLImageElement | null;
  scalePct: number;
  dataUrl: string | null;
  bgColor: string | null;
}

export interface CombatState {
  active: boolean;
  order: string[];
}

export interface Scene {
  id: number;
  name: string;
  map: MapSettings;
  fog: FogRect[];
  notes: Note[];
  objects: MapObject[];
  grid: GridSettings;
  combat: CombatState;
  nextFogId: number;
  nextNoteId: number;
  nextObjectId: number;
  folderId: number | null;
}

export interface SceneFolder {
  id: number;
  name: string;
  collapsed: boolean;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface GmState {
  grid: GridSettings;
  map: MapSettings;
  tokens: Token[];
  fog: FogRect[];
  notes: Note[];
  objects: MapObject[];
  partyBars: PartyBar[];
  glossary: Effect[];
  snapToGrid: boolean;
  nextFogId: number;
  nextNoteId: number;
  nextObjectId: number;
  nextBarId: number;
  nextEffectId: number;
  selectedTokenId: string | null;
  selectedTokenIds: string[];
  selectedObjectId: string | null;
  fogMode: boolean;
  moveMode: boolean;
  measureMode: boolean;
  fxMode: boolean;
  combat: CombatState;
}

export interface PlayerSyncedState {
  type: 'rpg-state';
  sceneId: number;
  map: { dataUrl: string | null; scalePct: number; bgColor: string | null };
  grid: { show: boolean; size: number; color: string | null; opacity: number };
  fog: FogRect[];
  objects: Array<{ id: string; x: number; y: number; w: number; h: number; rotation: number; dataUrl: string }>;
  tokens: Array<{
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
    r: number;
    photoDataUrl?: string | null;
    isPlayer?: boolean;
    barValues?: Record<string, { current: number; max: number }>;
    effects?: Array<{ id: string; duration?: number | null }>;
  }>;
  partyBars: PartyBar[];
  glossary?: Effect[];
  combat: CombatState;
  theme?: string;
}

export interface FxPayload {
  type: 'rpg-fx';
  fxType: string;
  x: number;
  y: number;
  scale?: number;
  durationMult?: number;
}
