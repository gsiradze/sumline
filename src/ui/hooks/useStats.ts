import { useEffect, useState } from 'react';
import { loadStats, saveStats } from '../../storage/persistence';
import { emptyStats, isoDateLocal, recordLoss, recordWin } from '../../game/domain/stats';
import type { LevelWin, Stats } from '../../game/domain/stats';

export interface UseStats {
  readonly stats: Stats;
  readonly hydrated: boolean;
  readonly onWin: (win: LevelWin) => void;
  readonly onLoss: () => void;
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

  return { stats, hydrated, onWin, onLoss };
}
