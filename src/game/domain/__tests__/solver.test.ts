import { describe, expect, it } from 'vitest';
import { CELL_COUNT } from '../types';
import type { Grid } from '../types';
import { colSums, countSolutions, isUniquelySolvableFromSums, rowSums } from '../solver';

function gridOf(indices: readonly number[]): Grid {
  const g = new Array<0 | 1>(CELL_COUNT).fill(0);
  for (const i of indices) g[i] = 1;
  return g;
}

describe('rowSums & colSums', () => {
  it('returns zeros for an empty grid', () => {
    const g = gridOf([]);
    expect(rowSums(g)).toEqual([0, 0, 0, 0, 0]);
    expect(colSums(g)).toEqual([0, 0, 0, 0, 0]);
  });

  it('returns fives for a fully filled grid', () => {
    const g: Grid = new Array<0 | 1>(CELL_COUNT).fill(1);
    expect(rowSums(g)).toEqual([5, 5, 5, 5, 5]);
    expect(colSums(g)).toEqual([5, 5, 5, 5, 5]);
  });

  it('computes sums for a diagonal pattern', () => {
    const g = gridOf([0, 6, 12, 18, 24]);
    expect(rowSums(g)).toEqual([1, 1, 1, 1, 1]);
    expect(colSums(g)).toEqual([1, 1, 1, 1, 1]);
  });

  it('computes sums for a row-concentrated pattern', () => {
    const g = gridOf([0, 1, 2, 3, 4]);
    expect(rowSums(g)).toEqual([5, 0, 0, 0, 0]);
    expect(colSums(g)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('countSolutions', () => {
  it('returns 1 when sums uniquely determine the grid', () => {
    const rows = [5, 0, 0, 0, 0];
    const cols = [1, 1, 1, 1, 1];
    expect(countSolutions(rows, cols)).toBe(1);
  });

  it('returns 0 when sums are inconsistent (row sum total != col sum total)', () => {
    expect(countSolutions([5, 0, 0, 0, 0], [2, 1, 1, 1, 0])).toBe(0);
  });

  it('returns at least 2 for a grid with multiple valid completions', () => {
    const rows = [1, 1, 1, 1, 1];
    const cols = [1, 1, 1, 1, 1];
    expect(countSolutions(rows, cols, 2)).toBe(2);
  });

  it('short-circuits at maxSolutions', () => {
    const rows = [2, 2, 2, 2, 2];
    const cols = [2, 2, 2, 2, 2];
    const capped = countSolutions(rows, cols, 2);
    expect(capped).toBe(2);
  });

  it('rejects malformed inputs', () => {
    expect(() => countSolutions([1, 2], [1, 1, 1, 1, 1])).toThrow();
    expect(() => countSolutions([1, 1, 1, 1, 1], [1, 2])).toThrow();
  });

  it('handles all-zero sums', () => {
    expect(countSolutions([0, 0, 0, 0, 0], [0, 0, 0, 0, 0])).toBe(1);
  });

  it('handles all-five sums', () => {
    expect(countSolutions([5, 5, 5, 5, 5], [5, 5, 5, 5, 5])).toBe(1);
  });
});

describe('isUniquelySolvableFromSums', () => {
  it('returns true for all-empty and all-filled grids', () => {
    expect(isUniquelySolvableFromSums(gridOf([]))).toBe(true);
    expect(isUniquelySolvableFromSums(new Array<0 | 1>(CELL_COUNT).fill(1))).toBe(true);
  });

  it('returns true when row/col sums force a single solution', () => {
    // rows=[5,0,0,0,0], cols=[1,1,1,1,1] — first row filled, rest must be empty.
    const g = gridOf([0, 1, 2, 3, 4]);
    expect(isUniquelySolvableFromSums(g)).toBe(true);
  });

  it('returns true for a 2x2 corner block (uniquely determined)', () => {
    // rows=[2,2,0,0,0], cols=[2,2,0,0,0] — must fill the top-left 2x2 entirely.
    const g = gridOf([0, 1, 5, 6]);
    expect(isUniquelySolvableFromSums(g)).toBe(true);
  });

  it('returns false for the main diagonal (permutation-matrix ambiguity)', () => {
    // rows=[1,1,1,1,1], cols=[1,1,1,1,1] — 5! = 120 valid permutation matrices.
    const g = gridOf([0, 6, 12, 18, 24]);
    expect(isUniquelySolvableFromSums(g)).toBe(false);
  });

  it('returns false for a 2x2 diagonal pair (corner-swap ambiguity)', () => {
    // rows=[1,1,0,0,0], cols=[1,1,0,0,0] — two solutions: {(0,0),(1,1)} and {(0,1),(1,0)}.
    const g = gridOf([0, 6]);
    expect(isUniquelySolvableFromSums(g)).toBe(false);
  });
});
