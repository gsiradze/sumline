import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export interface ShareImage {
  readonly blob: Blob;
  readonly name: string;
}

export interface ShareRequest {
  readonly title?: string;
  readonly text: string;
  readonly url?: string;
  readonly dialogTitle?: string;
  /** Sent along with the text where the platform can share files. */
  readonly image?: ShareImage | null;
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'unsupported';

function asFile(image: ShareImage): File {
  return new File([image.blob], image.name, { type: image.blob.type || 'image/png' });
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Whether a picture can go into the share sheet from here. In the Android and
 * iOS apps that needs the image written to a file first, which this build has
 * no plugin for, so there it is text and link only.
 */
export function canShareImages(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  if (typeof File === 'undefined') return false;
  try {
    return navigator.canShare({ files: [new File([], 'card.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

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
    if (req.image && canShareImages()) {
      try {
        await nav.share({ title: req.title, text: req.text, files: [asFile(req.image)] });
        return 'shared';
      } catch (err) {
        if (isAbort(err)) return 'dismissed';
        // fall through to sharing the text alone
      }
    }
    try {
      await nav.share({ title: req.title, text: req.text, url: req.url });
      return 'shared';
    } catch (err) {
      if (isAbort(err)) return 'dismissed';
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
