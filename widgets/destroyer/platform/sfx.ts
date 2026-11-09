// The game's sound effects, built from the shared chip synth.
import { ChipSynth } from '../../../shared/sound';

export type SfxName =
  | 'shoot'
  | 'hit'
  | 'break'
  | 'explode'
  | 'laser'
  | 'powerup'
  | 'pickup'
  | 'full'
  | 'countdown'
  | 'go'
  | 'clear'
  | 'gameover';

/** Minimum seconds between two plays of the same sound, so fast events don't turn into noise. */
const THROTTLE: Partial<Record<SfxName, number>> = {
  shoot: 0.05,
  hit: 0.035,
  break: 0.04,
  full: 0.4,
};

export class Sfx {
  private readonly synth = new ChipSynth(0.45);
  private readonly lastPlayed = new Map<SfxName, number>();

  get muted(): boolean {
    return this.synth.isMuted;
  }

  setMuted(muted: boolean): void {
    this.synth.setMuted(muted);
  }

  /** Call from a user gesture before the first sound. */
  unlock(): void {
    this.synth.unlock();
  }

  play(name: SfxName): void {
    const now = performance.now() / 1000;
    const gap = THROTTLE[name];
    if (gap && now - (this.lastPlayed.get(name) ?? -Infinity) < gap) return;
    this.lastPlayed.set(name, now);
    const s = this.synth;
    switch (name) {
      case 'shoot':
        s.tone({ freq: 1100, freqEnd: 700, duration: 0.05, volume: 0.035 });
        break;
      case 'hit':
        s.noise({ duration: 0.04, volume: 0.06, filter: 3500 });
        break;
      case 'break':
        s.noise({ duration: 0.2, volume: 0.14, filter: 3000, filterEnd: 300 });
        s.tone({ freq: 320, freqEnd: 70, duration: 0.16, volume: 0.06 });
        break;
      case 'explode':
        s.noise({ duration: 0.6, volume: 0.32, filter: 1600, filterEnd: 80 });
        s.tone({ type: 'triangle', freq: 140, freqEnd: 35, duration: 0.5, volume: 0.25 });
        break;
      case 'laser':
        s.tone({ type: 'sawtooth', freq: 1600, freqEnd: 180, duration: 0.4, volume: 0.07 });
        s.tone({ freq: 800, freqEnd: 90, duration: 0.4, volume: 0.05 });
        break;
      case 'powerup':
        s.tone({ freq: 300, freqEnd: 1200, duration: 0.22, volume: 0.07 });
        s.tone({ freq: 600, freqEnd: 2400, duration: 0.22, volume: 0.03, delay: 0.05 });
        break;
      case 'pickup':
        [660, 880, 1320].forEach((freq, i) =>
          s.tone({ freq, duration: 0.07, volume: 0.07, delay: i * 0.055 }),
        );
        break;
      case 'full':
        s.tone({ freq: 150, duration: 0.12, volume: 0.06 });
        break;
      case 'countdown':
        s.tone({ freq: 440, duration: 0.14, volume: 0.09 });
        break;
      case 'go':
        s.tone({ freq: 880, duration: 0.3, volume: 0.1 });
        s.tone({ freq: 1320, duration: 0.3, volume: 0.05 });
        break;
      case 'clear':
        [523, 659, 784, 1047, 1319].forEach((freq, i) =>
          s.tone({ freq, duration: 0.16, volume: 0.09, delay: i * 0.11 }),
        );
        break;
      case 'gameover':
        [523, 392, 330, 262].forEach((freq, i) =>
          s.tone({ freq, duration: 0.22, volume: 0.09, delay: i * 0.18 }),
        );
        break;
    }
  }

  dispose(): void {
    this.synth.close();
  }
}
