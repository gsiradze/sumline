import { MAX_GUESS_BUDGET } from '../../game/domain/types';
import { winRate } from '../../game/domain/stats';
import type { Stats } from '../../game/domain/stats';
import { TOTAL_LEVELS } from '../../game/domain/tiers';
import {
  maxStarsTotal,
  tierStars,
  totalStars,
} from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import { TIER_CONFIGS } from '../../game/domain/tiers';
import { CloseIcon, StarIcon } from './icons';

interface StatsModalProps {
  readonly stats: Stats;
  readonly progress: LevelProgressMap;
  readonly onDismiss: () => void;
}

export function StatsModal({ stats, progress, onDismiss }: StatsModalProps) {
  const starsEarned = totalStars(progress);
  const starsPossible = maxStarsTotal();
  const rate = Math.round(winRate(stats) * 100);
  const maxDist = Math.max(1, ...stats.distribution);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-4 py-8 bg-paper-100/95 overflow-y-auto"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-label="Your stats"
    >
      <div className="max-w-md w-full">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ochre-700">
              Your stats
            </div>
            <h2 className="font-serif text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink-900 mt-1">
              The shape of your play.
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close stats"
            className="w-9 h-9 rounded-md border border-rule-200 text-ink-500 hover:text-ink-900 flex items-center justify-center"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <StatTile label="Levels" value={`${stats.levelsCompleted} / ${TOTAL_LEVELS}`} />
          <StatTile
            label="Stars"
            value={`${starsEarned} / ${starsPossible}`}
            icon={<StarIcon className="w-3.5 h-3.5 text-ochre-600" filled />}
          />
          <StatTile label="Win rate" value={`${rate}%`} />
          <StatTile label="Wins" value={String(stats.totalWins)} />
          <StatTile label="Losses" value={String(stats.totalLosses)} />
          <StatTile
            label="Day streak"
            value={`${stats.dayStreak}${stats.bestDayStreak > stats.dayStreak ? ` · best ${stats.bestDayStreak}` : ''}`}
          />
        </div>

        <div className="mt-6">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500 mb-2">
            Guess-count distribution
          </div>
          <div className="flex flex-col gap-1">
            {stats.distribution.map((count, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 text-right font-mono text-[10px] tabular-nums text-ink-500">
                  {i + 1}
                </span>
                <div className="flex-1 h-4 bg-rule-200 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-sage-500"
                    style={{ width: `${(count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[10px] tabular-nums text-ink-700">
                  {count}
                </span>
              </div>
            ))}
            {stats.distribution.length !== MAX_GUESS_BUDGET && null}
          </div>
        </div>

        <div className="mt-6">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500 mb-2">
            Stars by tier
          </div>
          <div className="flex flex-col gap-2">
            {TIER_CONFIGS.map(cfg => {
              const earned = tierStars(progress, cfg.tier);
              const max = cfg.batches * 7 * 3;
              const pct = max === 0 ? 0 : Math.round((earned / max) * 100);
              return (
                <div key={cfg.tier} className="flex items-center gap-3">
                  <span className="w-24 font-sans text-[13px] font-semibold text-ink-900">
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-rule-200 overflow-hidden">
                    <div
                      className="h-full bg-ochre-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-ink-700 w-14 text-right">
                    {earned} / {max}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full font-sans text-[15px] font-semibold tracking-[0.02em] text-paper-100 bg-fill-800 rounded-md py-3 shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-rule-200 bg-paper-50 px-3 py-3 flex flex-col">
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-500">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1 font-serif text-[18px] font-semibold tabular-nums text-ink-900">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
