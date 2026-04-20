import { CELL_COUNT, Feedback } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';
import type { Cell, FeedbackGrid, Guess } from '../../game/domain/types';

interface HistoryStripProps {
  readonly state: ActiveGameState;
}

export function HistoryStrip({ state }: HistoryStripProps) {
  if (state.guesses.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 items-center px-5 pt-3 pb-1">
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500 mr-1">
        Past
      </span>
      {state.guesses.map((guess, i) => {
        const fb = state.feedbacks[i];
        if (!fb) return null;
        return <MiniGrid key={i} guess={guess} feedback={fb} />;
      })}
    </div>
  );
}

function MiniGrid({ guess, feedback }: { guess: Guess; feedback: FeedbackGrid }) {
  return (
    <div className="grid grid-cols-6 gap-[1px] rounded-sm overflow-hidden w-12 h-12 bg-paper-200 p-[1px]">
      {Array.from({ length: CELL_COUNT }, (_, i) => (
        <span key={i} className={cellClass(guess[i] ?? 0, feedback[i] ?? Feedback.Red)} />
      ))}
    </div>
  );
}

function cellClass(cell: Cell, fb: Feedback): string {
  if (fb === Feedback.Green) {
    return cell === 1 ? 'bg-sage-500' : 'bg-sage-100';
  }
  return cell === 1 ? 'bg-clay-500' : 'bg-clay-100';
}
