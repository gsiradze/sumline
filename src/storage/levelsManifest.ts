import rawManifest from '../../public/levels.json';
import { TOTAL_LEVELS } from '../game/domain/tiers';
import { Tier } from '../game/domain/types';
import type { Cell, Puzzle, Grid } from '../game/domain/types';

export interface BakedLevel {
  readonly id: number;
  readonly tier: Tier;
  readonly batchIndexInTier: number;
  readonly indexInBatch: number;
  readonly technique: string | null;
  readonly teachingHint: string | null;
  readonly solution: Grid;
  readonly rowSums: readonly number[];
  readonly colSums: readonly number[];
  readonly filledCount: number;
  readonly seed: number;
  readonly difficultyScore: number;
  readonly guessBudget: number;
  readonly preLockedCellCount: number;
}

interface RawLevel {
  id: number;
  tier: string;
  batchIndexInTier: number;
  indexInBatch: number;
  technique: string | null;
  teachingHint: string | null;
  solution: (0 | 1)[];
  rowSums: number[];
  colSums: number[];
  filledCount: number;
  seed: number;
  difficultyScore: number;
  guessBudget: number;
  preLockedCellCount: number;
}

interface RawManifest {
  version: number;
  generatedAt: string;
  count: number;
  levels: RawLevel[];
}

function coerceTier(value: string): Tier {
  switch (value) {
    case 'beginner':
      return Tier.Beginner;
    case 'intermediate':
      return Tier.Intermediate;
    case 'advanced':
      return Tier.Advanced;
    case 'expert':
      return Tier.Expert;
    case 'master':
      return Tier.Master;
    default:
      throw new Error(`unknown tier in manifest: ${value}`);
  }
}

const parsed = rawManifest as RawManifest;

if (parsed.levels.length !== TOTAL_LEVELS) {
  throw new Error(
    `levels manifest has ${parsed.levels.length} levels, expected ${TOTAL_LEVELS}`,
  );
}

export const LEVELS: readonly BakedLevel[] = parsed.levels.map(
  (l): BakedLevel => ({
    ...l,
    tier: coerceTier(l.tier),
    solution: l.solution as readonly Cell[],
  }),
);

export function bakedLevel(id: number): BakedLevel {
  const level = LEVELS[id];
  if (!level) throw new Error(`level ${id} not found in manifest`);
  return level;
}

export function puzzleForLevel(id: number): Puzzle {
  const level = bakedLevel(id);
  return {
    solution: level.solution,
    rowSums: level.rowSums,
    colSums: level.colSums,
    filledCount: level.filledCount,
    seed: level.seed,
  };
}
