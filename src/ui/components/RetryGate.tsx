import { useCallback, useState } from 'react';
import type { ActiveGameState } from '../../game/domain/game-state';
import { Feedback } from '../../game/domain/types';
import { ArrowLeftIcon } from './icons';
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

  return (
    <section className="px-5 pt-3 pb-6 text-center" role="status" aria-live="polite">
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-clay-700">
        Out of guesses —
      </div>
      <h2 className="font-serif text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink-900 mt-1">
        Next time.
      </h2>
      <p className="font-sans text-[15px] leading-[1.5] text-ink-700 mt-3">
        You were{' '}
        <span className="font-serif text-[18px] font-semibold text-clay-700 tabular-nums">
          {cellsAway}
        </span>{' '}
        {cellsAway === 1 ? 'cell' : 'cells'} away.
      </p>

      <div className="mt-5 flex flex-col items-center gap-2">
        {retry.canFreeRetry ? (
          <button
            type="button"
            onClick={handleFreeRetry}
            className="w-full max-w-xs font-sans text-[15px] font-semibold tracking-[0.02em] text-paper-100 bg-fill-800 rounded-md py-3 shadow-sh-2 active:scale-[0.97] transition-transform duration-nudge"
          >
            Try again
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAdRetry}
            disabled={pending}
            className="w-full max-w-xs font-sans text-[15px] font-semibold tracking-[0.02em] text-paper-100 bg-fill-800 rounded-md py-3 shadow-sh-2 active:scale-[0.97] transition-transform duration-nudge disabled:opacity-60"
          >
            {pending
              ? 'Loading ad…'
              : retry.canAdRetry
                ? `Use retry (${retry.retry.adRetriesRemaining} left)`
                : 'Watch ad · get 2 retries'}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 hover:text-ink-900 mt-2"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
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
