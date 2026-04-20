import { parentPort } from 'node:worker_threads';
import { generatePuzzle } from '../src/game/domain/puzzle';
import { bandForTier, scoreDifficulty, solutionCountInBand } from '../src/game/domain/difficulty';
import { coordsForLevelId, seedForLevelId } from '../src/game/domain/levels';
import { configForTier } from '../src/game/domain/tiers';
import { BATCH_SIZE } from '../src/game/domain/types';
import { Tier } from '../src/game/domain/types';
import type { Puzzle } from '../src/game/domain/types';
import type { BakedLevel, WorkerResult } from './build-levels-types';

interface TeachingSpec {
  readonly technique: string;
  readonly hint: string;
  readonly accept: (puzzle: Puzzle) => boolean;
}

const NEAR_FULL = 5;

const TEACHING_BATCH: readonly TeachingSpec[] = [
  {
    technique: 'singleton-cross',
    hint: 'A row and column both summing to 1 cross at one forced cell — find it.',
    accept: p => p.rowSums.some(s => s === 1) && p.colSums.some(s => s === 1),
  },
  {
    technique: 'row-singleton',
    hint: 'A row summing to 1 has exactly one filled cell. Cross-reference columns to find it.',
    accept: p => p.rowSums.some(s => s === 1),
  },
  {
    technique: 'col-singleton',
    hint: 'A column summing to 1 has exactly one filled cell. Cross-reference rows to find it.',
    accept: p => p.colSums.some(s => s === 1),
  },
  {
    technique: 'row-near-full',
    hint: 'A row summing to 5 has exactly one empty cell. Where must the empty be?',
    accept: p => p.rowSums.some(s => s === NEAR_FULL),
  },
  {
    technique: 'col-near-full',
    hint: 'A column summing to 5 has exactly one empty cell.',
    accept: p => p.colSums.some(s => s === NEAR_FULL),
  },
  {
    technique: 'both-near-full',
    hint: 'A sum=5 row and a sum=5 column each have one empty cell. Their intersection is informative.',
    accept: p => p.rowSums.some(s => s === NEAR_FULL) && p.colSums.some(s => s === NEAR_FULL),
  },
  {
    technique: 'balanced',
    hint: 'No extremes here. Combine row and column clues to narrow the grid.',
    accept: p =>
      p.rowSums.every(s => s >= 2 && s <= 4) && p.colSums.every(s => s >= 2 && s <= 4),
  },
];

if (TEACHING_BATCH.length !== BATCH_SIZE) {
  throw new Error(`TEACHING_BATCH must have exactly ${BATCH_SIZE} entries`);
}

const TRIVIAL_LO = 0;
const TRIVIAL_HI = 6;

function noTrivialSums(p: Puzzle): boolean {
  for (const s of p.rowSums) if (s === TRIVIAL_LO || s === TRIVIAL_HI) return false;
  for (const s of p.colSums) if (s === TRIVIAL_LO || s === TRIVIAL_HI) return false;
  return true;
}

function noNearTrivialSums(p: Puzzle): boolean {
  for (const s of p.rowSums) if (s <= 1 || s >= NEAR_FULL) return false;
  for (const s of p.colSums) if (s <= 1 || s >= NEAR_FULL) return false;
  return true;
}

function sumFilter(tier: Tier): (p: Puzzle) => boolean {
  if (tier === Tier.Advanced || tier === Tier.Expert || tier === Tier.Master) {
    return noNearTrivialSums;
  }
  return noTrivialSums;
}

function generateForLevel(id: number): Puzzle {
  const seed = seedForLevelId(id);
  const coords = coordsForLevelId(id);
  const band = bandForTier(coords.tier);
  const filter = sumFilter(coords.tier);
  if (id < TEACHING_BATCH.length) {
    const spec = TEACHING_BATCH[id]!;
    try {
      return generatePuzzle(seed, {
        accept: p => noTrivialSums(p) && spec.accept(p) && solutionCountInBand(p, band),
        maxAttemptsPerSeed: 4000,
        maxNudges: 150,
      });
    } catch {
      return generatePuzzle(seed, {
        accept: p => noTrivialSums(p) && spec.accept(p),
        maxAttemptsPerSeed: 4000,
        maxNudges: 150,
      });
    }
  }
  try {
    return generatePuzzle(seed, {
      accept: p => filter(p) && solutionCountInBand(p, band),
      maxAttemptsPerSeed: 4000,
      maxNudges: 150,
    });
  } catch {
    return generatePuzzle(seed, {
      accept: filter,
      maxAttemptsPerSeed: 3000,
    });
  }
}

function toBakedLevel(id: number, puzzle: Puzzle): BakedLevel {
  const coords = coordsForLevelId(id);
  const config = configForTier(coords.tier);
  const isTeaching = id < TEACHING_BATCH.length;
  const technique = isTeaching ? TEACHING_BATCH[id]!.technique : null;
  const teachingHint = isTeaching ? TEACHING_BATCH[id]!.hint : null;
  return {
    id,
    tier: coords.tier,
    batchIndexInTier: coords.batchIndexInTier,
    indexInBatch: coords.indexInBatch,
    technique,
    teachingHint,
    solution: [...puzzle.solution] as readonly (0 | 1)[],
    rowSums: [...puzzle.rowSums],
    colSums: [...puzzle.colSums],
    filledCount: puzzle.filledCount,
    seed: puzzle.seed,
    difficultyScore: Math.round(scoreDifficulty(puzzle).total * 10) / 10,
    guessBudget: config.guessBudget,
    preLockedCellCount: config.preLockedCells,
  };
}

if (!parentPort) throw new Error('worker started without parentPort');
const port = parentPort;
port.on('message', (id: number) => {
  try {
    const puzzle = generateForLevel(id);
    const baked = toBakedLevel(id, puzzle);
    port.postMessage({ id, baked } satisfies WorkerResult);
  } catch (err) {
    port.postMessage({ id, error: (err as Error).message } satisfies WorkerResult);
  }
});
