import { Capacitor } from '@capacitor/core';

// The public web build is a demo of the first two sets. The app and the dev
// server have no limit.
const WEB_DEMO_LEVELS = 14;

export function demoLevelLimit(): number | null {
  if (Capacitor.isNativePlatform() || import.meta.env.DEV) return null;
  return WEB_DEMO_LEVELS;
}
