import { describe, expect, it } from 'vitest';
import { LINE_COUNT, LineAxis, findHintLine, hintLine } from '../hint';
import { applyHint, initialGameState, isCellLocked, submitGuess } from '../game-state';
import { CELL_COUNT, GRID_SIZE, GameOutcome } from '../types';
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

describe('hintLine', () => {
  it('numbers the rows 0–5 and the columns 6–11', () => {
    expect(hintLine(2)).toEqual({
      id: 2,
      axis: LineAxis.Row,
      index: 2,
      cells: [12, 13, 14, 15, 16, 17],
    });
    expect(hintLine(9)).toEqual({
      id: 9,
      axis: LineAxis.Column,
      index: 3,
      cells: [3, 9, 15, 21, 27, 33],
    });
  });

  it('is null for anything that is not a line', () => {
    for (const id of [-1, LINE_COUNT, 2.5, Number.NaN]) expect(hintLine(id)).toBeNull();
  });
});

describe('findHintLine', () => {
  it('picks the line whose answer is least predictable', () => {
    // Row 2 holds three of six: twenty possible arrangements. Every other line
    // has fewer, so revealing row 2 tells the player the most.
    const puzzle = makePuzzle([0, 12, 13, 14, 30]);
    const state = initialGameState({ puzzle, guessBudget: 6 });
    expect(findHintLine(state)).toMatchObject({ axis: LineAxis.Row, index: 2 });
  });

  it('counts only the cells that are still open', () => {
    const puzzle = makePuzzle([0, 12, 13, 14, 30]);
    let state = initialGameState({ puzzle, guessBudget: 6 });
    state = applyHint(state, hintLine(2)!.cells);
    const next = findHintLine(state);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(2);
    expect(next!.cells.some(i => !isCellLocked(state, i))).toBe(true);
  });

  it('prefers more open cells when lines are equally predictable', () => {
    // A lone filled cell: every row and column has one arrangement fewer than
    // six, except the line through it. With the first row revealed, column 0 is
    // known too, and the remaining lines are all certain (nothing left in them).
    const puzzle = makePuzzle([0]);
    let state = initialGameState({ puzzle, guessBudget: 6 });
    state = applyHint(state, hintLine(0)!.cells);
    const line = findHintLine(state)!;
    const open = line.cells.filter(i => !isCellLocked(state, i)).length;
    for (let id = 0; id < LINE_COUNT; id++) {
      const other = hintLine(id)!.cells.filter(i => !isCellLocked(state, i)).length;
      expect(open).toBeGreaterThanOrEqual(other);
    }
  });

  it('keeps offering lines until the whole board is known, then stops', () => {
    const puzzle = makePuzzle([0, 1, 6, 8, 13, 15, 20, 22, 27, 29, 34, 35]);
    let state = initialGameState({ puzzle, guessBudget: 6 });
    let hints = 0;
    for (;;) {
      const line = findHintLine(state);
      if (!line) break;
      const after = applyHint(state, line.cells);
      expect(after).not.toBe(state);
      state = after;
      hints++;
      expect(hints).toBeLessThanOrEqual(LINE_COUNT);
    }
    for (let i = 0; i < CELL_COUNT; i++) expect(isCellLocked(state, i)).toBe(true);
    expect(state.hintsUsed).toBe(hints);
    expect(submitGuess(state).outcome).toBe(GameOutcome.Won);
  });
});
