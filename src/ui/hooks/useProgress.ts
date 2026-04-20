import { useCallback, useState } from 'react';
import { loadProgress, saveProgress } from '../../storage/persistence';
import type { LevelProgressMap, LevelProgressRecord } from '../../game/domain/levels';
import type { Stars } from '../../game/domain/stars';

export interface UseProgress {
  readonly progress: LevelProgressMap;
  readonly recordLevelWin: (levelId: number, guessCount: number, stars: Stars) => void;
}

export function useProgress(): UseProgress {
  const [progress, setProgress] = useState<LevelProgressMap>(() => loadProgress());

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
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  return { progress, recordLevelWin };
}
