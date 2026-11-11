import { useEffect, useState } from 'react';
import { allowSleep, keepAwake } from '../../platform/keepAwake';

const IDLE_RELEASE_MS = 120_000;

/**
 * Keeps the screen on while `active` and the player has touched the screen
 * recently. Thinking about a guess should not dim the phone, but a phone put
 * down mid-level must still go to sleep.
 */
export function useKeepAwake(active = true): void {
  const [recent, setRecent] = useState(true);

  useEffect(() => {
    if (!active) return;
    setRecent(true);
    let timer = window.setTimeout(() => setRecent(false), IDLE_RELEASE_MS);
    const bump = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRecent(false), IDLE_RELEASE_MS);
      setRecent(true);
    };
    window.addEventListener('pointerdown', bump, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.clearTimeout(timer);
    };
  }, [active]);

  const awake = active && recent;
  useEffect(() => {
    if (!awake) return;
    void keepAwake();
    return () => {
      void allowSleep();
    };
  }, [awake]);
}
