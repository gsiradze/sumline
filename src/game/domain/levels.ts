import { hashString, mulberry32 } from './rng';
import type { Puzzle, Tier } from './types';
import { BATCH_SIZE, CELL_COUNT, GRID_SIZE } from './types';
import {
  TIER_CONFIGS,
  TIER_ORDER,
  TOTAL_LEVELS,
  configForTier,
  firstLevelIdOfTier,
  levelsInTier,
} from './tiers';

export interface LevelCoords {
  readonly tier: Tier;
  readonly batchIndexInTier: number;
  readonly indexInBatch: number;
}

export function tierForLevelId(id: number): Tier {
  if (id < 0 || id >= TOTAL_LEVELS) {
    throw new Error(`invalid level id: ${id}`);
  }
  let offset = 0;
  for (const c of TIER_CONFIGS) {
    const size = c.batches * BATCH_SIZE;
    if (id < offset + size) return c.tier;
    offset += size;
  }
  throw new Error(`unreachable: level ${id} has no tier`);
}

export function coordsForLevelId(id: number): LevelCoords {
  const tier = tierForLevelId(id);
  const localId = id - firstLevelIdOfTier(tier);
  return {
    tier,
    batchIndexInTier: Math.floor(localId / BATCH_SIZE),
    indexInBatch: localId % BATCH_SIZE,
  };
}

export function levelIdForCoords(coords: LevelCoords): number {
  const config = configForTier(coords.tier);
  if (coords.batchIndexInTier < 0 || coords.batchIndexInTier >= config.batches) {
    throw new Error(`invalid batch: ${coords.batchIndexInTier} for tier ${coords.tier}`);
  }
  if (coords.indexInBatch < 0 || coords.indexInBatch >= BATCH_SIZE) {
    throw new Error(`invalid index in batch: ${coords.indexInBatch}`);
  }
  return (
    firstLevelIdOfTier(coords.tier) +
    coords.batchIndexInTier * BATCH_SIZE +
    coords.indexInBatch
  );
}

export function seedForLevelId(id: number): number {
  return hashString(`grid-level-v1-${id}`);
}

export function preLockIndices(seed: number, count: number): readonly number[] {
  if (count <= 0) return [];
  const rng = mulberry32((seed ^ 0xa5a5a5a5) >>> 0);
  const indices = Array.from({ length: CELL_COUNT }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  return indices.slice(0, Math.min(count, CELL_COUNT));
}

export function smartPreLockIndices(puzzle: Puzzle, count: number): readonly number[] {
  if (count <= 0) return [];
  const picked = new Set<number>();
  const rng = mulberry32((puzzle.seed ^ 0xa5a5a5a5) >>> 0);

  const rank = (sum: number): number => {
    if (sum === 1 || sum === 4) return 2;
    if (sum === 2 || sum === 3) return 1;
    return 0;
  };

  const scored: Array<{ idx: number; score: number }> = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const r = Math.floor(i / GRID_SIZE);
    const c = i % GRID_SIZE;
    const rs = puzzle.rowSums[r] ?? 0;
    const cs = puzzle.colSums[c] ?? 0;
    scored.push({ idx: i, score: rank(rs) + rank(cs) + rng() * 0.01 });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const s of scored) {
    if (picked.size >= count) break;
    picked.add(s.idx);
  }
  return [...picked];
}

export interface LevelProgressRecord {
  readonly completed: boolean;
  readonly bestGuessCount: number | null;
  readonly stars: 0 | 1 | 2 | 3;
}

export type LevelProgressMap = Readonly<Record<number, LevelProgressRecord>>;

export function emptyProgress(): LevelProgressMap {
  return {};
}

export function progressForLevel(
  progress: LevelProgressMap,
  id: number,
): LevelProgressRecord {
  return progress[id] ?? { completed: false, bestGuessCount: null, stars: 0 };
}

export function isBatchComplete(
  progress: LevelProgressMap,
  tier: Tier,
  batchIndexInTier: number,
): boolean {
  for (let i = 0; i < BATCH_SIZE; i++) {
    const id = levelIdForCoords({ tier, batchIndexInTier, indexInBatch: i });
    if (!progressForLevel(progress, id).completed) return false;
  }
  return true;
}

export function isBatchUnlocked(
  progress: LevelProgressMap,
  tier: Tier,
  batchIndexInTier: number,
): boolean {
  if (batchIndexInTier === 0) return true;
  return isBatchComplete(progress, tier, batchIndexInTier - 1);
}

export function isLevelAccessible(progress: LevelProgressMap, id: number): boolean {
  const { tier, batchIndexInTier } = coordsForLevelId(id);
  return isBatchUnlocked(progress, tier, batchIndexInTier);
}

export function batchCompletionCount(
  progress: LevelProgressMap,
  tier: Tier,
  batchIndexInTier: number,
): number {
  let n = 0;
  for (let i = 0; i < BATCH_SIZE; i++) {
    const id = levelIdForCoords({ tier, batchIndexInTier, indexInBatch: i });
    if (progressForLevel(progress, id).completed) n++;
  }
  return n;
}

export function tierStars(progress: LevelProgressMap, tier: Tier): number {
  let sum = 0;
  const start = firstLevelIdOfTier(tier);
  const end = start + levelsInTier(tier);
  for (let id = start; id < end; id++) {
    sum += progressForLevel(progress, id).stars;
  }
  return sum;
}

export function totalStars(progress: LevelProgressMap): number {
  let sum = 0;
  for (const tier of TIER_ORDER) sum += tierStars(progress, tier);
  return sum;
}

export function maxStarsForTier(tier: Tier): number {
  return levelsInTier(tier) * 3;
}

export function maxStarsTotal(): number {
  return TOTAL_LEVELS * 3;
}
