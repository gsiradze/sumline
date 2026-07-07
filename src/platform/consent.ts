import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import type { AdConsentState } from '../storage/ads';
import { loadJson, saveJson } from '../storage/persistence';

const CONSENT_KEY = 'consent:v1';

export interface ConsentResult {
  readonly ad: AdConsentState;
  readonly analyticsGranted: boolean;
}

const webConsent: ConsentResult = {
  ad: { personalized: false, childDirected: false, underAgeOfConsent: false },
  analyticsGranted: true,
};

export interface ConsentFlowOptions {
  readonly beforeAtt?: () => Promise<void>;
}

export async function runConsentFlow(options?: ConsentFlowOptions): Promise<ConsentResult> {
  if (!Capacitor.isNativePlatform()) return webConsent;

  let personalized = false;
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }

    if (Capacitor.getPlatform() === 'ios') {
      const before = await AdMob.trackingAuthorizationStatus();
      if (before.status === 'notDetermined') {
        await options?.beforeAtt?.();
        await AdMob.requestTrackingAuthorization();
      }
      const after = await AdMob.trackingAuthorizationStatus();
      personalized = after.status === 'authorized';
    } else {
      const refreshed = await AdMob.requestConsentInfo();
      personalized = refreshed.canRequestAds === true && refreshed.status !== AdmobConsentStatus.REQUIRED;
    }
  } catch {
    personalized = false;
  }

  const result: ConsentResult = {
    ad: { personalized, childDirected: false, underAgeOfConsent: false },
    analyticsGranted: true,
  };
  await saveJson(CONSENT_KEY, result);
  return result;
}

export async function loadConsent(): Promise<ConsentResult | null> {
  return loadJson<ConsentResult | null>(CONSENT_KEY, null);
}

export async function showPrivacyOptions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    // non-fatal
  }
}
