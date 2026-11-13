import { useEffect, useState } from 'react';
import { loadStats, saveStats } from '../../storage/persistence';
import { emptyStats, isoDateLocal, recordLoss, recordWin } from '../../game/domain/stats';
import type { LevelWin, Stats } from '../../game/domain/stats';

export interface UseStats {
  readonly stats: Stats;
  readonly hydrated: boolean;
  readonly onWin: (win: LevelWin) => void;
  readonly onLoss: () => void;
  /** Forgets everything in memory. Erasing what is saved is the caller's job. */
  readonly reset: () => void;
}

export function useStats(): UseStats {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadStats().then(loaded => {
      if (cancelled) return;
      setStats(loaded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onWin = (win: LevelWin) => {
    setStats(prev => {
      const next = recordWin(prev, win, isoDateLocal());
      void saveStats(next);
      return next;
    });
  };

  const onLoss = () => {
    setStats(prev => {
      const next = recordLoss(prev, isoDateLocal());
      void saveStats(next);
      return next;
    });
  };

  const reset = (): void => setStats(emptyStats);

  return { stats, hydrated, onWin, onLoss, reset };
}
