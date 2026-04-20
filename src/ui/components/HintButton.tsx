import { useState } from 'react';
import { adProvider } from '../../storage/ads';
import { LightbulbIcon } from './icons';
import { findHintCell } from '../../game/domain/hint';
import type { ActiveGameState } from '../../game/domain/game-state';

interface HintButtonProps {
  readonly state: ActiveGameState;
  readonly onHintCell: (cellIndex: number) => void;
  readonly disabled?: boolean;
}

export function HintButton({ state, onHintCell, disabled }: HintButtonProps) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (disabled || pending) return;
    setPending(true);
    try {
      const outcome = await adProvider.showRewardedAd('hint');
      if (outcome !== 'granted') return;
      const cell = findHintCell(state);
      if (cell === null) return;
      onHintCell(cell);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-rule-300 text-ink-700 hover:text-ink-900 hover:bg-paper-200/60 disabled:opacity-50 active:scale-[0.97] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
        aria-label="Get a hint — watch an ad to reveal one logically-forced cell"
      >
        <LightbulbIcon className="w-4 h-4" />
        <span className="font-sans text-[13px] font-semibold">
          {pending ? '…' : 'Hint'}
        </span>
        <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-500">
          ad
        </span>
      </button>
      <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-400">
        reveals one forced cell · used {state.hintsUsed}
      </span>
    </div>
  );
}
