import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initialGameState, markedCount, submitGuess, toggleMark, toggleNote } from '../game-state';
import type { ActiveGameState } from '../game-state';
import { startingBoard } from '../startingBoard';
import {
  TUTORIAL_LEVEL_ID,
  TourAction,
  TourStepKind,
  firstTourStep,
  isTourStepDone,
  nextTourStep,
  tourTargets,
} from '../tutorial';
import type { TourStep } from '../tutorial';
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

const mark = (state: ActiveGameState, cells: readonly number[]): ActiveGameState =>
  cells.reduce(toggleMark, state);
const pencil = (state: ActiveGameState, cells: readonly number[]): ActiveGameState =>
  cells.reduce(toggleNote, state);
const wordCount = (text: string): number => text.trim().split(/\s+/).length;

interface Walk {
  readonly end: ActiveGameState;
  readonly steps: readonly TourStep[];
}

/** Does what each step asks, as a player following the tour would. */
function walk(start: ActiveGameState, guess: (offered: readonly number[]) => number[]): Walk {
  const steps: TourStep[] = [];
  let state = start;
  let step = firstTourStep(state);
  while (step && steps.length < 40) {
    steps.push(step);
    switch (step.kind) {
      case TourStepKind.Clue:
        break;
      case TourStepKind.Line:
        state = mark(state, step.cells);
        break;
      case TourStepKind.RuleOut:
        state = pencil(state, step.notes);
        break;
      case TourStepKind.Guess:
        state = mark(state, guess(step.cells));
        break;
      case TourStepKind.Check:
        state = submitGuess(state);
        break;
    }
    if (step.kind !== TourStepKind.Clue) expect(isTourStepDone(step, state)).toBe(true);
    step = nextTourStep(state);
  }
  return { end: state, steps };
}

const kinds = (w: Walk): TourStepKind[] => w.steps.map(s => s.kind);

