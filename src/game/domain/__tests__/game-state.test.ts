import { describe, expect, it } from 'vitest';
import {
  applyHint,
  canSubmit,
  canToggle,
  guessesRemaining,
  guessesUsed,
  initialGameState,
  isCellLocked,
  markedCount,
  submitGuess,
  toggleMark,
} from '../game-state';
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

function ambiguousPuzzle(): Puzzle {
  // 6×6 offset-diagonal pattern: rowSums/colSums all 2 → ambiguous from sums.
  return makePuzzle([0, 1, 6, 8, 13, 15, 20, 22, 27, 29, 34, 35]);
}

describe('initialGameState', () => {
  it('starts with empty history and all-zero marks', () => {
    const p = makePuzzle([0, 6, 12, 18, 24]);
    const s = initialGameState({ puzzle: p, guessBudget: 6 });
    expect(s.puzzle).toBe(p);
    expect(s.guessBudget).toBe(6);
    expect(s.guesses).toHaveLength(0);
    expect(s.feedbacks).toHaveLength(0);
    expect(s.currentMarks).toHaveLength(CELL_COUNT);
    expect(s.currentMarks.every(m => m === 0)).toBe(true);
    expect(s.lockedFilled.every(b => b === false)).toBe(true);
    expect(s.lockedEmpty.every(b => b === false)).toBe(true);
    expect(s.outcome).toBe(GameOutcome.InProgress);
    expect(s.hintsUsed).toBe(0);
  });

  it('honors pre-locked cells by revealing their solution truth', () => {
    const p = makePuzzle([0, 6]);
    const s = initialGameState({ puzzle: p, guessBudget: 8, preLockedCells: [0, 1] });
    expect(s.lockedFilled[0]).toBe(true);
    expect(s.currentMarks[0]).toBe(1);
    expect(s.lockedEmpty[1]).toBe(true);
    expect(s.currentMarks[1]).toBe(0);
  });
});

describe('toggleMark', () => {
  it('flips the cell between 0 and 1 on toggle', () => {
    const s = initialGameState({ puzzle: makePuzzle([0]), guessBudget: 6 });
    const s1 = toggleMark(s, 3);
    expect(s1.currentMarks[3]).toBe(1);
    const s2 = toggleMark(s1, 3);
    expect(s2.currentMarks[3]).toBe(0);
  });

  it('returns the same state when outcome is not InProgress', () => {
    const base = initialGameState({ puzzle: makePuzzle([0]), guessBudget: 6 });
    const ended = { ...base, outcome: GameOutcome.Won };
    expect(toggleMark(ended, 0)).toBe(ended);
  });

  it('returns the same state when the cell is locked', () => {
    const base = initialGameState({ puzzle: makePuzzle([0]), guessBudget: 6 });
    const locked = {
      ...base,
      lockedFilled: base.lockedFilled.map((_, i) => i === 4),
    };
    expect(toggleMark(locked, 4)).toBe(locked);
  });

  it('ignores out-of-range indices', () => {
    const s = initialGameState({ puzzle: makePuzzle([0]), guessBudget: 6 });
    expect(toggleMark(s, -1)).toBe(s);
    expect(toggleMark(s, CELL_COUNT)).toBe(s);
  });
});

