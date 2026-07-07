import { describe, expect, it } from 'vitest';
import { shouldRequestReview, type ReviewPolicyInput } from '../reviewPolicy';

const base: ReviewPolicyInput = {
  stars: 3,
  level: 12,
  sessionCount: 4,
  lastPromptVersion: null,
  currentVersion: '0.1.0',
};

describe('reviewPolicy', () => {
  it('requests on a proud 3-star solve', () => {
    expect(shouldRequestReview(base)).toBe(true);
  });

  it('requires 3 stars', () => {
    expect(shouldRequestReview({ ...base, stars: 2 })).toBe(false);
  });

  it('requires a later level', () => {
    expect(shouldRequestReview({ ...base, level: 5 })).toBe(false);
  });

  it('requires enough sessions', () => {
    expect(shouldRequestReview({ ...base, sessionCount: 1 })).toBe(false);
  });

  it('only once per version', () => {
    expect(shouldRequestReview({ ...base, lastPromptVersion: '0.1.0' })).toBe(false);
  });
});
