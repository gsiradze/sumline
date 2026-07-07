export interface ReviewPolicyConfig {
  readonly minLevel: number;
  readonly minSessions: number;
}

export const defaultReviewPolicy: ReviewPolicyConfig = {
  minLevel: 10,
  minSessions: 3,
};

export interface ReviewPolicyInput {
  readonly stars: number;
  readonly level: number;
  readonly sessionCount: number;
  readonly lastPromptVersion: string | null;
  readonly currentVersion: string;
}

export function shouldRequestReview(
  input: ReviewPolicyInput,
  config: ReviewPolicyConfig = defaultReviewPolicy,
): boolean {
  if (input.stars < 3) return false;
  if (input.level < config.minLevel) return false;
  if (input.sessionCount < config.minSessions) return false;
  if (input.lastPromptVersion === input.currentVersion) return false;
  return true;
}
