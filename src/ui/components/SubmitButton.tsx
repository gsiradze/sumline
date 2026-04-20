import { canSubmit, guessesUsed, markedCount } from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';

interface SubmitButtonProps {
  readonly state: ActiveGameState;
  readonly onSubmit: () => void;
}

export function SubmitButton({ state, onSubmit }: SubmitButtonProps) {
  if (!canSubmit(state)) return null;
  const next = guessesUsed(state) + 1;
  const label = next === 1 ? 'Submit guess' : `Guess ${next} of ${state.guessBudget}`;
  const marked = markedCount(state);
  const target = state.puzzle.filledCount;
  const short = target - marked;
  return (
    <div className="flex flex-col items-stretch gap-1">
      {short > 0 && (
        <div className="text-center font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500">
          {short} more to mark — cap is {target}
        </div>
      )}
      <button
        type="button"
        onClick={onSubmit}
        className="w-full font-sans text-[15px] font-semibold tracking-[0.02em] text-paper-100 bg-fill-800 rounded-md py-3 shadow-sh-2 transition-transform duration-nudge ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
      >
        {label}
      </button>
    </div>
  );
}
