import { CELL_COUNT, Feedback } from '../../game/domain/types';
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
  const bars = state.guesses.map((g, i) => {
    const fb = state.feedbacks[i] ?? [];
    const { correct, wrong } = tallyGuess(g, fb);
    const total = correct + wrong;
    return total === 0 ? 0 : Math.round((correct / total) * 5);
  });
  const remaining = Math.max(0, budget - state.guesses.length);

  return (
    <div className="mx-4 mt-5 bg-paper-50 border border-rule-200 rounded-[12px] px-3.5 py-3 flex items-center justify-between">
      <div>
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
          Last guess
        </div>
        <div className="mt-1 font-sans text-[14px] text-ink-900">
          <span className="font-semibold text-sage-700">{last.correct} correct</span>
          <span className="text-ink-400 mx-1.5">·</span>
          <span className="font-semibold text-clay-700">{last.wrong} wrong</span>
        </div>
      </div>
      <div className="flex gap-1">
        {bars.map((green, i) => (
          <div key={`g-${i}`} className="flex flex-col gap-[2px]">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className={`w-1.5 h-1.5 rounded-[1px] ${
                  j < green ? 'bg-sage-500' : 'bg-clay-500'
                }`}
              />
            ))}
          </div>
        ))}
        {Array.from({ length: remaining }).map((_, i) => (
          <div key={`p-${i}`} className="flex flex-col gap-[2px]">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className="w-1.5 h-1.5 rounded-[1px] bg-paper-200 border border-rule-200/60"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
