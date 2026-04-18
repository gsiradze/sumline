import { GRID_SIZE } from './types';
import type { Grid } from './types';

export function rowSums(grid: Grid): number[] {
  const sums = new Array<number>(GRID_SIZE).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    let sum = 0;
    for (let c = 0; c < GRID_SIZE; c++) {
      sum += grid[r * GRID_SIZE + c] ?? 0;
    }
    sums[r] = sum;
  }
  return sums;
}

export function colSums(grid: Grid): number[] {
  const sums = new Array<number>(GRID_SIZE).fill(0);
  for (let c = 0; c < GRID_SIZE; c++) {
    let sum = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      sum += grid[r * GRID_SIZE + c] ?? 0;
    }
    sums[c] = sum;
  }
  return sums;
}

export function countSolutions(
  rows: readonly number[],
  cols: readonly number[],
  maxSolutions = 2,
): number {
  if (rows.length !== GRID_SIZE || cols.length !== GRID_SIZE) {
    throw new Error(`rows and cols must have exactly ${GRID_SIZE} entries`);
  }
  const rowPatterns: number[][] = rows.map(patternsForSum);
  const colTargets = [...cols];
  const partialCols = new Array<number>(GRID_SIZE).fill(0);
  let count = 0;

  const backtrack = (rowIdx: number): boolean => {
    if (rowIdx === GRID_SIZE) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (partialCols[c] !== colTargets[c]) return false;
      }
      count++;
      return count >= maxSolutions;
    }
    const patterns = rowPatterns[rowIdx] ?? [];
    const rowsLeftAfterThis = GRID_SIZE - rowIdx - 1;
    for (const pattern of patterns) {
      let feasible = true;
      for (let c = 0; c < GRID_SIZE; c++) {
        const bit = (pattern >>> c) & 1;
        const target = colTargets[c] ?? 0;
        const partial = partialCols[c] ?? 0;
        const next = partial + bit;
        if (next > target) {
          feasible = false;
          break;
        }
        if (next + rowsLeftAfterThis < target) {
          feasible = false;
          break;
        }
      }
      if (!feasible) continue;
      for (let c = 0; c < GRID_SIZE; c++) {
        partialCols[c] = (partialCols[c] ?? 0) + ((pattern >>> c) & 1);
      }
      const done = backtrack(rowIdx + 1);
      for (let c = 0; c < GRID_SIZE; c++) {
        partialCols[c] = (partialCols[c] ?? 0) - ((pattern >>> c) & 1);
      }
      if (done) return true;
    }
    return false;
  };

  backtrack(0);
  return count;
}

export function isUniquelySolvableFromSums(grid: Grid): boolean {
  return countSolutions(rowSums(grid), colSums(grid), 2) === 1;
}

function patternsForSum(sum: number): number[] {
  const patterns: number[] = [];
  const max = 1 << GRID_SIZE;
  for (let n = 0; n < max; n++) {
    if (popcount(n) === sum) patterns.push(n);
  }
  return patterns;
}

function popcount(n: number): number {
  let x = n;
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
