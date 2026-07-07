import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import type { CrashContext, CrashReporter } from './crash';

/* Firebase Crashlytics reporter implementing the swap-in CrashReporter
   interface. Native only — registered in main.tsx behind isNative(). */
export class FirebaseCrashReporter implements CrashReporter {
  async init(): Promise<void> {
    try {
      await FirebaseCrashlytics.setEnabled({ enabled: true });
    } catch {
      // non-fatal
    }
  }

  reportError(error: Error, context?: CrashContext): void {
    const keysAndValues = context
      ? Object.entries(context).map(([key, value]) => ({
          key,
          value: String(value),
          type: 'string' as const,
        }))
      : undefined;
    void FirebaseCrashlytics.recordException({ message: error.message, keysAndValues }).catch(() => {});
  }

  setUser(id: string | null): void {
    void FirebaseCrashlytics.setUserId({ userId: id ?? '' }).catch(() => {});
  }

  log(message: string): void {
    void FirebaseCrashlytics.log({ message }).catch(() => {});
  }
}
