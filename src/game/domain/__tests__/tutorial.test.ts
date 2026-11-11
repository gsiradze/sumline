import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyHint, initialGameState, markedCount, submitGuess, toggleMark } from '../game-state';
import type { ActiveGameState } from '../game-state';
import { LineAxis, hintLine } from '../hint';
import { startingBoard } from '../startingBoard';
import {
  CoachStep,
  TUTORIAL_LEVEL_ID,
  coachView,
  findForcedLine,
  findSolvedRow,
  isLineMarked,
} from '../tutorial';
import { CELL_COUNT, GRID_SIZE, GameOutcome } from '../types';
import type { Cell, Puzzle } from '../types';

interface RawLevel {
  id: number;
  solution: Cell[];
  rowSums: number[];
  colSums: number[];
  filledCount: number;
  seed: number;
  guessBudget: number;
  preLockedCellCount: number;
}

const levels = (
  JSON.parse(readFileSync(resolve(__dirname, '../../../../public/levels.json'), 'utf8')) as {
    levels: RawLevel[];
  }
).levels;

function tutorialStart(): ActiveGameState {
  const l = levels[TUTORIAL_LEVEL_ID]!;
  return startingBoard(
    {
      solution: l.solution,
      rowSums: l.rowSums,
      colSums: l.colSums,
      filledCount: l.filledCount,
      seed: l.seed,
    },
    l,
  );
}

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
  return { solution, rowSums, colSums, filledCount: solutionIndices.length, seed: 0 };
}

describe('the tutorial level as shipped', () => {
  const start = tutorialStart();
  const forced = findForcedLine(start);

  it('starts with one solved row to point at', () => {
    const row = findSolvedRow(start);
    expect(row).not.toBeNull();
    expect(row!.axis).toBe(LineAxis.Row);
    expect(start.puzzle.rowSums[row!.index]).toBe(Math.max(...start.puzzle.rowSums));
  });

  it('has a line the player can fill with certainty, and it is really all filled', () => {
    expect(forced).not.toBeNull();
    expect(forced!.open.length).toBeGreaterThanOrEqual(2);
    expect(forced!.need).toBe(forced!.open.length);
    for (const i of forced!.open) expect(start.puzzle.solution[i], `cell ${i}`).toBe(1);
  });

  it('walks a new player from reading the clues to a win', () => {
    expect(coachView(start, 0, forced)!.step).toBe(CoachStep.Clues);
    expect(coachView(start, 0, forced)!.rows).toHaveLength(GRID_SIZE);

    const row = coachView(start, 1, forced)!;
    expect(row.step).toBe(CoachStep.SolvedRow);
    expect(row.cells).toEqual(findSolvedRow(start)!.cells);
    // Level 1: the solved row completes two columns, which start dashed out.
    expect(row.cols.length).toBeGreaterThan(0);

    const fill = coachView(start, 2, forced)!;
    expect(fill.step).toBe(CoachStep.ForcedLine);
    expect(fill.cells).toEqual(forced!.open);
    expect(fill.text).toContain(`needs ${forced!.need}`);

    let s = start;
    for (const i of forced!.open) s = toggleMark(s, i);
    expect(isLineMarked(s, forced!)).toBe(true);
    const place = coachView(s, 2, forced)!;
    expect(place.step).toBe(CoachStep.Place);
    expect(place.cells).toHaveLength(0);
    expect(place.text).toContain(`${s.puzzle.filledCount - markedCount(s)} marks left`);

    for (let i = 0; i < CELL_COUNT; i++) {
      if (s.puzzle.solution[i] === 1 && s.currentMarks[i] !== 1) s = toggleMark(s, i);
    }
    expect(coachView(s, 3, forced)!.step).toBe(CoachStep.Submit);
    expect(coachView(submitGuess(s), 3, forced)).toBeNull();
  });

  it('tells a player who placed every mark their own way to submit', () => {
    // Every mark is on the board, none of them on the line the coach points at.
    let s = start;
    const elsewhere = [...Array(CELL_COUNT).keys()].filter(
      i => !forced!.open.includes(i) && s.currentMarks[i] !== 1,
    );
    for (const i of elsewhere) s = toggleMark(s, i);
    expect(markedCount(s)).toBe(s.puzzle.filledCount);
    expect(coachView(s, 2, forced)!.step).toBe(CoachStep.Submit);
  });

  it('explains the result after a guess that did not win', () => {
    let s = start;
    for (const i of forced!.open) s = toggleMark(s, i);
    s = submitGuess(s);
    expect(s.outcome).toBe(GameOutcome.InProgress);
    const after = coachView(s, 3, forced)!;
    expect(after.step).toBe(CoachStep.Feedback);
    expect(after.cells).toHaveLength(0);
    // A guess already made wins over wherever the reading had got to.
    expect(coachView(s, 0, forced)!.step).toBe(CoachStep.Feedback);
  });
});

describe('findForcedLine', () => {
  it('finds a column that needs every one of its open cells', () => {
    // Column 0 is full; with its top cell given, five open cells need five.
    const puzzle = makePuzzle([0, 6, 12, 18, 24, 30, 1]);
    const state = initialGameState({ puzzle, guessBudget: 5, preLockedCells: [0] });
    const forced = findForcedLine(state)!;
    expect(forced.line).toEqual(hintLine(GRID_SIZE)!);
    expect(forced.open).toEqual([6, 12, 18, 24, 30]);
    expect(forced.need).toBe(5);
  });

  it('is null when no line is certain', () => {
    const puzzle = makePuzzle([0, 1, 6, 8, 13, 15, 20, 22, 27, 29, 34, 35]);
    expect(findForcedLine(initialGameState({ puzzle, guessBudget: 5 }))).toBeNull();
  });

  it('ignores lines that are already finished', () => {
    const puzzle = makePuzzle([0, 1, 2, 3, 4, 5]);
    const state = applyHint(initialGameState({ puzzle, guessBudget: 5 }), hintLine(0)!.cells);
    expect(findForcedLine(state)).toBeNull();
  });
});

describe('coachView without a forced line', () => {
  it('goes straight from the reading steps to placing marks', () => {
    const puzzle = makePuzzle([0, 1, 6, 8, 13, 15, 20, 22, 27, 29, 34, 35]);
    const state = initialGameState({ puzzle, guessBudget: 5 });
    expect(findSolvedRow(state)).toBeNull();
    expect(coachView(state, 1, null)!.step).toBe(CoachStep.Place);
    expect(coachView(state, 2, null)!.step).toBe(CoachStep.Place);
  });

  it('says one mark, not one marks', () => {
    const puzzle = makePuzzle([0, 7]);
    const state = toggleMark(initialGameState({ puzzle, guessBudget: 5 }), 0);
    expect(coachView(state, 3, null)!.text).toContain('1 mark left');
  });
});
