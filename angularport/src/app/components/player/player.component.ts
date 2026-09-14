import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Camera, Token } from '../../models/rpg.models';
import { BarsService } from '../../services/bars.service';
import { CameraService } from '../../services/camera.service';
import { DiceService } from '../../services/dice.service';
import { FxTrailService } from '../../services/fx-trail.service';
import { PhotoCacheService } from '../../services/photo-cache.service';
import { PlayerStateService } from '../../services/player-state.service';
import { PlayerSyncService } from '../../services/player-sync.service';
import { SceneRenderService } from '../../services/scene-render.service';
import { ThemeService } from '../../services/theme.service';

declare var jsQR: any;

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('playerCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportRef') viewportRef!: ElementRef<HTMLDivElement>;
  @ViewChild('videoScanRef') videoScanRef?: ElementRef<HTMLVideoElement>;

  // Entry overlay form
  playerName: string = '';
  roomCode: string = '';
  pin: string = '';
  isScanningQr = signal<boolean>(false);
  scanHint = signal<string>('');

  // Fullscreen state
  isFullscreen = signal<boolean>(false);

  // Camera & Interaction
  cam: Camera = { x: 0, y: 0, zoom: 1 };
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private animationFrameId: number | null = null;
  private qrScanStream: MediaStream | null = null;

  constructor(
    public playerState: PlayerStateService,
    public playerSync: PlayerSyncService,
    public diceService: DiceService,
    public themeService: ThemeService,
    private cameraService: CameraService,
    private photoCache: PhotoCacheService,
    private barsService: BarsService,
    private sceneRender: SceneRenderService,
    private fxTrail: FxTrailService,
    private route: ActivatedRoute
  ) {}

  ngAfterViewInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['mesa']) this.roomCode = params['mesa'].toUpperCase();
      if (params['pin']) this.pin = params['pin'];
    });

    this.fxTrail.registerRenderCallback(() => this.requestDraw());
  }

  ngOnDestroy(): void {
    this.stopQrScan();
    this.playerSync.disconnect();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.initCanvasSize();
    this.requestDraw();
  }

  @HostListener('window:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
    this.initCanvasSize();
    this.requestDraw();
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  async joinTable(): Promise<void> {
    if (!this.roomCode || !this.pin) return;
    const ok = await this.playerSync.joinRoom(
      this.roomCode.trim(),
      this.pin.trim(),
      this.playerName.trim() || 'Jogador'
    );

    if (ok) {
      this.stopQrScan();
      setTimeout(() => {
        this.initCanvasSize();
        this.cameraService.centerView(this.cam, this.viewportRef.nativeElement);
        this.requestDraw();
      }, 100);
    }
  }

  // QR Scanning with Camera
  async startQrScan(): Promise<void> {
    this.isScanningQr.set(true);
    this.scanHint.set('Aponte a câmera para o QR Code na tela do mestre...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.qrScanStream = stream;
      if (this.videoScanRef?.nativeElement) {
        const video = this.videoScanRef.nativeElement;
        video.srcObject = stream;
        video.play();
        requestAnimationFrame(() => this.scanQrLoop());
      }
    } catch (err) {
      this.scanHint.set('Não foi possível acessar a câmera.');
      this.isScanningQr.set(false);
    }
  }

  stopQrScan(): void {
    if (this.qrScanStream) {
      this.qrScanStream.getTracks().forEach(t => t.stop());
      this.qrScanStream = null;
    }
    this.isScanningQr.set(false);
  }

  private scanQrLoop(): void {
    if (!this.isScanningQr() || !this.videoScanRef?.nativeElement) return;
    const video = this.videoScanRef.nativeElement;

    if (video.readyState === video.HAVE_ENOUGH_DATA && typeof jsQR !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = (typeof jsQR === 'function' ? jsQR : jsQR.default)(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          try {
            const url = new URL(code.data);
            const mesa = url.searchParams.get('mesa');
            const pin = url.searchParams.get('pin');
            if (mesa) this.roomCode = mesa.toUpperCase();
            if (pin) this.pin = pin;
            this.stopQrScan();
            this.joinTable();
            return;
          } catch (_) {}
        }
      }
    }

    requestAnimationFrame(() => this.scanQrLoop());
  }

  initCanvasSize(): void {
    const canvas = this.canvasRef?.nativeElement;
    const viewport = this.viewportRef?.nativeElement;
    if (!canvas || !viewport) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.clientWidth * dpr;
    canvas.height = viewport.clientHeight * dpr;
  }

  requestDraw(): void {
    if (this.animationFrameId !== null) return;
    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.render();
    });
  }

  render(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    const map = this.playerState.map();
    ctx.fillStyle = map.bgColor || this.themeService.getThemeMapBg();
    ctx.fillRect(0, 0, w, h);

    // Camera transform
    const s = this.cam.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, -this.cam.x * s, -this.cam.y * s);

    const wl = this.cam.x;
    const wt = this.cam.y;
    const wr = this.cam.x + (w / dpr) / this.cam.zoom;
    const wb = this.cam.y + (h / dpr) / this.cam.zoom;

    // 1. Map & Grid
    this.sceneRender.drawMapAndGrid(ctx, wl, wt, wr, wb, this.cam.zoom, map, this.playerState.grid());

    // 2. Objects
    for (const obj of this.playerState.objects()) {
      const img = this.photoCache.getObjectImg(obj);
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);
      if (img) {
        ctx.drawImage(img, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
      }
      ctx.restore();
    }

    // 3. Tokens
    const combat = this.playerState.combat();
    const isCombatActive = combat.active;
    const firstTurnId = combat.order[0];

    for (const t of this.playerState.tokens()) {
      const isTurn = isCombatActive && firstTurnId === t.id;
      this.sceneRender.drawTokenBasic(ctx, t, this.cam.zoom, isTurn);
      this.barsService.drawTokenBars(ctx, this.cam, t, this.playerState.partyBars());
    }

    // 4. Fog of War (Player view is 100% OPAQUE)
    ctx.fillStyle = map.bgColor || this.themeService.getThemeMapBg();
    for (const f of this.playerState.fog()) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }

    // 5. FX Trail
    this.fxTrail.drawFx(ctx, this.cam);
  }

  // Mouse pan and zoom
  onMouseDown(e: MouseEvent): void {
    if (e.button === 0 || e.button === 1) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
    }
  }

  onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.cam.x -= dx / this.cam.zoom;
      this.cam.y -= dy / this.cam.zoom;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.requestDraw();
    }
  }

  onMouseUp(): void {
    this.isPanning = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const canvas = this.canvasRef.nativeElement;
    const pos = this.cameraService.eventScreenPos(e, canvas);
    this.cameraService.zoomAt(pos.x, pos.y, factor, this.cam, () => this.requestDraw());
  }

  getTokenById(id: string): Token | undefined {
    return this.playerState.tokens().find(t => t.id === id);
  }
}

