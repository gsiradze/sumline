import {
  afterAdShown,
  afterLevelComplete,
  defaultAdPolicy,
  initialAdPolicyState,
  shouldShowInterstitial,
} from '../game/domain/adPolicy';
import type { AdPolicyState } from '../game/domain/adPolicy';

let state: AdPolicyState = initialAdPolicyState;
let sessionCount = 0;

export function setSessionCount(count: number): void {
  sessionCount = count;
}

export function currentSessionCount(): number {
  return sessionCount;
}

export function noteLevelComplete(): void {
  state = afterLevelComplete(state);
}

export function noteAdShown(now: number): void {
  state = afterAdShown(state, now);
}

export function canShowInterstitial(now: number): boolean {
  return shouldShowInterstitial(defaultAdPolicy, state, sessionCount, now);
}
