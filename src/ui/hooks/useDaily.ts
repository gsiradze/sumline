import { useCallback, useEffect, useState } from 'react';
import { emptyDaily, recordDaily } from '../../game/domain/daily';
import type { DailyRecord, DailyResult } from '../../game/domain/daily';
import { loadDaily, saveDaily } from '../../storage/persistence';

export interface UseDaily {
  readonly record: DailyRecord;
  readonly recordResult: (iso: string, result: DailyResult) => void;
  /** Forgets everything in memory. Erasing what is saved is the caller's job. */
  readonly reset: () => void;
}

export function useDaily(): UseDaily {
  const [record, setRecord] = useState<DailyRecord>(emptyDaily);

  useEffect(() => {
    let cancelled = false;
    void loadDaily().then(loaded => {
      if (!cancelled) setRecord(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordResult = useCallback((iso: string, result: DailyResult) => {
    setRecord(prev => {
      const next = recordDaily(prev, iso, result);
      if (next !== prev) void saveDaily(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => setRecord(emptyDaily()), []);

  return { record, recordResult, reset };
}
