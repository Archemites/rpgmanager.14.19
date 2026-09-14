import { Injectable, signal } from '@angular/core';
import { FxPayload, PlayerSyncedState } from '../models/rpg.models';
import { GmStateService } from './gm-state.service';
import { ThemeService } from './theme.service';
import { PeerHost, WebRtcService } from './webrtc.service';

@Injectable({
  providedIn: 'root'
})
export class GmSyncService {
  readonly roomCode = signal<string>('');
  readonly pin = signal<string>('1234');
  readonly connectedPlayers = signal<Array<{ id: string; name: string }>>([]);
  readonly isHostReady = signal<boolean>(false);

  private host: PeerHost | null = null;
  private connections: any[] = [];

  constructor(
    private webrtc: WebRtcService,
    private gmState: GmStateService,
    private themeService: ThemeService
  ) {
    this.rotatePin();
  }

  startHosting(): void {
    if (this.host) return;

    this.host = this.webrtc.createHost({
      onConnection: (conn: any) => this.handleNewConnection(conn),
      onError: (err: any) => {
        console.error('Peer host erro:', err);
      }
    });

    this.host.ready.then(code => {
      this.roomCode.set(code);
      this.isHostReady.set(true);
      this.gmState.logEvent(`Mesa P2P aberta. Código: ${code}`);
    }).catch(err => {
      console.error('Falha ao abrir host:', err);
    });
  }

  rotatePin(): void {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    this.pin.set(newPin);
  }

  private handleNewConnection(conn: any): void {
    conn.on('data', (data: any) => {
      if (data && data.type === 'rpg-join') {
        if (data.pin !== this.pin()) {
          conn.send({ type: 'rpg-error', message: 'PIN incorreto.' });
          conn.close();
          return;
        }

        const playerName = data.name || 'Jogador';
        this.connections.push(conn);
        this.connectedPlayers.update(list => [...list, { id: conn.peer, name: playerName }]);
        this.gmState.logEvent(`Jogador conectado: ${playerName}`);

        // Send current game state immediately
        this.sendStateTo(conn);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      this.connectedPlayers.update(list => list.filter(p => p.id !== conn.peer));
    });
  }

  buildStatePayload(): PlayerSyncedState {
    const sc = this.gmState.getCurrentScene();
    const st = this.gmState.state;

    return {
      type: 'rpg-state',
      sceneId: this.gmState.currentSceneId(),
      map: {
        dataUrl: st.map.dataUrl,
        scalePct: st.map.scalePct,
        bgColor: st.map.bgColor
      },
      grid: {
        show: st.grid.show,
        size: st.grid.size,
        color: st.grid.color,
        opacity: st.grid.opacity
      },
      fog: [...st.fog],
      objects: st.objects.map(o => ({
        id: o.id,
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        rotation: o.rotation,
        dataUrl: o.dataUrl
      })),
      tokens: this.gmState.visibleTokens().map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        x: t.x,
        y: t.y,
        r: t.r,
        photoDataUrl: t.photoDataUrl,
        isPlayer: t.isPlayer,
        barValues: t.barValues,
        effects: t.effects
      })),
      partyBars: [...st.partyBars],
      glossary: [...st.glossary],
      combat: { ...st.combat },
      theme: this.themeService.currentTheme()
    };
  }

  broadcast(msg: any): void {
    for (const conn of this.connections) {
      if (conn.open) conn.send(msg);
    }
  }

  sendState(): void {
    if (this.connections.length === 0) return;
    const payload = this.buildStatePayload();
    this.broadcast(payload);
  }

  sendStateTo(conn: any): void {
    if (conn.open) {
      conn.send(this.buildStatePayload());
    }
  }

  sendFx(fxType: string, x: number, y: number, scale?: number, durationMult?: number): void {
    const payload: FxPayload = {
      type: 'rpg-fx',
      fxType,
      x,
      y,
      scale,
      durationMult
    };
    this.broadcast(payload);
  }

  sendTheme(theme: string): void {
    this.broadcast({ type: 'rpg-theme', theme });
  }

  destroy(): void {
    if (this.host) {
      this.host.destroy();
      this.host = null;
    }
    this.connections = [];
  }
}