describe('submitGuess', () => {
  it('adds the guess + feedback to history and decrements remaining', () => {
    const p = makePuzzle([0, 6, 12, 18, 24]);
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    s = toggleMark(s, 0);
    s = submitGuess(s);
    expect(s.guesses).toHaveLength(1);
    expect(s.feedbacks).toHaveLength(1);
    expect(guessesUsed(s)).toBe(1);
    expect(guessesRemaining(s)).toBe(5);
  });

  it('locks correctly-marked cells as filled', () => {
    const p = makePuzzle([0]);
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    s = toggleMark(s, 0);
    s = submitGuess(s);
    expect(s.lockedFilled[0]).toBe(true);
    expect(s.lockedEmpty[0]).toBe(false);
  });

  it('does not lock unmarked cells without any earned info — only the player\'s marks get definitive feedback', () => {
    const p = ambiguousPuzzle();
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    s = submitGuess(s); // submit with zero marks
    for (let i = 0; i < CELL_COUNT; i++) {
      expect(s.lockedEmpty[i]).toBe(false);
      expect(s.lockedFilled[i]).toBe(false);
    }
  });

  it('locks wrongly-marked cells as empty (with the mark cleared)', () => {
    const p = makePuzzle([0]);
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    s = toggleMark(s, 5); // cell 5 is empty in truth but we mark it
    s = submitGuess(s);
    expect(s.lockedEmpty[5]).toBe(true);
    expect(s.lockedFilled[5]).toBe(false);
    expect(s.currentMarks[5]).toBe(0);
  });

  it('does not lock unmarked cells regardless of whether feedback would have been green or red', () => {
    const p = ambiguousPuzzle();
    const s0 = initialGameState({ puzzle: p, guessBudget: 6 });
    const s = submitGuess(s0);
    // cell 0 (truth=filled, unmarked): would be red → no lock
    expect(s.lockedFilled[0]).toBe(false);
    expect(s.lockedEmpty[0]).toBe(false);
    // cell 2 (truth=empty, unmarked): would be green → still no lock
    expect(s.lockedFilled[2]).toBe(false);
    expect(s.lockedEmpty[2]).toBe(false);
  });

  it('marks outcome Won when all 25 cells are green', () => {
    const p = makePuzzle([0, 6, 12, 18, 24]);
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    for (const i of [0, 6, 12, 18, 24]) s = toggleMark(s, i);
    s = submitGuess(s);
    expect(s.outcome).toBe(GameOutcome.Won);
  });

  it('marks outcome Lost after budget is exhausted without win', () => {
    const p = ambiguousPuzzle();
    let s = initialGameState({ puzzle: p, guessBudget: 4 });
    for (let g = 0; g < 4; g++) {
      // deliberately mark a cell that is empty in truth to avoid winning by accident
      s = toggleMark(s, 2);
      s = submitGuess(s);
      if (s.outcome === GameOutcome.Lost) break;
      s = toggleMark(s, 2);
    }
    expect(s.outcome).toBe(GameOutcome.Lost);
    expect(guessesUsed(s)).toBe(4);
  });

  it('is a no-op after the game has ended', () => {
    const p = makePuzzle([0]);
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    s = toggleMark(s, 0);
    s = submitGuess(s);
    expect(s.outcome).toBe(GameOutcome.Won);
    const after = submitGuess(s);
    expect(after).toBe(s);
  });

  it('does NOT auto-win when a wrong guess happens to be solvable via auto-clear + propagation', () => {
    // Regression for the Level-4 exploit: marking 16 cells with 3 wrong
    // positions gave 13 green + 3 red. Auto-clear zeroed the 3 reds and
    // the propagator then completed the board from row/col sums, yielding
    // nextMarks === solution → old code declared Won on the first guess.
    //
    // Solution for 6×6 Level 4:
    //   row 0: col 2           row 1: cols 0..4
    //   row 2: cols 1..5       row 3: col 1
    //   row 4: cols 1, 2, 4    row 5: col 1
    const idx = (r: number, c: number): number => r * GRID_SIZE + c;
    const solutionCells: number[] = [];
    for (const [r, cs] of [
      [0, [2]],
      [1, [0, 1, 2, 3, 4]],
      [2, [1, 2, 3, 4, 5]],
      [3, [1]],
      [4, [1, 2, 4]],
      [5, [1]],
    ] as const) {
      for (const c of cs) solutionCells.push(idx(r, c));
    }
    const p = makePuzzle(solutionCells);
    expect(p.filledCount).toBe(16);

    let s = initialGameState({
      puzzle: p,
      guessBudget: 8,
      preLockedCells: [idx(0, 0), idx(3, 5)],
    });

    // Player's marks from the screenshot: (0,1), all of row 1, all of row 2,
    // (3,1), (4,1), (5,1) — 16 marks, 3 of them wrong.
    const marks: number[] = [
      idx(0, 1),
      idx(1, 0), idx(1, 1), idx(1, 2), idx(1, 3), idx(1, 4), idx(1, 5),
      idx(2, 0), idx(2, 1), idx(2, 2), idx(2, 3), idx(2, 4), idx(2, 5),
      idx(3, 1),
      idx(4, 1),
      idx(5, 1),
    ];
    for (const m of marks) s = toggleMark(s, m);
    expect(markedCount(s)).toBe(16);

    s = submitGuess(s);
    expect(s.outcome).not.toBe(GameOutcome.Won);
    expect(s.outcome).toBe(GameOutcome.InProgress);
  });
});

