import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { emptyStats } from '../game/domain/stats';
import type { Stats } from '../game/domain/stats';
import { emptyProgress } from '../game/domain/levels';
import type { LevelProgressMap, LevelProgressRecord } from '../game/domain/levels';

const K_STATS = 'grid:v2:stats';
const K_PROGRESS = 'grid:v2:progress';
const K_RETRY = (levelId: number): string => `grid:v2:retry:${levelId}`;
const K_RULES = 'grid:v2:rulesShown';
const K_MUTED = 'grid:v2:muted';
const K_NOTIFICATIONS = 'grid:v2:notifications';
const K_SESSION = 'grid:v2:sessionCount';
const K_HAPTICS_OFF = 'grid:v2:hapticsOff';
const K_MUSIC_OFF = 'grid:v2:musicOff';
const K_THEME = 'grid:v2:theme';
const K_ATTEMPT = (levelId: number): string => `grid:v2:attempt:${levelId}`;

const SESSION_BOOT_FLAG = 'grid:session-advanced';

const LEGACY_KEYS = [
  'grid:v1:stats',
  'grid:v1:tutorialShown',
  'grid:v1:muted',
  'grid:v2:tutorialShown',
] as const;
const LEGACY_DAILY_PREFIX = 'grid:v1:daily:';

const MIGRATION_FLAG = 'grid:migrated-to-prefs';
const MIGRATE_PREFIXES = ['grid:v2:', 'settings:', 'consent:', 'review:'];

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function safeGet(key: string): Promise<string | null> {
  try {
    if (isNative()) {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    }
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function safeSet(key: string, value: string): Promise<void> {
  try {
    if (isNative()) {
      await Preferences.set({ key, value });
      return;
    }
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // swallow: private browsing, quota, etc.
  }
}

export async function safeRemove(key: string): Promise<void> {
  try {
    if (isNative()) {
      await Preferences.remove({ key });
      return;
    }
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // swallow
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await safeSet(key, JSON.stringify(value));
  } catch {
    // swallow
  }
}

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await safeGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function resetAllWithPrefix(prefix: string): Promise<void> {
  try {
    if (isNative()) {
      const { keys } = await Preferences.keys();
      await Promise.all(
        keys.filter(k => k.startsWith(prefix)).map(k => Preferences.remove({ key: k })),
      );
      return;
    }
    if (typeof window === 'undefined') return;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    // swallow
  }
}

/** Erases what the player has earned or half-played. Their settings are kept. */
export async function resetGameData(): Promise<void> {
  await Promise.all([
    safeRemove(K_STATS),
    safeRemove(K_PROGRESS),
    safeRemove(K_RULES),
    resetAllWithPrefix('grid:v2:retry:'),
    resetAllWithPrefix('grid:v2:attempt:'),
  ]);
}

let migrationPromise: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (!migrationPromise) migrationPromise = runMigration();
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  if (!isNative()) return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const { value: done } = await Preferences.get({ key: MIGRATION_FLAG });
    if (done) return;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !MIGRATE_PREFIXES.some(p => k.startsWith(p))) continue;
      const v = window.localStorage.getItem(k);
      if (v !== null) await Preferences.set({ key: k, value: v });
    }
    await Preferences.set({ key: MIGRATION_FLAG, value: '1' });
  } catch {
    // non-fatal: fall back to reading fresh state
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export async function loadStats(): Promise<Stats> {
  await ensureMigrated();
  const raw = await safeGet(K_STATS);
  if (!raw) return emptyStats();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof parsed !== 'object' || parsed === null) return emptyStats();
    const base = emptyStats();
    const stored = Array.isArray(parsed.distribution) ? parsed.distribution : [];
    const lastActive = parsed.lastActiveIsoDate;
    return {
      levelsCompleted: count(parsed.levelsCompleted),
      totalStars: count(parsed.totalStars),
      totalWins: count(parsed.totalWins),
      totalLosses: count(parsed.totalLosses),
      distribution: base.distribution.map((_, i) => count(stored[i])),
      lastActiveIsoDate:
        typeof lastActive === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastActive)
          ? lastActive
          : null,
      dayStreak: count(parsed.dayStreak),
      bestDayStreak: count(parsed.bestDayStreak),
    };
  } catch {
    return emptyStats();
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  await safeSet(K_STATS, JSON.stringify(stats));
}

