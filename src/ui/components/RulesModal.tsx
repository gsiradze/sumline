import { BACK_PRIORITY_OVERLAY } from '../../platform/back';
import { useBackHandler } from '../hooks/useBackHandler';
import { CloseIcon } from './icons';

interface RulesModalProps {
  readonly onDismiss: () => void;
  /** Runs the guided first solve again. */
  readonly onReplay: () => void;
}

/** The rules for reference, from the "?" in a level. The teaching is done by the tour on level 1. */
export function RulesModal({ onDismiss, onReplay }: RulesModalProps) {
  useBackHandler(onDismiss, BACK_PRIORITY_OVERLAY);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-label="How to play"
      style={{ paddingBottom: 'var(--bottom-reserve)' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute inset-0 bg-[rgba(20,18,14,0.3)] dark:bg-[rgba(0,0,0,0.6)]"
      />
      <div
        className="relative w-full bg-paper-50 rounded-t-[28px] px-5 pt-2.5 pb-6 overflow-y-auto"
        style={{
          maxHeight: '82vh',
          boxShadow: '0 -12px 30px rgba(60,42,20,0.14)',
        }}
      >
        <div className="w-10 h-1 bg-rule-200 rounded-full mx-auto my-2" />
        <div className="flex items-start justify-between mt-3">
          <div className="font-serif text-[22px] font-medium text-ink-900">How to play</div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="w-11 h-11 -mr-1.5 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3.5 flex flex-col gap-3">
          {[
            { n: 1, t: 'Mark filled cells.', d: 'Tap to mark. Tap again to unmark.' },
            {
              n: 2,
              t: 'Use the row and column sums.',
              d: 'Each sum is the number of filled cells in that row or column.',
            },
            {
              n: 3,
              t: 'Submit to check.',
              d: 'Correct marks lock green. Wrong marks are crossed out for good.',
            },
            {
              n: 4,
              t: 'Rule out cells.',
              d: 'Hold a cell, or switch to Rule out, to pencil a dash where you think it is empty. Dashes are only your notes.',
            },
          ].map(r => (
            <div key={r.n} className="flex items-start gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-paper-200 flex items-center justify-center font-serif text-[14px] font-semibold text-ink-900">
                {r.n}
              </div>
              <div className="flex-1">
                <div className="font-sans text-[15px] font-semibold text-ink-900">{r.t}</div>
                <div className="font-sans text-[13px] leading-[1.5] text-ink-500 mt-0.5">{r.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3.5 rounded-[12px] bg-paper-100 border border-dashed border-rule-300 flex items-center gap-3">
          <ResultExample />
          <div className="font-sans text-[12px] leading-[1.5] text-ink-500">
            <span className="text-sage-700 font-semibold">Green</span>: correct & locked.{' '}
            <span className="text-ink-900 font-semibold">Filled</span>: your current mark.
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full h-11 rounded-[12px] bg-fill-800 text-paper-50 font-sans text-[14px] font-semibold active:scale-[0.98] transition-transform duration-nudge"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="mt-2 w-full h-11 rounded-[12px] border border-rule-200 bg-paper-50 text-ink-900 font-sans text-[14px] font-semibold active:scale-[0.98] transition-transform duration-nudge"
        >
          Replay tutorial
        </button>
      </div>
    </div>
  );
}

// A guess as it comes back: 0 untouched, 2 right (green, locked), 3 wrong (ruled out).
const EXAMPLE_CELLS: readonly number[] = [0, 2, 3, 0, 2, 0, 2, 2, 2];
const EXAMPLE_ROW_SUMS = [2, 1, 3] as const;
const EXAMPLE_COL_SUMS = [1, 3, 2] as const;
const EXAMPLE_SUM =
  'flex items-center justify-center font-semibold tabular-nums text-ink-700 text-[11px]';

function ResultExample() {
  return (
    <div
      className="inline-grid font-serif"
      style={{
        gridTemplateColumns: '14px repeat(3, 22px)',
        gridTemplateRows: '14px repeat(3, 22px)',
        gap: 3,
      }}
    >
      <div />
      {EXAMPLE_COL_SUMS.map((n, c) => (
        <div key={`c${c}`} className={EXAMPLE_SUM}>
          {n}
        </div>
      ))}
      {EXAMPLE_ROW_SUMS.map((n, r) => (
        <ExampleRow key={r} row={r} sum={n} />
      ))}
    </div>
  );
}

function ExampleRow({ row, sum }: { readonly row: number; readonly sum: number }) {
  return (
    <>
      <div className={EXAMPLE_SUM}>{sum}</div>
      {[0, 1, 2].map(c => {
        const v = EXAMPLE_CELLS[row * 3 + c] ?? 0;
        const look =
          v === 2
            ? 'bg-sage-500 border-sage-700'
            : v === 3
              ? 'bg-clay-100 border-clay-300'
              : 'bg-paper-50 border-rule-200';
        return <div key={c} className={`w-[22px] h-[22px] rounded-[6px] border ${look}`} />;
      })}
    </>
  );
}
