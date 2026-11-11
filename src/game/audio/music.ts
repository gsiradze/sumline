import { sound } from './soundManager';

// The track is a loop: it ends exactly where it begins. AAC files carry padding
// that some browsers keep after decoding and some trim, so the player loops this
// exact stretch instead of the whole decoded buffer. When the music file is
// replaced, change these with it: `afinfo public/audio/music.m4a` prints
// "valid frames" and "priming".
export const MUSIC_TRACK = {
  url: 'audio/music.m4a',
  sampleRate: 22_050,
  frames: 320_727,
  primingFrames: 2_112,
} as const;

// Sits just under the tap sounds (soundManager.ts): the track averages about
// -16 dBFS, the taps peak around -27.
const MUSIC_VOLUME = 0.14;
const FADE_IN_S = 0.8;
const FADE_OUT_S = 0.25;
// One AAC frame: the most padding a decoder can leave at the end.
const MAX_TAIL_FRAMES = 1024;
const TOLERANCE_S = 0.004;

export interface LoopWindow {
  readonly start: number;
  readonly end: number;
}

export interface MusicTrack {
  readonly sampleRate: number;
  readonly frames: number;
  readonly primingFrames: number;
}

/**
 * The stretch of a decoded buffer to loop, in seconds. Null when the buffer is
 * not the length the track describes (the file was swapped without updating
 * MUSIC_TRACK): it is then looped whole, which may leave a small gap but never
 * cuts the music short.
 */
export function loopWindow(
  decodedSeconds: number,
  track: MusicTrack = MUSIC_TRACK,
): LoopWindow | null {
  const loop = track.frames / track.sampleRate;
  const priming = track.primingFrames / track.sampleRate;
  const tail = MAX_TAIL_FRAMES / track.sampleRate;
  const extra = decodedSeconds - loop;
  if (extra < -TOLERANCE_S || extra > priming + tail + TOLERANCE_S) return null;
  const start = extra > priming - TOLERANCE_S ? priming : 0;
  return { start, end: start + loop };
}

export interface MusicState {
  readonly playing: boolean;
  readonly loop: LoopWindow | null;
}

class MusicPlayer {
  // Off until the saved setting has been read, so a player who turned music off
  // never hears a blip of it at launch.
  private enabled = false;
  private muted = false;
  private unlocked = false;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<AudioBuffer | null> | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private loop: LoopWindow | null = null;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.sync();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.sync();
  }

  /** Browsers only let audio begin from a touch or a key press: call this from one. */
  start(): void {
    this.unlocked = true;
    sound.unlock();
    this.sync();
  }

  state(): MusicState {
    return { playing: this.source !== null, loop: this.loop };
  }

  private wanted(): boolean {
    return this.unlocked && this.enabled && !this.muted;
  }

  private sync(): void {
    if (this.wanted()) void this.play();
    else this.stop();
  }

  private async play(): Promise<void> {
    if (this.source) return;
    const ctx = sound.context();
    if (!ctx) return;
    const buffer = await this.load(ctx);
    if (!buffer || this.source || !this.wanted()) return;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, ctx.currentTime + FADE_IN_S);
    gain.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const loop = loopWindow(buffer.duration);
    if (loop) {
      source.loopStart = loop.start;
      source.loopEnd = loop.end;
    }
    source.connect(gain);
    source.start(0, loop?.start ?? 0);
    this.source = source;
    this.gain = gain;
    this.loop = loop;
  }

  private stop(): void {
    const { source, gain } = this;
    if (!source || !gain) return;
    this.source = null;
    this.gain = null;
    const now = source.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    source.onended = () => gain.disconnect();
    source.stop(now + FADE_OUT_S + 0.05);
  }

  private load(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.buffer) return Promise.resolve(this.buffer);
    this.loading ??= fetch(new URL(MUSIC_TRACK.url, document.baseURI))
      .then(res => {
        if (!res.ok) throw new Error(`music: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => {
        this.buffer = buffer;
        return buffer;
      })
      .catch(() => {
        // The game is complete without music. The next toggle or launch tries again.
        this.loading = null;
        return null;
      });
    return this.loading;
  }
}

export const music = new MusicPlayer();
