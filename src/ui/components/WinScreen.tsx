import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLAY_STORE_URL, WEB_APP_URL } from '../../config/links';
import { generateShareText } from '../../game/domain/shareGrid';
import type { ActiveGameState } from '../../game/domain/game-state';
import type { Stars } from '../../game/domain/stars';
import { displayLink, levelLink } from '../../platform/deepLink';
import { canShareImages, shareOrCopy } from '../../platform/share';
import type { ShareImage } from '../../platform/share';
import { shareResult } from '../../telemetry/events';
import { renderShareCard } from '../shareCard';
import { ShareIcon, StarIcon } from './icons';

interface WinScreenProps {
  readonly state: ActiveGameState;
  /** The number the player sees (1-based). */
  readonly levelNumber: number;
  readonly tierLabel: string;
  /** "Daily #12" when this is the day's puzzle: one attempt, nothing after it. */
  readonly dailyTitle?: string | null;
  readonly stars: Stars;
  /** Null when there is no next level to go to (locked set, or the last level). */
  readonly nextLevelNumber: number | null;
  readonly onNext: () => void;
  /** Starts the level over, for an ad. Offered while there are stars still to earn. */
  readonly onReplay: () => void;
  /** The replay's ad is loading or showing. */
  readonly replayPending: boolean;
  readonly onBack: () => void;
  /** True once Next has been pressed: everything is inert until the screen changes. */
  readonly busy: boolean;
}

// Fixed footer: 16 + 54 + 10 + 44 + 16.
const FOOTER_PX = 140;

export function WinScreen({
  state,
  levelNumber,
  tierLabel,
  dailyTitle = null,
  stars,
  nextLevelNumber,
  onNext,
  onReplay,
  replayPending,
  onBack,
  busy,
}: WinScreenProps) {
  const used = state.guesses.length;
  // The link opens this level on the web version when there is one; the store otherwise.
  const link = dailyTitle === null ? levelLink(WEB_APP_URL, levelNumber) : null;
  const shareText = useMemo(
    () =>
      generateShareText(state, {
        levelNumber,
        title: dailyTitle ?? undefined,
        stars,
        url: link ?? PLAY_STORE_URL,
      }),
    [state, levelNumber, dailyTitle, stars, link],
  );
  const [copied, setCopied] = useState(false);
  // Drawn ahead of time: the share sheet must open straight from the tap.
  const cardRef = useRef<ShareImage | null>(null);
  useEffect(() => {
    // The share image names a level; a daily result is shared as text.
    if (!canShareImages() || dailyTitle !== null) return;
    let cancelled = false;
    void renderShareCard({
      levelNumber,
      tierLabel,
      rowSums: state.puzzle.rowSums,
      colSums: state.puzzle.colSums,
      stars,
      guesses: used,
      footer: link ? displayLink(link) : 'Sumline on Google Play',
    })
      .then(blob => {
        if (!cancelled && blob)
          cardRef.current = { blob, name: `sumline-level-${levelNumber}.png` };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [levelNumber, tierLabel, dailyTitle, state.puzzle, stars, used, link]);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);

  // On short screens the result would otherwise sit under the fixed footer.
  useEffect(() => {
    headlineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleShare = useCallback(async () => {
    const outcome = await shareOrCopy({
      text: shareText,
      title: `Sumline ${dailyTitle ?? `#${levelNumber}`}`,
      image: cardRef.current,
    });
    shareResult('level', outcome);
    if (outcome === 'copied') setCopied(true);
  }, [shareText, levelNumber, dailyTitle]);

  const secondary =
    'flex-1 h-11 rounded-[12px] bg-paper-50 border border-rule-200 text-ink-700 font-sans text-[14px] font-medium whitespace-nowrap inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-nudge disabled:opacity-60';

  return (
    <section
      className="px-4 pt-3 text-center"
      role="status"
      aria-live="polite"
      style={{ paddingBottom: FOOTER_PX + 16 }}
    >
      <div className="mt-2 inline-flex gap-1" aria-label={`${stars} of 3 stars`}>
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
      <h2
        ref={headlineRef}
        className="font-serif text-[42px] font-semibold leading-[1.05] tracking-[-0.015em] text-ink-900 mt-2.5"
      >
        Solved in {used}.
      </h2>
      <div className="mt-1.5 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
        {used} {used === 1 ? 'guess' : 'guesses'} · {state.guessBudget} available
      </div>

      <div
        className="fixed inset-x-0 z-40 px-4 pt-4 pb-4"
        style={{
          bottom: 'var(--bottom-reserve)',
          background:
            'linear-gradient(to top, var(--paper-100) 78%, var(--page-veil) 90%, var(--page-clear) 100%)',
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={nextLevelNumber !== null ? onNext : onBack}
            disabled={busy}
            className="w-full h-[54px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold active:scale-[0.98] transition-transform duration-nudge shadow-sh-2 disabled:opacity-60"
          >
            {nextLevelNumber !== null
              ? `Next · Level ${nextLevelNumber}`
              : dailyTitle !== null
                ? 'Done'
                : 'Back to levels'}
          </button>
          <div className="mt-2.5 flex items-center gap-2.5">
            {stars < 3 && dailyTitle === null && (
              <button
                type="button"
                onClick={onReplay}
                disabled={busy}
                aria-label="Replay: watch an ad to play this level again"
                className={secondary}
              >
                <span>{replayPending ? 'Loading ad…' : 'Replay'}</span>
                {!replayPending && (
                  <span className="font-mono text-[9px] tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[3px] bg-ochre-100 text-ochre-700">
                    AD
                  </span>
                )}
              </button>
            )}
            <button type="button" onClick={handleShare} disabled={busy} className={secondary}>
              <ShareIcon className="w-4 h-4" />
              <span>{copied ? 'Copied' : 'Share result'}</span>
            </button>
            {nextLevelNumber !== null && (
              <button type="button" onClick={onBack} disabled={busy} className={secondary}>
                All levels
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
