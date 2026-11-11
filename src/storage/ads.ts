import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { admobConfig } from '../config/env';

/** granted: reward earned / ad shown. dismissed: closed before the reward. error: no ad was shown. */
export type AdOutcome = 'granted' | 'dismissed' | 'error';

export interface AdConsentState {
  readonly personalized: boolean;
  readonly childDirected: boolean;
  readonly underAgeOfConsent: boolean;
}

export interface AdProvider {
  /** Call only once consent allows ad requests. Safe to call again. Resolves false if ads are unavailable. */
  readonly init: (consent: AdConsentState) => Promise<boolean>;
  readonly showRewardedAd: (placement: string) => Promise<AdOutcome>;
  /** Shows only an ad that is already loaded; never makes the player wait for a load. */
  readonly showInterstitial: (placement: string) => Promise<AdOutcome>;
  readonly showBanner: () => Promise<void>;
  readonly hideBanner: () => Promise<void>;
  readonly onBannerHeight: (cb: (px: number) => void) => () => void;
  readonly setConsent: (consent: AdConsentState) => Promise<void>;
  /** App came back to the foreground or back online: refill whatever is missing. */
  readonly onAppResume: () => void;
}

const DEV_GRANT_DELAY_MS = 400;

class DevStubAdProvider implements AdProvider {
  async init(_consent: AdConsentState): Promise<boolean> {
    return true;
  }

  async showRewardedAd(_placement: string): Promise<AdOutcome> {
    await new Promise<void>(resolve => setTimeout(resolve, DEV_GRANT_DELAY_MS));
    return 'granted';
  }

  async showInterstitial(_placement: string): Promise<AdOutcome> {
    return 'error';
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

  onAppResume(): void {
    // no-op
  }
}

type FullscreenKind = 'rewarded' | 'interstitial';

interface Slot {
  ready: boolean;
  loadedAt: number;
  preloading: boolean;
  inflight: Promise<boolean> | null;
}

interface FullscreenResult {
  readonly outcome: AdOutcome;
  readonly retryable: boolean;
}

const PRELOAD_BACKOFF_MS = [5000, 10000, 30000, 60000];
const BANNER_BACKOFF_MS = [30000, 60000, 120000, 300000];
// Google expires a loaded full-screen ad after an hour; reload a little earlier.
const AD_MAX_AGE_MS = 55 * 60 * 1000;
const LOAD_TIMEOUT_MS = 12000;
const SHOW_WATCHDOG_MS = 10000;
const RESUME_GRACE_MS = 4000;

function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void work.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

class AdMobAdProvider implements AdProvider {
  private readonly config = admobConfig();
  private readonly testing = this.config.mode === 'test';
  private ready = false;
  private npa = true;
  private showing = false;
  private readonly slots: Record<FullscreenKind, Slot> = {
    rewarded: { ready: false, loadedAt: 0, preloading: false, inflight: null },
    interstitial: { ready: false, loadedAt: 0, preloading: false, inflight: null },
  };

  private bannerWanted = false;
  private bannerAlive = false;
  private bannerVisible = false;
  private bannerBusy = false;
  private bannerHeight = 0;
  private bannerRetryAttempt = 0;
  private bannerRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private bannerHandles: PluginListenerHandle[] | null = null;
  private readonly bannerListeners = new Set<(px: number) => void>();

  async init(consent: AdConsentState): Promise<boolean> {
    this.npa = !consent.personalized;
    if (this.ready) return true;
    if (!this.config.ids) return false;
    try {
      await AdMob.initialize({
        initializeForTesting: this.testing,
        tagForChildDirectedTreatment: consent.childDirected,
        tagForUnderAgeOfConsent: consent.underAgeOfConsent,
        maxAdContentRating: MaxAdContentRating.ParentalGuidance,
      });
    } catch {
      return false;
    }
    this.ready = true;
    void this.preload('rewarded');
    void this.preload('interstitial');
    if (this.bannerWanted) void this.showBanner();
    return true;
  }

  async setConsent(consent: AdConsentState): Promise<void> {
    this.npa = !consent.personalized;
  }

