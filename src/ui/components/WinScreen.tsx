import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateShareText } from '../../game/domain/shareGrid';
import type { ActiveGameState } from '../../game/domain/game-state';
import type { Stars } from '../../game/domain/stars';
import { ShareIcon, StarIcon } from './icons';
import { ShareGridPreview } from './ShareGridPreview';

interface WinScreenProps {
  readonly state: ActiveGameState;
  readonly levelId: number;
  readonly stars: Stars;
  readonly onNext: (() => void) | null;
  readonly onBack: () => void;
}

const AUTO_ADVANCE_MS = 4500;

export function WinScreen({ state, levelId, stars, onNext, onBack }: WinScreenProps) {
  const used = state.guesses.length;
  const shareText = useMemo(
    () => generateShareText(state, { levelId, stars }),
    [state, levelId, stars],
  );
  const [copied, setCopied] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_ADVANCE_MS / 1000));
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!onNext || cancelled) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((AUTO_ADVANCE_MS - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (elapsed >= AUTO_ADVANCE_MS) {
        clearInterval(interval);
        onNextRef.current?.();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [onNext, cancelled]);

  const handleShare = useCallback(async () => {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ text: shareText, title: `Grid L${levelId + 1}` });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        await nav.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // swallow
      }
    }
  }, [shareText, levelId]);

  return (
    <section className="px-5 pt-3 pb-6 text-center" role="status" aria-live="polite">
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ochre-700">
        Solved in {used}
      </div>
      <h2 className="font-serif text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink-900 mt-1">
        Nice deduction.
      </h2>

      <div className="mt-4 flex items-center justify-center gap-2 text-ochre-600">
        {[0, 1, 2].map(i => (
          <StarIcon
            key={i}
            className={`w-7 h-7 transition-transform duration-flip ease-out ${
              i < stars ? 'scale-100' : 'scale-90 opacity-40'
            }`}
            filled={i < stars}
          />
        ))}
      </div>

      <ShareGridPreview state={state} />

      <div className="mt-5 flex flex-col items-center gap-2">
        {onNext && (
          <>
            <button
              type="button"
              onClick={onNext}
              className="w-full max-w-xs font-sans text-[15px] font-semibold tracking-[0.02em] text-paper-100 bg-fill-800 rounded-md py-3 shadow-sh-2 active:scale-[0.97] transition-transform duration-nudge"
            >
              Next level
              {!cancelled && secondsLeft > 0 && ` · ${secondsLeft}s`}
            </button>
            {!cancelled && (
              <button
                type="button"
                onClick={() => setCancelled(true)}
                className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500 hover:text-ink-900"
              >
                Cancel auto-advance
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-2 font-sans text-[13px] font-semibold tracking-[0.02em] text-ink-700 border border-rule-300 rounded-md py-2 px-5 active:scale-[0.97] transition-transform duration-nudge"
        >
          <ShareIcon className="w-3.5 h-3.5" />
          <span>{copied ? 'Copied' : 'Share'}</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 hover:text-ink-900 mt-1"
        >
          Back to levels
        </button>
      </div>
    </section>
  );
}
