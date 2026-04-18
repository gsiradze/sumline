import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, randInt, shuffle } from '../rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let equal = 0;
    for (let i = 0; i < 32; i++) {
      if (a() === b()) equal++;
    }
    expect(equal).toBeLessThan(4);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is roughly uniform over 10k draws (chi-square-ish)', () => {
    const rng = mulberry32(2026);
    const buckets = new Array<number>(10).fill(0);
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const b = Math.floor(rng() * 10);
      buckets[b] = (buckets[b] ?? 0) + 1;
    }
    const expected = n / 10;
    for (const count of buckets) {
      expect(Math.abs(count - expected)).toBeLessThan(expected * 0.1);
    }
  });
});

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('grid')).toBe(hashString('grid'));
    expect(hashString('2026-04-18')).toBe(hashString('2026-04-18'));
  });

  it('differs for different inputs', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('2026-01-01')).not.toBe(hashString('2026-01-02'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashString('some-longer-seed-input');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('handles empty string', () => {
    const h = hashString('');
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe('randInt', () => {
  it('returns values within [min, max)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = randInt(rng, 10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });
});

describe('shuffle', () => {
  it('preserves elements', () => {
    const rng = mulberry32(99);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(rng, input);
    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const rng = mulberry32(1);
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffle(rng, input);
    expect(input).toEqual(snapshot);
  });

  it('is deterministic for the same seed', () => {
    const input = Array.from({ length: 25 }, (_, i) => i);
    const a = shuffle(mulberry32(5), input);
    const b = shuffle(mulberry32(5), input);
    expect(a).toEqual(b);
  });
});