  onAppResume(): void {
    if (!this.ready) return;
    void this.preload('rewarded');
    void this.preload('interstitial');
    if (this.bannerWanted && !this.bannerVisible) {
      this.clearBannerRetry();
      void this.showBanner();
    }
  }

  async showRewardedAd(_placement: string): Promise<AdOutcome> {
    if (!this.ready || this.showing || !pageVisible()) return 'error';
    this.showing = true;
    try {
      if (!this.isFresh('rewarded')) {
        this.slots.rewarded.ready = false;
        if (!(await withTimeout(this.loadOnce('rewarded'), LOAD_TIMEOUT_MS, false))) return 'error';
      }
      let result = await this.runFullscreen('rewarded');
      this.slots.rewarded.ready = false;
      if (result.outcome === 'error' && result.retryable) {
        // The loaded ad had expired or was already used: load a fresh one and try once more.
        if (await withTimeout(this.loadOnce('rewarded'), LOAD_TIMEOUT_MS, false)) {
          result = await this.runFullscreen('rewarded');
          this.slots.rewarded.ready = false;
        }
      }
      return result.outcome;
    } finally {
      this.showing = false;
      void this.preload('rewarded');
    }
  }

  async showInterstitial(_placement: string): Promise<AdOutcome> {
    if (!this.ready || this.showing || !pageVisible()) return 'error';
    if (!this.isFresh('interstitial')) {
      this.slots.interstitial.ready = false;
      void this.preload('interstitial');
      return 'error';
    }
    this.showing = true;
    try {
      return (await this.runFullscreen('interstitial')).outcome;
    } finally {
      this.slots.interstitial.ready = false;
      this.showing = false;
      void this.preload('interstitial');
    }
  }

  async showBanner(): Promise<void> {
    this.bannerWanted = true;
    const ids = this.config.ids;
    if (!this.ready || !ids || this.bannerVisible || this.bannerBusy) return;
    this.bannerBusy = true;
    try {
      await this.ensureBannerListeners();
      if (this.bannerAlive) {
        // After hideBanner the native view is only hidden; showBanner alone would
        // load a new ad into an invisible view.
        await AdMob.resumeBanner();
      } else {
        await AdMob.showBanner({
          adId: ids.banner,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: this.testing,
          npa: this.npa,
        });
        this.bannerAlive = true;
      }
      this.bannerVisible = true;
    } catch {
      this.scheduleBannerRetry();
    } finally {
      this.bannerBusy = false;
    }
  }

