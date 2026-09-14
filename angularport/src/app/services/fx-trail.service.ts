import { Injectable } from '@angular/core';
import { Camera } from '../models/rpg.models';

export interface FxDefinition {
  label: string;
  duration: number;
  draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, cam: Camera, scale: number) => void;
}

export interface ActiveFx {
  type: string;
  x: number;
  y: number;
  startedAt: number;
  duration: number;
  scale: number;
}

export const FX_TYPES: Record<string, FxDefinition> = {
  explosion: {
    label: 'Explosão',
    duration: 700,
    draw(ctx, cx, cy, t, cam, scale) {
      const maxR = 60 * scale;
      const r = maxR * Math.sin(t * Math.PI * 0.5);
      const alpha = 1 - t;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,200,0.95)');
      grad.addColorStop(0.4, 'rgba(255,150,40,0.85)');
      grad.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  fire: {
    label: 'Fogo',
    duration: 1400,
    draw(ctx, cx, cy, t, cam, scale) {
      const flicker = 0.85 + 0.15 * Math.sin(t * 40);
      const h = 34 * flicker * (1 - 0.3 * t) * scale;
      const w = 20 * flicker * scale;
      const alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy - h * 0.3, h);
      grad.addColorStop(0, 'rgba(255,240,150,0.95)');
      grad.addColorStop(0.5, 'rgba(255,120,30,0.85)');
      grad.addColorStop(1, 'rgba(180,30,10,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - h * 0.35, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  smoke: {
    label: 'Fumaça',
    duration: 2200,
    draw(ctx, cx, cy, t, cam, scale) {
      const r = (14 + 46 * t) * scale;
      const rise = 30 * t * scale;
      const alpha = 0.5 * (1 - t);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(150,150,150,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy - rise, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  heal: {
    label: 'Cura',
    duration: 900,
    draw(ctx, cx, cy, t, cam, scale) {
      const r = 40 * t * scale;
      const alpha = 1 - t;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(120,255,180,0.9)';
      ctx.lineWidth = 3 / cam.zoom;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (t < 0.6) {
        const crossAlpha = 1 - t / 0.6;
        ctx.globalAlpha = crossAlpha;
        ctx.strokeStyle = 'rgba(220,255,230,0.95)';
        ctx.lineWidth = 2 / cam.zoom;
        const s = 10 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
        ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
};

@Injectable({
  providedIn: 'root'
})
export class FxTrailService {
  private activeFx: ActiveFx[] = [];
  private onFrameCallback?: () => void;
  private rafId: number | null = null;

  registerRenderCallback(cb: () => void): void {
    this.onFrameCallback = cb;
  }

  spawnFx(type: string, x: number, y: number, opts?: { scale?: number; durationMult?: number }): void {
    const def = FX_TYPES[type];
    if (!def) return;
    const scale = (opts && opts.scale) || 1;
    const durationMult = (opts && opts.durationMult) || 1;
    this.activeFx.push({
      type,
      x,
      y,
      startedAt: performance.now(),
      duration: def.duration * durationMult,
      scale
    });
    this.ensureLoop();
  }

  drawFx(ctx: CanvasRenderingContext2D, cam: Camera): void {
    if (this.activeFx.length === 0) return;
    const now = performance.now();
    for (let i = this.activeFx.length - 1; i >= 0; i--) {
      const fx = this.activeFx[i];
      const def = FX_TYPES[fx.type];
      if (!def) {
        this.activeFx.splice(i, 1);
        continue;
      }
      const t = (now - fx.startedAt) / fx.duration;
      if (t >= 1) {
        this.activeFx.splice(i, 1);
        continue;
      }
      def.draw(ctx, fx.x, fx.y, t, cam, fx.scale);
    }
  }

  hasActiveFx(): boolean {
    return this.activeFx.length > 0;
  }

  private ensureLoop(): void {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    this.rafId = null;
    if (this.onFrameCallback) this.onFrameCallback();
    if (this.hasActiveFx()) {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  }
}
