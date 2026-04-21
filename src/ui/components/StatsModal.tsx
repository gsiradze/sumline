import type { Stats } from '../../game/domain/stats';
import { TOTAL_LEVELS, TIER_CONFIGS } from '../../game/domain/tiers';
import {
  maxStarsForTier,
  maxStarsTotal,
  tierStars,
  totalStars,
} from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import { CloseIcon, FlameIcon } from './icons';

interface StatsModalProps {
  readonly stats: Stats;
  readonly progress: LevelProgressMap;
  readonly onDismiss: () => void;
}

const TIER_ACCENT: Record<string, string> = {
  beginner: 'bg-sage-500',
  intermediate: 'bg-sage-500',
  advanced: 'bg-ochre-500',
  expert: 'bg-ochre-500',
  master: 'bg-ink-300',
};

export function StatsModal({ stats, progress, onDismiss }: StatsModalProps) {
  const starsEarned = totalStars(progress);
  const starsMax = maxStarsTotal();
  const maxDist = Math.max(1, ...stats.distribution);

  return (
    <div
      className="fixed inset-0 z-50 bg-paper-100 flex flex-col overflow-y-auto"
      role="dialog"
      aria-label="Your stats"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="px-4 pt-[18px] pb-2.5 flex items-center justify-between">
        <div className="w-9" />
        <h2 className="font-serif text-[20px] font-medium text-ink-900">Stats</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close stats"
          className="w-9 h-9 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* 3 topline tiles */}
      <div className="px-4 pt-1.5 grid grid-cols-3 gap-2">
        <Tile big={String(starsEarned)} sub="stars" foot={`of ${starsMax}`} accentClass="text-ochre-500" />
        <Tile
          big={String(stats.levelsCompleted)}
          sub="levels"
          foot={`of ${TOTAL_LEVELS}`}
          accentClass="text-ink-900"
        />
        <Tile
          big={String(stats.dayStreak)}
          sub="streak"
          foot={stats.bestDayStreak > 0 ? `best: ${stats.bestDayStreak}` : 'start one'}
          accentClass="text-ochre-500"
          flame
        />
      </div>

      {/* Per tier */}
      <section className="px-4 pt-5">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 mb-2">
          Per tier
        </div>
        <div className="bg-paper-50 border border-rule-200 rounded-[14px] overflow-hidden">
          {TIER_CONFIGS.map((cfg, i) => {
            const earned = tierStars(progress, cfg.tier);
            const max = maxStarsForTier(cfg.tier);
            const pct = max === 0 ? 0 : (earned / max) * 100;
            return (
              <div
                key={cfg.tier}
                className={`px-3.5 py-2.5 flex items-center gap-3 ${
                  i < TIER_CONFIGS.length - 1 ? 'border-b border-rule-200' : ''
                }`}
              >
                <div className="w-[72px] font-serif text-[14px] font-medium text-ink-900">
                  {cfg.label}
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-paper-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${TIER_ACCENT[cfg.tier]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-14 text-right font-mono text-[11px] tabular-nums text-ink-500">
                  {earned}/{max}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Guess distribution */}
      <section className="px-4 pt-4 pb-8">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 mb-2.5">
          Guess distribution
        </div>
        <div className="bg-paper-50 border border-rule-200 rounded-[14px] px-3.5 py-3">
          {stats.distribution.map((count, i) => {
            const n = i + 1;
            const barClass = n <= 2 ? 'bg-sage-500' : n <= 4 ? 'bg-ochre-500' : 'bg-clay-500';
            return (
              <div key={i} className="flex items-center gap-2.5 h-7">
                <span className="w-4 font-serif text-[14px] text-ink-900 tabular-nums">
                  {n}
                </span>
                <div className="flex-1 h-[18px]">
                  <div
                    className={`h-full rounded-[4px] ${barClass} flex items-center justify-end pr-2 font-mono text-[11px] text-paper-50 font-medium tabular-nums`}
                    style={{ width: `${Math.max(10, (count / maxDist) * 100)}%` }}
                  >
                    {count > 0 && count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

interface TileProps {
  readonly big: string;
  readonly sub: string;
  readonly foot: string;
  readonly accentClass: string;
  readonly flame?: boolean;
}

function Tile({ big, sub, foot, accentClass, flame }: TileProps) {
  return (
    <div className="rounded-[14px] border border-rule-200 bg-paper-50 p-3 shadow-sh-1">
      <div className="flex items-baseline gap-1">
        <div
          className={`font-serif text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${accentClass}`}
        >
          {big}
        </div>
        {flame && <FlameIcon className="w-3.5 h-3.5 text-ochre-500 mb-0.5" />}
      </div>
      <div className="mt-0.5 font-sans text-[12px] text-ink-700">{sub}</div>
      <div className="mt-0.5 font-mono text-[10px] text-ink-400">{foot}</div>
    </div>
  );
}
