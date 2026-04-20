import { mulberry32, shuffle } from './rng';
import type { Rng } from './rng';
import { CELL_COUNT, MAX_FILLED, MIN_FILLED } from './types';
import type { Cell, Grid, Puzzle } from './types';
import { colSums, rowSums } from './solver';

const MAX_ATTEMPTS_PER_SEED = 500;
const MAX_NUDGES = 50;
const NUDGE_STEP = 0x9e3779b9;

export interface GenerateOptions {
  readonly accept?: (puzzle: Puzzle) => boolean;
  readonly minFilled?: number;
  readonly maxFilled?: number;
  readonly maxAttemptsPerSeed?: number;
  readonly maxNudges?: number;
}

export function generatePuzzle(seed: number, opts: GenerateOptions = {}): Puzzle {
  const nudges = opts.maxNudges ?? MAX_NUDGES;
  for (let nudge = 0; nudge < nudges; nudge++) {
    const candidate = tryGenerate((seed + nudge * NUDGE_STEP) >>> 0, opts);
    if (candidate) return candidate;
  }
  throw new Error(`failed to generate a valid puzzle after ${nudges} seed nudges`);
}

function tryGenerate(seed: number, opts: GenerateOptions): Puzzle | null {
  const rng = mulberry32(seed);
  const attempts = opts.maxAttemptsPerSeed ?? MAX_ATTEMPTS_PER_SEED;
  const lo = opts.minFilled ?? MIN_FILLED;
  const hi = opts.maxFilled ?? MAX_FILLED;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const filledCount = lo + Math.floor(rng() * (hi - lo + 1));
    const grid = randomGrid(rng, filledCount);
    const puzzle: Puzzle = {
      solution: grid,
      rowSums: rowSums(grid),
      colSums: colSums(grid),
      filledCount,
      seed,
    };
    if (opts.accept && !opts.accept(puzzle)) continue;
    return puzzle;
  }
  return null;
}

function randomGrid(rng: Rng, filledCount: number): Grid {
  const cells = new Array<Cell>(CELL_COUNT).fill(0);
  const indices = shuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, i) => i),
  );
  for (let i = 0; i < filledCount; i++) {
    cells[indices[i] ?? 0] = 1;
  }
  return cells;
}
