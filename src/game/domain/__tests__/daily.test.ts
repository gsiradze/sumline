import { describe, expect, it } from 'vitest';
import {
  LAUNCH_EPOCH_ISO,
  isoDateForPuzzleId,
  puzzleIdForDate,
  seedForPracticeRun,
  seedForPuzzleId,
  toIsoDate,
} from '../daily';

describe('puzzleIdForDate', () => {
  it('maps the launch date to id 0', () => {
    expect(puzzleIdForDate(LAUNCH_EPOCH_ISO)).toBe(0);
    expect(puzzleIdForDate('2026-01-01')).toBe(0);
  });

  it('increments by 1 per day', () => {
    expect(puzzleIdForDate('2026-01-02')).toBe(1);
    expect(puzzleIdForDate('2026-01-31')).toBe(30);
    expect(puzzleIdForDate('2026-02-01')).toBe(31);
  });

  it('handles year boundary', () => {
    expect(puzzleIdForDate('2026-12-31')).toBe(364);
    expect(puzzleIdForDate('2027-01-01')).toBe(365);
  });

  it('returns negative ids for pre-launch dates', () => {
    expect(puzzleIdForDate('2025-12-31')).toBe(-1);
    expect(puzzleIdForDate('2025-12-01')).toBe(-31);
  });

  it('handles leap year correctly', () => {
    const feb28 = puzzleIdForDate('2028-02-28');
    const feb29 = puzzleIdForDate('2028-02-29');
    const mar01 = puzzleIdForDate('2028-03-01');
    expect(feb29 - feb28).toBe(1);
    expect(mar01 - feb29).toBe(1);
  });

  it('rejects malformed dates', () => {
    expect(() => puzzleIdForDate('not-a-date')).toThrow();
    expect(() => puzzleIdForDate('2026/01/01')).toThrow();
    expect(() => puzzleIdForDate('26-01-01')).toThrow();
  });
});

describe('isoDateForPuzzleId', () => {
  it('round-trips with puzzleIdForDate', () => {
    const dates = ['2026-01-01', '2026-04-18', '2026-12-31', '2027-06-15'];
    for (const d of dates) {
      expect(isoDateForPuzzleId(puzzleIdForDate(d))).toBe(d);
    }
  });

  it('handles ids across the launch boundary', () => {
    expect(isoDateForPuzzleId(0)).toBe('2026-01-01');
    expect(isoDateForPuzzleId(-1)).toBe('2025-12-31');
  });
});

describe('toIsoDate', () => {
  it('formats a UTC date correctly', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 3, 18)))).toBe('2026-04-18');
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });
});

describe('seedForPuzzleId', () => {
  it('is stable for the same id', () => {
    expect(seedForPuzzleId(42)).toBe(seedForPuzzleId(42));
  });

  it('differs for different ids', () => {
    expect(seedForPuzzleId(0)).not.toBe(seedForPuzzleId(1));
  });

  it('returns an unsigned 32-bit integer', () => {
    const seed = seedForPuzzleId(100);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});

describe('seedForPracticeRun', () => {
  it('is stable for same session + index', () => {
    expect(seedForPracticeRun('s1', 0)).toBe(seedForPracticeRun('s1', 0));
  });

  it('differs by index within a session', () => {
    expect(seedForPracticeRun('s1', 0)).not.toBe(seedForPracticeRun('s1', 1));
  });

  it('differs between sessions', () => {
    expect(seedForPracticeRun('s1', 0)).not.toBe(seedForPracticeRun('s2', 0));
  });
});
