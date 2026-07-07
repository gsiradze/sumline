import type { Stars } from '../game/domain/stars';
import type { AdOutcome } from '../storage/ads';
import type { ShareOutcome } from '../platform/share';
import { trackEvent } from './analytics';

export function appOpen(): void {
  trackEvent({ kind: 'app_open' });
}

export function sessionStart(sessionCount: number): void {
  trackEvent({ kind: 'session_start', sessionCount });
}

export function levelStart(level: number): void {
  trackEvent({ kind: 'level_start', level });
}

export function levelComplete(level: number, moves: number, stars: Stars, durationS: number): void {
  trackEvent({ kind: 'level_complete', level, moves, stars, durationS });
}

export function levelFail(level: number, moves: number, durationS: number): void {
  trackEvent({ kind: 'level_fail', level, moves, durationS });
}

export function levelQuit(level: number, moves: number, durationS: number): void {
  trackEvent({ kind: 'level_quit', level, moves, durationS });
}

export function hintUsed(level: number): void {
  trackEvent({ kind: 'hint_used', level });
}

export function adImpression(
  placement: string,
  outcome: AdOutcome,
  adType: 'rewarded' | 'interstitial' | 'banner' = 'rewarded',
): void {
  trackEvent({ kind: 'ad_impression', placement, adType, outcome });
}

export function shareResult(surface: 'level', outcome: ShareOutcome): void {
  trackEvent({ kind: 'share_result', surface, outcome });
}

export function streakAdvanced(dayStreak: number): void {
  trackEvent({ kind: 'streak_advanced', dayStreak });
}

export function settingChanged(settingKey: string, value: boolean): void {
  trackEvent({ kind: 'setting_changed', settingKey, value });
}