export async function loadProgress(): Promise<LevelProgressMap> {
  await ensureMigrated();
  const raw = await safeGet(K_PROGRESS);
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

export async function saveProgress(progress: LevelProgressMap): Promise<void> {
  await safeSet(K_PROGRESS, JSON.stringify(progress));
}

export interface RetryState {
  readonly freeRetryUsed: boolean;
  readonly adRetriesRemaining: number;
}

export function defaultRetryState(): RetryState {
  return { freeRetryUsed: false, adRetriesRemaining: 0 };
}

export async function loadRetryState(levelId: number): Promise<RetryState> {
  await ensureMigrated();
  const raw = await safeGet(K_RETRY(levelId));
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

export async function saveRetryState(levelId: number, state: RetryState): Promise<void> {
  await safeSet(K_RETRY(levelId), JSON.stringify(state));
}

export async function clearRetryState(levelId: number): Promise<void> {
  await safeRemove(K_RETRY(levelId));
}

// The in-progress (or lost) attempt for a level, stored as its move list.
// Validation happens on replay in the domain layer, so this returns raw JSON.
export async function loadAttempt(levelId: number): Promise<unknown> {
  await ensureMigrated();
  const raw = await safeGet(K_ATTEMPT(levelId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function saveAttempt(levelId: number, snapshot: unknown): Promise<void> {
  await safeSet(K_ATTEMPT(levelId), JSON.stringify(snapshot));
}

export async function clearAttempt(levelId: number): Promise<void> {
  await safeRemove(K_ATTEMPT(levelId));
}

export async function getRulesShown(): Promise<boolean> {
  await ensureMigrated();
  return (await safeGet(K_RULES)) === '1';
}

export async function setRulesShown(shown: boolean): Promise<void> {
  if (shown) await safeSet(K_RULES, '1');
  else await safeRemove(K_RULES);
}

export async function getMuted(): Promise<boolean> {
  await ensureMigrated();
  return (await safeGet(K_MUTED)) === '1';
}

export async function setMuted(muted: boolean): Promise<void> {
  if (muted) await safeSet(K_MUTED, '1');
  else await safeRemove(K_MUTED);
}

export async function getHapticsEnabled(): Promise<boolean> {
  await ensureMigrated();
  return (await safeGet(K_HAPTICS_OFF)) !== '1';
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  if (enabled) await safeRemove(K_HAPTICS_OFF);
  else await safeSet(K_HAPTICS_OFF, '1');
}

export async function getMusicEnabled(): Promise<boolean> {
  await ensureMigrated();
  return (await safeGet(K_MUSIC_OFF)) !== '1';
}

export async function setMusicEnabled(enabled: boolean): Promise<void> {
  if (enabled) await safeRemove(K_MUSIC_OFF);
  else await safeSet(K_MUSIC_OFF, '1');
}

// In the app the saved choice lives in Preferences, which can only be read
// asynchronously. index.html needs it before the first paint, so a copy is kept
// in localStorage, the one store a page can read at once.
function copyThemeForFirstPaint(theme: string): void {
  if (!isNative()) return;
  try {
    window.localStorage.setItem(K_THEME, theme);
  } catch {
    // swallow: the page then starts light and corrects itself
  }
}

/** 'light' or 'dark' once the player has chosen; null until then (the game is light). */
export async function getThemeChoice(): Promise<string | null> {
  await ensureMigrated();
  const theme = await safeGet(K_THEME);
  if (theme !== null) copyThemeForFirstPaint(theme);
  return theme;
}

export async function setThemeChoice(theme: string): Promise<void> {
  copyThemeForFirstPaint(theme);
  await safeSet(K_THEME, theme);
}

export async function getNotificationsEnabled(): Promise<boolean> {
  await ensureMigrated();
  return (await safeGet(K_NOTIFICATIONS)) === '1';
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  if (enabled) await safeSet(K_NOTIFICATIONS, '1');
  else await safeRemove(K_NOTIFICATIONS);
}

export async function getSessionCount(): Promise<number> {
  const raw = await safeGet(K_SESSION);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function advanceSessionOncePerBoot(): Promise<number> {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(SESSION_BOOT_FLAG)) return getSessionCount();
      sessionStorage.setItem(SESSION_BOOT_FLAG, '1');
    }
  } catch {
    // ignore; fall through to increment
  }
  const next = (await getSessionCount()) + 1;
  await safeSet(K_SESSION, String(next));
  return next;
}

export async function purgeLegacyKeys(): Promise<void> {
  if (isNative()) return;
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_KEYS) await safeRemove(key);
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LEGACY_DAILY_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) await safeRemove(k);
  } catch {
    // swallow
  }
}
