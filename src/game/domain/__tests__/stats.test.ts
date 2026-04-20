import { describe, expect, it } from 'vitest';
import { emptyStats, recordLoss, recordWin, winRate } from '../stats';
import { MAX_GUESS_BUDGET } from '../types';

describe('emptyStats', () => {
  it('starts at zero with a distribution sized to MAX_GUESS_BUDGET', () => {
    const s = emptyStats();
    expect(s.levelsCompleted).toBe(0);
    expect(s.totalStars).toBe(0);
    expect(s.totalWins).toBe(0);
    expect(s.totalLosses).toBe(0);
    expect(s.distribution).toHaveLength(MAX_GUESS_BUDGET);
    expect(s.distribution.every(n => n === 0)).toBe(true);
    expect(s.lastActiveIsoDate).toBeNull();
    expect(s.dayStreak).toBe(0);
    expect(s.bestDayStreak).toBe(0);
  });
});

describe('day streak', () => {
  it('starts streak at 1 on first active day', () => {
    const s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-01');
    expect(s.dayStreak).toBe(1);
    expect(s.bestDayStreak).toBe(1);
    expect(s.lastActiveIsoDate).toBe('2026-04-01');
  });

  it('extends streak on consecutive days', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-01');
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true }, '2026-04-02');
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true }, '2026-04-03');
    expect(s.dayStreak).toBe(3);
    expect(s.bestDayStreak).toBe(3);
  });

  it('resets streak after a day gap', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-01');
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-03');
    expect(s.dayStreak).toBe(1);
    expect(s.bestDayStreak).toBe(1);
  });

  it('preserves bestDayStreak when current streak drops', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-01');
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-02');
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-04');
    expect(s.dayStreak).toBe(1);
    expect(s.bestDayStreak).toBe(2);
  });

  it('does not change streak for multiple plays on the same day', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-01');
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true }, '2026-04-01');
    expect(s.dayStreak).toBe(1);
  });
});

describe('recordWin', () => {
  it('increments levelsCompleted only on first completion', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true });
    expect(s.levelsCompleted).toBe(1);
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: false });
    expect(s.levelsCompleted).toBe(1);
    expect(s.totalWins).toBe(2);
  });

  it('accumulates stars across wins', () => {
    let s = recordWin(emptyStats(), { guessCount: 4, stars: 2, firstCompletion: true });
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true });
    expect(s.totalStars).toBe(5);
  });

  it('buckets guess counts into the distribution', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true });
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true });
    s = recordWin(s, { guessCount: 6, stars: 2, firstCompletion: true });
    expect(s.distribution[2]).toBe(2);
    expect(s.distribution[5]).toBe(1);
  });

  it('clamps out-of-range guess counts', () => {
    let s = recordWin(emptyStats(), { guessCount: 0, stars: 1, firstCompletion: true });
    expect(s.distribution[0]).toBe(1);
    s = recordWin(s, { guessCount: 99, stars: 1, firstCompletion: true });
    expect(s.distribution[MAX_GUESS_BUDGET - 1]).toBe(1);
  });
});

describe('recordLoss', () => {
  it('increments totalLosses and leaves wins/stars alone', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true });
    s = recordLoss(s);
    expect(s.totalLosses).toBe(1);
    expect(s.totalWins).toBe(1);
    expect(s.totalStars).toBe(3);
  });
});

describe('winRate', () => {
  it('returns 0 for a clean stats record', () => {
    expect(winRate(emptyStats())).toBe(0);
  });

  it('returns wins / (wins + losses)', () => {
    let s = recordWin(emptyStats(), { guessCount: 3, stars: 3, firstCompletion: true });
    s = recordLoss(s);
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true });
    expect(winRate(s)).toBeCloseTo(2 / 3);
  });
});
