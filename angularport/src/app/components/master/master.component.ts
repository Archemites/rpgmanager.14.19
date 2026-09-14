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
import {
  Camera,
  Effect,
  FogRect,
  MapObject,
  Note,
  PartyBar,
  Scene,
  SceneFolder,
  Token
} from '../../models/rpg.models';
import { BarsService, MAX_ACTIVE_BARS } from '../../services/bars.service';
import { CameraService } from '../../services/camera.service';
import { DiceService } from '../../services/dice.service';
import { FxTrailService } from '../../services/fx-trail.service';
import { GmStateService } from '../../services/gm-state.service';
import { GmSyncService } from '../../services/gm-sync.service';
import { PhotoCacheService } from '../../services/photo-cache.service';
import { SceneRenderService } from '../../services/scene-render.service';
import { THEMES, ThemeName, ThemeService } from '../../services/theme.service';

declare var QRCode: any;

@Component({
  selector: 'app-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './master.component.html',
  styleUrls: ['./master.component.css']
})
export class MasterComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewportRef') viewportRef!: ElementRef<HTMLDivElement>;
  @ViewChild('inviteQrRef') inviteQrRef?: ElementRef<HTMLDivElement>;
  @ViewChild('cropCanvasRef') cropCanvasRef?: ElementRef<HTMLCanvasElement>;

  // Sidebar & tools state
  readonly sidebarCollapsed = signal<boolean>(false);
  readonly sceneSidebarCollapsed = signal<boolean>(false);
  readonly rightToolsCollapsed = signal<boolean>(true);
  readonly tokenSort = signal<'added' | 'name'>('added');
  readonly selectedThemes = THEMES;

  // Tool modes
  readonly currentTool = signal<'select' | 'fog' | 'measure' | 'fx' | 'move'>('select');

  // Modals state
  readonly showTokenModal = signal<boolean>(false);
  readonly showObjectModal = signal<boolean>(false);
  readonly showCropModal = signal<boolean>(false);
  readonly showBarModal = signal<boolean>(false);
  readonly showGlossaryModal = signal<boolean>(false);
  readonly showInviteModal = signal<boolean>(false);
  readonly showEffectsPickerModal = signal<boolean>(false);
  readonly showSettingsModal = signal<boolean>(false);
  readonly showFxSettingsModal = signal<boolean>(false);
  readonly showNoteModal = signal<boolean>(false);
  readonly showEventLogModal = signal<boolean>(false);
  readonly showHelpModal = signal<boolean>(false);
  readonly showConfirmClearModal = signal<boolean>(false);
  readonly showConfirmDeleteTokenModal = signal<boolean>(false);
  readonly showConfirmDeleteSceneModal = signal<boolean>(false);

  // Form bindings
  tokenForm: { id?: string; name: string; color: string; isPlayer: boolean; photoDataUrl: string | null } = {
    name: '',
    color: '#e04b4b',
    isPlayer: false,
    photoDataUrl: null
  };

  objectForm: { id?: string; name: string; dataUrl: string | null } = {
    name: '',
    dataUrl: null
  };

  barForm: { id?: string; name: string; current: number; max: number; color: string; display: 'horizontal' | 'vertical' | 'radial'; side: 'left' | 'right'; direction: 'ltr' | 'rtl' } = {
    name: '',
    current: 10,
    max: 10,
    color: '#e04b4b',
    display: 'horizontal',
    side: 'left',
    direction: 'ltr'
  };

  effectForm: { id?: string; name: string; desc: string; color: string; icon: string; narrative: boolean; duration: number | null } = {
    name: '',
    desc: '',
    color: '#4be08f',
    icon: '',
    narrative: false,
    duration: 3
  };

  noteFormText: string = '';
  editingNoteId: string | null = null;
  targetTokenForDelete: Token | null = null;
  targetSceneForDelete: Scene | null = null;
  targetTokenForEffects: Token | null = null;

  // Swatches
  readonly colorSwatches = ['#e04b4b', '#4b7be0', '#4be08f', '#e0c24b', '#9b4be0', '#e08f4b', '#4be0d4', '#ffffff'];

  // FX settings
  fxSize: number = 100;
  fxDuration: number = 100;

  // Camera & Interaction
  cam: Camera = { x: 0, y: 0, zoom: 1 };
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private isDraggingToken = false;
  private draggedToken: Token | null = null;
  private dragOffset = { x: 0, y: 0 };
  private isDrawingFog = false;
  private fogStart = { x: 0, y: 0 };
  private fogCurrent = { x: 0, y: 0 };

  // Measuring
  private measureA: { x: number; y: number } | null = null;
  private measureB: { x: number; y: number } | null = null;
  private isMeasuringDrag = false;

  // Crop editor state
  private cropImg: HTMLImageElement | null = null;
  cropZoom: number = 1;
  private cropPan = { x: 0, y: 0 };
  private isCropDragging = false;
  private cropDragStart = { x: 0, y: 0 };

  // Animation frame
  private animationFrameId: number | null = null;

  constructor(
    public gmState: GmStateService,
    public gmSync: GmSyncService,
    public diceService: DiceService,
    public themeService: ThemeService,
    private cameraService: CameraService,
    private photoCache: PhotoCacheService,
    private barsService: BarsService,
    private sceneRender: SceneRenderService,
    private fxTrail: FxTrailService
  ) {}

  ngAfterViewInit(): void {
    this.initCanvasSize();
    this.cameraService.centerView(this.cam, this.viewportRef.nativeElement);
    this.gmSync.startHosting();
    this.fxTrail.registerRenderCallback(() => this.requestDraw());
    this.requestDraw();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  // Window resize handler
  @HostListener('window:resize')
  onResize(): void {
    this.initCanvasSize();
    this.requestDraw();
  }

  // Global hotkeys
  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.gmState.undo();
      this.gmSync.sendState();
      this.requestDraw();
    } else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      this.gmState.redo();
      this.gmSync.sendState();
      this.requestDraw();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.gmState.state.selectedTokenId) {
        this.gmState.removeToken(this.gmState.state.selectedTokenId);
        this.gmSync.sendState();
        this.requestDraw();
      } else if (this.gmState.state.selectedObjectId) {
        this.gmState.removeObject(this.gmState.state.selectedObjectId);
        this.gmSync.sendState();
        this.requestDraw();
      }
    } else if (e.key === 'Escape') {
      this.closeAllModals();
      this.gmState.state.selectedTokenId = null;
      this.gmState.state.selectedObjectId = null;
      this.measureA = null;
      this.measureB = null;
      this.requestDraw();
    }
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
    ctx.fillStyle = this.gmState.state.map.bgColor || this.themeService.getThemeMapBg();
    ctx.fillRect(0, 0, w, h);

    // Camera transform
    const s = this.cam.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, -this.cam.x * s, -this.cam.y * s);

    // Visible bounds
    const wl = this.cam.x;
    const wt = this.cam.y;
    const wr = this.cam.x + (w / dpr) / this.cam.zoom;
    const wb = this.cam.y + (h / dpr) / this.cam.zoom;

    // 1. Map & Grid
    this.sceneRender.drawMapAndGrid(ctx, wl, wt, wr, wb, this.cam.zoom, this.gmState.state.map, this.gmState.state.grid);

    // 2. Objects
    for (const obj of this.gmState.state.objects) {
      const img = this.photoCache.getObjectImg(obj);
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);
      if (img) {
        ctx.drawImage(img, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
      } else {
        ctx.fillStyle = 'rgba(120,120,120,0.5)';
        ctx.fillRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
      }
      if (obj.id === this.gmState.state.selectedObjectId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / this.cam.zoom;
        ctx.strokeRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
      }
      ctx.restore();
    }

    // 3. Tokens
    const combatActive = this.gmState.state.combat.active;
    const firstCombatId = this.gmState.state.combat.order[0];

    for (const t of this.gmState.state.tokens) {
      const isTurn = combatActive && firstCombatId === t.id;
      this.sceneRender.drawTokenBasic(ctx, t, this.cam.zoom, isTurn);

      // Selected ring
      if (t.id === this.gmState.state.selectedTokenId || this.gmState.state.selectedTokenIds.includes(t.id)) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r + 4 / this.cam.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffff45';
        ctx.lineWidth = 2 / this.cam.zoom;
        ctx.stroke();
      }

      // Status bars
      this.barsService.drawTokenBars(ctx, this.cam, t, this.gmState.state.partyBars);

      // Effect dots
      this.drawEffectDots(ctx, t);
    }

    // 4. Fog (GM translucent preview)
    ctx.fillStyle = 'rgba(20, 60, 40, 0.45)';
    ctx.strokeStyle = 'rgba(69, 255, 120, 0.6)';
    ctx.lineWidth = 1 / this.cam.zoom;
    for (const f of this.gmState.state.fog) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeRect(f.x, f.y, f.w, f.h);
    }

    // In-progress fog drag
    if (this.isDrawingFog) {
      const fx = Math.min(this.fogStart.x, this.fogCurrent.x);
      const fy = Math.min(this.fogStart.y, this.fogCurrent.y);
      const fw = Math.abs(this.fogCurrent.x - this.fogStart.x);
      const fh = Math.abs(this.fogCurrent.y - this.fogStart.y);
      ctx.fillStyle = 'rgba(255, 150, 40, 0.35)';
      ctx.strokeStyle = '#ff9f45';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeRect(fx, fy, fw, fh);
    }

    // 5. Measure Line
    if (this.measureA && this.measureB) {
      ctx.beginPath();
      ctx.moveTo(this.measureA.x, this.measureA.y);
      ctx.lineTo(this.measureB.x, this.measureB.y);
      ctx.strokeStyle = '#45ff78';
      ctx.lineWidth = 2 / this.cam.zoom;
      ctx.stroke();

      const dx = this.measureB.x - this.measureA.x;
      const dy = this.measureB.y - this.measureA.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const gridSize = this.gmState.state.grid.size || 48;
      const meters = (distPx / gridSize).toFixed(1);

      const mx = (this.measureA.x + this.measureB.x) / 2;
      const my = (this.measureA.y + this.measureB.y) / 2;
      ctx.font = `bold ${Math.max(12, 14 / this.cam.zoom)}px ${this.themeService.getThemeFont()}`;
      ctx.fillStyle = '#45ff78';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${meters}m`, mx, my - 4 / this.cam.zoom);
    }

    // 6. FX Trail
    this.fxTrail.drawFx(ctx, this.cam);
  }

  private drawEffectDots(ctx: CanvasRenderingContext2D, t: Token): void {
    if (!t.effects || t.effects.length === 0) return;
    const dotR = Math.max(2.5 / this.cam.zoom, t.r * 0.16);
    const gap = dotR * 0.9;
    const ext = this.barsService.tokenBarExtents(this.cam, t, this.gmState.state.partyBars);
    const pad = 3 / this.cam.zoom;
    const cx = t.x + t.r + ext.right + dotR + pad;
    let cy = t.y - t.r - ext.top - dotR - pad;

    for (const app of t.effects) {
      const eff = this.gmState.state.glossary.find(e => e.id === app.id);
      if (!eff) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = eff.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1 / this.cam.zoom;
      ctx.fill();
      ctx.stroke();
      cy += dotR * 2 + gap;
    }
  }

  // Canvas Mouse Interactions
  onCanvasMouseDown(e: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const pos = this.cameraService.eventScreenPos(e, canvas);
    const world = this.cameraService.screenToWorld(pos.x, pos.y, this.cam);

    // Pan with middle button
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 0) {
      // Tool modes
      if (this.currentTool() === 'fog') {
        this.isDrawingFog = true;
        this.fogStart = { ...world };
        this.fogCurrent = { ...world };
        return;
      }

      if (this.currentTool() === 'measure') {
        const token = this.tokenAt(world.x, world.y);
        if (token) {
          if (!this.measureA) {
            this.measureA = { x: token.x, y: token.y };
          } else {
            this.measureB = { x: token.x, y: token.y };
            this.requestDraw();
          }
        } else {
          this.measureA = { ...world };
          this.measureB = { ...world };
          this.isMeasuringDrag = true;
        }
        return;
      }

      if (this.currentTool() === 'fx') {
        this.fxTrail.spawnFx('explosion', world.x, world.y, {
          scale: this.fxSize / 100,
          durationMult: this.fxDuration / 100
        });
        this.gmSync.sendFx('explosion', world.x, world.y, this.fxSize / 100, this.fxDuration / 100);
        this.requestDraw();
        return;
      }

      // Check token hit
      const token = this.tokenAt(world.x, world.y);
      if (token) {
        this.gmState.state.selectedTokenId = token.id;
        this.gmState.state.selectedObjectId = null;
        this.isDraggingToken = true;
        this.draggedToken = token;
        this.dragOffset = { x: world.x - token.x, y: world.y - token.y };
        this.requestDraw();
        return;
      }

      // Check object hit
      const obj = this.objectAt(world.x, world.y);
      if (obj) {
        this.gmState.state.selectedObjectId = obj.id;
        this.gmState.state.selectedTokenId = null;
        this.requestDraw();
        return;
      }

      // Click on background
      this.gmState.state.selectedTokenId = null;
      this.gmState.state.selectedObjectId = null;
      this.measureA = null;
      this.measureB = null;
      this.requestDraw();
    }
  }

  onCanvasMouseMove(e: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const pos = this.cameraService.eventScreenPos(e, canvas);
    const world = this.cameraService.screenToWorld(pos.x, pos.y, this.cam);

    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.cam.x -= dx / this.cam.zoom;
      this.cam.y -= dy / this.cam.zoom;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.requestDraw();
      return;
    }

    if (this.isDraggingToken && this.draggedToken) {
      let nx = world.x - this.dragOffset.x;
      let ny = world.y - this.dragOffset.y;

      if (this.gmState.state.snapToGrid) {
        const g = this.gmState.state.grid.size || 48;
        nx = Math.round(nx / g) * g;
        ny = Math.round(ny / g) * g;
      }

      this.draggedToken.x = nx;
      this.draggedToken.y = ny;
      this.requestDraw();
      return;
    }

    if (this.isDrawingFog) {
      this.fogCurrent = { ...world };
      this.requestDraw();
      return;
    }

    if (this.isMeasuringDrag && this.measureA) {
      this.measureB = { ...world };
      this.requestDraw();
      return;
    }
  }

  onCanvasMouseUp(e: MouseEvent): void {
    this.isPanning = false;

    if (this.isDraggingToken && this.draggedToken) {
      this.isDraggingToken = false;
      this.gmState.commitTokenPosition(this.draggedToken);
      this.gmState.triggerAutosave();
      this.gmSync.sendState();
      this.draggedToken = null;
      return;
    }

    if (this.isDrawingFog) {
      this.isDrawingFog = false;
      const fx = Math.min(this.fogStart.x, this.fogCurrent.x);
      const fy = Math.min(this.fogStart.y, this.fogCurrent.y);
      const fw = Math.abs(this.fogCurrent.x - this.fogStart.x);
      const fh = Math.abs(this.fogCurrent.y - this.fogStart.y);
      if (fw > 4 && fh > 4) {
        this.gmState.addFogRect(fx, fy, fw, fh);
        this.gmSync.sendState();
      }
      this.requestDraw();
      return;
    }

    if (this.isMeasuringDrag) {
      this.isMeasuringDrag = false;
    }
  }

  onCanvasContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const canvas = this.canvasRef.nativeElement;
    const pos = this.cameraService.eventScreenPos(e, canvas);
    const world = this.cameraService.screenToWorld(pos.x, pos.y, this.cam);

    // Right click on fog removes it
    const fog = this.fogRectAt(world.x, world.y);
    if (fog) {
      this.gmState.removeFogRect(fog.id);
      this.gmSync.sendState();
      this.requestDraw();
      return;
    }

    // Right click on token opens edit
    const token = this.tokenAt(world.x, world.y);
    if (token) {
      this.openEditToken(token);
      return;
    }

    // Right click on FX tool opens FX settings
    if (this.currentTool() === 'fx') {
      this.showFxSettingsModal.set(true);
    }
  }

  onCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const canvas = this.canvasRef.nativeElement;
    const pos = this.cameraService.eventScreenPos(e, canvas);
    this.cameraService.zoomAt(pos.x, pos.y, factor, this.cam, () => this.requestDraw());
  }

  // Hit test utilities
  tokenAt(wx: number, wy: number): Token | null {
    const tokens = this.gmState.state.tokens;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      const dx = wx - t.x, dy = wy - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) return t;
    }
    return null;
  }

  objectAt(wx: number, wy: number): MapObject | null {
    const objs = this.gmState.state.objects;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      const dx = wx - o.x, dy = wy - o.y;
      const cos = Math.cos(-o.rotation), sin = Math.sin(-o.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2) return o;
    }
    return null;
  }

  fogRectAt(wx: number, wy: number): FogRect | null {
    const fog = this.gmState.state.fog;
    for (let i = fog.length - 1; i >= 0; i--) {
      const f = fog[i];
      if (wx >= f.x && wx <= f.x + f.w && wy >= f.y && wy <= f.y + f.h) return f;
    }
    return null;
  }

  // Zoom actions
  zoomIn(): void {
    const canvas = this.canvasRef.nativeElement;
    this.cameraService.zoomAt(canvas.width / 2, canvas.height / 2, 1.25, this.cam, () => this.requestDraw());
  }

  zoomOut(): void {
    const canvas = this.canvasRef.nativeElement;
    this.cameraService.zoomAt(canvas.width / 2, canvas.height / 2, 0.8, this.cam, () => this.requestDraw());
  }

  zoomReset(): void {
    this.cameraService.centerView(this.cam, this.viewportRef.nativeElement, () => this.requestDraw());
  }

  // Toolbar & Modals helpers
  setTool(tool: 'select' | 'fog' | 'measure' | 'fx' | 'move'): void {
    if (this.currentTool() === tool) {
      this.currentTool.set('select');
    } else {
      this.currentTool.set(tool);
    }
    this.measureA = null;
    this.measureB = null;
    this.requestDraw();
  }

  closeAllModals(): void {
    this.showTokenModal.set(false);
    this.showObjectModal.set(false);
    this.showCropModal.set(false);
    this.showBarModal.set(false);
    this.showGlossaryModal.set(false);
    this.showInviteModal.set(false);
    this.showEffectsPickerModal.set(false);
    this.showSettingsModal.set(false);
    this.showFxSettingsModal.set(false);
    this.showNoteModal.set(false);
    this.showEventLogModal.set(false);
    this.showHelpModal.set(false);
    this.showConfirmClearModal.set(false);
    this.showConfirmDeleteTokenModal.set(false);
    this.showConfirmDeleteSceneModal.set(false);
  }

  openNewTokenModal(): void {
    this.tokenForm = {
      name: '',
      color: this.colorSwatches[Math.floor(Math.random() * this.colorSwatches.length)],
      isPlayer: false,
      photoDataUrl: null
    };
    this.showTokenModal.set(true);
  }

  openEditToken(t: Token): void {
    this.tokenForm = {
      id: t.id,
      name: t.name,
      color: t.color,
      isPlayer: !!t.isPlayer,
      photoDataUrl: t.photoDataUrl || null
    };
    this.showTokenModal.set(true);
  }

  saveToken(): void {
    if (this.tokenForm.id) {
      const t = this.gmState.allTokens().find(tok => tok.id === this.tokenForm.id);
      if (t) {
        t.name = this.tokenForm.name.trim() || 'Personagem';
        t.color = this.tokenForm.color;
        t.isPlayer = this.tokenForm.isPlayer;
        t.photoDataUrl = this.tokenForm.photoDataUrl;
        this.gmState.refreshVisibleTokens();
        this.gmState.triggerAutosave();
      }
    } else {
      const center = this.cameraService.screenToWorld(
        this.viewportRef.nativeElement.clientWidth / 2,
        this.viewportRef.nativeElement.clientHeight / 2,
        this.cam
      );
      this.gmState.addToken({
        name: this.tokenForm.name.trim() || 'Personagem',
        color: this.tokenForm.color,
        isPlayer: this.tokenForm.isPlayer,
        photoDataUrl: this.tokenForm.photoDataUrl,
        x: center.x,
        y: center.y,
        r: 24
      });
    }
    this.showTokenModal.set(false);
    this.gmSync.sendState();
    this.requestDraw();
  }

  confirmDeleteToken(t: Token): void {
    this.targetTokenForDelete = t;
    this.showConfirmDeleteTokenModal.set(true);
  }

  executeDeleteToken(): void {
    if (this.targetTokenForDelete) {
      this.gmState.removeToken(this.targetTokenForDelete.id);
      this.targetTokenForDelete = null;
      this.showConfirmDeleteTokenModal.set(false);
      this.gmSync.sendState();
      this.requestDraw();
    }
  }

  // Token resizing
  shrinkSelectedToken(): void {
    const tid = this.gmState.state.selectedTokenId;
    if (!tid) return;
    const t = this.gmState.state.tokens.find(tok => tok.id === tid);
    if (t && t.r > 12) {
      t.r -= 4;
      this.gmState.triggerAutosave();
      this.gmSync.sendState();
      this.requestDraw();
    }
  }

  growSelectedToken(): void {
    const tid = this.gmState.state.selectedTokenId;
    if (!tid) return;
    const t = this.gmState.state.tokens.find(tok => tok.id === tid);
    if (t && t.r < 96) {
      t.r += 4;
      this.gmState.triggerAutosave();
      this.gmSync.sendState();
      this.requestDraw();
    }
  }

  // Objects
  openNewObjectModal(): void {
    this.objectForm = { name: '', dataUrl: null };
    this.showObjectModal.set(true);
  }

  saveObject(): void {
    if (!this.objectForm.dataUrl) return;
    const center = this.cameraService.screenToWorld(
      this.viewportRef.nativeElement.clientWidth / 2,
      this.viewportRef.nativeElement.clientHeight / 2,
      this.cam
    );
    this.gmState.addObject(this.objectForm.dataUrl, this.objectForm.name, center.x, center.y);
    this.showObjectModal.set(false);
    this.gmSync.sendState();
    this.requestDraw();
  }

  shrinkSelectedObject(): void {
    const oid = this.gmState.state.selectedObjectId;
    if (!oid) return;
    const o = this.gmState.state.objects.find(obj => obj.id === oid);
    if (o && o.w > 20) {
      o.w *= 0.85;
      o.h *= 0.85;
      this.gmState.triggerAutosave();
      this.gmSync.sendState();
      this.requestDraw();
    }
  }

  growSelectedObject(): void {
    const oid = this.gmState.state.selectedObjectId;
    if (!oid) return;
    const o = this.gmState.state.objects.find(obj => obj.id === oid);
    if (o && o.w < 1000) {
      o.w *= 1.15;
      o.h *= 1.15;
      this.gmState.triggerAutosave();
      this.gmSync.sendState();
      this.requestDraw();
    }
  }

  // Map import
  onMapFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.gmState.state.map.img = img;
        this.gmState.state.map.dataUrl = dataUrl;
        this.gmState.commitSceneFields();
        this.gmState.triggerAutosave();
        this.gmSync.sendState();
        this.cameraService.centerView(this.cam, this.viewportRef.nativeElement);
        this.requestDraw();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  removeMap(): void {
    this.gmState.state.map.img = null;
    this.gmState.state.map.dataUrl = null;
    this.gmState.commitSceneFields();
    this.gmState.triggerAutosave();
    this.gmSync.sendState();
    this.requestDraw();
  }

  // Photo upload
  onTokenPhotoSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      this.tokenForm.photoDataUrl = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onObjectPhotoSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      this.objectForm.dataUrl = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Invite modal QR
  openInvite(): void {
    this.showInviteModal.set(true);
    setTimeout(() => {
      const el = document.getElementById('inviteOfferQr');
      if (el && typeof QRCode !== 'undefined') {
        el.innerHTML = '';
        const url = `${window.location.origin}/player?mesa=${this.gmSync.roomCode()}&pin=${this.gmSync.pin()}`;
        new QRCode(el, {
          text: url,
          width: 140,
          height: 140,
          colorDark: '#45ff78',
          colorLight: '#041008',
          correctLevel: 1
        });
      }
    }, 50);
  }

  // Scenes
  createNewScene(): void {
    const sc = this.gmState.createScene();
    this.gmState.switchScene(sc.id);
    this.requestDraw();
  }

  confirmDeleteScene(s: Scene): void {
    this.targetSceneForDelete = s;
    this.showConfirmDeleteSceneModal.set(true);
  }

  executeDeleteScene(): void {
    if (this.targetSceneForDelete) {
      this.gmState.deleteScene(this.targetSceneForDelete.id);
      this.targetSceneForDelete = null;
      this.showConfirmDeleteSceneModal.set(false);
      this.requestDraw();
    }
  }

  updatePlayerScreens(): void {
    this.gmSync.sendState();
    this.gmState.sceneSyncPending.set(false);
  }

  // Session backup
  exportSession(): void {
    const json = this.gmState.exportSession();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mesa-rpg-sessao-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onImportSessionSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const str = evt.target?.result as string;
      if (this.gmState.importSession(str)) {
        this.gmSync.sendState();
        this.requestDraw();
      }
    };
    reader.readAsText(file);
  }

  partyTokens(): Token[] {
    return this.gmState.state.tokens.filter(t => t.isPlayer);
  }

  getTokenById(id: string): Token | undefined {
    return this.gmState.state.tokens.find(t => t.id === id);
  }

  addGlossaryEffect(): void {
    this.gmState.state.glossary.push({
      id: 'eff_' + Date.now(),
      name: this.effectForm.name || 'Efeito',
      desc: this.effectForm.desc,
      color: this.effectForm.color,
      duration: this.effectForm.duration
    });
    this.gmState.triggerAutosave();
  }
}

