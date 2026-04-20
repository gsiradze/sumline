import { useCallback, useReducer, useRef } from 'react';
import {
  applyHint,
  initialGameState,
  submitGuess,
  toggleMark,
} from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';
import { sound } from '../../game/audio/soundManager';
import { haptics } from '../../game/audio/haptics';
import { smartPreLockIndices } from '../../game/domain/levels';
import { puzzleForLevel } from '../../storage/levelsManifest';
import type { BakedLevel } from '../../storage/levelsManifest';

type Action =
  | { readonly type: 'toggle'; readonly index: number }
  | { readonly type: 'submit' }
  | { readonly type: 'hint'; readonly index: number }
  | { readonly type: 'restart' };

interface HookInit {
  readonly level: BakedLevel;
}

function freshState(level: BakedLevel): ActiveGameState {
  const puzzle = puzzleForLevel(level.id);
  return initialGameState({
    puzzle,
    guessBudget: level.guessBudget,
    preLockedCells: smartPreLockIndices(puzzle, level.preLockedCellCount),
  });
}

function reducer(state: ActiveGameState, action: Action, init: HookInit): ActiveGameState {
  switch (action.type) {
    case 'toggle':
      return toggleMark(state, action.index);
    case 'submit':
      return submitGuess(state);
    case 'hint':
      return applyHint(state, action.index);
    case 'restart':
      return freshState(init.level);
  }
}

export interface UseGameState {
  readonly state: ActiveGameState;
  readonly onCellTapped: (index: number) => void;
  readonly submit: () => void;
  readonly applyHint: (cellIndex: number) => void;
  readonly restart: () => void;
}

export function useGameState(level: BakedLevel): UseGameState {
  const initRef = useRef<HookInit>({ level });
  initRef.current = { level };
  const [state, rawDispatch] = useReducer(
    (s: ActiveGameState, a: Action) => reducer(s, a, initRef.current),
    level,
    freshState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const onCellTapped = useCallback((index: number) => {
    sound.unlock();
    const wasMarked = stateRef.current.currentMarks[index] === 1;
    if (wasMarked) sound.playToggleOff();
    else sound.playToggleOn();
    haptics.tap();
    rawDispatch({ type: 'toggle', index });
  }, []);

  const submit = useCallback(() => {
    sound.unlock();
    rawDispatch({ type: 'submit' });
  }, []);

  const hint = useCallback((cellIndex: number) => {
    sound.unlock();
    rawDispatch({ type: 'hint', index: cellIndex });
  }, []);

  const restart = useCallback(() => {
    rawDispatch({ type: 'restart' });
  }, []);

  return { state, onCellTapped, submit, applyHint: hint, restart };
}
