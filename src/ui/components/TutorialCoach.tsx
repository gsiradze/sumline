import { LightbulbIcon } from './icons';

interface TutorialCoachProps {
  readonly text: string;
  /** Set on the steps that are read; marking a cell moves past them too. */
  readonly onNext: (() => void) | null;
  readonly onSkip: () => void;
}

/** The guided first solve on level 1: one short instruction at a time, above the board. */
export function TutorialCoach({ text, onNext, onSkip }: TutorialCoachProps) {
  return (
    <div className="mx-auto w-full max-w-md px-5 mt-3 mb-2">
      <div
        className="rounded-lg border border-ochre-300 bg-ochre-100/40 pl-3 pr-1.5 pt-2 pb-1.5 text-ink-900"
        role="status"
        aria-live="polite"
        data-coach=""
      >
        {/* Room for three lines, so the board does not shift between steps. */}
        <div className="flex items-start gap-2 pr-1.5 min-h-[57px]">
          <LightbulbIcon className="w-4 h-4 mt-0.5 text-ochre-600 shrink-0" />
          <p className="font-sans text-[13px] leading-[1.45]">{text}</p>
        </div>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onSkip}
            className="h-11 px-3 font-sans text-[13px] text-ink-500 hover:text-ink-900"
          >
            Skip tutorial
          </button>
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="h-11 px-5 rounded-full bg-fill-800 text-paper-50 font-sans text-[14px] font-semibold active:scale-[0.97] transition-transform duration-nudge"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
