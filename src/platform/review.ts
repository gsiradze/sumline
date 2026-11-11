import { InAppReview } from '@capacitor-community/in-app-review';
import {
  shouldRequestReview,
  type ReviewPolicyConfig,
  type ReviewPolicyInput,
} from '../game/domain/reviewPolicy';
import { APP_VERSION } from '../config/version';
import { loadJson, saveJson } from '../storage/persistence';
import { isNative } from './native';

const KEY = 'review:v1';

interface ReviewRecord {
  readonly lastPromptVersion: string | null;
}

/** Resolves true when a review prompt was requested, so the caller can hold back an ad. */
export async function maybeRequestReview(
  input: Omit<ReviewPolicyInput, 'lastPromptVersion' | 'currentVersion'>,
  config?: ReviewPolicyConfig,
): Promise<boolean> {
  const record = await loadJson<ReviewRecord>(KEY, { lastPromptVersion: null });
  const full: ReviewPolicyInput = {
    ...input,
    lastPromptVersion: record.lastPromptVersion,
    currentVersion: APP_VERSION,
  };
  if (!shouldRequestReview(full, config)) return false;
  await saveJson(KEY, { lastPromptVersion: APP_VERSION });
  if (!isNative()) return false;
  try {
    await InAppReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
