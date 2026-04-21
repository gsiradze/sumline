import { useCallback, useState } from 'react';
import type { ActiveGameState } from '../../game/domain/game-state';
import { Feedback } from '../../game/domain/types';
import type { UseRetry } from '../hooks/useRetry';

interface RetryGateProps {
  readonly state: ActiveGameState;
  readonly retry: UseRetry;
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

export function RetryGate({ state, retry, onRetry, onBack }: RetryGateProps) {
  const last = state.feedbacks[state.feedbacks.length - 1];
  const cellsAway = last ? countCellsAway(last) : 0;
  const [pending, setPending] = useState(false);

  const handleFreeRetry = useCallback(() => {
    retry.consumeFreeRetry();
    onRetry();
  }, [retry, onRetry]);

  const handleAdRetry = useCallback(async () => {
    if (retry.canAdRetry) {
      retry.consumeAdRetry();
      onRetry();
      return;
    }
    setPending(true);
    try {
      const granted = await retry.requestAdRetries();
      if (!granted) return;
      retry.consumeAdRetry();
      onRetry();
    } finally {
      setPending(false);
    }
  }, [retry, onRetry]);

  const isFree = retry.canFreeRetry;

  return (
    <section
      className="px-4 pt-2 text-center"
      role="status"
      aria-live="polite"
      style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
    >
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-clay-700">
        Out of guesses
      </div>
      <h2 className="font-serif text-[26px] font-medium leading-[1.1] tracking-[-0.01em] text-ink-900 mt-1.5">
        The answer was —
      </h2>
      <p className="mt-2 font-sans text-[13px] text-ink-500">
        You were{' '}
        <span className="font-serif text-[15px] font-semibold text-clay-700 tabular-nums">
          {cellsAway}
        </span>{' '}
        {cellsAway === 1 ? 'cell' : 'cells'} away.
      </p>

      <div className="mt-5">
        <button
          type="button"
          onClick={isFree ? handleFreeRetry : handleAdRetry}
          disabled={pending}
          className="w-full h-[54px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold inline-flex items-center justify-center gap-2.5 shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge disabled:opacity-60"
        >
          {isFree
            ? 'Try again'
            : pending
              ? 'Loading ad…'
              : retry.canAdRetry
                ? `Use retry · ${retry.retry.adRetriesRemaining} left`
                : 'Watch ad · retry'}
          {isFree && (
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase px-1.5 py-[3px] rounded-[3px] bg-ochre-500 text-fill-800 font-bold">
              FREE
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mt-2.5 w-full h-11 rounded-[12px] bg-paper-50 border border-rule-200 text-ink-700 font-sans text-[14px] font-medium active:scale-[0.98] transition-transform duration-nudge"
        >
          Back to levels
        </button>
      </div>
    </section>
  );
}

function countCellsAway(feedback: readonly Feedback[]): number {
  let count = 0;
  for (const f of feedback) if (f === Feedback.Red) count++;
  return count;
}
