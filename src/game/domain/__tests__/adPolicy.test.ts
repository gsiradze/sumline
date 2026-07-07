import { describe, expect, it } from 'vitest';
import {
  afterAdShown,
  afterLevelComplete,
  defaultAdPolicy,
  initialAdPolicyState,
  shouldShowInterstitial,
} from '../adPolicy';
import type { AdPolicyState } from '../adPolicy';

const NOW = 1_000_000_000_000;

function ready(): AdPolicyState {
  return { lastAdAt: null, levelsSinceInterstitial: defaultAdPolicy.levelsBetweenInterstitials };
}

describe('shouldShowInterstitial', () => {
  it('never shows during session 1', () => {
    expect(shouldShowInterstitial(defaultAdPolicy, ready(), 1, NOW)).toBe(false);
  });

  it('shows once cadence and session gates are met', () => {
    expect(shouldShowInterstitial(defaultAdPolicy, ready(), 2, NOW)).toBe(true);
  });

  it('blocks until enough levels have passed since the last interstitial', () => {
    const state: AdPolicyState = { lastAdAt: null, levelsSinceInterstitial: 2 };
    expect(shouldShowInterstitial(defaultAdPolicy, state, 5, NOW)).toBe(false);
  });

  it('respects the minimum time gap between any ads', () => {
    const state: AdPolicyState = {
      lastAdAt: NOW - 30_000,
      levelsSinceInterstitial: defaultAdPolicy.levelsBetweenInterstitials,
    };
    expect(shouldShowInterstitial(defaultAdPolicy, state, 5, NOW)).toBe(false);
  });

  it('allows again once the time gap has elapsed', () => {
    const state: AdPolicyState = {
      lastAdAt: NOW - 120_000,
      levelsSinceInterstitial: defaultAdPolicy.levelsBetweenInterstitials,
    };
    expect(shouldShowInterstitial(defaultAdPolicy, state, 5, NOW)).toBe(true);
  });
});

describe('state transitions', () => {
  it('afterLevelComplete increments the interstitial counter', () => {
    const next = afterLevelComplete(initialAdPolicyState);
    expect(next.levelsSinceInterstitial).toBe(1);
    expect(next.lastAdAt).toBeNull();
  });

  it('afterAdShown resets the counter and stamps the time (rewarded resets cooldown too)', () => {
    const state: AdPolicyState = { lastAdAt: null, levelsSinceInterstitial: 5 };
    const next = afterAdShown(state, NOW);
    expect(next).toEqual({ lastAdAt: NOW, levelsSinceInterstitial: 0 });
  });
});
