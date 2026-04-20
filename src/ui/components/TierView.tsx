import { useMemo } from 'react';
import type { Tier } from '../../game/domain/types';
import { BATCH_SIZE } from '../../game/domain/types';
import {
  batchCompletionCount,
  isBatchUnlocked,
  levelIdForCoords,
  maxStarsForTier,
  progressForLevel,
  tierStars,
} from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import { configForTier, firstLevelIdOfTier, levelsInTier } from '../../game/domain/tiers';
import { ArrowLeftIcon, LockIcon, StarIcon } from './icons';
import { LevelCard } from './LevelCard';

interface TierViewProps {
  readonly tier: Tier;
  readonly progress: LevelProgressMap;
  readonly onBack: () => void;
  readonly onPickLevel: (levelId: number) => void;
}

export function TierView({ tier, progress, onBack, onPickLevel }: TierViewProps) {
  const config = configForTier(tier);
  const baseId = firstLevelIdOfTier(tier);
  const earnedStars = tierStars(progress, tier);
  const maxStars = maxStarsForTier(tier);
  const size = levelsInTier(tier);

  const batchMeta = useMemo(() => {
    return Array.from({ length: config.batches }, (_, batchIndexInTier) => {
      const unlocked = isBatchUnlocked(progress, tier, batchIndexInTier);
      const done = batchCompletionCount(progress, tier, batchIndexInTier);
      return { batchIndexInTier, unlocked, done };
    });
  }, [config.batches, progress, tier]);

  return (
    <main className="min-h-screen flex flex-col font-sans text-ink-900 bg-paper-100">
      <header className="px-5 pt-6 pb-4 border-b border-rule-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 -ml-1 text-ink-500 hover:text-ink-900 font-mono text-[11px] tracking-[0.14em] uppercase"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Tiers
        </button>
        <div className="mt-2 flex items-baseline justify-between">
          <h1 className="font-serif text-[28px] font-semibold tracking-[-0.01em]">
            {config.label}
          </h1>
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500">
            {size} levels
          </span>
        </div>
        <div className="mt-2 inline-flex items-center gap-2 text-ochre-700">
          <StarIcon className="w-4 h-4" filled />
          <span className="font-serif text-[16px] font-semibold tabular-nums">
            {earnedStars} / {maxStars}
          </span>
        </div>
      </header>

      <section className="flex-1 px-5 py-4 flex flex-col gap-5">
        {batchMeta.map(({ batchIndexInTier, unlocked, done }) => (
          <div key={batchIndexInTier}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-[16px] font-semibold tracking-[-0.01em]">
                  Set {batchIndexInTier + 1}
                </h2>
                {!unlocked && <LockIcon className="w-3.5 h-3.5 text-ink-400" />}
              </div>
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500">
                {done} / {BATCH_SIZE}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: BATCH_SIZE }, (_, i) => {
                const levelId = levelIdForCoords({
                  tier,
                  batchIndexInTier,
                  indexInBatch: i,
                });
                return (
                  <LevelCard
                    key={levelId}
                    levelId={levelId}
                    progress={progressForLevel(progress, levelId)}
                    locked={!unlocked}
                    onClick={onPickLevel}
                  />
                );
              })}
              <div className="col-span-4 sr-only">{`Starting at level ${baseId + 1}`}</div>
            </div>
            {!unlocked && (
              <p className="mt-2 font-sans text-[12px] text-ink-500">
                Complete all 7 in the previous set to unlock.
              </p>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
