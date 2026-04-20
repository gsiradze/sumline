import type { Tier } from './types';
import { configForTier } from './tiers';

export type Stars = 0 | 1 | 2 | 3;

export function starsForWin(tier: Tier, guessCount: number): Stars {
  const config = configForTier(tier);
  if (guessCount <= 0) return 1;
  if (guessCount <= config.threeStarMaxGuesses) return 3;
  if (guessCount <= config.twoStarMaxGuesses) return 2;
  return 1;
}
