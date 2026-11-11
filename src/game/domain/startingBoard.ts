import { initialGameState } from './game-state';
import type { ActiveGameState } from './game-state';
import { smartPreLockIndices } from './levels';
import { GRID_SIZE } from './types';
import type { Puzzle } from './types';

// The first set is the tutorial: each of its levels starts with one whole row solved.
export const TEACHING_LEVEL_COUNT = 7;

export interface StartingBoardSpec {
  readonly id: number;
  readonly guessBudget: number;
  readonly preLockedCellCount: number;
}

function fullestRowIndices(puzzle: Puzzle): readonly number[] {
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

/** The board a level starts with, including whatever its tier pre-solves. */
export function startingBoard(puzzle: Puzzle, spec: StartingBoardSpec): ActiveGameState {
  const preLockedCells =
    spec.id < TEACHING_LEVEL_COUNT
      ? fullestRowIndices(puzzle)
      : smartPreLockIndices(puzzle, spec.preLockedCellCount);
  return initialGameState({ puzzle, guessBudget: spec.guessBudget, preLockedCells });
}
