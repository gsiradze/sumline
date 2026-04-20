import { useState } from 'react';
import { loadStats, saveStats } from '../../storage/persistence';
import { isoDateUTC, recordLoss, recordWin } from '../../game/domain/stats';
import type { LevelWin, Stats } from '../../game/domain/stats';

export interface UseStats {
  readonly stats: Stats;
  readonly onWin: (win: LevelWin) => void;
  readonly onLoss: () => void;
}

export function useStats(): UseStats {
  const [stats, setStats] = useState<Stats>(() => loadStats());

  const onWin = (win: LevelWin) => {
    setStats(prev => {
      const next = recordWin(prev, win, isoDateUTC());
      saveStats(next);
      return next;
    });
  };

  const onLoss = () => {
    setStats(prev => {
      const next = recordLoss(prev, isoDateUTC());
      saveStats(next);
      return next;
    });
  };

  return { stats, onWin, onLoss };
}
