import { Injectable } from '@angular/core';

declare var Peer: any;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 5;
const PEER_PREFIX = 'rpgmesa-';

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};

export interface PeerHost {
  peer: any;
  code: string;
  ready: Promise<string>;
  destroy: () => void;
}

export interface PeerClient {
  peer: any;
  connection: Promise<any>;
  destroy: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class WebRtcService {
  randomRoomCode(): string {
    let out = '';
    const buf = new Uint8Array(CODE_LEN);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    } else {
      for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return out;
  }

  codeToPeerId(code: string): string {
    return PEER_PREFIX + String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  normalizeCode(code: string): string {
    return String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  createHost(opts?: { onConnection?: (conn: any) => void; onError?: (err: any) => void }): PeerHost {
    const code = this.randomRoomCode();
    const peer = new Peer(this.codeToPeerId(code), PEER_CONFIG);

    const ready = new Promise<string>((resolve, reject) => {
      peer.on('open', () => resolve(code));
      peer.on('error', (err: any) => {
        reject(err);
        if (opts?.onError) opts.onError(err);
      });
    });

    peer.on('connection', (conn: any) => {
      conn.on('open', () => {
        if (opts?.onConnection) opts.onConnection(conn);
      });
    });

    return { peer, code, ready, destroy: () => peer.destroy() };
  }

  joinHost(code: string, opts?: { onError?: (err: any) => void }): PeerClient {
    const peer = new Peer(null, PEER_CONFIG);

    const connection = new Promise<any>((resolve, reject) => {
      peer.on('open', () => {
        const conn = peer.connect(this.codeToPeerId(code), { reliable: true });
        conn.on('open', () => resolve(conn));
        conn.on('error', (err: any) => reject(err));
      });
      peer.on('error', (err: any) => {
        reject(err);
        if (opts?.onError) opts.onError(err);
      });
    });

    return { peer, connection, destroy: () => peer.destroy() };
  }

  describePeerError(err: any): string {
    const t = err && err.type;
    if (t === 'peer-unavailable') return 'Código não encontrado — confira se digitou certo e se o mestre ainda está com a mesa aberta.';
    if (t === 'unavailable-id') return 'Este código já está em uso. Gere outro.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Sem conexão com o servidor de pareamento. Verifique sua internet.';
    if (t === 'browser-incompatible') return 'Este navegador não suporta a conexão P2P necessária.';
    if (t === 'webrtc') return 'Falha ao estabelecer a conexão direta. Tente novamente.';
    return 'Não foi possível conectar. Tente novamente.';
  }
}
