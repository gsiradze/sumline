import { useCallback, useEffect, useState } from 'react';
import { loadProgress, saveProgress } from '../../storage/persistence';
import { emptyProgress } from '../../game/domain/levels';
import type { LevelProgressMap, LevelProgressRecord } from '../../game/domain/levels';
import type { Stars } from '../../game/domain/stars';

export interface UseProgress {
  readonly progress: LevelProgressMap;
  readonly hydrated: boolean;
  readonly recordLevelWin: (levelId: number, guessCount: number, stars: Stars) => void;
  /** Forgets everything in memory. Erasing what is saved is the caller's job. */
  readonly reset: () => void;
}

export function useProgress(): UseProgress {
  const [progress, setProgress] = useState<LevelProgressMap>(emptyProgress);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadProgress().then(loaded => {
      if (cancelled) return;
      setProgress(loaded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordLevelWin = useCallback(
    (levelId: number, guessCount: number, stars: Stars) => {
      setProgress(prev => {
        const existing = prev[levelId];
        const prevBest = existing?.bestGuessCount ?? null;
        const prevStars = (existing?.stars ?? 0) as Stars;
        const bestGuessCount =
          prevBest === null ? guessCount : Math.min(prevBest, guessCount);
        const bestStars = (Math.max(prevStars, stars) as Stars);
        const next: Record<number, LevelProgressRecord> = { ...prev };
        next[levelId] = {
          completed: true,
          bestGuessCount,
          stars: bestStars,
        };
        void saveProgress(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => setProgress(emptyProgress()), []);

  return { progress, hydrated, recordLevelWin, reset };
}
