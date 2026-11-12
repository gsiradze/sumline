import { PLAY_STORE_URL } from '../../config/links';
import { TOTAL_LEVELS } from '../../game/domain/tiers';
import { BACK_PRIORITY_OVERLAY } from '../../platform/back';
import { useBackHandler } from '../hooks/useBackHandler';

interface GetAppModalProps {
  readonly demoLevels: number;
  /** "Keep playing the demo": has to lead to a level that can be played. */
  readonly onKeepPlaying: () => void;
  readonly onDismiss: () => void;
}

/** Shown on the web build only, where the game is a demo of the first levels. */
export function GetAppModal({ demoLevels, onKeepPlaying, onDismiss }: GetAppModalProps) {
  useBackHandler(onDismiss, BACK_PRIORITY_OVERLAY);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-label="Get the app"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute inset-0 bg-[rgba(20,18,14,0.35)] dark:bg-[rgba(0,0,0,0.6)]"
      />
      <div className="relative w-full max-w-sm rounded-[20px] bg-paper-50 border border-rule-200 shadow-sh-3 px-5 py-6 text-center">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
          End of the web demo
        </div>
        <h2 className="mt-2 font-serif text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink-900">
          {TOTAL_LEVELS - demoLevels} more puzzles in the app
        </h2>
        <p className="mt-2 font-sans text-[14px] leading-[1.5] text-ink-700">
          The first {demoLevels} levels are free to play here. The full ladder of {TOTAL_LEVELS} is
          on Google Play.
        </p>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 w-full h-[52px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold inline-flex items-center justify-center shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge"
        >
          Get Sumline on Google Play
        </a>
        <button
          type="button"
          onClick={onKeepPlaying}
          className="mt-2 w-full h-11 rounded-[12px] font-sans text-[14px] font-medium text-ink-700"
        >
          Keep playing the demo
        </button>
      </div>
    </div>
  );
}
