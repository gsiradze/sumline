import { canSubmit, guessesUsed, markedCount } from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';

interface SubmitButtonProps {
  readonly state: ActiveGameState;
  readonly onSubmit: () => void;
}

export function SubmitButton({ state, onSubmit }: SubmitButtonProps) {
  if (!canSubmit(state)) return null;
  const next = guessesUsed(state) + 1;
  const marked = markedCount(state);
  const cap = state.puzzle.filledCount;
  const atCap = marked >= cap;
  const label = next === 1 ? 'Submit guess' : `Guess ${next} of ${state.guessBudget}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`font-mono text-[10px] tracking-[0.14em] uppercase text-center tabular-nums ${
          atCap ? 'text-sage-700' : 'text-ink-500'
        }`}
        aria-live="polite"
      >
        {marked} of {cap} marked
      </div>
      <button
        type="button"
        onClick={onSubmit}
        className="w-full h-[54px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold tracking-[0.01em] shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
      >
        {label}
      </button>
    </div>
  );
}
