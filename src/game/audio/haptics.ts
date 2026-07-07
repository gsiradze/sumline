import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // swallow
  }
}

export const haptics = {
  tap(): void {
    if (!enabled) return;
    if (isNative()) {
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      return;
    }
    vibrate(8);
  },
  lock(): void {
    if (!enabled) return;
    if (isNative()) {
      void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      return;
    }
    vibrate(14);
  },
  win(): void {
    if (!enabled) return;
    if (isNative()) {
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      return;
    }
    vibrate([40, 40, 40, 40, 80]);
  },
  lose(): void {
    if (!enabled) return;
    if (isNative()) {
      void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
      return;
    }
    vibrate([90]);
  },
};
