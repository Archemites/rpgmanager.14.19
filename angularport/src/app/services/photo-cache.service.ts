import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PhotoCacheService {
  private tokenCache = new Map<string, HTMLImageElement>();
  private objectCache = new Map<string, HTMLImageElement>();

  getTokenPhotoImg(t: { photoDataUrl?: string | null }): HTMLImageElement | null {
    if (!t.photoDataUrl) return null;
    let img = this.tokenCache.get(t.photoDataUrl);
    if (!img) {
      img = new Image();
      img.src = t.photoDataUrl;
      this.tokenCache.set(t.photoDataUrl, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  getObjectImg(o: { dataUrl?: string }): HTMLImageElement | null {
    if (!o.dataUrl) return null;
    let img = this.objectCache.get(o.dataUrl);
    if (!img) {
      img = new Image();
      img.src = o.dataUrl;
      this.objectCache.set(o.dataUrl, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  contrastColor(hex: string): string {
    if (!hex || hex[0] !== '#') return '#ffffff';
    let c = hex.slice(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return '#ffffff';
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#111827' : '#ffffff';
  }

  preloadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }
}
