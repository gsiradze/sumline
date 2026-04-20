import { MAX_GUESS_BUDGET } from './types';

export interface Stats {
  readonly levelsCompleted: number;
  readonly totalStars: number;
  readonly totalWins: number;
  readonly totalLosses: number;
  readonly distribution: readonly number[];
  readonly lastActiveIsoDate: string | null;
  readonly dayStreak: number;
  readonly bestDayStreak: number;
}

export function emptyStats(): Stats {
  return {
    levelsCompleted: 0,
    totalStars: 0,
    totalWins: 0,
    totalLosses: 0,
    distribution: new Array<number>(MAX_GUESS_BUDGET).fill(0),
    lastActiveIsoDate: null,
    dayStreak: 0,
    bestDayStreak: 0,
  };
}

export interface LevelWin {
  readonly guessCount: number;
  readonly stars: 0 | 1 | 2 | 3;
  readonly firstCompletion: boolean;
}

export function recordWin(stats: Stats, win: LevelWin, today?: string): Stats {
  const dist = [...stats.distribution];
  const clamped = Math.max(1, Math.min(MAX_GUESS_BUDGET, win.guessCount));
  const existing = dist[clamped - 1] ?? 0;
  dist[clamped - 1] = existing + 1;
  const activity = today ? updateStreak(stats, today) : {};
  return {
    ...stats,
    levelsCompleted: stats.levelsCompleted + (win.firstCompletion ? 1 : 0),
    totalStars: stats.totalStars + win.stars,
    totalWins: stats.totalWins + 1,
    distribution: dist,
    ...activity,
  };
}

export function recordLoss(stats: Stats, today?: string): Stats {
  const activity = today ? updateStreak(stats, today) : {};
  return {
    ...stats,
    totalLosses: stats.totalLosses + 1,
    ...activity,
  };
}

export function isoDateUTC(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updateStreak(
  stats: Stats,
  todayIso: string,
): Pick<Stats, 'lastActiveIsoDate' | 'dayStreak' | 'bestDayStreak'> {
  if (stats.lastActiveIsoDate === todayIso) {
    return {
      lastActiveIsoDate: stats.lastActiveIsoDate,
      dayStreak: stats.dayStreak,
      bestDayStreak: stats.bestDayStreak,
    };
  }
  const yesterday = shiftIsoDate(todayIso, -1);
  const nextStreak = stats.lastActiveIsoDate === yesterday ? stats.dayStreak + 1 : 1;
  return {
    lastActiveIsoDate: todayIso,
    dayStreak: nextStreak,
    bestDayStreak: Math.max(stats.bestDayStreak, nextStreak),
  };
}

function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
  if (y === undefined || m === undefined || d === undefined) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return isoDateUTC(date);
}

export function winRate(stats: Stats): number {
  const total = stats.totalWins + stats.totalLosses;
  if (total === 0) return 0;
  return stats.totalWins / total;
}
