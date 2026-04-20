import { describe, expect, it } from 'vitest';
import {
  batchCompletionCount,
  coordsForLevelId,
  emptyProgress,
  isBatchComplete,
  isBatchUnlocked,
  isLevelAccessible,
  levelIdForCoords,
  maxStarsForTier,
  maxStarsTotal,
  progressForLevel,
  seedForLevelId,
  tierForLevelId,
  tierStars,
  totalStars,
} from '../levels';
import type { LevelProgressMap } from '../levels';
import { BATCH_SIZE, Tier } from '../types';
import { TOTAL_LEVELS } from '../tiers';

describe('tierForLevelId', () => {
  it('assigns boundary levels to the right tiers', () => {
    expect(tierForLevelId(0)).toBe(Tier.Beginner);
    expect(tierForLevelId(27)).toBe(Tier.Beginner);
    expect(tierForLevelId(28)).toBe(Tier.Intermediate);
    expect(tierForLevelId(62)).toBe(Tier.Intermediate);
    expect(tierForLevelId(63)).toBe(Tier.Advanced);
    expect(tierForLevelId(104)).toBe(Tier.Advanced);
    expect(tierForLevelId(105)).toBe(Tier.Expert);
    expect(tierForLevelId(153)).toBe(Tier.Expert);
    expect(tierForLevelId(154)).toBe(Tier.Master);
    expect(tierForLevelId(209)).toBe(Tier.Master);
  });

  it('rejects out-of-range ids', () => {
    expect(() => tierForLevelId(-1)).toThrow();
    expect(() => tierForLevelId(TOTAL_LEVELS)).toThrow();
  });
});

describe('coordsForLevelId / levelIdForCoords', () => {
  it('round-trips for every level', () => {
    for (let id = 0; id < TOTAL_LEVELS; id++) {
      const coords = coordsForLevelId(id);
      expect(levelIdForCoords(coords)).toBe(id);
      expect(coords.indexInBatch).toBeGreaterThanOrEqual(0);
      expect(coords.indexInBatch).toBeLessThan(BATCH_SIZE);
    }
  });

  it('groups 7 consecutive ids into a batch', () => {
    for (let id = 0; id < TOTAL_LEVELS - 1; id++) {
      const a = coordsForLevelId(id);
      const b = coordsForLevelId(id + 1);
      if (a.tier === b.tier && a.batchIndexInTier === b.batchIndexInTier) {
        expect(b.indexInBatch).toBe(a.indexInBatch + 1);
      }
    }
  });
});

describe('seedForLevelId', () => {
  it('is deterministic', () => {
    expect(seedForLevelId(7)).toBe(seedForLevelId(7));
  });

  it('differs across consecutive levels', () => {
    expect(seedForLevelId(0)).not.toBe(seedForLevelId(1));
    expect(seedForLevelId(42)).not.toBe(seedForLevelId(43));
  });
});

function completeLevels(ids: readonly number[]): LevelProgressMap {
  const map: Record<number, { completed: boolean; bestGuessCount: number; stars: 3 }> = {};
  for (const id of ids) {
    map[id] = { completed: true, bestGuessCount: 3, stars: 3 };
  }
  return map;
}

describe('progress + unlock logic', () => {
  it('treats missing entries as not completed / 0 stars', () => {
    const p = emptyProgress();
    const r = progressForLevel(p, 5);
    expect(r.completed).toBe(false);
    expect(r.stars).toBe(0);
    expect(r.bestGuessCount).toBeNull();
  });

  it('first batch in a tier is always unlocked', () => {
    const p = emptyProgress();
    expect(isBatchUnlocked(p, Tier.Beginner, 0)).toBe(true);
    expect(isBatchUnlocked(p, Tier.Expert, 0)).toBe(true);
    expect(isBatchUnlocked(p, Tier.Master, 0)).toBe(true);
  });

  it('second batch unlocks only when every level in the first batch is completed', () => {
    const partial = completeLevels([0, 1, 2, 3, 4, 5]);
    expect(isBatchComplete(partial, Tier.Beginner, 0)).toBe(false);
    expect(isBatchUnlocked(partial, Tier.Beginner, 1)).toBe(false);
    const full = completeLevels([0, 1, 2, 3, 4, 5, 6]);
    expect(isBatchComplete(full, Tier.Beginner, 0)).toBe(true);
    expect(isBatchUnlocked(full, Tier.Beginner, 1)).toBe(true);
  });

  it('isLevelAccessible reflects batch unlock', () => {
    const p = emptyProgress();
    expect(isLevelAccessible(p, 0)).toBe(true);
    expect(isLevelAccessible(p, 7)).toBe(false);
    const first = completeLevels([0, 1, 2, 3, 4, 5, 6]);
    expect(isLevelAccessible(first, 7)).toBe(true);
  });

  it('batchCompletionCount reports partial progress', () => {
    const p = completeLevels([0, 2, 5]);
    expect(batchCompletionCount(p, Tier.Beginner, 0)).toBe(3);
    expect(batchCompletionCount(p, Tier.Beginner, 1)).toBe(0);
  });
});

describe('star totals', () => {
  it('tierStars sums stars within that tier only', () => {
    const p = completeLevels([0, 1, 28, 29]);
    expect(tierStars(p, Tier.Beginner)).toBe(6);
    expect(tierStars(p, Tier.Intermediate)).toBe(6);
    expect(tierStars(p, Tier.Advanced)).toBe(0);
  });

  it('totalStars is the sum across all tiers', () => {
    const p = completeLevels([0, 28, 63, 105, 154]);
    expect(totalStars(p)).toBe(15);
  });

  it('maxStarsForTier scales with the tier', () => {
    expect(maxStarsForTier(Tier.Beginner)).toBe(28 * 3);
    expect(maxStarsForTier(Tier.Master)).toBe(56 * 3);
    expect(maxStarsTotal()).toBe(TOTAL_LEVELS * 3);
  });
});
