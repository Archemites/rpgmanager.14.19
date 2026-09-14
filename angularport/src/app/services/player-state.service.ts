import { Injectable, signal } from '@angular/core';
import { CombatState, FogRect, MapObject, PartyBar, PlayerSyncedState, Token } from '../models/rpg.models';

@Injectable({
  providedIn: 'root'
})
export class PlayerStateService {
  readonly sceneId = signal<number>(1);
  readonly map = signal<{ img: HTMLImageElement | null; dataUrl: string | null; scalePct: number; bgColor: string | null }>({
    img: null,
    dataUrl: null,
    scalePct: 100,
    bgColor: null
  });
  readonly grid = signal<{ show: boolean; size: number; color: string | null; opacity: number }>({
    show: true,
    size: 48,
    color: null,
    opacity: 30
  });
  readonly fog = signal<FogRect[]>([]);
  readonly objects = signal<MapObject[]>([]);
  readonly tokens = signal<Token[]>([]);
  readonly partyBars = signal<PartyBar[]>([]);
  readonly combat = signal<CombatState>({ active: false, order: [] });

  applySyncedState(data: PlayerSyncedState): void {
    this.sceneId.set(data.sceneId);

    // Map handling
    if (data.map) {
      const currentMap = this.map();
      if (data.map.dataUrl !== currentMap.dataUrl) {
        if (data.map.dataUrl) {
          const img = new Image();
          img.src = data.map.dataUrl;
          this.map.set({
            img,
            dataUrl: data.map.dataUrl,
            scalePct: data.map.scalePct || 100,
            bgColor: data.map.bgColor || null
          });
        } else {
          this.map.set({
            img: null,
            dataUrl: null,
            scalePct: 100,
            bgColor: data.map.bgColor || null
          });
        }
      } else {
        this.map.update(m => ({
          ...m,
          scalePct: data.map.scalePct || 100,
          bgColor: data.map.bgColor || null
        }));
      }
    }

    // Grid
    if (data.grid) {
      this.grid.set({
        show: data.grid.show,
        size: data.grid.size || 48,
        color: data.grid.color || null,
        opacity: data.grid.opacity ?? 30
      });
    }

    // Fog
    this.fog.set(data.fog || []);

    // Objects
    if (data.objects) {
      const objs: MapObject[] = data.objects.map(o => ({
        id: o.id,
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        rotation: o.rotation,
        dataUrl: o.dataUrl
      }));
      this.objects.set(objs);
    }

    // Tokens
    if (data.tokens) {
      const toks: Token[] = data.tokens.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        x: t.x,
        y: t.y,
        r: t.r,
        photoDataUrl: t.photoDataUrl,
        isPlayer: t.isPlayer,
        barValues: t.barValues,
        effects: t.effects || [],
        scenes: {}
      }));
      this.tokens.set(toks);
    }

    // Party bars
    if (data.partyBars) {
      this.partyBars.set(data.partyBars);
    }

    // Combat
    if (data.combat) {
      this.combat.set(data.combat);
    }
  }
}
