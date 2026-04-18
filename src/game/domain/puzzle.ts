import { mulberry32, shuffle } from './rng';
import type { Rng } from './rng';
import { CELL_COUNT, MAX_FILLED, MIN_FILLED } from './types';
import type { Cell, Grid, Puzzle } from './types';
import { colSums, isUniquelySolvableFromSums, rowSums } from './solver';

const MAX_ATTEMPTS_PER_SEED = 500;
const MAX_NUDGES = 50;
const NUDGE_STEP = 0x9e3779b9;

export function generatePuzzle(seed: number): Puzzle {
  for (let nudge = 0; nudge < MAX_NUDGES; nudge++) {
    const candidate = tryGenerate((seed + nudge * NUDGE_STEP) >>> 0);
    if (candidate) return candidate;
  }
  throw new Error(`failed to generate a valid puzzle after ${MAX_NUDGES} seed nudges`);
}

function tryGenerate(seed: number): Puzzle | null {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SEED; attempt++) {
    const filledCount = MIN_FILLED + Math.floor(rng() * (MAX_FILLED - MIN_FILLED + 1));
    const grid = randomGrid(rng, filledCount);
    if (!passesDifficultyHeuristic(grid)) continue;
    if (!isUniquelySolvableFromSums(grid)) continue;
    return {
      solution: grid,
      rowSums: rowSums(grid),
      colSums: colSums(grid),
      filledCount,
      seed,
    };
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

function passesDifficultyHeuristic(grid: Grid): boolean {
  const rs = rowSums(grid);
  const cs = colSums(grid);
  let trivial = 0;
  for (const s of rs) if (s === 0 || s === 5) trivial++;
  for (const s of cs) if (s === 0 || s === 5) trivial++;
  return trivial <= 2;
}
