import { describe, expect, it } from 'vitest';
import {
  DAILY_ID_BASE,
  dailyLevelId,
  dailyNumber,
  dailyPuzzle,
  dailyStreak,
  emptyDaily,
  recordDaily,
} from '../daily';
import { countSolutions } from '../solver';
import { TOTAL_LEVELS } from '../tiers';

const WIN = { won: true, guesses: 2, stars: 3 } as const;
const LOSS = { won: false, guesses: 4, stars: 0 } as const;

describe('dailyPuzzle', () => {
  it('is the same puzzle for everyone on the same day', () => {
    expect(dailyPuzzle('2026-11-13')).toEqual(dailyPuzzle('2026-11-13'));
  });

  it('changes from one day to the next', () => {
    expect(dailyPuzzle('2026-11-13').solution).not.toEqual(dailyPuzzle('2026-11-14').solution);
  });

  it('is as open as an Intermediate level: 6 to 15 grids fit its numbers', () => {
    for (const day of ['2026-11-13', '2026-12-31', '2027-02-28', '2028-02-29']) {
      const p = dailyPuzzle(day);
      const n = countSolutions(p.rowSums, p.colSums, 100);
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(15);
      expect([...p.rowSums, ...p.colSums].every(s => s > 0 && s < 6)).toBe(true);
    }
  });
});

describe('numbering', () => {
  it('counts days from the first one, across months and years', () => {
    expect(dailyNumber('2026-11-13')).toBe(1);
    expect(dailyNumber('2026-11-14')).toBe(2);
    expect(dailyNumber('2026-12-13')).toBe(31);
    expect(dailyNumber('2027-11-13')).toBe(366);
  });

  it('gives each day an id that no ladder level has', () => {
    expect(dailyLevelId('2026-11-13')).toBe(DAILY_ID_BASE + 1);
    expect(dailyLevelId('2026-11-13')).toBeGreaterThan(TOTAL_LEVELS);
    expect(dailyLevelId('2026-11-14')).not.toBe(dailyLevelId('2026-11-13'));
  });
});

describe('recordDaily and the streak', () => {
  it('starts a streak with the first win', () => {
    const r = recordDaily(emptyDaily(), '2026-11-13', WIN);
    expect(r.results['2026-11-13']).toEqual(WIN);
    expect(dailyStreak(r, '2026-11-13')).toBe(1);
    expect(r.bestStreak).toBe(1);
  });

  it('grows with a win on the next day, and is still alive the day after until played', () => {
    let r = recordDaily(emptyDaily(), '2026-11-13', WIN);
    r = recordDaily(r, '2026-11-14', WIN);
    expect(dailyStreak(r, '2026-11-14')).toBe(2);
    expect(dailyStreak(r, '2026-11-15')).toBe(2);
    expect(r.bestStreak).toBe(2);
  });

  it('is over after a missed day, and the best is remembered', () => {
    let r = recordDaily(emptyDaily(), '2026-11-13', WIN);
    r = recordDaily(r, '2026-11-14', WIN);
    expect(dailyStreak(r, '2026-11-16')).toBe(0);
    r = recordDaily(r, '2026-11-16', WIN);
    expect(dailyStreak(r, '2026-11-16')).toBe(1);
    expect(r.bestStreak).toBe(2);
  });

  it('is ended by a loss', () => {
    let r = recordDaily(emptyDaily(), '2026-11-13', WIN);
    r = recordDaily(r, '2026-11-14', LOSS);
    expect(dailyStreak(r, '2026-11-14')).toBe(0);
    expect(r.bestStreak).toBe(1);
  });

  it('keeps the first result of a day: there is one attempt', () => {
    let r = recordDaily(emptyDaily(), '2026-11-13', LOSS);
    r = recordDaily(r, '2026-11-13', WIN);
    expect(r.results['2026-11-13']).toEqual(LOSS);
    expect(dailyStreak(r, '2026-11-13')).toBe(0);
  });

  it('carries over a month end', () => {
    let r = recordDaily(emptyDaily(), '2026-11-30', WIN);
    r = recordDaily(r, '2026-12-01', WIN);
    expect(dailyStreak(r, '2026-12-01')).toBe(2);
  });
});
