import {
  maxStarsForTier,
  maxStarsTotal,
  tierStars,
  totalStars,
} from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import { TIER_CONFIGS } from '../../game/domain/tiers';
import type { Tier } from '../../game/domain/types';
import type { Stats } from '../../game/domain/stats';
import { ChartIcon, StarIcon } from './icons';

interface HomeScreenProps {
  readonly progress: LevelProgressMap;
  readonly stats: Stats;
  readonly onPickTier: (tier: Tier) => void;
  readonly onOpenStats: () => void;
}

export function HomeScreen({ progress, stats, onPickTier, onOpenStats }: HomeScreenProps) {
  const total = totalStars(progress);
  const totalMax = maxStarsTotal();
  return (
    <main className="min-h-screen flex flex-col font-sans text-ink-900 bg-paper-100">
      <header className="px-5 pt-8 pb-5 border-b border-rule-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
              Grid · 210 levels
            </div>
            <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-[-0.01em] mt-1">
              Pick your challenge.
            </h1>
          </div>
          <button
            type="button"
            onClick={onOpenStats}
            aria-label="Open stats"
            className="mt-1 w-9 h-9 rounded-md border border-rule-200 text-ink-500 hover:text-ink-900 flex items-center justify-center"
          >
            <ChartIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 inline-flex items-center gap-3 text-ochre-700">
          <div className="inline-flex items-center gap-1.5">
            <StarIcon className="w-4 h-4" filled />
            <span className="font-serif text-[18px] font-semibold tabular-nums">
              {total}
            </span>
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
              / {totalMax}
            </span>
          </div>
          {stats.dayStreak > 0 && (
            <div className="inline-flex items-center gap-1 text-ink-500">
              <span className="font-serif text-[14px] font-semibold tabular-nums text-ink-900">
                {stats.dayStreak}
              </span>
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase">
                day streak
              </span>
            </div>
          )}
        </div>
      </header>

      <section className="flex-1 px-5 py-4 flex flex-col gap-3">
        {TIER_CONFIGS.map(cfg => {
          const earned = tierStars(progress, cfg.tier);
          const max = maxStarsForTier(cfg.tier);
          const pct = Math.round((earned / max) * 100);
          return (
            <button
              key={cfg.tier}
              type="button"
              onClick={() => onPickTier(cfg.tier)}
              className="group text-left rounded-xl border border-rule-300 bg-paper-50 p-4 hover:bg-paper-200/70 active:scale-[0.99] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-[22px] font-semibold tracking-[-0.01em]">
                  {cfg.label}
                </h2>
                <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
                  {cfg.batches * 7} levels
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-rule-200 overflow-hidden">
                  <div
                    className="h-full bg-ochre-500 transition-[width] duration-fade"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 text-ochre-700">
                  <StarIcon className="w-3.5 h-3.5" filled />
                  <span className="font-serif text-[14px] font-semibold tabular-nums">
                    {earned}/{max}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ink-500 font-mono text-[10px] tracking-[0.14em] uppercase">
                <span>{cfg.guessBudget} guesses</span>
                {cfg.preLockedCells > 0 && <span>{cfg.preLockedCells} free cells</span>}
                <span>3★ in ≤{cfg.threeStarMaxGuesses}</span>
              </div>
            </button>
          );
        })}
      </section>
    </main>
  );
}
