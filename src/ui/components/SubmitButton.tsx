import { guessesUsed, markedCount } from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';
import { GameOutcome } from '../../game/domain/types';

interface SubmitButtonProps {
  readonly state: ActiveGameState;
  readonly onSubmit: () => void;
  readonly disabled?: boolean;
}

export function SubmitButton({ state, onSubmit, disabled }: SubmitButtonProps) {
  const marked = markedCount(state);
  const cap = state.puzzle.filledCount;
  const used = guessesUsed(state);

  if (state.outcome !== GameOutcome.InProgress) return null;

  const over = marked - cap;
  const short = cap - marked;
  const next = used + 1;
  // Marks of the player's own: a guess without any would spend a turn and show nothing.
  const own = state.currentMarks.some((mark, i) => mark === 1 && !state.lockedFilled[i]);

  let label = next === 1 ? 'Submit guess' : `Guess ${next} of ${state.guessBudget}`;
  if (over > 0) label = `Remove ${over} ${over === 1 ? 'mark' : 'marks'} to submit`;
  else if (!own) label = 'Mark some cells first';
  // A short guess cannot win, but it is the player's to make.
  else if (short > 0) label = `Submit ${marked} of ${cap}`;

  return (
    <button
      type="button"
      data-tour="submit"
      onClick={onSubmit}
      disabled={disabled || over > 0 || !own}
      className="w-full h-[54px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold tracking-[0.01em] shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
    >
      {label}
    </button>
  );
}