  async hideBanner(): Promise<void> {
    this.bannerWanted = false;
    this.clearBannerRetry();
    if (this.bannerAlive && this.bannerVisible) {
      try {
        await AdMob.hideBanner();
      } catch {
        // non-fatal
      }
    }
    this.bannerVisible = false;
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

  private async ensureBannerListeners(): Promise<void> {
    if (this.bannerHandles) return;
    this.bannerHandles = await Promise.all([
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, size => {
        const height = size.height > 0 ? size.height : 0;
        if (height > 0) this.bannerRetryAttempt = 0;
        this.emitBannerHeight(this.bannerWanted ? height : 0);
      }),
      // The plugin destroys its view when a load or refresh fails. Without this
      // the banner would be gone for the rest of the session.
      AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
        this.bannerAlive = false;
        this.bannerVisible = false;
        this.emitBannerHeight(0);
        if (this.bannerWanted) this.scheduleBannerRetry();
      }),
    ]);
  }

  private scheduleBannerRetry(): void {
    if (this.bannerRetryTimer !== null || !this.bannerWanted) return;
    const wait =
      BANNER_BACKOFF_MS[Math.min(this.bannerRetryAttempt, BANNER_BACKOFF_MS.length - 1)] ?? 300000;
    this.bannerRetryAttempt++;
    this.bannerRetryTimer = setTimeout(() => {
      this.bannerRetryTimer = null;
      if (this.bannerWanted && pageVisible()) void this.showBanner();
    }, wait);
  }

  private clearBannerRetry(): void {
    if (this.bannerRetryTimer === null) return;
    clearTimeout(this.bannerRetryTimer);
    this.bannerRetryTimer = null;
  }

  private isFresh(kind: FullscreenKind): boolean {
    const slot = this.slots[kind];
    return slot.ready && Date.now() - slot.loadedAt < AD_MAX_AGE_MS;
  }

  private loadOnce(kind: FullscreenKind): Promise<boolean> {
    const slot = this.slots[kind];
    const ids = this.config.ids;
    if (!this.ready || !ids) return Promise.resolve(false);
    if (slot.inflight) return slot.inflight;
    const options = { isTesting: this.testing, npa: this.npa };
    const request =
      kind === 'rewarded'
        ? AdMob.prepareRewardVideoAd({ adId: ids.rewarded, ...options })
        : AdMob.prepareInterstitial({ adId: ids.interstitial, ...options });
    slot.inflight = request
      .then(
        () => {
          slot.ready = true;
          slot.loadedAt = Date.now();
          return true;
        },
        () => {
          slot.ready = false;
          return false;
        },
      )
      .finally(() => {
        slot.inflight = null;
      });
    return slot.inflight;
  }

  private async preload(kind: FullscreenKind): Promise<void> {
    const slot = this.slots[kind];
    if (!this.ready || slot.preloading || this.isFresh(kind)) return;
    slot.preloading = true;
    try {
      for (const wait of [...PRELOAD_BACKOFF_MS, 0]) {
        if (this.isFresh(kind) || (await this.loadOnce(kind))) return;
        if (wait > 0) await delay(wait);
      }
    } finally {
      slot.preloading = false;
    }
  }

  private listen(
    kind: FullscreenKind,
    on: { shown: () => void; dismissed: () => void; failed: () => void; rewarded: () => void },
  ): Promise<PluginListenerHandle[]> {
    if (kind === 'rewarded') {
      return Promise.all([
        AdMob.addListener(RewardAdPluginEvents.Showed, on.shown),
        AdMob.addListener(RewardAdPluginEvents.Dismissed, on.dismissed),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, on.failed),
        AdMob.addListener(RewardAdPluginEvents.Rewarded, on.rewarded),
      ]);
    }
    return Promise.all([
      AdMob.addListener(InterstitialAdPluginEvents.Showed, on.shown),
      AdMob.addListener(InterstitialAdPluginEvents.Dismissed, on.dismissed),
      AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, on.failed),
    ]);
  }

  private runFullscreen(kind: FullscreenKind): Promise<FullscreenResult> {
    return new Promise<FullscreenResult>(resolve => {
      let shown = false;
      let rewarded = false;
      let done = false;
      let handles: PluginListenerHandle[] = [];
      let resumeTimer: ReturnType<typeof setTimeout> | null = null;

      const settle = (outcome: AdOutcome, retryable: boolean): void => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        if (resumeTimer !== null) clearTimeout(resumeTimer);
        document.removeEventListener('visibilitychange', onVisibility);
        for (const h of handles) void h.remove();
        resolve({ outcome, retryable });
      };
      const finish = (): void => {
        settle(kind === 'interstitial' || rewarded ? 'granted' : 'dismissed', false);
      };
      // The ad covers the app, so the page is hidden while it plays. If the page
      // is visible again and no dismiss event arrives, do not wait forever.
      const onVisibility = (): void => {
        if (!shown || document.visibilityState !== 'visible' || resumeTimer !== null) return;
        resumeTimer = setTimeout(finish, RESUME_GRACE_MS);
      };
      const watchdog = setTimeout(() => {
        if (!shown) settle('error', false);
      }, SHOW_WATCHDOG_MS);
      document.addEventListener('visibilitychange', onVisibility);

      void this.listen(kind, {
        shown: () => {
          shown = true;
          clearTimeout(watchdog);
        },
        dismissed: finish,
        failed: () => settle('error', true),
        rewarded: () => {
          rewarded = true;
        },
      }).then(
        registered => {
          handles = registered;
          if (done) {
            for (const h of registered) void h.remove();
            return;
          }
          const show = kind === 'rewarded' ? AdMob.showRewardVideoAd() : AdMob.showInterstitial();
          show.catch(() => settle('error', true));
        },
        () => settle('error', false),
      );
    });
  }
}

function selectProvider(): AdProvider {
  return Capacitor.isNativePlatform() ? new AdMobAdProvider() : new DevStubAdProvider();
}

export const adProvider: AdProvider = selectProvider();
