import { useEffect, useRef } from 'react';
import { sound } from '../../game/audio/soundManager';
import { haptics } from '../../game/audio/haptics';
import { CELL_COUNT, GameOutcome } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';

export function useAudioFx(state: ActiveGameState, hydrated: boolean): void {
  const prev = useRef(state);
  const wasHydrated = useRef(hydrated);

  useEffect(() => {
    const prevState = prev.current;
    prev.current = state;
    const settled = wasHydrated.current;
    wasHydrated.current = hydrated;
    // A saved attempt appearing on screen is not news: no fanfare, no buzz.
    if (!hydrated || !settled) return;

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
  }, [state, hydrated]);
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
