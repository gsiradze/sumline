import { CELL_COUNT, Feedback, GRID_SIZE } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';

interface LastGuessSummaryProps {
  readonly state: ActiveGameState;
}

interface GuessTally {
  readonly correct: number;
  readonly wrong: number;
}

function tallyGuess(guess: readonly (0 | 1)[], feedback: readonly Feedback[]): GuessTally {
  let correct = 0;
  let wrong = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (guess[i] !== 1) continue;
    if (feedback[i] === Feedback.Green) correct++;
    else wrong++;
  }
  return { correct, wrong };
}

/**
 * Always the same height, so the Submit button never moves: guidance before
 * the first guess, then the result of the latest one.
 */
export function LastGuessSummary({ state }: LastGuessSummaryProps) {
  const lastFb = state.feedbacks[state.feedbacks.length - 1];
  const lastGuess = state.guesses[state.guesses.length - 1];
  const shell =
    'h-[58px] bg-paper-50 border border-rule-200 rounded-[12px] px-3.5 flex items-center justify-between gap-4';

  if (!lastFb || !lastGuess) {
    const cap = state.puzzle.filledCount;
    return (
      <div className={shell}>
        <p className="font-sans text-[13px] leading-[1.4] text-ink-700">
          <span className="font-semibold text-ink-900">{cap} cells are filled.</span> Mark where you
          think they are, then submit.
        </p>
      </div>
    );
  }

  const last = tallyGuess(lastGuess, lastFb);
  return (
    <div className={shell} role="status">
      <div>
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500">
          Last guess · {state.guesses.length}/{state.guessBudget}
        </div>
        <div className="mt-0.5 font-sans text-[14px] text-ink-900">
          <span className="font-semibold text-sage-700">{last.correct} correct</span>
          <span className="text-ink-400 mx-1.5">·</span>
          <span className="font-semibold text-clay-700">{last.wrong} wrong</span>
        </div>
      </div>
      <MiniGrid guess={lastGuess} feedback={lastFb} />
    </div>
  );
}

function MiniGrid({
  guess,
  feedback,
}: {
  readonly guess: readonly (0 | 1)[];
  readonly feedback: readonly Feedback[];
}) {
  return (
    <div
      className="inline-grid gap-[2px] shrink-0"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 5px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 5px)`,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: CELL_COUNT }).map((_, i) => {
        const marked = guess[i] === 1;
        const correct = marked && feedback[i] === Feedback.Green;
        const wrong = marked && feedback[i] === Feedback.Red;
        const cls = correct ? 'bg-sage-500' : wrong ? 'bg-clay-500' : 'bg-paper-300';
        return <div key={i} className={`w-[5px] h-[5px] rounded-[1px] ${cls}`} />;
      })}
    </div>
  );
}
