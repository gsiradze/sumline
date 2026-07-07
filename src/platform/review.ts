import { InAppReview } from '@capacitor-community/in-app-review';
import {
  shouldRequestReview,
  type ReviewPolicyConfig,
  type ReviewPolicyInput,
} from '../game/domain/reviewPolicy';
import { loadJson, saveJson } from '../storage/persistence';
import { isNative } from './native';

// Bump on each store release so the prompt can fire again for that version.
const APP_VERSION = '0.1.0';

const KEY = 'review:v1';

interface ReviewRecord {
  readonly lastPromptVersion: string | null;
}

export async function maybeRequestReview(
  input: Omit<ReviewPolicyInput, 'lastPromptVersion' | 'currentVersion'>,
  config?: ReviewPolicyConfig,
): Promise<void> {
  const record = await loadJson<ReviewRecord>(KEY, { lastPromptVersion: null });
  const full: ReviewPolicyInput = {
    ...input,
    lastPromptVersion: record.lastPromptVersion,
    currentVersion: APP_VERSION,
  };
  if (!shouldRequestReview(full, config)) return;
  await saveJson(KEY, { lastPromptVersion: APP_VERSION });
  if (!isNative()) return;
  try {
    await InAppReview.requestReview();
  } catch {
    // non-fatal
  }
}
