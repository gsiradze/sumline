type AudioCtx = AudioContext;

class SoundManager {
  private ctx: AudioCtx | null = null;
  private muted = false;
  private paused = false;
  private unlocked = false;
  private masterGain: GainNode | null = null;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** The one audio context of the app, shared with the music player. */
  context(): AudioCtx | null {
    return this.ensureCtx();
  }

  /** 'none' until the first sound has been asked for. */
  engineState(): AudioContextState | 'none' {
    return this.ctx?.state ?? 'none';
  }

  /** The app went to the background (or an ad covers it): nothing plays until `resume`. */
  pause(): void {
    this.paused = true;
    this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    this.paused = false;
    if (this.unlocked) this.ctx?.resume().catch(() => {});
  }

  private ensureCtx(): AudioCtx | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, durationMs: number, opts: ToneOptions = {}): void {
    if (this.muted || this.paused) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = freq;

    const now = ctx.currentTime;
    const volume = opts.volume ?? 0.08;
    const attackMs = opts.attackMs ?? 8;
    const releaseMs = opts.releaseMs ?? 80;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attackMs / 1000);
    gain.gain.linearRampToValueAtTime(volume, now + (durationMs - releaseMs) / 1000);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  playClick(): void {
    this.tone(520, 40, { volume: 0.03, attackMs: 2, releaseMs: 30 });
  }

  playToggleOn(): void {
    this.tone(640, 60, { volume: 0.045, attackMs: 2, releaseMs: 40 });
  }

  playToggleOff(): void {
    this.tone(440, 60, { volume: 0.035, attackMs: 2, releaseMs: 40 });
  }

  playSubmitReveal(): void {
    // Two-note "tick-chime" — one submit = one short cue, regardless of how
    // many cells flip. Replaces the old per-lock arpeggio.
    this.tone(660, 70, { volume: 0.05, attackMs: 3, releaseMs: 50 });
    setTimeout(() => this.tone(880, 120, { volume: 0.055, attackMs: 3, releaseMs: 90 }), 55);
  }

  playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      setTimeout(() => this.tone(n, 280, { volume: 0.09, releaseMs: 220 }), i * 110);
    });
  }

  playLose(): void {
    this.tone(220, 320, { type: 'triangle', volume: 0.07, releaseMs: 240 });
    setTimeout(() => this.tone(165, 400, { type: 'triangle', volume: 0.06, releaseMs: 320 }), 160);
  }

  unlock(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.unlocked = true;
    if (ctx.state === 'suspended' && !this.paused) {
      ctx.resume().catch(() => {});
    }
  }
}

interface ToneOptions {
  type?: OscillatorType;
  volume?: number;
  attackMs?: number;
  releaseMs?: number;
}

export const sound = new SoundManager();
