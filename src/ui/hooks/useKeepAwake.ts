import { useEffect } from 'react';
import { allowSleep, keepAwake } from '../../platform/keepAwake';

/**
 * Keep the screen awake while `active` and this component is mounted; release
 * on unmount or when `active` goes false. Mount in a level play view.
 */
export function useKeepAwake(active = true): void {
  useEffect(() => {
    if (!active) return;
    void keepAwake();
    return () => {
      void allowSleep();
    };
  }, [active]);
}
