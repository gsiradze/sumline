import { describe, expect, it } from 'vitest';
import { bandForTier, scoreDifficulty, solutionCountInBand, uniquenessViable } from '../difficulty';
import { generatePuzzle } from '../puzzle';
import { isUniquelySolvableFromSums } from '../solver';
import { CELL_COUNT, GRID_SIZE, Tier } from '../types';
import type { Cell, Puzzle } from '../types';

function puzzleFromSolution(solution: readonly Cell[]): Puzzle {
  if (solution.length !== CELL_COUNT) throw new Error('bad test');
  const rowSums = new Array<number>(GRID_SIZE).fill(0);
  const colSums = new Array<number>(GRID_SIZE).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = solution[r * GRID_SIZE + c] ?? 0;
      rowSums[r]! += v;
      colSums[c]! += v;
    }
  }
  let filled = 0;
  for (const v of solution) filled += v;
  return { solution, rowSums, colSums, filledCount: filled, seed: 0 };
}

function generateUnique(seed: number): Puzzle {
  return generatePuzzle(seed, {
    accept: p => isUniquelySolvableFromSums(p.solution),
    maxAttemptsPerSeed: 2000,
  });
}

describe('scoreDifficulty', () => {
  it('returns a total between 0 and 100', () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePuzzle(i);
      const s = scoreDifficulty(p);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
    }
  });

  it('scores unique-from-sums puzzles lower than highly ambiguous ones', () => {
    const unique = generateUnique(7);
    const uniqueScore = scoreDifficulty(unique).total;
    expect(uniqueScore).toBeLessThanOrEqual(10);
  });
});

describe('bandForTier', () => {
  it('returns bands with non-decreasing maximums from Beginner to Master', () => {
    const tiers = [Tier.Beginner, Tier.Intermediate, Tier.Advanced, Tier.Expert, Tier.Master];
    const bands = tiers.map(bandForTier);
    for (const b of bands) {
      expect(b.min).toBeLessThanOrEqual(b.max);
    }
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.max).toBeGreaterThanOrEqual(bands[i - 1]!.max);
    }
  });
});

describe('solutionCountInBand', () => {
  it('rejects a uniquely-sum-solvable puzzle for Beginner (which now requires ambiguity)', () => {
    const p = generateUnique(3);
    expect(solutionCountInBand(p, bandForTier(Tier.Beginner))).toBe(false);
  });
});

describe('uniquenessViable', () => {
  it('accepts a hand-crafted uniquely-solvable puzzle', () => {
    const p = generateUnique(11);
    expect(uniquenessViable(p)).toBe(true);
  });

  it('is exercised by a heavily-trivial shape for sanity', () => {
    const trivial = new Array<Cell>(CELL_COUNT).fill(0);
    for (let r = Math.ceil(GRID_SIZE / 2); r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) trivial[r * GRID_SIZE + c] = 1;
    }
    const p = puzzleFromSolution(trivial);
    expect(uniquenessViable(p)).toBe(true);
  });
});
