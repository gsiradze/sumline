export interface AdPolicyConfig {
  readonly minSessionForInterstitials: number;
  readonly levelsBetweenInterstitials: number;
  readonly minSecondsBetweenAds: number;
}

export const defaultAdPolicy: AdPolicyConfig = {
  minSessionForInterstitials: 2,
  levelsBetweenInterstitials: 3,
  minSecondsBetweenAds: 90,
};

export interface AdPolicyState {
  readonly lastAdAt: number | null; // epoch ms of the last ad of any type
  readonly levelsSinceInterstitial: number;
}

export const initialAdPolicyState: AdPolicyState = {
  lastAdAt: null,
  levelsSinceInterstitial: 0,
};

export function shouldShowInterstitial(
  config: AdPolicyConfig,
  state: AdPolicyState,
  sessionCount: number,
  now: number,
): boolean {
  if (sessionCount < config.minSessionForInterstitials) return false;
  if (state.levelsSinceInterstitial < config.levelsBetweenInterstitials) return false;
  if (state.lastAdAt !== null && (now - state.lastAdAt) / 1000 < config.minSecondsBetweenAds) {
    return false;
  }
  return true;
}

export function afterAdShown(_state: AdPolicyState, now: number): AdPolicyState {
  return { lastAdAt: now, levelsSinceInterstitial: 0 };
}

export function afterLevelComplete(state: AdPolicyState): AdPolicyState {
  return { ...state, levelsSinceInterstitial: state.levelsSinceInterstitial + 1 };
}
