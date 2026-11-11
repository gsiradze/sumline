export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.narnarigames.sumline';

// Both come from .env and are required for a release build (`npm run doctor -- --release`).
export const PRIVACY_POLICY_URL: string = import.meta.env.VITE_PRIVACY_URL ?? '';
export const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL ?? '';

// Where the web version is hosted. When set, a shared result links to its level
// there (`…/?level=37`); when empty, it links to the store listing instead.
export const WEB_APP_URL: string = import.meta.env.VITE_WEB_URL ?? '';
