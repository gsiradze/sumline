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

  it('tightens thresholds for Master (no 2★ tier — nail it or scrape it)', () => {
    expect(starsForWin(Tier.Master, 2)).toBe(3);
    expect(starsForWin(Tier.Master, 3)).toBe(1);
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
