import { beforeAll, describe, expect, it } from 'vitest';
import { generatePuzzle } from '../puzzle';
import { seedForPuzzleId } from '../daily';
import { CELL_COUNT, MAX_FILLED, MIN_FILLED } from '../types';
import type { Puzzle } from '../types';
import { colSums, isUniquelySolvableFromSums, rowSums } from '../solver';

describe('generatePuzzle determinism', () => {
  it('returns the same puzzle for the same seed', () => {
    const seed = 42;
    const a = generatePuzzle(seed);
    const b = generatePuzzle(seed);
    expect(a.solution).toEqual(b.solution);
    expect(a.rowSums).toEqual(b.rowSums);
    expect(a.colSums).toEqual(b.colSums);
    expect(a.filledCount).toBe(b.filledCount);
  });

  it('is stable across 1000 runs with the same seed', () => {
    const seed = 2026_01_01;
    const first = generatePuzzle(seed);
    for (let i = 0; i < 1000; i++) {
      const again = generatePuzzle(seed);
      expect(again.solution).toEqual(first.solution);
    }
  });

  it('returns different puzzles for different seeds (high probability)', () => {
    const a = generatePuzzle(1);
    const b = generatePuzzle(2);
    expect(a.solution).not.toEqual(b.solution);
  });
});

describe('generatePuzzle properties', () => {
  it('produces a grid of exactly 25 cells', () => {
    const p = generatePuzzle(1);
    expect(p.solution).toHaveLength(CELL_COUNT);
  });

  it('has filled count in [MIN_FILLED, MAX_FILLED]', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePuzzle(i);
      expect(p.filledCount).toBeGreaterThanOrEqual(MIN_FILLED);
      expect(p.filledCount).toBeLessThanOrEqual(MAX_FILLED);
      const actualFilled = p.solution.reduce<number>((sum, c) => sum + c, 0);
      expect(actualFilled).toBe(p.filledCount);
    }
  });

  it('has rowSums and colSums that match the solution', () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePuzzle(i * 13 + 7);
      expect(rowSums(p.solution)).toEqual([...p.rowSums]);
      expect(colSums(p.solution)).toEqual([...p.colSums]);
    }
  });
});

describe('generatePuzzle solvability (365-day sample)', () => {
  const puzzles: Puzzle[] = [];

  beforeAll(() => {
    for (let id = 0; id < 365; id++) {
      puzzles.push(generatePuzzle(seedForPuzzleId(id)));
    }
  }, 60_000);

  it('generates all 365 puzzles without throwing', () => {
    expect(puzzles).toHaveLength(365);
  });

  it('every puzzle has a unique row/col-sum solution', () => {
    for (const p of puzzles) {
      expect(isUniquelySolvableFromSums(p.solution)).toBe(true);
    }
  });

  it('filled-cell counts vary across the year (not all identical)', () => {
    const counts = new Set(puzzles.map(p => p.filledCount));
    expect(counts.size).toBeGreaterThan(1);
  });

  it('every puzzle has filled count in [MIN_FILLED, MAX_FILLED]', () => {
    for (const p of puzzles) {
      expect(p.filledCount).toBeGreaterThanOrEqual(MIN_FILLED);
      expect(p.filledCount).toBeLessThanOrEqual(MAX_FILLED);
    }
  });
});
