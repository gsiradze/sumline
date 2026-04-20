import { CELL_COUNT, Feedback } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';

interface LastGuessSummaryProps {
  readonly state: ActiveGameState;
}

export function LastGuessSummary({ state }: LastGuessSummaryProps) {
  const lastFb = state.feedbacks[state.feedbacks.length - 1];
  const lastGuess = state.guesses[state.guesses.length - 1];
  if (!lastFb || !lastGuess) return null;

  let filledMatch = 0;
  let emptyMatch = 0;
  let wrong = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (lastFb[i] === Feedback.Green) {
      if (lastGuess[i] === 1) filledMatch++;
      else emptyMatch++;
    } else {
      wrong++;
    }
  }
  const matched = filledMatch + emptyMatch;

  return (
    <div className="mx-5 mt-2 mb-1 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.14em] uppercase">
      <span className="text-sage-700 font-semibold">
        {matched} of {CELL_COUNT} matched
      </span>
      <span className="text-ink-500">·</span>
      <span className="text-sage-700">{filledMatch} correctly filled</span>
      <span className="text-ink-500">·</span>
      <span className="text-sage-700">{emptyMatch} correctly empty</span>
      <span className="text-ink-500">·</span>
      <span className="text-clay-700">{wrong} still wrong</span>
    </div>
  );
}
