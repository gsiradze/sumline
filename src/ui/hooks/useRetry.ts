import { useCallback, useEffect, useState } from 'react';
import {
  clearRetryState,
  defaultRetryState,
  loadRetryState,
  saveRetryState,
} from '../../storage/persistence';
import type { RetryState } from '../../storage/persistence';
import { adProvider } from '../../storage/ads';

const AD_RETRY_GRANT = 2;

export interface UseRetry {
  readonly retry: RetryState;
  readonly canFreeRetry: boolean;
  readonly canAdRetry: boolean;
  readonly consumeFreeRetry: () => void;
  readonly consumeAdRetry: () => void;
  readonly requestAdRetries: () => Promise<boolean>;
  readonly reset: () => void;
}

export function useRetry(levelId: number): UseRetry {
  const [retry, setRetry] = useState<RetryState>(() => loadRetryState(levelId));

  useEffect(() => {
    setRetry(loadRetryState(levelId));
  }, [levelId]);

  const persist = useCallback(
    (next: RetryState) => {
      setRetry(next);
      saveRetryState(levelId, next);
    },
    [levelId],
  );

  const consumeFreeRetry = useCallback(() => {
    setRetry(prev => {
      if (prev.freeRetryUsed) return prev;
      const next = { ...prev, freeRetryUsed: true };
      saveRetryState(levelId, next);
      return next;
    });
  }, [levelId]);

  const consumeAdRetry = useCallback(() => {
    setRetry(prev => {
      if (prev.adRetriesRemaining <= 0) return prev;
      const next = { ...prev, adRetriesRemaining: prev.adRetriesRemaining - 1 };
      saveRetryState(levelId, next);
      return next;
    });
  }, [levelId]);

  const requestAdRetries = useCallback(async () => {
    const outcome = await adProvider.showRewardedAd('retry');
    if (outcome !== 'granted') return false;
    setRetry(prev => {
      const next = {
        ...prev,
        adRetriesRemaining: prev.adRetriesRemaining + AD_RETRY_GRANT,
      };
      saveRetryState(levelId, next);
      return next;
    });
    return true;
  }, [levelId]);

  const reset = useCallback(() => {
    clearRetryState(levelId);
    persist(defaultRetryState());
  }, [levelId, persist]);

  return {
    retry,
    canFreeRetry: !retry.freeRetryUsed,
    canAdRetry: retry.adRetriesRemaining > 0,
    consumeFreeRetry,
    consumeAdRetry,
    requestAdRetries,
    reset,
  };
}
