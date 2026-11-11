import { describe, expect, it } from 'vitest';
import { starsForWin } from '../stars';
import { Tier } from '../types';

describe('starsForWin', () => {
  it('awards 3 stars for a quick Beginner win', () => {
    expect(starsForWin(Tier.Beginner, 1)).toBe(3);
    expect(starsForWin(Tier.Beginner, 2)).toBe(3);
  });

  it('awards 2 stars for an on-budget Beginner win', () => {
    expect(starsForWin(Tier.Beginner, 3)).toBe(2);
  });

  it('awards 1 star for a near-failure Beginner win', () => {
    expect(starsForWin(Tier.Beginner, 4)).toBe(1);
    expect(starsForWin(Tier.Beginner, 5)).toBe(1);
  });

  it('gives two stars for a last-guess win in Expert and Master', () => {
    // Even perfect play needs the third guess on many of these levels, so
    // using it is not a one-star scrape.
    for (const tier of [Tier.Expert, Tier.Master]) {
      expect(starsForWin(tier, 2)).toBe(3);
      expect(starsForWin(tier, 3)).toBe(2);
    }
  });

  it('never returns 0 for a valid win', () => {
    for (const tier of [Tier.Beginner, Tier.Advanced, Tier.Master]) {
      for (let g = 1; g <= 8; g++) {
        const s = starsForWin(tier, g);
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(3);
      }
    }
  });
});
