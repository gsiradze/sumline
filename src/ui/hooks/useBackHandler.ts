import { useEffect, useRef } from 'react';
import { BACK_PRIORITY_SCREEN, pushBackHandler } from '../../platform/back';

/** Makes `handler` the meaning of "back" (Android button, Escape) while this component shows. */
export function useBackHandler(
  handler: () => void,
  priority: number = BACK_PRIORITY_SCREEN,
  active = true,
): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => latest.current(), priority);
  }, [priority, active]);
}
