import { BATCH_SIZE, Tier } from './types';

export interface TierConfig {
  readonly tier: Tier;
  readonly label: string;
  readonly batches: number;
  readonly guessBudget: number;
  readonly preLockedCells: number;
  readonly threeStarMaxGuesses: number;
  readonly twoStarMaxGuesses: number;
}

export const TIER_CONFIGS: readonly TierConfig[] = [
  {
    tier: Tier.Beginner,
    label: 'Beginner',
    batches: 4,
    guessBudget: 5,
    preLockedCells: 2,
    threeStarMaxGuesses: 2,
    twoStarMaxGuesses: 3,
  },
  {
    tier: Tier.Intermediate,
    label: 'Intermediate',
    batches: 5,
    guessBudget: 4,
    preLockedCells: 1,
    threeStarMaxGuesses: 2,
    twoStarMaxGuesses: 3,
  },
  {
    tier: Tier.Advanced,
    label: 'Advanced',
    batches: 6,
    guessBudget: 4,
    preLockedCells: 0,
    threeStarMaxGuesses: 2,
    twoStarMaxGuesses: 3,
  },
  {
    tier: Tier.Expert,
    label: 'Expert',
    batches: 7,
    guessBudget: 3,
    preLockedCells: 0,
    threeStarMaxGuesses: 2,
    twoStarMaxGuesses: 2,
  },
  {
    tier: Tier.Master,
    label: 'Master',
    batches: 8,
    guessBudget: 3,
    preLockedCells: 0,
    threeStarMaxGuesses: 2,
    twoStarMaxGuesses: 2,
  },
];

export const TIER_ORDER: readonly Tier[] = TIER_CONFIGS.map(c => c.tier);

export const TOTAL_BATCHES = TIER_CONFIGS.reduce((sum, c) => sum + c.batches, 0);
export const TOTAL_LEVELS = TOTAL_BATCHES * BATCH_SIZE;

export function configForTier(tier: Tier): TierConfig {
  const config = TIER_CONFIGS.find(c => c.tier === tier);
  if (!config) throw new Error(`unknown tier: ${tier}`);
  return config;
}

export function levelsInTier(tier: Tier): number {
  return configForTier(tier).batches * BATCH_SIZE;
}

export function firstLevelIdOfTier(tier: Tier): number {
  let offset = 0;
  for (const c of TIER_CONFIGS) {
    if (c.tier === tier) return offset;
    offset += c.batches * BATCH_SIZE;
  }
  throw new Error(`unknown tier: ${tier}`);
}