describe('applyHint', () => {
  it('locks a filled cell to lockedFilled and marks it', () => {
    const p = makePuzzle([0]);
    const s = initialGameState({ puzzle: p, guessBudget: 6 });
    const after = applyHint(s, 0);
    expect(after.lockedFilled[0]).toBe(true);
    expect(after.currentMarks[0]).toBe(1);
    expect(after.hintsUsed).toBe(1);
  });

  it('locks an empty cell to lockedEmpty', () => {
    const p = makePuzzle([0]);
    const s = initialGameState({ puzzle: p, guessBudget: 6 });
    const after = applyHint(s, 5);
    expect(after.lockedEmpty[5]).toBe(true);
    expect(after.hintsUsed).toBe(1);
  });

  it('is a no-op on already-locked cells', () => {
    const p = makePuzzle([0]);
    const s = initialGameState({ puzzle: p, guessBudget: 6 });
    const after = applyHint(s, 0);
    const again = applyHint(after, 0);
    expect(again).toBe(after);
  });

  it('is a no-op when game is over', () => {
    const p = makePuzzle([0]);
    const base = initialGameState({ puzzle: p, guessBudget: 6 });
    const ended = { ...base, outcome: GameOutcome.Won };
    expect(applyHint(ended, 0)).toBe(ended);
  });
});

describe('helpers', () => {
  it('canToggle enforces outcome + lock', () => {
    const p = makePuzzle([0]);
    const s = initialGameState({ puzzle: p, guessBudget: 6 });
    expect(canToggle(s, 0)).toBe(true);
    const locked = { ...s, lockedFilled: s.lockedFilled.map((_, i) => i === 0) };
    expect(canToggle(locked, 0)).toBe(false);
    const ended = { ...s, outcome: GameOutcome.Won };
    expect(canToggle(ended, 0)).toBe(false);
  });

  it('canSubmit is true only in-progress', () => {
    const p = makePuzzle([0]);
    const s = initialGameState({ puzzle: p, guessBudget: 6 });
    expect(canSubmit(s)).toBe(true);
    expect(canSubmit({ ...s, outcome: GameOutcome.Won })).toBe(false);
    expect(canSubmit({ ...s, outcome: GameOutcome.Lost })).toBe(false);
  });

  it('isCellLocked reports filled or empty lock', () => {
    const p = makePuzzle([0]);
    const base = initialGameState({ puzzle: p, guessBudget: 6 });
    expect(isCellLocked(base, 0)).toBe(false);
    const f = { ...base, lockedFilled: base.lockedFilled.map((_, i) => i === 1) };
    expect(isCellLocked(f, 1)).toBe(true);
    const e = { ...base, lockedEmpty: base.lockedEmpty.map((_, i) => i === 2) };
    expect(isCellLocked(e, 2)).toBe(true);
  });

  it('markedCount counts 1s in currentMarks', () => {
    const p = makePuzzle([0, 7, 14]); // 3 filled → can mark up to 3
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    expect(markedCount(s)).toBe(0);
    s = toggleMark(s, 0);
    s = toggleMark(s, 7);
    expect(markedCount(s)).toBe(2);
  });

  it('toggleMark refuses new marks past the puzzle\'s filled-cell count', () => {
    const p = makePuzzle([0, 7]); // 2 filled
    let s = initialGameState({ puzzle: p, guessBudget: 6 });
    s = toggleMark(s, 3);
    s = toggleMark(s, 4);
    expect(markedCount(s)).toBe(2);
    // a third mark should be rejected
    s = toggleMark(s, 5);
    expect(markedCount(s)).toBe(2);
    expect(s.currentMarks[5]).toBe(0);
    // un-toggling is still allowed even at the cap
    s = toggleMark(s, 3);
    expect(markedCount(s)).toBe(1);
    // and now a new mark is allowed again
    s = toggleMark(s, 5);
    expect(markedCount(s)).toBe(2);
    expect(s.currentMarks[5]).toBe(1);
  });
});
