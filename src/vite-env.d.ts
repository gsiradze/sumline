/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ADS_MODE?: string;
  readonly VITE_ADMOB_APP_ID_ANDROID?: string;
  readonly VITE_ADMOB_APP_ID_IOS?: string;
  readonly VITE_ADMOB_REWARDED_ANDROID?: string;
  readonly VITE_ADMOB_REWARDED_IOS?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ANDROID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_IOS?: string;
  readonly VITE_ADMOB_BANNER_ANDROID?: string;
  readonly VITE_ADMOB_BANNER_IOS?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
