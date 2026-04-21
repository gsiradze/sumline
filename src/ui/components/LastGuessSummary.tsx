import { CELL_COUNT, Feedback, GRID_SIZE } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';

interface LastGuessSummaryProps {
  readonly state: ActiveGameState;
  readonly budget: number;
}

interface GuessTally {
  readonly correct: number;
  readonly wrong: number;
}

function tallyGuess(
  guess: readonly (0 | 1)[],
  feedback: readonly Feedback[],
): GuessTally {
  let correct = 0;
  let wrong = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (guess[i] !== 1) continue;
    if (feedback[i] === Feedback.Green) correct++;
    else wrong++;
  }
  return { correct, wrong };
}

export function LastGuessSummary({ state, budget }: LastGuessSummaryProps) {
  if (state.guesses.length === 0) return null;
  const lastFb = state.feedbacks[state.feedbacks.length - 1];
  const lastGuess = state.guesses[state.guesses.length - 1];
  if (!lastFb || !lastGuess) return null;

  const last = tallyGuess(lastGuess, lastFb);
  const used = state.guesses.length;
  const remaining = Math.max(0, budget - used);

  return (
    <div className="mx-4 mt-5 bg-paper-50 border border-rule-200 rounded-[12px] px-3.5 py-3 flex items-center justify-between gap-4">
      <div>
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
          Last guess · {used}/{budget}
        </div>
        <div className="mt-1 font-sans text-[14px] text-ink-900">
          <span className="font-semibold text-sage-700">{last.correct} correct</span>
          <span className="text-ink-400 mx-1.5">·</span>
          <span className="font-semibold text-clay-700">{last.wrong} wrong</span>
        </div>
        {remaining > 0 && (
          <div className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-400">
            {remaining} {remaining === 1 ? 'guess' : 'guesses'} left
          </div>
        )}
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
        gridTemplateColumns: `repeat(${GRID_SIZE}, 10px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 10px)`,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: CELL_COUNT }).map((_, i) => {
        const marked = guess[i] === 1;
        const correct = marked && feedback[i] === Feedback.Green;
        const wrong = marked && feedback[i] === Feedback.Red;
        const cls = correct
          ? 'bg-sage-500'
          : wrong
            ? 'bg-clay-500'
            : 'bg-paper-200 border border-rule-200/70';
        return <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${cls}`} />;
      })}
    </div>
  );
}
