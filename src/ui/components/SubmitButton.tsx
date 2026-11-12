import { useEffect, useState } from 'react';
import { guessesUsed, markedCount } from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';
import { GameOutcome } from '../../game/domain/types';

interface SubmitButtonProps {
  readonly state: ActiveGameState;
  readonly onSubmit: () => void;
  readonly disabled?: boolean;
}

const CONFIRM_WINDOW_MS = 4000;

export function SubmitButton({ state, onSubmit, disabled }: SubmitButtonProps) {
  const marked = markedCount(state);
  const cap = state.puzzle.filledCount;
  const used = guessesUsed(state);
  const [confirming, setConfirming] = useState(false);

  // Any change to the board, or a short pause, withdraws the confirmation.
  useEffect(() => {
    setConfirming(false);
  }, [marked, used]);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(t);
  }, [confirming]);

  if (state.outcome !== GameOutcome.InProgress) return null;

  const over = marked - cap;
  const short = cap - marked;
  const next = used + 1;

  let label = next === 1 ? 'Submit guess' : `Guess ${next} of ${state.guessBudget}`;
  if (over > 0) label = `Remove ${over} ${over === 1 ? 'mark' : 'marks'} to submit`;
  else if (confirming) label = `Only ${marked} of ${cap} marked · submit anyway?`;

  const handleClick = (): void => {
    if (over > 0) return;
    // A guess with unused marks can never win and always tells you less.
    if (short > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onSubmit();
  };

  return (
    <button
      type="button"
      data-tour="submit"
      onClick={handleClick}
      disabled={disabled || over > 0}
      className={`w-full h-[54px] rounded-[14px] text-paper-50 font-sans text-[16px] font-semibold tracking-[0.01em] shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60 ${
        confirming ? 'bg-clay-600' : 'bg-fill-800'
      }`}
    >
      {label}
    </button>
  );
}
