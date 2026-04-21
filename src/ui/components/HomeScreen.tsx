import { useMemo } from 'react';
import {
  coordsForLevelId,
  maxStarsForTier,
  progressForLevel,
  tierStars,
} from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import { TIER_CONFIGS, TOTAL_LEVELS, levelsInTier } from '../../game/domain/tiers';
import { Tier } from '../../game/domain/types';
import type { Stats } from '../../game/domain/stats';
import {
  ChartIcon,
  ChevronRightIcon,
  FlameIcon,
  SpeakerOffIcon,
  SpeakerOnIcon,
  StarIcon,
} from './icons';
import { Wordmark } from './Wordmark';

interface HomeScreenProps {
  readonly progress: LevelProgressMap;
  readonly stats: Stats;
  readonly muted: boolean;
  readonly onToggleMute: () => void;
  readonly onPickTier: (tier: Tier) => void;
  readonly onPickLevel: (levelId: number) => void;
  readonly onOpenStats: () => void;
}

function firstIncompleteLevelId(progress: LevelProgressMap): number {
  for (let id = 0; id < TOTAL_LEVELS; id++) {
    if (!progressForLevel(progress, id).completed) return id;
  }
  return TOTAL_LEVELS - 1;
}

function dailyLevelId(): number {
  const today = new Date();
  const key = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  // Seed daily into Beginner/Intermediate range for accessibility.
  const span = levelsInTier(Tier.Beginner) + levelsInTier(Tier.Intermediate);
  return key % span;
}

const TIER_ACCENT: Record<Tier, string> = {
  [Tier.Beginner]: 'bg-sage-500',
  [Tier.Intermediate]: 'bg-sage-500',
  [Tier.Advanced]: 'bg-ochre-500',
  [Tier.Expert]: 'bg-ochre-500',
  [Tier.Master]: 'bg-ink-300',
};

