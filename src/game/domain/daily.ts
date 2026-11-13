import { generatePuzzle } from './puzzle';
import { solutionCountInBand } from './difficulty';
import { hashString } from './rng';
import type { Stars } from './stars';
import { Tier } from './types';
import type { Puzzle } from './types';

// One puzzle a day, the same for everyone, made on the device from the date.
// It plays as an Intermediate level (its guesses, its one pre-solved cell, its
// stars) and there is one attempt: no retry, no replay.
export const DAILY_TIER = Tier.Intermediate;

/** Daily puzzles are saved like levels, under ids no ladder level has. */
export const DAILY_ID_BASE = 1_000_000;

const FIRST_DAY = '2026-11-13';
const DAY_MS = 86_400_000;
// As open as an Intermediate level: this many grids fit the numbers.
const BAND = { min: 6, max: 15 } as const;

export interface DailyResult {
  readonly won: boolean;
  readonly guesses: number;
  readonly stars: Stars;
}

export interface DailyRecord {
  /** By calendar day (`2026-11-13`), the player's own. */
  readonly results: Readonly<Record<string, DailyResult>>;
  /** Days won in a row, ending on `lastWonIso`. */
  readonly streak: number;
  readonly bestStreak: number;
  readonly lastWonIso: string | null;
}

export function emptyDaily(): DailyRecord {
  return { results: {}, streak: 0, bestStreak: 0, lastWonIso: null };
}

function dayIndex(iso: string): number {
  return Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / DAY_MS,
  );
}

/** "Daily #1" is the first day; the number is what a shared result shows. */
export function dailyNumber(iso: string): number {
  return dayIndex(iso) + 1;
}

export function dailyLevelId(iso: string): number {
  return DAILY_ID_BASE + dailyNumber(iso);
}

const trivial = (sum: number): boolean => sum === 0 || sum === 6;
const cache = new Map<string, Puzzle>();

export function dailyPuzzle(iso: string): Puzzle {
  const cached = cache.get(iso);
  if (cached) return cached;
  const puzzle = generatePuzzle(hashString(`daily:${iso}`), {
    accept: p =>
      !p.rowSums.some(trivial) && !p.colSums.some(trivial) && solutionCountInBand(p, BAND),
    maxAttemptsPerSeed: 4000,
    maxNudges: 150,
  });
  cache.set(iso, puzzle);
  return puzzle;
}

/** The day's first result stands. A win extends the streak; a loss ends it. */
export function recordDaily(record: DailyRecord, iso: string, result: DailyResult): DailyRecord {
  if (record.results[iso]) return record;
  const results = { ...record.results, [iso]: result };
  if (!result.won) return { ...record, results, streak: 0 };
  const follows = record.lastWonIso !== null && dayIndex(iso) - dayIndex(record.lastWonIso) === 1;
  const streak = follows ? record.streak + 1 : 1;
  return {
    results,
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    lastWonIso: iso,
  };
}

/** The streak as of today: alive if the last win was today or yesterday. */
export function dailyStreak(record: DailyRecord, todayIso: string): number {
  if (record.lastWonIso === null || record.streak === 0) return 0;
  return dayIndex(todayIso) - dayIndex(record.lastWonIso) <= 1 ? record.streak : 0;
}
