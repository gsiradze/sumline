import { describe, expect, it } from 'vitest';
import { CELL_COUNT, GRID_SIZE } from '../types';
import type { Grid } from '../types';
import { colSums, countSolutions, isUniquelySolvableFromSums, rowSums } from '../solver';

function gridOf(indices: readonly number[]): Grid {
  const g = new Array<0 | 1>(CELL_COUNT).fill(0);
  for (const i of indices) g[i] = 1;
  return g;
}

function uniform(value: number): number[] {
  return new Array<number>(GRID_SIZE).fill(value);
}

const firstRowIndices = Array.from({ length: GRID_SIZE }, (_, i) => i);
const mainDiagonalIndices = Array.from({ length: GRID_SIZE }, (_, i) => i * (GRID_SIZE + 1));

describe('rowSums & colSums', () => {
  it('returns zeros for an empty grid', () => {
    const g = gridOf([]);
    expect(rowSums(g)).toEqual(uniform(0));
    expect(colSums(g)).toEqual(uniform(0));
  });

  it('returns GRID_SIZE for a fully filled grid', () => {
    const g: Grid = new Array<0 | 1>(CELL_COUNT).fill(1);
    expect(rowSums(g)).toEqual(uniform(GRID_SIZE));
    expect(colSums(g)).toEqual(uniform(GRID_SIZE));
  });

  it('computes sums for a diagonal pattern', () => {
    const g = gridOf(mainDiagonalIndices);
    expect(rowSums(g)).toEqual(uniform(1));
    expect(colSums(g)).toEqual(uniform(1));
  });

  it('computes sums for a row-concentrated pattern', () => {
    const g = gridOf(firstRowIndices);
    const expectedRow = uniform(0);
    expectedRow[0] = GRID_SIZE;
    expect(rowSums(g)).toEqual(expectedRow);
    expect(colSums(g)).toEqual(uniform(1));
  });
});

describe('countSolutions', () => {
  it('returns 1 when sums uniquely determine the grid', () => {
    const rows = uniform(0);
    rows[0] = GRID_SIZE;
    const cols = uniform(1);
    expect(countSolutions(rows, cols)).toBe(1);
  });

  it('returns 0 when sums are inconsistent (row sum total != col sum total)', () => {
    const rows = uniform(0);
    rows[0] = GRID_SIZE;
    const cols = uniform(1);
    cols[0] = 2;
    expect(countSolutions(rows, cols)).toBe(0);
  });

  it('returns at least 2 for a grid with multiple valid completions', () => {
    expect(countSolutions(uniform(1), uniform(1), 2)).toBe(2);
  });

  it('short-circuits at maxSolutions', () => {
    const capped = countSolutions(uniform(2), uniform(2), 2);
    expect(capped).toBe(2);
  });

  it('rejects malformed inputs', () => {
    expect(() => countSolutions([1, 2], uniform(1))).toThrow();
    expect(() => countSolutions(uniform(1), [1, 2])).toThrow();
  });

  it('handles all-zero sums', () => {
    expect(countSolutions(uniform(0), uniform(0))).toBe(1);
  });

  it('handles all-GRID_SIZE sums', () => {
    expect(countSolutions(uniform(GRID_SIZE), uniform(GRID_SIZE))).toBe(1);
  });
});

describe('isUniquelySolvableFromSums', () => {
  it('returns true for all-empty and all-filled grids', () => {
    expect(isUniquelySolvableFromSums(gridOf([]))).toBe(true);
    expect(isUniquelySolvableFromSums(new Array<0 | 1>(CELL_COUNT).fill(1))).toBe(true);
  });

  it('returns true when row/col sums force a single solution', () => {
    const g = gridOf(firstRowIndices);
    expect(isUniquelySolvableFromSums(g)).toBe(true);
  });

  it('returns true for a 2x2 corner block (uniquely determined)', () => {
    // top-left 2x2 filled: rows=[2,2,0,...], cols=[2,2,0,...]
    const indices = [0, 1, GRID_SIZE, GRID_SIZE + 1];
    expect(isUniquelySolvableFromSums(gridOf(indices))).toBe(true);
  });

  it('returns false for the main diagonal (permutation-matrix ambiguity)', () => {
    expect(isUniquelySolvableFromSums(gridOf(mainDiagonalIndices))).toBe(false);
  });

  it('returns false for a 2x2 diagonal pair (corner-swap ambiguity)', () => {
    expect(isUniquelySolvableFromSums(gridOf([0, GRID_SIZE + 1]))).toBe(false);
  });
});
