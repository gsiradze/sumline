import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import type { AdConsentState } from '../storage/ads';
import { loadJson, saveJson } from '../storage/persistence';

const CONSENT_KEY = 'consent:v1';

export interface ConsentResult {
  readonly ad: AdConsentState;
  /** False until the consent platform says ads may be requested. Nothing ad-related runs before that. */
  readonly canRequestAds: boolean;
  readonly analyticsGranted: boolean;
  /** True where the player must be able to reopen the consent choices (shown in Settings). */
  readonly privacyOptionsRequired: boolean;
}

const webConsent: ConsentResult = {
  ad: { personalized: false, childDirected: false, underAgeOfConsent: false },
  canRequestAds: true,
  analyticsGranted: true,
  privacyOptionsRequired: false,
};

const blocked: ConsentResult = {
  ad: { personalized: false, childDirected: false, underAgeOfConsent: false },
  canRequestAds: false,
  analyticsGranted: false,
  privacyOptionsRequired: false,
};

export interface ConsentFlowOptions {
  readonly beforeAtt?: () => Promise<void>;
}

let current: ConsentResult = Capacitor.isNativePlatform() ? blocked : webConsent;

export function currentConsent(): ConsentResult {
  return current;
}

function sanitize(stored: Partial<ConsentResult> | null): ConsentResult | null {
  if (!stored || typeof stored !== 'object' || stored.canRequestAds !== true) return null;
  return {
    ad: {
      personalized: stored.ad?.personalized === true,
      childDirected: false,
      underAgeOfConsent: false,
    },
    canRequestAds: true,
    analyticsGranted: stored.analyticsGranted === true,
    privacyOptionsRequired: stored.privacyOptionsRequired === true,
  };
}

export async function runConsentFlow(options?: ConsentFlowOptions): Promise<ConsentResult> {
  if (!Capacitor.isNativePlatform()) return webConsent;

  try {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      info = await AdMob.showConsentForm();
    }

    let personalized = info.canRequestAds === true;
    if (Capacitor.getPlatform() === 'ios') {
      const before = await AdMob.trackingAuthorizationStatus();
      if (before.status === 'notDetermined') {
        await options?.beforeAtt?.();
        await AdMob.requestTrackingAuthorization();
      }
      const after = await AdMob.trackingAuthorizationStatus();
      personalized = personalized && after.status === 'authorized';
    }

    const canRequestAds = info.canRequestAds === true;
    current = {
      ad: { personalized, childDirected: false, underAgeOfConsent: false },
      canRequestAds,
      // Until the consent question is settled nothing is collected. This does not
      // read per-purpose choices; set consent-mode defaults in the Firebase console.
      analyticsGranted: canRequestAds,
      privacyOptionsRequired: String(info.privacyOptionsRequirementStatus) === 'REQUIRED',
    };
    await saveJson(CONSENT_KEY, current);
  } catch {
    // Offline or the consent service failed. Fall back to what an earlier
    // session established; a first launch with no answer on record stays blocked.
    current = sanitize(await loadJson<Partial<ConsentResult> | null>(CONSENT_KEY, null)) ?? blocked;
  }
  return current;
}

export async function showPrivacyOptions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    // non-fatal
  }
}
