import type { Stars } from '../game/domain/stars';
import type { AdOutcome } from '../storage/ads';
import type { ShareOutcome } from '../platform/share';
import { trackEvent } from './analytics';

/* Names avoid Firebase's reserved events (session_start, first_open, …) and the
   ones AdMob logs by itself (ad_impression). Levels are sent as the number the
   player sees (1-based). */

const MILESTONE_LEVELS: readonly number[] = [1, 5, 10];

export function appOpen(): void {
  trackEvent({ kind: 'app_open' });
}

export function sessionBegin(sessionCount: number): void {
  trackEvent({ kind: 'session_begin', session_count: sessionCount });
}

export function tutorialBegin(): void {
  trackEvent({ kind: 'tutorial_begin' });
}

export function tutorialComplete(skipped: boolean): void {
  trackEvent({ kind: 'tutorial_complete', skipped });
}

export function levelStart(levelId: number): void {
  trackEvent({ kind: 'level_start', level: levelId + 1 });
}

export function levelComplete(
  levelId: number,
  moves: number,
  stars: Stars,
  durationS: number,
  firstCompletion: boolean,
): void {
  const level = levelId + 1;
  trackEvent({ kind: 'level_complete', level, moves, stars, duration_s: durationS });
  if (firstCompletion && MILESTONE_LEVELS.includes(level)) {
    trackEvent({ kind: `level_${level}_complete`, moves, stars });
  }
}

export function levelFail(levelId: number, moves: number, durationS: number): void {
  trackEvent({ kind: 'level_fail', level: levelId + 1, moves, duration_s: durationS });
}

export function levelQuit(levelId: number, moves: number, durationS: number): void {
  trackEvent({ kind: 'level_quit', level: levelId + 1, moves, duration_s: durationS });
}

export function hintUsed(levelId: number): void {
  trackEvent({ kind: 'hint_used', level: levelId + 1 });
}

export function adResult(
  placement: string,
  outcome: AdOutcome,
  adType: 'rewarded' | 'interstitial' = 'rewarded',
): void {
  trackEvent({ kind: 'ad_result', placement, ad_type: adType, outcome });
}

export function shareResult(surface: 'level', outcome: ShareOutcome): void {
  trackEvent({ kind: 'share_result', surface, outcome });
}

export function settingChanged(settingKey: string, enabled: boolean): void {
  trackEvent({ kind: 'setting_changed', setting_key: settingKey, enabled });
}
