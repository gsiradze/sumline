import { Tier } from './types';
import type { Puzzle } from './types';
import { countSolutions } from './solver';
import { measureSolverWork } from './solverWork';

const MAX_COUNTED = 120;

export interface DifficultyScore {
  readonly total: number;
  readonly solutionCount: number;
  readonly forcedMoves: number;
  readonly branches: number;
  readonly maxDepth: number;
}

export function scoreDifficulty(puzzle: Puzzle): DifficultyScore {
  const solutionCount = countSolutions(puzzle.rowSums, puzzle.colSums, MAX_COUNTED);
  const work = measureSolverWork(puzzle);
  return {
    total: solutionsToScore(solutionCount),
    solutionCount,
    forcedMoves: work.forcedMoves,
    branches: work.branches,
    maxDepth: work.maxDepth,
  };
}

function solutionsToScore(n: number): number {
  if (n <= 1) return 5;
  if (n <= 3) return 15;
  if (n <= 8) return 30;
  if (n <= 15) return 45;
  if (n <= 25) return 60;
  if (n <= 40) return 75;
  if (n <= 70) return 90;
  return 100;
}

export interface DifficultyBand {
  readonly min: number;
  readonly max: number;
}

const BASE_BANDS: Record<Tier, DifficultyBand> = {
  [Tier.Beginner]: { min: 2, max: 8 },
  [Tier.Intermediate]: { min: 6, max: 15 },
  [Tier.Advanced]: { min: 12, max: 28 },
  [Tier.Expert]: { min: 25, max: 60 },
  [Tier.Master]: { min: 50, max: MAX_COUNTED },
};

export function bandForTier(tier: Tier): DifficultyBand {
  return BASE_BANDS[tier];
}

export function solutionCountInBand(puzzle: Puzzle, band: DifficultyBand): boolean {
  const n = countSolutions(puzzle.rowSums, puzzle.colSums, Math.max(2, band.max + 1));
  return n >= band.min && n <= band.max;
}

export function uniquenessViable(puzzle: Puzzle): boolean {
  return countSolutions(puzzle.rowSums, puzzle.colSums, 2) === 1;
}
