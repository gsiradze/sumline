import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC_TRACK, loopWindow } from '../music';

const ROOT = resolve(__dirname, '../../../..');
const LOOP = MUSIC_TRACK.frames / MUSIC_TRACK.sampleRate;
const PRIMING = MUSIC_TRACK.primingFrames / MUSIC_TRACK.sampleRate;
const seconds = (frames: number): number => frames / MUSIC_TRACK.sampleRate;

describe('loopWindow', () => {
  it('loops the whole buffer when the browser trimmed all the padding', () => {
    expect(loopWindow(LOOP)).toEqual({ start: 0, end: LOOP });
  });

  it('stops short of padding a browser left at the end', () => {
    // Measured: one Chromium build decodes this file 745 frames long.
    const w = loopWindow(LOOP + seconds(745))!;
    expect(w.start).toBe(0);
    expect(w.end).toBeCloseTo(LOOP, 9);
  });

  it('skips padding a browser left at the start', () => {
    for (const decoded of [LOOP + PRIMING, LOOP + PRIMING + seconds(745)]) {
      const w = loopWindow(decoded)!;
      expect(w.start).toBeCloseTo(PRIMING, 9);
      expect(w.end - w.start).toBeCloseTo(LOOP, 9);
      expect(w.end).toBeLessThanOrEqual(decoded + 1e-9);
    }
  });

  it('survives resampling, which nudges the length by a fraction of a millisecond', () => {
    expect(loopWindow(LOOP - 0.00001)).toEqual({ start: 0, end: LOOP });
  });

  it('is null for a buffer that is not this track, so a swapped file is looped whole', () => {
    expect(loopWindow(LOOP - 1)).toBeNull();
    expect(loopWindow(LOOP + 1)).toBeNull();
    expect(loopWindow(120)).toBeNull();
  });
});

describe('the music files', () => {
  it('ships the small encoded file, not the master', () => {
    const shipped = resolve(ROOT, 'public', MUSIC_TRACK.url);
    expect(existsSync(shipped)).toBe(true);
    expect(statSync(shipped).size).toBeLessThan(200_000);
    expect(existsSync(resolve(ROOT, 'public/audio/music.wav'))).toBe(false);
  });

  it('MUSIC_TRACK matches the master recording', () => {
    const wav = readFileSync(resolve(ROOT, 'assets/audio/music.wav'));
    expect(wav.toString('latin1', 0, 4)).toBe('RIFF');
    let sampleRate = 0;
    let blockAlign = 0;
    let dataBytes = 0;
    for (let at = 12; at + 8 <= wav.length; ) {
      const id = wav.toString('latin1', at, at + 4);
      const size = wav.readUInt32LE(at + 4);
      if (id === 'fmt ') {
        sampleRate = wav.readUInt32LE(at + 12);
        blockAlign = wav.readUInt16LE(at + 20);
      } else if (id === 'data') {
        dataBytes = size;
      }
      at += 8 + size + (size % 2);
    }
    expect(sampleRate).toBe(MUSIC_TRACK.sampleRate);
    expect(dataBytes / blockAlign).toBe(MUSIC_TRACK.frames);
  });
});
