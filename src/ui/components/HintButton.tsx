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

  const handleClick = async (): Promise<void> => {
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
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      className="h-9 px-3.5 rounded-full border border-rule-200 bg-paper-50 text-ink-700 inline-flex items-center gap-2 font-sans text-[13px] font-medium active:scale-[0.97] transition-transform duration-nudge disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
      aria-label="Get a hint — watch an ad to reveal one logically-forced cell"
    >
      <LightbulbIcon className="w-3.5 h-3.5 text-ochre-700" />
      <span>{pending ? '…' : 'Hint'}</span>
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[3px] bg-ochre-100 text-ochre-700">
        AD
      </span>
    </button>
  );
}