describe('the tour on level 1 as shipped', () => {
  const start = tutorialStart();
  const TWIN = [11, 26];

  it('opens on the row solved for the player and says what its number means', () => {
    const step = firstTourStep(start)!;
    expect(step.kind).toBe(TourStepKind.Clue);
    expect(step.action).toBe(TourAction.Button);
    expect(step.button).toBe('Next');
    expect(step.lines).toEqual([3]);
    expect(step.cells).toEqual([]);
    expect(step.text).toBe('Find the hidden beavers. This row has 5.');
    // Reading it changes nothing on the board: only the button moves on.
    expect(isTourStepDone(step, start)).toBe(false);
  });

  it('then has the player fill a row that needs every one of its free cells', () => {
    const step = nextTourStep(start)!;
    expect(step.kind).toBe(TourStepKind.Line);
    expect(step.action).toBe(TourAction.Mark);
    expect(step.button).toBeNull();
    expect(step.lines).toEqual([5]);
    expect(step.cells).toEqual([30, 31, 32, 35]);
    expect(step.text).toBe('4 beavers, 4 free cells. Tap them.');
    for (const i of step.cells) expect(start.puzzle.solution[i], `cell ${i}`).toBe(1);

    expect(isTourStepDone(step, start)).toBe(false);
    expect(isTourStepDone(step, mark(start, [30, 31, 32]))).toBe(false);
    expect(isTourStepDone(step, mark(start, [30, 31, 32, 35]))).toBe(true);
  });

  it('then rules out the rest of a column that has all its beavers', () => {
    const marked = mark(start, [30, 31, 32, 35]);
    const step = nextTourStep(marked)!;
    expect(step.kind).toBe(TourStepKind.RuleOut);
    expect(step.action).toBe(TourAction.Button);
    expect(step.button).toBe('Rule them out');
    expect(step.lines).toEqual([GRID_SIZE]);
    expect(step.notes).toEqual([0, 6, 12, 24]);
    expect(step.cells).toEqual([]);
    expect(step.text).toBe('This column has its 1 beaver. The rest are empty.');
    for (const i of step.notes) expect(marked.puzzle.solution[i], `cell ${i}`).toBe(0);

    expect(isTourStepDone(step, marked)).toBe(false);
    expect(isTourStepDone(step, pencil(marked, [0, 6, 12, 24]))).toBe(true);
  });

  it('after that, the next row is again one that needs all its free cells', () => {
    const state = pencil(mark(start, [30, 31, 32, 35]), [0, 6, 12, 24]);
    const step = nextTourStep(state)!;
    expect(step.kind).toBe(TourStepKind.Line);
    expect(step.lines).toEqual([2]);
    expect(step.cells).toEqual([13, 14, 17]);
    expect(step.text).toBe('3 beavers, 3 free cells. Tap them.');
  });

  it('asks for a guess only where the numbers cannot decide', () => {
    const w = walk(start, offered => offered.slice(0, 2));
    const guess = w.steps.find(s => s.kind === TourStepKind.Guess)!;
    expect(guess.action).toBe(TourAction.Mark);
    expect(guess.lines).toEqual([1, 4]);
    expect(guess.cells).toEqual([8, 11, 26, 29]);
    expect(guess.text).toBe('1 beaver, 2 free cells. Guess one in each row!');
    // Before it, everything asked for was certain and true.
    const before = w.steps.slice(0, w.steps.indexOf(guess));
    for (const s of before) {
      for (const i of s.cells) expect(start.puzzle.solution[i], `marked cell ${i}`).toBe(1);
      for (const i of s.notes) expect(start.puzzle.solution[i], `pencilled cell ${i}`).toBe(0);
    }
    expect(before.map(s => s.kind)).toEqual([
      TourStepKind.Clue,
      TourStepKind.Line,
      TourStepKind.RuleOut,
      TourStepKind.Line,
      TourStepKind.RuleOut,
      TourStepKind.Line,
    ]);
  });

  it('points at the cells still to be marked, and at nothing once they are', () => {
    const line = nextTourStep(start)!;
    expect(tourTargets(line, start)).toEqual([30, 31, 32, 35]);
    expect(tourTargets(line, mark(start, [30, 32]))).toEqual([31, 35]);
    expect(tourTargets(line, mark(start, [30, 31, 32, 35]))).toEqual([]);
    expect(tourTargets(firstTourStep(start)!, start)).toEqual([]);
  });

  it('takes one guess in each row: a row that has its mark offers no more cells', () => {
    const w = walk(start, offered => offered.slice(0, 2));
    const guess = w.steps.find(s => s.kind === TourStepKind.Guess)!;
    // The board as it was when the guess was asked for: everything certain is marked.
    const before = w.steps
      .slice(0, w.steps.indexOf(guess))
      .reduce((state, s) => pencil(mark(state, s.cells), s.notes), start);
    expect(tourTargets(guess, before)).toEqual([8, 11, 26, 29]);
    expect(tourTargets(guess, mark(before, [8]))).toEqual([26, 29]);
    expect(tourTargets(guess, mark(before, [29]))).toEqual([8, 11]);
    expect(tourTargets(guess, mark(before, [8, 26]))).toEqual([]);
  });

  it('asks for the check once every mark is placed, and says how many guesses there are', () => {
    const w = walk(start, () => TWIN);
    const checks = w.steps.filter(s => s.kind === TourStepKind.Check);
    expect(checks).toHaveLength(2);
    expect(checks[0]!.action).toBe(TourAction.Submit);
    expect(checks[0]!.text).toBe('Tap here to check. You get 5 guesses.');
    expect(checks[0]!.guesses).toBe(0);
    expect(checks[1]!.text).toBe('Check again.');
    expect(checks[1]!.guesses).toBe(1);
  });

  it('explains the ✕ after a wrong guess and points at what is left', () => {
    const both = walk(start, () => TWIN);
    const fixBoth = both.steps[both.steps.length - 2]!;
    expect(fixBoth.kind).toBe(TourStepKind.Line);
    expect(fixBoth.lines).toEqual([1, 4]);
    expect(fixBoth.cells).toEqual([8, 29]);
    expect(fixBoth.text).toBe("✕ means no beaver. So they're here.");

    const one = walk(start, () => [8, 11]);
    const fixOne = one.steps[one.steps.length - 2]!;
    expect(fixOne.kind).toBe(TourStepKind.Line);
    expect(fixOne.lines).toEqual([4]);
    expect(fixOne.cells).toEqual([29]);
    expect(fixOne.text).toBe("✕ means no beaver. So it's here.");
  });

  it('ends in a win within two guesses, whichever way the guess goes', () => {
    const offered = [8, 11, 26, 29];
    for (let a = 0; a < offered.length; a++) {
      for (let b = a + 1; b < offered.length; b++) {
        const pick = [offered[a]!, offered[b]!];
        const w = walk(start, () => pick);
        expect(w.end.outcome, `guess ${pick.join(',')}`).toBe(GameOutcome.Won);
        expect(w.end.guesses.length, `guess ${pick.join(',')}`).toBeLessThanOrEqual(2);
        expect(kinds(w).at(-1)).toBe(TourStepKind.Check);
      }
    }
    // The right guess wins at once.
    expect(walk(start, () => [8, 29]).end.guesses).toHaveLength(1);
  });

  it('never puts more than ten words on screen', () => {
    const texts = new Set<string>();
    for (const pick of [TWIN, [8, 29], [8, 11], [26, 29]]) {
      for (const s of walk(start, () => pick).steps) {
        texts.add(s.text);
        if (s.button) texts.add(s.button);
      }
    }
    for (const text of texts) expect(wordCount(text), text).toBeLessThanOrEqual(10);
  });

  it('is over when the puzzle is', () => {
    const won = walk(start, () => [8, 29]).end;
    expect(nextTourStep(won)).toBeNull();
    expect(firstTourStep(won)).toBeNull();
  });
});

