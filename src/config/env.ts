import { Capacitor } from '@capacitor/core';

// Google's public sample units. They always fill and never earn or count as
// real traffic, so they are safe to tap during development and device testing.
const TEST_ADMOB = {
  appIdIos: 'ca-app-pub-3940256099942544~1458002511',
  appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
  rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
  interstitialIos: 'ca-app-pub-3940256099942544/4411468910',
  interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
  bannerIos: 'ca-app-pub-3940256099942544/2934735716',
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
} as const;

export interface AdMobIds {
  readonly appId: string;
  readonly rewarded: string;
  readonly interstitial: string;
  readonly banner: string;
}

export type AdsMode = 'test' | 'live';

export interface AdMobConfig {
  readonly mode: AdsMode;
  /** null when live mode is requested but an ID is missing: ads stay off. */
  readonly ids: AdMobIds | null;
  readonly missing: readonly string[];
}

// Live ads are opt-in per build (`VITE_ADS_MODE=live`, set by the release
// scripts). Every other build, including device builds, shows test ads, so
// nobody ends up tapping their own live units while testing.
export function adsMode(): AdsMode {
  return import.meta.env.VITE_ADS_MODE === 'live' ? 'live' : 'test';
}

export function admobConfig(): AdMobConfig {
  const ios = Capacitor.getPlatform() === 'ios';
  if (adsMode() === 'test') {
    return {
      mode: 'test',
      ids: ios
        ? {
            appId: TEST_ADMOB.appIdIos,
            rewarded: TEST_ADMOB.rewardedIos,
            interstitial: TEST_ADMOB.interstitialIos,
            banner: TEST_ADMOB.bannerIos,
          }
        : {
            appId: TEST_ADMOB.appIdAndroid,
            rewarded: TEST_ADMOB.rewardedAndroid,
            interstitial: TEST_ADMOB.interstitialAndroid,
            banner: TEST_ADMOB.bannerAndroid,
          },
      missing: [],
    };
  }

  const e = import.meta.env;
  const wanted: readonly (readonly [keyof AdMobIds, string, string | undefined])[] = ios
    ? [
        ['appId', 'VITE_ADMOB_APP_ID_IOS', e.VITE_ADMOB_APP_ID_IOS],
        ['rewarded', 'VITE_ADMOB_REWARDED_IOS', e.VITE_ADMOB_REWARDED_IOS],
        ['interstitial', 'VITE_ADMOB_INTERSTITIAL_IOS', e.VITE_ADMOB_INTERSTITIAL_IOS],
        ['banner', 'VITE_ADMOB_BANNER_IOS', e.VITE_ADMOB_BANNER_IOS],
      ]
    : [
        ['appId', 'VITE_ADMOB_APP_ID_ANDROID', e.VITE_ADMOB_APP_ID_ANDROID],
        ['rewarded', 'VITE_ADMOB_REWARDED_ANDROID', e.VITE_ADMOB_REWARDED_ANDROID],
        ['interstitial', 'VITE_ADMOB_INTERSTITIAL_ANDROID', e.VITE_ADMOB_INTERSTITIAL_ANDROID],
        ['banner', 'VITE_ADMOB_BANNER_ANDROID', e.VITE_ADMOB_BANNER_ANDROID],
      ];

  const missing = wanted.filter(([, , value]) => !isRealId(value)).map(([, name]) => name);
  if (missing.length > 0) return { mode: 'live', ids: null, missing };

  const ids = Object.fromEntries(
    wanted.map(([key, , value]) => [key, value]),
  ) as unknown as AdMobIds;
  return { mode: 'live', ids, missing: [] };
}

function isRealId(value: string | undefined): value is string {
  if (!value) return false;
  if (value.includes('xxxx')) return false;
  // Never let a sample unit ship in a live build.
  return !value.startsWith('ca-app-pub-3940256099942544');
}
