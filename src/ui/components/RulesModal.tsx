import { useState } from 'react';
import { ChevronRightIcon, CloseIcon } from './icons';

interface RulesModalProps {
  readonly onDismiss: () => void;
  readonly variant?: 'intro' | 'reference';
}

interface Panel {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
}

const PANELS: readonly Panel[] = [
  {
    eyebrow: 'How to play · 1 of 3',
    title: 'Mark the cells you think are filled.',
    body: 'Tap once to mark. Tap again to unmark. Only the marked cells count.',
  },
  {
    eyebrow: 'How to play · 2 of 3',
    title: 'Use the row and column sums.',
    body: 'Each sum tells you how many cells are filled in that row or column. The numbers never change.',
  },
  {
    eyebrow: 'How to play · 3 of 3',
    title: 'Submit to check.',
    body: 'Correct marks lock green. Wrong marks clear. A few guesses are all you get — deduce carefully.',
  },
];

export function RulesModal({ onDismiss, variant = 'reference' }: RulesModalProps) {
  if (variant === 'intro') return <RulesIntro onDismiss={onDismiss} />;
  return <RulesSheet onDismiss={onDismiss} />;
}

function RulesIntro({ onDismiss }: { readonly onDismiss: () => void }) {
  const [i, setI] = useState(0);
  const panel = PANELS[i]!;
  const atEnd = i === PANELS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-paper-100 flex flex-col"
      role="dialog"
      aria-label="How to play"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="w-9" />
        <div className="flex items-center gap-1.5">
          {PANELS.map((_, j) => (
            <span
              key={j}
              className={`h-[3px] rounded-full transition-all duration-nudge ${
                j === i ? 'w-[18px] bg-ochre-500' : 'w-1.5 bg-rule-200'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="font-sans text-[13px] text-ink-500 hover:text-ink-900 px-2"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 px-6 flex flex-col justify-center">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
          {panel.eyebrow}
        </div>
        <h2 className="mt-2 font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink-900">
          {panel.title}
        </h2>
        <p className="mt-3 font-sans text-[15px] leading-[1.55] text-ink-700 max-w-xs">
          {panel.body}
        </p>

        {i === 0 && <DemoGrid />}
      </div>

      <div className="px-4 pt-4 pb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setI(Math.max(0, i - 1))}
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-400 disabled:opacity-30"
          disabled={i === 0}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => (atEnd ? onDismiss() : setI(i + 1))}
          className="h-11 px-5 rounded-full bg-fill-800 text-paper-50 font-sans text-[14px] font-semibold inline-flex items-center gap-2 active:scale-[0.97] transition-transform duration-nudge"
        >
          {atEnd ? 'Got it' : 'Next'}
          {!atEnd && <ChevronRightIcon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function RulesSheet({ onDismiss }: { readonly onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-label="How to play">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute inset-0 bg-[rgba(20,18,14,0.3)]"
      />
      <div
        className="relative w-full bg-paper-50 rounded-t-[28px] px-5 pt-2.5"
        style={{
          maxHeight: '80vh',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
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
            className="w-9 h-9 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center"
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
              d: 'Correct marks lock green. Wrong marks clear.',
            },
          ].map(r => (
            <div key={r.n} className="flex items-start gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-paper-200 flex items-center justify-center font-serif text-[14px] font-semibold text-ink-900">
                {r.n}
              </div>
              <div className="flex-1">
                <div className="font-sans text-[15px] font-semibold text-ink-900">
                  {r.t}
                </div>
                <div className="font-sans text-[13px] leading-[1.5] text-ink-500 mt-0.5">
                  {r.d}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3.5 rounded-[12px] bg-paper-100 border border-dashed border-rule-300 flex items-center gap-3">
          <DemoGrid compact />
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
      </div>
    </div>
  );
}

function DemoGrid({ compact = false }: { readonly compact?: boolean }) {
  // Tiny 3×3 demo with 1 filled + 2 green-locked cells.
  const rowSums = [2, 1, 3];
  const colSums = [1, 3, 2];
  // 0 empty, 1 filled mark, 2 green-locked
  const cells = [0, 1, 1, 0, 1, 0, 1, 1, 1];
  const size = compact ? 22 : 46;
  const gap = compact ? 3 : 5;
  return (
    <div className={compact ? '' : 'mt-7'}>
      <div
        className="inline-grid font-serif text-ink-900"
        style={{
          gridTemplateColumns: `${compact ? 14 : 22}px repeat(3, ${size}px)`,
          gridTemplateRows: `${compact ? 14 : 22}px repeat(3, ${size}px)`,
          gap,
        }}
      >
        <div />
        {colSums.map((n, i) => (
          <div
            key={`c${i}`}
            className="flex items-center justify-center font-medium text-ink-700"
            style={{ fontSize: compact ? 11 : 16 }}
          >
            {n}
          </div>
        ))}
        {rowSums.map((n, r) => (
          <Row
            key={r}
            n={n}
            row={r}
            cells={cells}
            size={size}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  n,
  row,
  cells,
  size,
  compact,
}: {
  readonly n: number;
  readonly row: number;
  readonly cells: readonly number[];
  readonly size: number;
  readonly compact: boolean;
}) {
  return (
    <>
      <div
        className="flex items-center justify-center font-medium text-ink-700"
        style={{ fontSize: compact ? 11 : 16 }}
      >
        {n}
      </div>
      {[0, 1, 2].map(c => {
        const v = cells[row * 3 + c] ?? 0;
        const base =
          v === 1
            ? 'bg-fill-800 border-transparent shadow-sh-ink'
            : v === 2
              ? 'bg-sage-500 border-sage-700'
              : 'bg-paper-50 border-rule-200';
        return (
          <div
            key={c}
            className={`relative rounded-[6px] border ${base}`}
            style={{ width: size, height: size }}
          >
            {v === 2 && !compact && (
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-sage-700/60"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </>
  );
}
