import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from './native';

/* Keep the screen on during active play. No-op on web. */

export async function keepAwake(): Promise<void> {
  if (!isNative()) return;
  try {
    await KeepAwake.keepAwake();
  } catch {
    // non-fatal
  }
}

export async function allowSleep(): Promise<void> {
  if (!isNative()) return;
  try {
    await KeepAwake.allowSleep();
  } catch {
    // non-fatal
  }
}
