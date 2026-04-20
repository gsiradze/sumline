import { describe, expect, it } from 'vitest';
import { findHintCell } from '../hint';
import { applyHint, initialGameState, isCellLocked } from '../game-state';
import { CELL_COUNT, GRID_SIZE } from '../types';
import type { Cell, Puzzle } from '../types';

function makePuzzle(solutionIndices: readonly number[]): Puzzle {
  const solution: Cell[] = new Array<Cell>(CELL_COUNT).fill(0);
  for (const i of solutionIndices) solution[i] = 1;
  const rowSums = new Array<number>(GRID_SIZE).fill(0);
  const colSums = new Array<number>(GRID_SIZE).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = solution[r * GRID_SIZE + c] ?? 0;
      rowSums[r]! += v;
      colSums[c]! += v;
    }
  }
  return {
    solution,
    rowSums,
    colSums,
    filledCount: solutionIndices.length,
    seed: 0,
  };
}

describe('findHintCell', () => {
  it('returns null when every cell is already locked', () => {
    const puzzle = makePuzzle([0, 6, 12, 18, 24]);
    let state = initialGameState({ puzzle, guessBudget: 6 });
    for (let i = 0; i < CELL_COUNT; i++) {
      state = applyHint(state, i);
    }
    expect(findHintCell(state)).toBeNull();
  });

  it('returns an unlocked cell index when any exist', () => {
    const puzzle = makePuzzle([0]);
    const state = initialGameState({ puzzle, guessBudget: 6 });
    const hint = findHintCell(state);
    expect(hint).not.toBeNull();
    expect(hint!).toBeGreaterThanOrEqual(0);
    expect(hint!).toBeLessThan(CELL_COUNT);
    expect(isCellLocked(state, hint!)).toBe(false);
  });

  it('applyHint locks the chosen cell to the solution truth', () => {
    const puzzle = makePuzzle([0, 6, 12]);
    const state = initialGameState({ puzzle, guessBudget: 6 });
    const hint = findHintCell(state);
    const after = applyHint(state, hint!);
    expect(isCellLocked(after, hint!)).toBe(true);
    expect(after.hintsUsed).toBe(1);
    if (puzzle.solution[hint!] === 1) {
      expect(after.lockedFilled[hint!]).toBe(true);
    } else {
      expect(after.lockedEmpty[hint!]).toBe(true);
    }
  });
});