export function HomeScreen({
  progress,
  stats,
  muted,
  onToggleMute,
  onPickTier,
  onPickLevel,
  onOpenStats,
}: HomeScreenProps) {
  const continueLevelId = useMemo(() => firstIncompleteLevelId(progress), [progress]);
  const continueCoords = coordsForLevelId(continueLevelId);
  const continueTier = TIER_CONFIGS.find(c => c.tier === continueCoords.tier)!;
  const continueStars = progressForLevel(progress, continueLevelId).stars;

  const todayDaily = useMemo(dailyLevelId, []);
  const dateLabel = useMemo(() => {
    const d = new Date();
    const m = d.toLocaleString('en-US', { month: 'short' });
    return `${m} ${d.getDate()}`;
  }, []);
  const dailyDone = progressForLevel(progress, todayDaily).completed;

  return (
    <main
      className="min-h-screen flex flex-col font-sans text-ink-900 bg-paper-100 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="px-5 pt-5 flex items-center justify-between">
        <Wordmark size={26} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenStats}
            aria-label="Open stats"
            className="w-9 h-9 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
          >
            <ChartIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="w-9 h-9 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
          >
            {muted ? (
              <SpeakerOffIcon className="w-[18px] h-[18px]" />
            ) : (
              <SpeakerOnIcon className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>
      </header>

      {/* Continue card — primary CTA */}
      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={() => onPickLevel(continueLevelId)}
          className="relative w-full overflow-hidden rounded-[20px] bg-fill-800 text-paper-50 px-[22px] py-5 text-left shadow-sh-3 active:scale-[0.99] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
        >
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-paper-50/55">
            Continue · {continueTier.label} · Set {continueCoords.batchIndexInTier + 1}
          </div>
          <div className="flex items-end justify-between mt-1.5">
            <div className="font-serif text-[34px] font-semibold leading-none tracking-[-0.01em]">
              Level {continueLevelId + 1}
            </div>
            <div className="flex gap-[3px] pb-1">
              {[0, 1, 2].map(i => (
                <StarIcon
                  key={i}
                  className={`w-4 h-4 ${
                    i < continueStars ? 'text-ochre-500' : 'text-paper-50/25'
                  }`}
                  filled={i < continueStars}
                />
              ))}
            </div>
          </div>
          <div className="mt-[18px] flex items-center justify-between">
            <div className="font-sans text-[13px] text-paper-50/65">
              {continueCoords.indexInBatch + 1} of 7 · {continueTier.guessBudget} guesses
            </div>
            <div className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-paper-50 text-ink-900 font-sans text-[14px] font-semibold">
              Resume
              <ChevronRightIcon className="w-[13px] h-[13px] text-ink-700" />
            </div>
          </div>
          {/* corner grid motif */}
          <div
            aria-hidden="true"
            className="absolute -right-2.5 -top-2.5 opacity-[0.12] pointer-events-none"
          >
            <div className="grid grid-cols-4 gap-[2px]">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-[14px] h-[14px] rounded-[2px] border border-paper-50 ${
                    [0, 3, 5, 9, 10, 12].includes(i) ? 'bg-paper-50' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Daily card — secondary */}
      <div className="px-5 pt-3">
        <button
          type="button"
          onClick={() => onPickLevel(todayDaily)}
          className="w-full flex items-center gap-3 rounded-[16px] bg-paper-50 border border-ochre-500 px-4 py-3.5 active:scale-[0.99] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-500/60"
          style={{ boxShadow: '0 0 0 3px rgba(195,154,62,0.10)' }}
        >
          <div className="w-10 h-10 rounded-[10px] bg-ochre-100 text-ochre-700 flex items-center justify-center shrink-0">
            <FlameIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-serif text-[16px] font-medium text-ink-900">
              Daily · {dateLabel}
            </div>
            <div className="font-sans text-[12px] text-ink-500 mt-px">
              {stats.dayStreak > 0
                ? `${stats.dayStreak}-day streak · ${dailyDone ? 'played' : 'unplayed'}`
                : dailyDone
                  ? 'played today'
                  : 'start a streak'}
            </div>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-ink-400" />
        </button>
      </div>

      {/* Tiers */}
      <section className="px-5 pt-[22px] pb-8 flex-1">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 mb-2.5">
          Tiers
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {TIER_CONFIGS.slice(0, 4).map(cfg => {
            const earned = tierStars(progress, cfg.tier);
            const max = maxStarsForTier(cfg.tier);
            const pct = max === 0 ? 0 : (earned / max) * 100;
            return (
              <button
                key={cfg.tier}
                type="button"
                onClick={() => onPickTier(cfg.tier)}
                className="text-left rounded-[14px] border border-rule-200 bg-paper-50 p-3.5 shadow-sh-1 active:scale-[0.99] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-serif text-[17px] font-medium text-ink-900">
                    {cfg.label}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-ink-500">
                    {earned}/{max}
                  </div>
                </div>
                <div className="mt-2.5 h-1 rounded-full bg-paper-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${TIER_ACCENT[cfg.tier]} transition-[width] duration-fade`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
        {/* Master (full-width, lower emphasis) */}
        {TIER_CONFIGS[4] && (
          <MasterTile
            tier={TIER_CONFIGS[4]}
            progress={progress}
            onPickTier={onPickTier}
          />
        )}
      </section>
    </main>
  );
}

interface MasterTileProps {
  readonly tier: (typeof TIER_CONFIGS)[number];
  readonly progress: LevelProgressMap;
  readonly onPickTier: (tier: Tier) => void;
}

function MasterTile({ tier, progress, onPickTier }: MasterTileProps) {
  const earned = tierStars(progress, tier.tier);
  const max = maxStarsForTier(tier.tier);
  const pct = max === 0 ? 0 : (earned / max) * 100;
  return (
    <button
      type="button"
      onClick={() => onPickTier(tier.tier)}
      className="mt-2.5 w-full text-left rounded-[14px] border border-rule-200 bg-paper-50 p-3.5 active:scale-[0.99] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
    >
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-[17px] font-medium text-ink-900">{tier.label}</div>
        <div className="font-mono text-[11px] tabular-nums text-ink-500">
          {earned}/{max}
        </div>
      </div>
      <div className="mt-2.5 h-1 rounded-full bg-paper-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${TIER_ACCENT[tier.tier]} transition-[width] duration-fade`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
