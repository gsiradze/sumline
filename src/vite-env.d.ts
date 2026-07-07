/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMOB_APP_ID_ANDROID?: string;
  readonly VITE_ADMOB_APP_ID_IOS?: string;
  readonly VITE_ADMOB_REWARDED_ANDROID?: string;
  readonly VITE_ADMOB_REWARDED_IOS?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ANDROID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_IOS?: string;
  readonly VITE_ADMOB_BANNER_ANDROID?: string;
  readonly VITE_ADMOB_BANNER_IOS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
