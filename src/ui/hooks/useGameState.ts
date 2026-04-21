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
import { GRID_SIZE } from '../../game/domain/types';
import type { Puzzle } from '../../game/domain/types';
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

function fullestRowPreLockIndices(puzzle: Puzzle): readonly number[] {
  let bestRow = 0;
  let bestSum = -1;
  for (let r = 0; r < GRID_SIZE; r++) {
    const s = puzzle.rowSums[r] ?? 0;
    if (s > bestSum) {
      bestSum = s;
      bestRow = r;
    }
  }
  const indices: number[] = [];
  for (let c = 0; c < GRID_SIZE; c++) indices.push(bestRow * GRID_SIZE + c);
  return indices;
}

const TEACHING_BATCH_SIZE = 7;

function freshState(level: BakedLevel): ActiveGameState {
  const puzzle = puzzleForLevel(level.id);
  const preLockedCells =
    level.id < TEACHING_BATCH_SIZE
      ? fullestRowPreLockIndices(puzzle)
      : smartPreLockIndices(puzzle, level.preLockedCellCount);
  return initialGameState({
    puzzle,
    guessBudget: level.guessBudget,
    preLockedCells,
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
