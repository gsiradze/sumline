import { hashString } from './rng';

export const LAUNCH_EPOCH_ISO = '2026-01-01';
export const LAUNCH_EPOCH_UTC_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function puzzleIdForDate(isoDate: string): number {
  const match = ISO_DATE_REGEX.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid ISO date: "${isoDate}" (expected YYYY-MM-DD)`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  if (Number.isNaN(utcMs)) {
    throw new Error(`Invalid ISO date: "${isoDate}"`);
  }
  return Math.floor((utcMs - LAUNCH_EPOCH_UTC_MS) / DAY_MS);
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoDateForPuzzleId(id: number): string {
  const utcMs = LAUNCH_EPOCH_UTC_MS + id * DAY_MS;
  return toIsoDate(new Date(utcMs));
}

export function seedForPuzzleId(id: number): number {
  return hashString(`grid-daily-v1-${id}`);
}

export function seedForPracticeRun(sessionId: string, index: number): number {
  return hashString(`grid-practice-v1-${sessionId}-${index}`);
}
