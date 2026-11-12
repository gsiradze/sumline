import { Capacitor } from '@capacitor/core';

// The public web build is a demo of the first two sets. The app has no limit,
// and neither does the dev server unless its address asks for the demo
// (`/?demo`): that is how the browser tests, and anyone at a desk, reach it.
const WEB_DEMO_LEVELS = 14;

// Read once, at load: a shared link (`?level=37`) cleans the address afterwards.
const demoRequested =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('demo');

export function demoLevelLimit(): number | null {
  if (Capacitor.isNativePlatform()) return null;
  if (import.meta.env.DEV && !demoRequested) return null;
  return WEB_DEMO_LEVELS;
}
