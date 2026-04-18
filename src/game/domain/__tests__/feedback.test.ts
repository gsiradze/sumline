import { describe, expect, it } from 'vitest';
import { computeFeedback, isWinningFeedback, lockedFromHistory } from '../feedback';
import { CELL_COUNT, Feedback } from '../types';
import type { Grid } from '../types';

const allEmpty: Grid = new Array<0 | 1>(CELL_COUNT).fill(0);
const allFilled: Grid = new Array<0 | 1>(CELL_COUNT).fill(1);

function gridOf(indices: readonly number[]): Grid {
  const out = new Array<0 | 1>(CELL_COUNT).fill(0);
  for (const i of indices) out[i] = 1;
  return out;
}

describe('computeFeedback', () => {
  it('returns all green when guess matches solution exactly', () => {
    const solution = gridOf([0, 6, 12, 18, 24]);
    const fb = computeFeedback(solution, solution);
    expect(fb).toHaveLength(CELL_COUNT);
    expect(fb.every(f => f === Feedback.Green)).toBe(true);
  });

  it('returns all red when guess is the inverse of solution', () => {
    const solution = gridOf([0, 6, 12, 18, 24]);
    const inverse: Grid = solution.map(c => (c === 1 ? 0 : 1));
    const fb = computeFeedback(inverse, solution);
    expect(fb.every(f => f === Feedback.Red)).toBe(true);
  });

  it('returns all green for empty guess against empty solution', () => {
    const fb = computeFeedback(allEmpty, allEmpty);
    expect(fb.every(f => f === Feedback.Green)).toBe(true);
  });

  it('returns all green for all-filled guess against all-filled solution', () => {
    const fb = computeFeedback(allFilled, allFilled);
    expect(fb.every(f => f === Feedback.Green)).toBe(true);
  });

  it('returns correct per-cell feedback for a mixed guess', () => {
    const solution = gridOf([0, 1, 2]);
    const guess = gridOf([0, 2, 5]);
    const fb = computeFeedback(guess, solution);
    expect(fb[0]).toBe(Feedback.Green);
    expect(fb[1]).toBe(Feedback.Red);
    expect(fb[2]).toBe(Feedback.Green);
    expect(fb[5]).toBe(Feedback.Red);
    expect(fb[6]).toBe(Feedback.Green);
  });

  it('throws on wrong-length inputs', () => {
    expect(() => computeFeedback([0, 1], allEmpty)).toThrow();
    expect(() => computeFeedback(allEmpty, [0, 1])).toThrow();
  });
});

describe('isWinningFeedback', () => {
  it('is true when all cells are green', () => {
    const fb = new Array<Feedback>(CELL_COUNT).fill(Feedback.Green);
    expect(isWinningFeedback(fb)).toBe(true);
  });

  it('is false when any cell is red', () => {
    const fb = new Array<Feedback>(CELL_COUNT).fill(Feedback.Green);
    fb[12] = Feedback.Red;
    expect(isWinningFeedback(fb)).toBe(false);
  });

  it('is false for empty or wrong-length feedback', () => {
    expect(isWinningFeedback([])).toBe(false);
    expect(isWinningFeedback([Feedback.Green])).toBe(false);
  });
});

describe('lockedFromHistory', () => {
  it('returns all false when no history', () => {
    const locked = lockedFromHistory([]);
    expect(locked).toHaveLength(CELL_COUNT);
    expect(locked.every(b => b === false)).toBe(true);
  });

  it('locks any cell that was green in at least one past guess', () => {
    const fb1 = new Array<Feedback>(CELL_COUNT).fill(Feedback.Red);
    fb1[0] = Feedback.Green;
    fb1[5] = Feedback.Green;
    const fb2 = new Array<Feedback>(CELL_COUNT).fill(Feedback.Red);
    fb2[5] = Feedback.Red;
    fb2[10] = Feedback.Green;
    const locked = lockedFromHistory([fb1, fb2]);
    expect(locked[0]).toBe(true);
    expect(locked[5]).toBe(true);
    expect(locked[10]).toBe(true);
    expect(locked[1]).toBe(false);
  });
});
