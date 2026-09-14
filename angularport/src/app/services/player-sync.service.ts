import { Injectable, signal } from '@angular/core';
import { FxTrailService } from './fx-trail.service';
import { PlayerStateService } from './player-state.service';
import { ThemeName, ThemeService } from './theme.service';
import { PeerClient, WebRtcService } from './webrtc.service';

declare var jsQR: any;

@Injectable({
  providedIn: 'root'
})
export class PlayerSyncService {
  readonly isConnected = signal<boolean>(false);
  readonly statusMessage = signal<string>('Aguardando conexão com o mestre…');
  readonly errorMessage = signal<string | null>(null);

  private client: PeerClient | null = null;
  private activeConnection: any = null;

  constructor(
    private webrtc: WebRtcService,
    private playerState: PlayerStateService,
    private fxTrail: FxTrailService,
    private themeService: ThemeService
  ) {}

  async joinRoom(code: string, pin: string, playerName: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.statusMessage.set('Conectando ao mestre…');

    try {
      this.client = this.webrtc.joinHost(code, {
        onError: (err) => {
          const msg = this.webrtc.describePeerError(err);
          this.errorMessage.set(msg);
          this.statusMessage.set(msg);
        }
      });

      const conn = await this.client.connection;
      this.activeConnection = conn;

      conn.on('data', (data: any) => this.handleData(data));
      conn.on('close', () => {
        this.isConnected.set(false);
        this.statusMessage.set('Conexão encerrada pelo mestre.');
      });

      // Send join handshake
      conn.send({
        type: 'rpg-join',
        pin,
        name: playerName
      });

      this.isConnected.set(true);
      this.statusMessage.set('Conectado à mesa!');
      return true;
    } catch (err) {
      const msg = this.webrtc.describePeerError(err);
      this.errorMessage.set(msg);
      this.statusMessage.set(msg);
      return false;
    }
  }

  private handleData(data: any): void {
    if (!data || !data.type) return;

    if (data.type === 'rpg-state') {
      this.playerState.applySyncedState(data);
      if (data.theme) {
        this.themeService.applyTheme(data.theme as ThemeName);
      }
    } else if (data.type === 'rpg-fx') {
      this.fxTrail.spawnFx(data.fxType, data.x, data.y, {
        scale: data.scale,
        durationMult: data.durationMult
      });
    } else if (data.type === 'rpg-theme') {
      if (data.theme) {
        this.themeService.applyTheme(data.theme as ThemeName);
      }
    } else if (data.type === 'rpg-error') {
      this.errorMessage.set(data.message || 'Erro recebido do mestre.');
      this.statusMessage.set(data.message || 'Erro recebido do mestre.');
    }
  }

  disconnect(): void {
    if (this.activeConnection) {
      this.activeConnection.close();
      this.activeConnection = null;
    }
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.isConnected.set(false);
  }
}
