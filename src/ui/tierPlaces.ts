import { Tier } from '../game/domain/types';

// The home map gives each tier a place on the river; other screens show both names.
export const TIER_PLACE_NAMES: Readonly<Record<Tier, string>> = {
  [Tier.Beginner]: 'Pond',
  [Tier.Intermediate]: 'Stream',
  [Tier.Advanced]: 'River',
  [Tier.Expert]: 'Waterfall',
  [Tier.Master]: 'Lake',
};
