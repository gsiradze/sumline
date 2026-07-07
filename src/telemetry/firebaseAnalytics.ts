import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import type { AnalyticsEvent, AnalyticsProvider } from './analytics';

/* Firebase Analytics provider implementing the swap-in AnalyticsProvider
   interface. Native only — registered in main.tsx behind isNative(). */
export class FirebaseAnalyticsProvider implements AnalyticsProvider {
  async init(): Promise<void> {
    try {
      await FirebaseAnalytics.setEnabled({ enabled: true });
    } catch {
      // non-fatal
    }
  }

  track(event: AnalyticsEvent): void {
    const { kind, ...params } = event;
    void FirebaseAnalytics.logEvent({ name: kind, params: params as Record<string, unknown> }).catch(() => {});
  }

  setUser(id: string | null): void {
    void FirebaseAnalytics.setUserId({ userId: id }).catch(() => {});
  }

  setConsent(granted: boolean): void {
    void FirebaseAnalytics.setEnabled({ enabled: granted }).catch(() => {});
  }
}
