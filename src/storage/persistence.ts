import { emptyStats } from '../game/domain/stats';
import type { Stats } from '../game/domain/stats';
import { emptyProgress } from '../game/domain/levels';
import type { LevelProgressMap, LevelProgressRecord } from '../game/domain/levels';

const K_STATS = 'grid:v2:stats';
const K_PROGRESS = 'grid:v2:progress';
const K_RETRY = (levelId: number) => `grid:v2:retry:${levelId}`;
const K_TUTORIAL = 'grid:v2:tutorialShown';
const K_RULES = 'grid:v2:rulesShown';
const K_MUTED = 'grid:v2:muted';

const LEGACY_KEYS = [
  'grid:v1:stats',
  'grid:v1:tutorialShown',
  'grid:v1:muted',
] as const;
const LEGACY_DAILY_PREFIX = 'grid:v1:daily:';

function safeGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // swallow: private browsing, quota, etc.
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // swallow
  }
}

export function loadStats(): Stats {
  const raw = safeGet(K_STATS);
  if (!raw) return emptyStats();
  try {
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      ...emptyStats(),
      ...parsed,
      distribution: Array.isArray(parsed.distribution)
        ? parsed.distribution.map(n => (typeof n === 'number' ? n : 0))
        : emptyStats().distribution,
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: Stats): void {
  safeSet(K_STATS, JSON.stringify(stats));
}

export function loadProgress(): LevelProgressMap {
  const raw = safeGet(K_PROGRESS);
  if (!raw) return emptyProgress();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, LevelProgressRecord> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 0) continue;
      if (typeof value !== 'object' || value === null) continue;
      const v = value as Partial<LevelProgressRecord>;
      const stars = v.stars;
      if (stars !== 0 && stars !== 1 && stars !== 2 && stars !== 3) continue;
      out[id] = {
        completed: v.completed === true,
        bestGuessCount: typeof v.bestGuessCount === 'number' ? v.bestGuessCount : null,
        stars,
      };
    }
    return out;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: LevelProgressMap): void {
  safeSet(K_PROGRESS, JSON.stringify(progress));
}

export interface RetryState {
  readonly freeRetryUsed: boolean;
  readonly adRetriesRemaining: number;
}

export function defaultRetryState(): RetryState {
  return { freeRetryUsed: false, adRetriesRemaining: 0 };
}

export function loadRetryState(levelId: number): RetryState {
  const raw = safeGet(K_RETRY(levelId));
  if (!raw) return defaultRetryState();
  try {
    const parsed = JSON.parse(raw) as Partial<RetryState>;
    return {
      freeRetryUsed: parsed.freeRetryUsed === true,
      adRetriesRemaining:
        typeof parsed.adRetriesRemaining === 'number'
          ? Math.max(0, Math.floor(parsed.adRetriesRemaining))
          : 0,
    };
  } catch {
    return defaultRetryState();
  }
}

export function saveRetryState(levelId: number, state: RetryState): void {
  safeSet(K_RETRY(levelId), JSON.stringify(state));
}

export function clearRetryState(levelId: number): void {
  safeRemove(K_RETRY(levelId));
}

export function getTutorialShown(): boolean {
  return safeGet(K_TUTORIAL) === '1';
}

export function setTutorialShown(shown: boolean): void {
  if (shown) safeSet(K_TUTORIAL, '1');
  else safeRemove(K_TUTORIAL);
}

export function getRulesShown(): boolean {
  return safeGet(K_RULES) === '1';
}

export function setRulesShown(shown: boolean): void {
  if (shown) safeSet(K_RULES, '1');
  else safeRemove(K_RULES);
}

export function getMuted(): boolean {
  return safeGet(K_MUTED) === '1';
}

export function setMuted(muted: boolean): void {
  if (muted) safeSet(K_MUTED, '1');
  else safeRemove(K_MUTED);
}

export function purgeLegacyKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_KEYS) safeRemove(key);
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LEGACY_DAILY_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) safeRemove(k);
  } catch {
    // swallow
  }
}
