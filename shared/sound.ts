// Tiny 8-bit synth on the Web Audio API: square/triangle/saw tones with pitch sweeps and
// filtered noise bursts. No audio files.

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Pitch at the end of the note (sweep). */
  freqEnd?: number;
  duration: number;
  volume?: number;
  /** Seconds from now. */
  delay?: number;
}

export interface NoiseOptions {
  duration: number;
  volume?: number;
  /** Low-pass cutoff at the start / end of the burst. */
  filter?: number;
  filterEnd?: number;
  delay?: number;
}

type AudioContextCtor = typeof AudioContext;

export class ChipSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  constructor(private readonly volume = 0.5) {}

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  /** Create/resume the audio context. Call from a user gesture (click, key, tap). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // audio unavailable: stay silent
    }
  }

  tone({ type = 'square', freq, freqEnd, duration, volume = 0.1, delay = 0 }: ToneOptions): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise({ duration, volume = 0.1, filter = 4000, filterEnd, delay = 0 }: NoiseOptions): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(filter, t);
    if (filterEnd) lowpass.frequency.exponentialRampToValueAtTime(filterEnd, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(lowpass).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  private ready(): AudioContext | null {
    // A context that is still resuming plays the queued notes as soon as it's running.
    return this.ctx && !this.muted && this.ctx.state !== 'closed' ? this.ctx : null;
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}
