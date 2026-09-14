import { Injectable } from '@angular/core';
import { Camera } from '../models/rpg.models';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 6;

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  createCamera(): Camera {
    return { x: 0, y: 0, zoom: 1 };
  }

  screenToWorld(sx: number, sy: number, cam: Camera): { x: number; y: number } {
    return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
  }

  worldToScreen(wx: number, wy: number, cam: Camera): { x: number; y: number } {
    return { x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom };
  }

  eventScreenPos(e: MouseEvent | Touch, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  zoomAt(screenX: number, screenY: number, factor: number, cam: Camera, afterChange?: () => void): void {
    const before = this.screenToWorld(screenX, screenY, cam);
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * factor));
    cam.x = before.x - screenX / cam.zoom;
    cam.y = before.y - screenY / cam.zoom;
    if (afterChange) afterChange();
  }

  centerView(cam: Camera, viewport: HTMLElement, afterChange?: () => void): void {
    cam.zoom = 1;
    cam.x = -viewport.clientWidth / 2;
    cam.y = -viewport.clientHeight / 2;
    if (afterChange) afterChange();
  }
}
