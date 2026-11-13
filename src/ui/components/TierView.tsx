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
import type { LevelProgressMap, LevelProgressRecord } from '../../game/domain/levels';
import { configForTier, levelsInTier } from '../../game/domain/tiers';
import { useBackHandler } from '../hooks/useBackHandler';
import { TIER_PLACE_NAMES } from '../tierPlaces';
import { ArrowLeftIcon, LockIcon, StarIcon } from './icons';

interface TierViewProps {
  readonly tier: Tier;
  readonly progress: LevelProgressMap;
  readonly onBack: () => void;
  readonly onPickLevel: (levelId: number) => void;
}

// A set is a stretch of the trail the home map starts: seven stones, four out
// and three back. Positions are in a 100-wide box so the trail and the stones
// share them at any screen width.
const STONE_PX = 56;
const ROW_Y = [34, 132] as const;
const TRAIL_HEIGHT = 182;
const STONES: readonly { readonly x: number; readonly row: 0 | 1 }[] = [
  { x: 12.5, row: 0 },
  { x: 37.5, row: 0 },
  { x: 62.5, row: 0 },
  { x: 87.5, row: 0 },
  { x: 75, row: 1 },
  { x: 50, row: 1 },
  { x: 25, row: 1 },
];
const TRAIL_PATH =
  `M12.5 ${ROW_Y[0]} L87.5 ${ROW_Y[0]} ` +
  `C104 ${ROW_Y[0]} 104 ${ROW_Y[1]} 75 ${ROW_Y[1]} L25 ${ROW_Y[1]}`;

// Numbers on a coloured stone are the same cream in both themes, as the home
// map's pins are.
const ON_STONE = '#FDFBF6';

enum StoneState {
  Locked = 'locked',
  Open = 'open',
  Next = 'next',
  Done = 'done',
}

