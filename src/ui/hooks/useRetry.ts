import { useCallback, useEffect, useState } from 'react';
import {
  clearRetryState,
  defaultRetryState,
  loadRetryState,
  saveRetryState,
} from '../../storage/persistence';
import type { RetryState } from '../../storage/persistence';
import { adProvider } from '../../storage/ads';
import { noteAdShown } from '../../storage/adSession';
import { adImpression } from '../../telemetry/events';

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
  const [retry, setRetry] = useState<RetryState>(defaultRetryState);

  useEffect(() => {
    let cancelled = false;
    void loadRetryState(levelId).then(loaded => {
      if (!cancelled) setRetry(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [levelId]);

  const persist = useCallback(
    (next: RetryState) => {
      setRetry(next);
      void saveRetryState(levelId, next);
    },
    [levelId],
  );

  const consumeFreeRetry = useCallback(() => {
    setRetry(prev => {
      if (prev.freeRetryUsed) return prev;
      const next = { ...prev, freeRetryUsed: true };
      void saveRetryState(levelId, next);
      return next;
    });
  }, [levelId]);

  const consumeAdRetry = useCallback(() => {
    setRetry(prev => {
      if (prev.adRetriesRemaining <= 0) return prev;
      const next = { ...prev, adRetriesRemaining: prev.adRetriesRemaining - 1 };
      void saveRetryState(levelId, next);
      return next;
    });
  }, [levelId]);

  const requestAdRetries = useCallback(async () => {
    const outcome = await adProvider.showRewardedAd('retry');
    adImpression('retry', outcome);
    if (outcome !== 'granted') return false;
    noteAdShown(Date.now());
    setRetry(prev => {
      const next = {
        ...prev,
        adRetriesRemaining: prev.adRetriesRemaining + AD_RETRY_GRANT,
      };
      void saveRetryState(levelId, next);
      return next;
    });
    return true;
  }, [levelId]);

  const reset = useCallback(() => {
    void clearRetryState(levelId);
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
