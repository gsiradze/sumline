import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateShareText } from '../../game/domain/shareGrid';
import { CELL_COUNT, Feedback } from '../../game/domain/types';
import type { ActiveGameState } from '../../game/domain/game-state';
import type { Stars } from '../../game/domain/stars';
import { ShareIcon, StarIcon } from './icons';

interface WinScreenProps {
  readonly state: ActiveGameState;
  readonly levelId: number;
  readonly stars: Stars;
  readonly onNext: (() => void) | null;
  readonly onBack: () => void;
}

const AUTO_ADVANCE_MS = 4500;

function buildEmojiGrid(state: ActiveGameState): string[] {
  // Use the final state's locked cells as the "solved" picture.
  const rows: string[] = [];
  const side = Math.sqrt(CELL_COUNT);
  for (let r = 0; r < side; r++) {
    let row = '';
    for (let c = 0; c < side; c++) {
      const i = r * side + c;
      if (state.puzzle.solution[i] === 1) row += '🟩';
      else row += '⬜';
    }
    rows.push(row);
  }
  return rows;
}

export function WinScreen({ state, levelId, stars, onNext, onBack }: WinScreenProps) {
  const used = state.guesses.length;
  const shareText = useMemo(
    () => generateShareText(state, { levelId, stars }),
    [state, levelId, stars],
  );
  const emojiRows = useMemo(() => buildEmojiGrid(state), [state]);
  const [copied, setCopied] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_ADVANCE_MS / 1000));
  const [progress, setProgress] = useState(0);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!onNext || cancelled) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((AUTO_ADVANCE_MS - elapsed) / 1000));
      setSecondsLeft(remaining);
      setProgress(Math.min(1, elapsed / AUTO_ADVANCE_MS));
      if (elapsed >= AUTO_ADVANCE_MS) {
        clearInterval(interval);
        onNextRef.current?.();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [onNext, cancelled]);

  const handleShare = useCallback(async () => {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ text: shareText, title: `Sumline L${levelId}` });
        return;
      } catch {
        // fall through
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

  const dateLabel = useMemo(() => {
    const d = new Date();
    return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
  }, []);

  const available = state.guessBudget;
  const hitGreens = state.feedbacks.length
    ? state.feedbacks[state.feedbacks.length - 1]?.every(f => f === Feedback.Green)
    : false;
  void hitGreens;

  return (
    <section
      className="px-4 pt-3 text-center"
      role="status"
      aria-live="polite"
      style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
    >
      <div className="mt-2 inline-flex gap-1">
        {[0, 1, 2].map(i => (
          <StarIcon
            key={i}
            className={`w-8 h-8 transition-transform duration-flip ease-out ${
              i < stars ? 'text-ochre-500 scale-100' : 'text-ochre-500/25 scale-95'
            }`}
            filled={i < stars}
          />
        ))}
      </div>
      <h2 className="font-serif text-[42px] font-semibold leading-[1.05] tracking-[-0.015em] text-ink-900 mt-2.5">
        Solved in {used}.
      </h2>
      <div className="mt-1.5 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
        {used} {used === 1 ? 'guess' : 'guesses'} · {available} available
      </div>

      <div className="mt-5 mx-auto max-w-sm rounded-[16px] bg-paper-50 border border-rule-200 px-4 py-3.5 shadow-sh-1 text-left">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
              Sumline · #{levelId}
            </div>
            <div className="font-serif text-[14px] font-medium text-ink-700 mt-0.5">
              {dateLabel} · {used}/{available}
            </div>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="h-9 px-3.5 rounded-full bg-fill-800 text-paper-50 font-sans text-[13px] font-semibold inline-flex items-center gap-2 active:scale-[0.97] transition-transform duration-nudge"
          >
            <ShareIcon className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
        <div className="mt-3 font-mono text-[17px] leading-[22px] tracking-[0.04em] text-ink-900">
          {emojiRows.map((row, i) => (
            <div key={i}>{row}</div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="relative w-full h-[54px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold overflow-hidden active:scale-[0.98] transition-transform duration-nudge"
          >
            {!cancelled && (
              <span
                className="absolute left-0 top-0 bottom-0 bg-white/[0.08] transition-[width] duration-[100ms] ease-linear"
                style={{ width: `${progress * 100}%` }}
                aria-hidden="true"
              />
            )}
            <span className="relative">
              Next · Level {levelId + 1}
              {!cancelled && secondsLeft > 0 && (
                <span className="font-mono opacity-60 ml-2">{secondsLeft}s</span>
              )}
            </span>
          </button>
        )}
        <div className="mt-3 flex items-center justify-between px-1">
          {onNext && !cancelled ? (
            <button
              type="button"
              onClick={() => setCancelled(true)}
              className="font-sans text-[13px] text-ink-500 hover:text-ink-900"
            >
              Cancel auto-advance
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onBack}
            className="font-sans text-[13px] text-ink-500 hover:text-ink-900"
          >
            Back to levels
          </button>
        </div>
      </div>
    </section>
  );
}
