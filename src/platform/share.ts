import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export interface ShareRequest {
  readonly title?: string;
  readonly text: string;
  readonly url?: string;
  readonly dialogTitle?: string;
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'unsupported';

export async function shareOrCopy(req: ShareRequest): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: req.title,
        text: req.text,
        url: req.url,
        dialogTitle: req.dialogTitle,
      });
      return 'shared';
    } catch {
      return 'dismissed';
    }
  }

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: req.title, text: req.text, url: req.url });
      return 'shared';
    } catch {
      // fall through to clipboard
    }
  }

  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      const payload = [req.text, req.url].filter(Boolean).join('\n');
      await nav.clipboard.writeText(payload);
      return 'copied';
    } catch {
      return 'unsupported';
    }
  }

  return 'unsupported';
}
