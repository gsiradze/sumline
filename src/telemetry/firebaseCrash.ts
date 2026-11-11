import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import type { CrashContext, CrashReporter } from './crash';
import { parseStack } from './stack';

const MAX_STACK_KEY_CHARS = 900;

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
    const keysAndValues = Object.entries(context ?? {}).map(([key, value]) => ({
      key,
      value: String(value),
      type: 'string' as const,
    }));
    if (error.stack) {
      keysAndValues.push({
        key: 'js_stack',
        value: error.stack.slice(0, MAX_STACK_KEY_CHARS),
        type: 'string' as const,
      });
    }
    const stacktrace = parseStack(error.stack);
    void FirebaseCrashlytics.recordException({
      message: `${error.name}: ${error.message}`,
      keysAndValues,
      ...(stacktrace.length > 0 ? { stacktrace } : {}),
    }).catch(() => {});
  }

  setUser(id: string | null): void {
    void FirebaseCrashlytics.setUserId({ userId: id ?? '' }).catch(() => {});
  }

  log(message: string): void {
    void FirebaseCrashlytics.log({ message }).catch(() => {});
  }
}