export function TierView({ tier, progress, onBack, onPickLevel }: TierViewProps) {
  useBackHandler(onBack);
  const config = configForTier(tier);
  const earnedStars = tierStars(progress, tier);
  const maxStars = maxStarsForTier(tier);
  const size = levelsInTier(tier);

  const sets = useMemo(() => {
    let nextFound = false;
    return Array.from({ length: config.batches }, (_, batchIndexInTier) => {
      const unlocked = isBatchUnlocked(progress, tier, batchIndexInTier);
      const done = batchCompletionCount(progress, tier, batchIndexInTier);
      const stones = Array.from({ length: BATCH_SIZE }, (_, indexInBatch) => {
        const levelId = levelIdForCoords({ tier, batchIndexInTier, indexInBatch });
        const record = progressForLevel(progress, levelId);
        let state = StoneState.Locked;
        if (record.completed) state = StoneState.Done;
        else if (unlocked && !nextFound) {
          // The first unsolved level in the tier: where the player goes on.
          nextFound = true;
          state = StoneState.Next;
        } else if (unlocked) state = StoneState.Open;
        return { levelId, indexInBatch, record, state };
      });
      return { batchIndexInTier, unlocked, done, stones };
    });
  }, [config.batches, progress, tier]);

  return (
    <main
      className="screen-min-h flex flex-col font-sans text-ink-900 overflow-x-hidden"
      style={{
        backgroundColor: 'var(--home-page)',
        backgroundImage:
          'radial-gradient(rgba(120,100,60,0.05) 1px, transparent 1px), radial-gradient(rgba(195,154,62,0.05) 1px, transparent 1px)',
        backgroundSize: '3px 3px, 9px 9px',
        backgroundPosition: '0 0, 1px 2px',
      }}
    >
      <div className="w-full max-w-md mx-auto flex flex-col flex-1">
        <header className="px-5 pt-2 pb-5">
          <button
            type="button"
            onClick={onBack}
            className="h-11 pr-4 inline-flex items-center gap-1.5 -ml-1 text-ink-500 hover:text-ink-900 font-mono text-[11px] tracking-[0.14em] uppercase"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Tiers
          </button>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ochre-700">
                {TIER_PLACE_NAMES[tier]}
              </div>
              <h1 className="mt-1 font-serif text-[34px] font-semibold leading-none tracking-[-0.015em]">
                {config.label}
              </h1>
            </div>
            <div className="pb-0.5 text-right">
              <div className="inline-flex items-center gap-1.5 text-ochre-700">
                <StarIcon className="w-4 h-4" filled />
                <span className="font-serif text-[18px] font-semibold leading-none tabular-nums">
                  {earnedStars} / {maxStars}
                </span>
              </div>
              <div className="mt-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500">
                {size} levels
              </div>
            </div>
          </div>
          <div
            className="mt-4 h-[6px] rounded-full bg-rule-200 overflow-hidden"
            role="progressbar"
            aria-label="Stars earned in this tier"
            aria-valuemin={0}
            aria-valuemax={maxStars}
            aria-valuenow={earnedStars}
          >
            <div
              className="h-full rounded-full bg-ochre-500 transition-[width] duration-500 ease-out"
              style={{ width: `${(earnedStars / maxStars) * 100}%` }}
            />
          </div>
        </header>

        <section className="flex-1 px-5 pb-8 flex flex-col gap-4">
          {sets.map(({ batchIndexInTier, unlocked, done, stones }) => (
            <div
              key={batchIndexInTier}
              className="rounded-[20px] border border-rule-200 bg-paper-50 px-3 pt-3.5 pb-2 shadow-sh-1"
            >
              <div className="px-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-[17px] font-semibold tracking-[-0.01em]">
                    Set {batchIndexInTier + 1}
                  </h2>
                  {!unlocked && <LockIcon className="w-3.5 h-3.5 text-ink-400" />}
                </div>
                <span
                  className={`font-mono text-[10px] tracking-[0.14em] uppercase ${
                    done === BATCH_SIZE ? 'text-sage-700' : 'text-ink-500'
                  }`}
                >
                  {done} / {BATCH_SIZE}
                </span>
              </div>

              <div className="relative mt-1" style={{ height: TRAIL_HEIGHT }}>
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 100 ${TRAIL_HEIGHT}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d={TRAIL_PATH}
                    stroke="var(--rule-300)"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeDasharray="5 7"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                </svg>
                {stones.map(({ levelId, indexInBatch, record, state }) => (
                  <Stone
                    key={levelId}
                    levelId={levelId}
                    number={indexInBatch + 1}
                    record={record}
                    state={state}
                    x={STONES[indexInBatch]!.x}
                    y={ROW_Y[STONES[indexInBatch]!.row]}
                    onPick={onPickLevel}
                  />
                ))}
              </div>
              {!unlocked && (
                <p className="px-1.5 pb-2 -mt-1 font-sans text-[12px] text-ink-500">
                  Complete all 7 in the previous set to unlock.
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

const STONE_FILL: Readonly<Record<StoneState, string>> = {
  [StoneState.Locked]: 'var(--paper-200)',
  [StoneState.Open]: 'var(--paper-50)',
  [StoneState.Next]: 'var(--ochre-500)',
  [StoneState.Done]: 'var(--sage-500)',
};

function Stone({
  levelId,
  number,
  record,
  state,
  x,
  y,
  onPick,
}: {
  readonly levelId: number;
  readonly number: number;
  readonly record: LevelProgressRecord;
  readonly state: StoneState;
  readonly x: number;
  readonly y: number;
  readonly onPick: (levelId: number) => void;
}) {
  const locked = state === StoneState.Locked;
  const coloured = state === StoneState.Next || state === StoneState.Done;
  const best = record.bestGuessCount;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onPick(levelId)}
      data-state={state}
      className="absolute flex flex-col items-center active:scale-95 transition-transform duration-nudge focus-visible:outline-none disabled:cursor-not-allowed"
      style={{
        left: `calc(${x}% - ${STONE_PX / 2}px)`,
        top: y - STONE_PX / 2,
        width: STONE_PX,
      }}
      aria-label={`Level ${levelId + 1}${locked ? ' (locked)' : ''}`}
      title={
        record.completed && best !== null
          ? `${record.stars} of 3 stars, best ${best} ${best === 1 ? 'guess' : 'guesses'}`
          : undefined
      }
    >
      <span
        className="flex items-center justify-center font-serif text-[22px] font-semibold leading-none tabular-nums"
        style={{
          width: STONE_PX,
          height: STONE_PX,
          borderRadius: '50%',
          background: STONE_FILL[state],
          color: coloured ? ON_STONE : 'var(--ink-900)',
          border: locked ? '2px solid var(--rule-200)' : '2px solid var(--pin-edge)',
          boxShadow: locked ? 'none' : '0 4px 0 var(--pin-edge), 0 6px 10px rgba(0,0,0,0.12)',
          animation:
            state === StoneState.Next ? 'homeTierPulse 2.2s ease-in-out infinite' : undefined,
        }}
      >
        {locked ? <LockIcon className="w-[18px] h-[18px] text-ink-400" /> : number}
      </span>
      <span className="mt-2.5 h-3 flex items-center gap-[2px] text-ochre-600">
        {record.completed
          ? [0, 1, 2].map(i => <StarIcon key={i} className="w-3 h-3" filled={i < record.stars} />)
          : state === StoneState.Next && (
              <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-ochre-700">
                Play
              </span>
            )}
      </span>
    </button>
  );
}
