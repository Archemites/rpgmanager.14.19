import { Injectable } from '@angular/core';
import { GridSettings, MapSettings, Token } from '../models/rpg.models';
import { PhotoCacheService } from './photo-cache.service';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class SceneRenderService {
  constructor(
    private photoCache: PhotoCacheService,
    private themeService: ThemeService
  ) {}

  drawMapAndGrid(
    ctx: CanvasRenderingContext2D,
    wl: number,
    wt: number,
    wr: number,
    wb: number,
    lineScale: number,
    map: MapSettings,
    grid: GridSettings
  ): void {
    let mapL: number | null = null, mapT: number | null = null, mapR: number | null = null, mapB: number | null = null;
    if (map.img && map.img.complete && map.img.naturalWidth > 0) {
      const img = map.img;
      const scale = map.scalePct / 100;
      const mw = img.naturalWidth * scale;
      const mh = img.naturalHeight * scale;
      mapL = -mw / 2; mapT = -mh / 2; mapR = mw / 2; mapB = mh / 2;
      ctx.drawImage(img, mapL, mapT, mw, mh);
    }

    if (grid.show) {
      const gl = mapL === null ? wl : Math.max(wl, mapL);
      const gt = mapT === null ? wt : Math.max(wt, mapT);
      const gr = mapR === null ? wr : Math.min(wr, mapR);
      const gb = mapB === null ? wb : Math.min(wb, mapB);

      if (gr > gl && gb > gt) {
        const g = grid.size;
        ctx.strokeStyle = grid.color || this.themeService.getThemeGridColor();
        const op = (grid.opacity !== undefined && grid.opacity !== null) ? (grid.opacity / 100) : 0.3;
        ctx.globalAlpha = op;
        ctx.lineWidth = 1 / lineScale;
        ctx.beginPath();
        const x0 = Math.ceil(gl / g) * g;
        const y0 = Math.ceil(gt / g) * g;
        for (let x = x0; x <= gr; x += g) { ctx.moveTo(x, gt); ctx.lineTo(x, gb); }
        for (let y = y0; y <= gb; y += g) { ctx.moveTo(gl, y); ctx.lineTo(gr, y); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawTokenBasic(ctx: CanvasRenderingContext2D, t: Token, lineScale: number, isCurrentTurn: boolean): void {
    const photo = this.photoCache.getTokenPhotoImg(t);

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

    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.lineWidth = (isCurrentTurn ? 4 : 2) / lineScale;
    ctx.strokeStyle = isCurrentTurn ? '#ff9f45' : (photo ? t.color : 'rgba(0,0,0,0.5)');
    ctx.stroke();

    const themeFont = this.themeService.getThemeFont();

    if (!photo && t.name) {
      ctx.font = `bold ${Math.max(12, t.r * 0.7)}px ${themeFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.photoCache.contrastColor(t.color);
      ctx.fillText(t.name.slice(0, 2).toUpperCase(), t.x, t.y);
    }

    if (t.name) {
      ctx.font = `bold ${Math.max(13, t.r * 0.55)}px ${themeFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = t.y + t.r + 4 / lineScale;
      ctx.lineWidth = 3 / lineScale;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.name, t.x, labelY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.name, t.x, labelY);
    }
  }
}
