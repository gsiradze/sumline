import { describe, expect, it } from 'vitest';
import {
  TIER_CONFIGS,
  TIER_ORDER,
  TOTAL_BATCHES,
  TOTAL_LEVELS,
  configForTier,
  firstLevelIdOfTier,
  levelsInTier,
} from '../tiers';
import { BATCH_SIZE, Tier } from '../types';

describe('tier configuration', () => {
  it('has 5 tiers in the canonical order', () => {
    expect(TIER_ORDER).toEqual([
      Tier.Beginner,
      Tier.Intermediate,
      Tier.Advanced,
      Tier.Expert,
      Tier.Master,
    ]);
  });

  it('has the A₂ uneven batch shape: 4/5/6/7/8', () => {
    expect(TIER_CONFIGS.map(c => c.batches)).toEqual([4, 5, 6, 7, 8]);
  });

  it('has 30 batches and 210 levels total', () => {
    expect(TOTAL_BATCHES).toBe(30);
    expect(TOTAL_LEVELS).toBe(210);
    expect(TOTAL_BATCHES * BATCH_SIZE).toBe(TOTAL_LEVELS);
  });

  it('uses tight, decreasing guess budgets tuned for fun', () => {
    expect(configForTier(Tier.Beginner).guessBudget).toBe(5);
    expect(configForTier(Tier.Intermediate).guessBudget).toBe(4);
    expect(configForTier(Tier.Advanced).guessBudget).toBe(4);
    expect(configForTier(Tier.Expert).guessBudget).toBe(3);
    expect(configForTier(Tier.Master).guessBudget).toBe(3);
  });

  it('uses pre-locked scaffolding only in Beginner/Intermediate', () => {
    expect(configForTier(Tier.Beginner).preLockedCells).toBe(2);
    expect(configForTier(Tier.Intermediate).preLockedCells).toBe(1);
    expect(configForTier(Tier.Advanced).preLockedCells).toBe(0);
    expect(configForTier(Tier.Expert).preLockedCells).toBe(0);
    expect(configForTier(Tier.Master).preLockedCells).toBe(0);
  });

  it('has star thresholds at or below guess budget', () => {
    for (const c of TIER_CONFIGS) {
      expect(c.threeStarMaxGuesses).toBeLessThanOrEqual(c.twoStarMaxGuesses);
      expect(c.twoStarMaxGuesses).toBeLessThanOrEqual(c.guessBudget);
    }
  });
});

describe('firstLevelIdOfTier', () => {
  it('places Beginner at 0 and tiers stack correctly', () => {
    expect(firstLevelIdOfTier(Tier.Beginner)).toBe(0);
    expect(firstLevelIdOfTier(Tier.Intermediate)).toBe(28);
    expect(firstLevelIdOfTier(Tier.Advanced)).toBe(63);
    expect(firstLevelIdOfTier(Tier.Expert)).toBe(105);
    expect(firstLevelIdOfTier(Tier.Master)).toBe(154);
  });
});

describe('levelsInTier', () => {
  it('matches batches × BATCH_SIZE', () => {
    expect(levelsInTier(Tier.Beginner)).toBe(28);
    expect(levelsInTier(Tier.Intermediate)).toBe(35);
    expect(levelsInTier(Tier.Advanced)).toBe(42);
    expect(levelsInTier(Tier.Expert)).toBe(49);
    expect(levelsInTier(Tier.Master)).toBe(56);
  });
});
