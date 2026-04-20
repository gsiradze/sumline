import { useEffect, useRef } from 'react';
import { sound } from '../../game/audio/soundManager';
import { haptics } from '../../game/audio/haptics';
import { CELL_COUNT, GameOutcome } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';

export function useAudioFx(state: ActiveGameState): void {
  const prev = useRef(state);

  useEffect(() => {
    const prevState = prev.current;
    prev.current = state;

    if (prevState.outcome !== state.outcome) {
      if (state.outcome === GameOutcome.Won) {
        sound.playWin();
        haptics.win();
      } else if (state.outcome === GameOutcome.Lost) {
        sound.playLose();
        haptics.lose();
      }
    }

    if (state.outcome === GameOutcome.InProgress) {
      const newLocks = countNewLocks(prevState, state);
      if (newLocks > 0) {
        haptics.lock();
        sound.playSubmitReveal();
      }
    }
  }, [state]);
}

function countNewLocks(prev: ActiveGameState, curr: ActiveGameState): number {
  let count = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const wasLocked = (prev.lockedFilled[i] ?? false) || (prev.lockedEmpty[i] ?? false);
    const isLocked = (curr.lockedFilled[i] ?? false) || (curr.lockedEmpty[i] ?? false);
    if (!wasLocked && isLocked) count++;
  }
  return count;
}
