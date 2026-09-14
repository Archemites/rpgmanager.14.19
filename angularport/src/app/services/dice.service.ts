import { Injectable, signal } from '@angular/core';

export interface RollResult {
  id: string;
  rollerName: string;
  isGM: boolean;
  isSecret: boolean;
  faces: number;
  count: number;
  modifier: number;
  mode: 'normal' | 'adv' | 'dis';
  rolls: number[];
  total: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DiceService {
  readonly history = signal<RollResult[]>([]);
  readonly lastRoll = signal<RollResult | null>(null);
  readonly isModalOpen = signal<boolean>(false);
  readonly isSecretRoll = signal<boolean>(false);

  private diceBoxInstance: any = null;

  constructor() {
    try {
      this.isSecretRoll.set(localStorage.getItem('rpg-gm-secret-dice') === 'true');
    } catch (_) {}
  }

  setSecretRoll(val: boolean): void {
    this.isSecretRoll.set(val);
    try {
      localStorage.setItem('rpg-gm-secret-dice', String(val));
    } catch (_) {}
  }

  toggleModal(open?: boolean): void {
    this.isModalOpen.update(v => (open !== undefined ? open : !v));
  }

  roll(
    count: number,
    faces: number,
    modifier: number = 0,
    mode: 'normal' | 'adv' | 'dis' = 'normal',
    rollerName: string = 'Mestre',
    isGM: boolean = true,
    secret: boolean = false
  ): RollResult {
    const rawRolls: number[] = [];
    let totalRollsToPerform = count;
    if (mode === 'adv' || mode === 'dis') {
      totalRollsToPerform = Math.max(2, count * 2);
    }

    for (let i = 0; i < totalRollsToPerform; i++) {
      rawRolls.push(Math.floor(Math.random() * faces) + 1);
    }

    let keptRolls = [...rawRolls];
    if (mode === 'adv') {
      keptRolls.sort((a, b) => b - a);
      keptRolls = keptRolls.slice(0, count);
    } else if (mode === 'dis') {
      keptRolls.sort((a, b) => a - b);
      keptRolls = keptRolls.slice(0, count);
    }

    const sum = keptRolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;

    const res: RollResult = {
      id: Math.random().toString(36).substring(2, 9),
      rollerName,
      isGM,
      isSecret: secret,
      faces,
      count,
      modifier,
      mode,
      rolls: rawRolls,
      total,
      timestamp: Date.now()
    };

    this.history.update(h => [res, ...h.slice(0, 49)]);
    this.lastRoll.set(res);

    return res;
  }
}
