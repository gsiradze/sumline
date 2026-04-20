function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // swallow
  }
}

export const haptics = {
  tap(): void {
    vibrate(8);
  },
  lock(): void {
    vibrate(14);
  },
  win(): void {
    vibrate([40, 40, 40, 40, 80]);
  },
  lose(): void {
    vibrate([90]);
  },
};
