import { Capacitor } from '@capacitor/core';
import { reportError } from '../telemetry/crash';

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

const isDev = import.meta.env.DEV === true;

function currentPlatform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
}

function resolve(name: string, value: string | undefined, testFallback: string): string {
  if (isDev) return testFallback;
  if (!value) {
    reportError(new Error(`Missing required env var ${name}`), { envVar: name });
    return testFallback;
  }
  return value;
}

export function admobIds(): AdMobIds {
  const e = import.meta.env;
  if (currentPlatform() === 'ios') {
    return {
      appId: resolve('VITE_ADMOB_APP_ID_IOS', e.VITE_ADMOB_APP_ID_IOS, TEST_ADMOB.appIdIos),
      rewarded: resolve('VITE_ADMOB_REWARDED_IOS', e.VITE_ADMOB_REWARDED_IOS, TEST_ADMOB.rewardedIos),
      interstitial: resolve('VITE_ADMOB_INTERSTITIAL_IOS', e.VITE_ADMOB_INTERSTITIAL_IOS, TEST_ADMOB.interstitialIos),
      banner: resolve('VITE_ADMOB_BANNER_IOS', e.VITE_ADMOB_BANNER_IOS, TEST_ADMOB.bannerIos),
    };
  }
  return {
    appId: resolve('VITE_ADMOB_APP_ID_ANDROID', e.VITE_ADMOB_APP_ID_ANDROID, TEST_ADMOB.appIdAndroid),
    rewarded: resolve('VITE_ADMOB_REWARDED_ANDROID', e.VITE_ADMOB_REWARDED_ANDROID, TEST_ADMOB.rewardedAndroid),
    interstitial: resolve(
      'VITE_ADMOB_INTERSTITIAL_ANDROID',
      e.VITE_ADMOB_INTERSTITIAL_ANDROID,
      TEST_ADMOB.interstitialAndroid,
    ),
    banner: resolve('VITE_ADMOB_BANNER_ANDROID', e.VITE_ADMOB_BANNER_ANDROID, TEST_ADMOB.bannerAndroid),
  };
}

export function usingAdMobTestIds(): boolean {
  return isDev;
}