describe('the tour on other boards', () => {
  it('starts with the first thing to do when no row is solved for the player', () => {
    const puzzle = makePuzzle([0, 7]);
    const state = initialGameState({ puzzle, guessBudget: 5 });
    const step = firstTourStep(state)!;
    expect(step).toEqual(nextTourStep(state));
    expect(step.kind).toBe(TourStepKind.Guess);
    expect(step.lines).toEqual([0, 1]);
    expect(step.cells).toEqual([0, 1, 6, 7]);
  });

  it('says one beaver and one cell when that is what there is', () => {
    const puzzle = makePuzzle([0, 7]);
    const state = initialGameState({ puzzle, guessBudget: 5, preLockedCells: [0] });
    const step = nextTourStep(state)!;
    expect(step.kind).toBe(TourStepKind.Line);
    expect(step.cells).toEqual([7]);
    expect(step.text).toBe('1 beaver, 1 free cell. Tap it.');
  });

  it('takes the longest certain line first', () => {
    // With its first cell given, row 0 needs all five of its free cells. Column 5
    // needs both of its two, a shorter certain line.
    const puzzle = makePuzzle([0, 1, 2, 3, 4, 5, 11]);
    const state = initialGameState({ puzzle, guessBudget: 5, preLockedCells: [0] });
    const step = nextTourStep(state)!;
    expect(step.kind).toBe(TourStepKind.Line);
    expect(step.lines).toEqual([0]);
    expect(step.cells).toEqual([1, 2, 3, 4, 5]);
  });

  it('rules out a row as readily as a column, down to a single cell', () => {
    const puzzle = makePuzzle([0, 1, 2, 3, 4, 11]);
    const state = mark(initialGameState({ puzzle, guessBudget: 5 }), [0, 1, 2, 3, 4]);
    const step = nextTourStep(state)!;
    expect(step.kind).toBe(TourStepKind.RuleOut);
    expect(step.lines).toEqual([0]);
    expect(step.notes).toEqual([5]);
    expect(step.text).toBe('This row has its 5 beavers. The last cell is empty.');
    expect(step.button).toBe('Rule it out');
  });

  it('falls back to counting what is left when the lines to guess in differ', () => {
    // Rows 0 and 1 hold one each, row 2 holds two: nothing certain, nothing uniform.
    const puzzle = makePuzzle([0, 7, 14, 15]);
    const state = initialGameState({ puzzle, guessBudget: 5 });
    const step = nextTourStep(state)!;
    expect(step.kind).toBe(TourStepKind.Guess);
    expect(step.text).toBe("4 beavers left. The numbers can't say where. Guess!");
  });

  it('asks for the check when every mark is placed, however that came about', () => {
    const puzzle = makePuzzle([0, 7]);
    const state = mark(initialGameState({ puzzle, guessBudget: 3 }), [1, 6]);
    expect(markedCount(state)).toBe(2);
    const step = nextTourStep(state)!;
    expect(step.kind).toBe(TourStepKind.Check);
    expect(step.text).toBe('Tap here to check. You get 3 guesses.');
    expect(isTourStepDone(step, state)).toBe(false);
    expect(isTourStepDone(step, submitGuess(state))).toBe(true);
  });
});
