import { TOTAL_LEVELS } from '../game/domain/tiers';

/** The level a shared link asks for (`?level=37` is level id 36), or null. */
export function levelIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('level');
  if (raw === null || !/^\d{1,4}$/.test(raw)) return null;
  const levelNumber = Number(raw);
  return levelNumber >= 1 && levelNumber <= TOTAL_LEVELS ? levelNumber - 1 : null;
}

/** Null when no web address is configured: there is nowhere for a link to lead. */
export function levelLink(webUrl: string, levelNumber: number): string | null {
  const base = webUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return null;
  return `${base}/?level=${levelNumber}`;
}

/** A link as people read it: no scheme, no "www.". */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
}
