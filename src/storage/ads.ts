import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { admobIds, usingAdMobTestIds } from '../config/env';

export type AdOutcome = 'granted' | 'dismissed' | 'error';

export type AdPlacement = 'hint' | 'retry';

export interface AdConsentState {
  readonly personalized: boolean;
  readonly childDirected: boolean;
  readonly underAgeOfConsent: boolean;
}

export interface AdProvider {
  readonly init: (consent: AdConsentState) => Promise<void>;
  readonly showRewardedAd: (placement: string) => Promise<AdOutcome>;
  readonly preloadRewarded: () => Promise<void>;
  readonly showInterstitial: (placement: string) => Promise<AdOutcome>;
  readonly preloadInterstitial: () => Promise<void>;
  readonly showBanner: () => Promise<void>;
  readonly hideBanner: () => Promise<void>;
  readonly onBannerHeight: (cb: (px: number) => void) => () => void;
  readonly setConsent: (consent: AdConsentState) => Promise<void>;
}

const DEV_GRANT_DELAY_MS = 400;

class DevStubAdProvider implements AdProvider {
  async init(_consent: AdConsentState): Promise<void> {
    // no-op
  }

  async showRewardedAd(_placement: string): Promise<AdOutcome> {
    await new Promise<void>(resolve => setTimeout(resolve, DEV_GRANT_DELAY_MS));
    return 'granted';
  }

  async preloadRewarded(): Promise<void> {
    // no-op
  }

  async showInterstitial(_placement: string): Promise<AdOutcome> {
    await new Promise<void>(resolve => setTimeout(resolve, DEV_GRANT_DELAY_MS));
    return 'granted';
  }

  async preloadInterstitial(): Promise<void> {
    // no-op
  }

  async showBanner(): Promise<void> {
    // no banner on web
  }

  async hideBanner(): Promise<void> {
    // no-op
  }

  onBannerHeight(_cb: (px: number) => void): () => void {
    return () => {};
  }

  async setConsent(_consent: AdConsentState): Promise<void> {
    // no-op
  }
}

const BACKOFF_MS = [5000, 10000, 30000, 60000];

class AdMobAdProvider implements AdProvider {
  private readonly ids = admobIds();
  private readonly testing = usingAdMobTestIds();
  private npa = false;
  private rewardedReady = false;
  private interstitialReady = false;
  private bannerShown = false;
  private bannerHeight = 0;
  private bannerSizeHandle: PluginListenerHandle | null = null;
  private readonly bannerListeners = new Set<(px: number) => void>();

  async init(consent: AdConsentState): Promise<void> {
    this.npa = !consent.personalized;
    try {
      await AdMob.initialize({
        initializeForTesting: this.testing,
        tagForChildDirectedTreatment: consent.childDirected,
        tagForUnderAgeOfConsent: consent.underAgeOfConsent,
      });
    } catch {
      // non-fatal — shows will report 'error'
    }
    void this.preloadRewarded();
    void this.preloadInterstitial();
  }

  async setConsent(consent: AdConsentState): Promise<void> {
    this.npa = !consent.personalized;
  }

  async preloadRewarded(): Promise<void> {
    await this.loadWithBackoff('rewarded');
  }

  async preloadInterstitial(): Promise<void> {
    await this.loadWithBackoff('interstitial');
  }

  async showRewardedAd(placement: string): Promise<AdOutcome> {
    if (!this.rewardedReady && !(await this.loadOnce('rewarded'))) return 'error';
    const outcome = await this.runRewarded();
    this.rewardedReady = false;
    void this.preloadRewarded();
    void placement;
    return outcome;
  }

  async showInterstitial(placement: string): Promise<AdOutcome> {
    if (!this.interstitialReady && !(await this.loadOnce('interstitial'))) return 'error';
    const outcome = await this.runInterstitial();
    this.interstitialReady = false;
    void this.preloadInterstitial();
    void placement;
    return outcome;
  }

  async showBanner(): Promise<void> {
    if (this.bannerShown) return;
    try {
      if (!this.bannerSizeHandle) {
        this.bannerSizeHandle = await AdMob.addListener(BannerAdPluginEvents.SizeChanged, size => {
          this.emitBannerHeight(size.height > 0 ? size.height : 0);
        });
      }
      await AdMob.showBanner({
        adId: this.ids.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: this.testing,
        npa: this.npa,
      });
      this.bannerShown = true;
    } catch {
      // non-fatal — no banner reserved
    }
  }

  async hideBanner(): Promise<void> {
    try {
      await AdMob.hideBanner();
    } catch {
      // non-fatal
    }
    this.bannerShown = false;
    this.emitBannerHeight(0);
  }

  onBannerHeight(cb: (px: number) => void): () => void {
    this.bannerListeners.add(cb);
    cb(this.bannerHeight);
    return () => {
      this.bannerListeners.delete(cb);
    };
  }

  private emitBannerHeight(px: number): void {
    this.bannerHeight = px;
    for (const cb of this.bannerListeners) cb(px);
  }

  private async loadOnce(kind: 'rewarded' | 'interstitial'): Promise<boolean> {
    try {
      if (kind === 'rewarded') {
        await AdMob.prepareRewardVideoAd({ adId: this.ids.rewarded, isTesting: this.testing, npa: this.npa });
        this.rewardedReady = true;
      } else {
        await AdMob.prepareInterstitial({ adId: this.ids.interstitial, isTesting: this.testing, npa: this.npa });
        this.interstitialReady = true;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async loadWithBackoff(kind: 'rewarded' | 'interstitial'): Promise<void> {
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      if (await this.loadOnce(kind)) return;
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }

  private runRewarded(): Promise<AdOutcome> {
    return new Promise<AdOutcome>(resolve => {
      let rewarded = false;
      const handles: PluginListenerHandle[] = [];
      const settle = (outcome: AdOutcome): void => {
        for (const h of handles) void h.remove();
        resolve(outcome);
      };
      void Promise.all([
        AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
          rewarded = true;
        }),
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => settle(rewarded ? 'granted' : 'dismissed')),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => settle('error')),
      ]).then(hs => {
        handles.push(...hs);
        AdMob.showRewardVideoAd().catch(() => settle('error'));
      });
    });
  }

  private runInterstitial(): Promise<AdOutcome> {
    return new Promise<AdOutcome>(resolve => {
      const handles: PluginListenerHandle[] = [];
      const settle = (outcome: AdOutcome): void => {
        for (const h of handles) void h.remove();
        resolve(outcome);
      };
      void Promise.all([
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => settle('granted')),
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => settle('error')),
      ]).then(hs => {
        handles.push(...hs);
        AdMob.showInterstitial().catch(() => settle('error'));
      });
    });
  }
}

function selectProvider(): AdProvider {
  return Capacitor.isNativePlatform() ? new AdMobAdProvider() : new DevStubAdProvider();
}

export const adProvider: AdProvider = selectProvider();

export const defaultConsent: AdConsentState = {
  personalized: false,
  childDirected: false,
  underAgeOfConsent: false,
};
