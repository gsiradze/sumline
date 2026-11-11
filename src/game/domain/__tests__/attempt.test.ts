import { describe, expect, it } from 'vitest';
import {
  encodeCells,
  guessEvent,
  hintEvent,
  isBlankAttempt,
  replayAttempt,
  snapshotOf,
} from '../attempt';
import type { AttemptEvent } from '../attempt';
import { applyHint, initialGameState, submitGuess, toggleMark, toggleNote } from '../game-state';
import type { ActiveGameState } from '../game-state';
import { hintLine } from '../hint';
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
  return { solution, rowSums, colSums, filledCount: solutionIndices.length, seed: 0 };
}

const SOLUTION = [0, 1, 6, 8, 13, 15, 20, 22, 27, 29, 34, 35];

function fresh(budget = 3): ActiveGameState {
  return initialGameState({ puzzle: makePuzzle(SOLUTION), guessBudget: budget });
}

// Plays moves and records them the way the UI hook does. A hint names its line (0–11).
function play(
  start: ActiveGameState,
  moves: readonly (['mark', number] | ['note', number] | ['submit'] | ['hint', number])[],
): { state: ActiveGameState; events: AttemptEvent[] } {
  let state = start;
  const events: AttemptEvent[] = [];
  for (const move of moves) {
    if (move[0] === 'mark') state = toggleMark(state, move[1]);
    else if (move[0] === 'note') state = toggleNote(state, move[1]);
    else if (move[0] === 'submit') {
      events.push(guessEvent(state));
      state = submitGuess(state);
    } else {
      events.push(hintEvent(move[1]));
      state = applyHint(state, hintLine(move[1])!.cells);
    }
  }
  return { state, events };
}

describe('attempt snapshot round trip', () => {
  it('restores an in-progress attempt exactly', () => {
    const { state, events } = play(fresh(4), [
      ['mark', 0],
      ['mark', 2],
      ['mark', 6],
      ['submit'],
      ['hint', 8],
      ['mark', 1],
      ['note', 30],
      ['mark', 31],
    ]);
    expect(state.outcome).toBe(GameOutcome.InProgress);
    const saved = JSON.parse(JSON.stringify(snapshotOf(state, events))) as unknown;
    const restored = replayAttempt(fresh(4), saved);
    expect(restored).not.toBeNull();
    expect(restored!.state).toEqual(state);
    expect(restored!.events).toEqual(events);
  });

  it('restores a lost attempt as lost, with every guess intact', () => {
    const { state, events } = play(fresh(2), [['mark', 2], ['submit'], ['mark', 3], ['submit']]);
    expect(state.outcome).toBe(GameOutcome.Lost);
    const restored = replayAttempt(fresh(2), snapshotOf(state, events));
    expect(restored!.state.outcome).toBe(GameOutcome.Lost);
    expect(restored!.state.guesses).toHaveLength(2);
    expect(restored!.state).toEqual(state);
  });

  it('keeps the pencil notes that were on the board when the attempt was lost', () => {
    const { state, events } = play(fresh(2), [
      ['note', 30],
      ['mark', 2],
      ['submit'],
      ['note', 31],
      ['mark', 3],
      ['submit'],
    ]);
    expect(state.outcome).toBe(GameOutcome.Lost);
    expect(state.emptyNotes[30]).toBe(true);
    const restored = replayAttempt(fresh(2), snapshotOf(state, events));
    expect(restored!.state).toEqual(state);
  });

  it('keeps an over-cap board over cap so the player still has to fix it', () => {
    const p = makePuzzle([0, 7]);
    const start = initialGameState({ puzzle: p, guessBudget: 4 });
    const { state, events } = play(start, [
      ['mark', 20],
      ['mark', 21],
      ['hint', 0],
    ]);
    const restored = replayAttempt(start, snapshotOf(state, events));
    expect(restored!.state).toEqual(state);
  });

  it('treats a snapshot with no moves, marks or notes as blank', () => {
    const start = fresh();
    expect(isBlankAttempt(start, snapshotOf(start, []))).toBe(true);
    expect(isBlankAttempt(start, snapshotOf(toggleNote(start, 4), []))).toBe(false);
    expect(isBlankAttempt(start, snapshotOf(toggleMark(start, 4), []))).toBe(false);
  });
});

describe('replayAttempt rejects anything it cannot trust', () => {
  const blank = encodeCells(new Array<boolean>(CELL_COUNT).fill(false));

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['wrong version', { v: 2, events: [], marks: blank, notes: blank }],
    ['events not an array', { v: 1, events: 'x', marks: blank, notes: blank }],
    ['short marks', { v: 1, events: [], marks: '0101', notes: blank }],
    ['non-binary notes', { v: 1, events: [], marks: blank, notes: blank.replace('0', '2') }],
    ['unknown event', { v: 1, events: [{ t: 'z' }], marks: blank, notes: blank }],
    ['bad guess payload', { v: 1, events: [{ t: 'g', m: 'short' }], marks: blank, notes: blank }],
    ['hint line out of range', { v: 1, events: [{ t: 'l', i: 12 }], marks: blank, notes: blank }],
    ['fractional hint line', { v: 1, events: [{ t: 'l', i: 1.5 }], marks: blank, notes: blank }],
    ['an old single-cell hint', { v: 1, events: [{ t: 'h', i: 0 }], marks: blank, notes: blank }],
    [
      'a hint that reveals nothing',
      {
        v: 1,
        events: [
          { t: 'l', i: 0 },
          { t: 'l', i: 0 },
        ],
        marks: blank,
        notes: blank,
      },
    ],
    [
      'too many events',
      {
        v: 1,
        events: new Array(65).fill({ t: 'l', i: 0 }),
        marks: blank,
        notes: blank,
      },
    ],
  ])('%s', (_label, raw) => {
    expect(replayAttempt(fresh(), raw)).toBeNull();
  });

  it('more guesses than the budget allows', () => {
    const g: AttemptEvent = { t: 'g', m: blank };
    const raw = { v: 1, events: [g, g, g, g], marks: blank, notes: blank };
    expect(replayAttempt(fresh(3), raw)).toBeNull();
  });

  it('a finished win (nothing left to resume)', () => {
    const { state, events } = play(fresh(3), [
      ...SOLUTION.map(i => ['mark', i] as ['mark', number]),
      ['submit'],
    ]);
    expect(state.outcome).toBe(GameOutcome.Won);
    expect(replayAttempt(fresh(3), snapshotOf(state, events))).toBeNull();
  });

  it('cannot be used to mark or note a locked cell', () => {
    const start = initialGameState({
      puzzle: makePuzzle(SOLUTION),
      guessBudget: 3,
      preLockedCells: [2],
    });
    const all = encodeCells(new Array<boolean>(CELL_COUNT).fill(true));
    const restored = replayAttempt(start, { v: 1, events: [], marks: all, notes: all });
    expect(restored!.state.currentMarks[2]).toBe(0);
    expect(restored!.state.emptyNotes[2]).toBe(false);
    expect(restored!.state.lockedEmpty[2]).toBe(true);
  });
});
