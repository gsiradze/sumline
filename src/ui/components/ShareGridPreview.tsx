import { CELL_COUNT, Feedback } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';
import type { Cell, FeedbackGrid, Guess } from '../../game/domain/types';

interface ShareGridPreviewProps {
  readonly state: ActiveGameState;
}

export function ShareGridPreview({ state }: ShareGridPreviewProps) {
  if (state.guesses.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-2 mt-5">
      {state.guesses.map((guess, i) => {
        const fb = state.feedbacks[i];
        if (!fb) return null;
        return <MiniBlock key={i} guess={guess} feedback={fb} />;
      })}
    </div>
  );
}

function MiniBlock({ guess, feedback }: { guess: Guess; feedback: FeedbackGrid }) {
  return (
    <div className="grid grid-cols-6 gap-[2px] bg-paper-200 p-[2px] rounded-sm w-[84px]">
      {Array.from({ length: CELL_COUNT }, (_, i) => (
        <span
          key={i}
          className={`aspect-square rounded-[1px] ${cellColor(guess[i] ?? 0, feedback[i] ?? Feedback.Red)}`}
        />
      ))}
    </div>
  );
}

function cellColor(cell: Cell, fb: Feedback): string {
  if (fb === Feedback.Green) return cell === 1 ? 'bg-sage-500' : 'bg-sage-100';
  return cell === 1 ? 'bg-clay-500' : 'bg-clay-100';
}
