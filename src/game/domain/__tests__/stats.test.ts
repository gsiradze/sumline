import { describe, expect, it } from 'vitest';
import { emptyStats, isoDateLocal, recordLoss, recordWin, winRate } from '../stats';
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
    const s = recordWin(
      emptyStats(),
      { guessCount: 3, stars: 3, firstCompletion: true },
      '2026-04-01',
    );
    expect(s.dayStreak).toBe(1);
    expect(s.bestDayStreak).toBe(1);
    expect(s.lastActiveIsoDate).toBe('2026-04-01');
  });

  it('extends streak on consecutive days', () => {
    let s = recordWin(
      emptyStats(),
      { guessCount: 3, stars: 3, firstCompletion: true },
      '2026-04-01',
    );
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true }, '2026-04-02');
    s = recordWin(s, { guessCount: 2, stars: 3, firstCompletion: true }, '2026-04-03');
    expect(s.dayStreak).toBe(3);
    expect(s.bestDayStreak).toBe(3);
  });

  it('resets streak after a day gap', () => {
    let s = recordWin(
      emptyStats(),
      { guessCount: 3, stars: 3, firstCompletion: true },
      '2026-04-01',
    );
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-03');
    expect(s.dayStreak).toBe(1);
    expect(s.bestDayStreak).toBe(1);
  });

  it('preserves bestDayStreak when current streak drops', () => {
    let s = recordWin(
      emptyStats(),
      { guessCount: 3, stars: 3, firstCompletion: true },
      '2026-04-01',
    );
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-02');
    s = recordWin(s, { guessCount: 3, stars: 3, firstCompletion: true }, '2026-04-04');
    expect(s.dayStreak).toBe(1);
    expect(s.bestDayStreak).toBe(2);
  });

  it('does not change streak for multiple plays on the same day', () => {
    let s = recordWin(
      emptyStats(),
      { guessCount: 3, stars: 3, firstCompletion: true },
      '2026-04-01',
    );
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

describe('isoDateLocal', () => {
  it('formats the local calendar day, zero-padded', () => {
    expect(isoDateLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(isoDateLocal(new Date(2026, 10, 11, 0, 1))).toBe('2026-11-11');
  });

  it('keeps a streak for evening play on consecutive local days', () => {
    // 5 pm, 3 pm, 5 pm local on three consecutive days. With UTC keys and a
    // UTC-8 clock these collapsed to Tue, Tue, Thu and broke the streak.
    const win = { guessCount: 2, stars: 3, firstCompletion: true } as const;
    let s = recordWin(emptyStats(), win, isoDateLocal(new Date(2026, 3, 6, 17, 0)));
    s = recordWin(s, win, isoDateLocal(new Date(2026, 3, 7, 15, 0)));
    s = recordWin(s, win, isoDateLocal(new Date(2026, 3, 8, 17, 0)));
    expect(s.dayStreak).toBe(3);
  });

  it('continues a streak across a month boundary', () => {
    const win = { guessCount: 2, stars: 3, firstCompletion: true } as const;
    let s = recordWin(emptyStats(), win, isoDateLocal(new Date(2026, 0, 31, 12, 0)));
    s = recordWin(s, win, isoDateLocal(new Date(2026, 1, 1, 12, 0)));
    expect(s.dayStreak).toBe(2);
  });
});
