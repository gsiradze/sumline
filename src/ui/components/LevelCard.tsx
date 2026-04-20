import { LockIcon, StarIcon } from './icons';
import { coordsForLevelId } from '../../game/domain/levels';
import type { LevelProgressRecord } from '../../game/domain/levels';

interface LevelCardProps {
  readonly levelId: number;
  readonly progress: LevelProgressRecord;
  readonly locked: boolean;
  readonly onClick: (levelId: number) => void;
}

export function LevelCard({ levelId, progress, locked, onClick }: LevelCardProps) {
  const { indexInBatch } = coordsForLevelId(levelId);
  const displayNumber = indexInBatch + 1;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onClick(levelId)}
      className={`group relative aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-transform duration-nudge active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60 ${
        locked
          ? 'border-rule-200 bg-paper-50 text-ink-400 cursor-not-allowed'
          : progress.completed
            ? 'border-sage-300 bg-sage-100/60 text-ink-900 hover:bg-sage-100'
            : 'border-rule-300 bg-paper-50 text-ink-900 hover:bg-paper-200/70'
      }`}
      aria-label={`Level ${levelId + 1}${locked ? ' (locked)' : ''}`}
    >
      {locked ? (
        <LockIcon className="w-5 h-5 text-ink-400" />
      ) : (
        <>
          <span className="font-serif text-[20px] font-semibold leading-none tabular-nums">
            {displayNumber}
          </span>
          {progress.completed ? (
            <>
              <span className="flex items-center gap-[2px] text-ochre-600">
                {[0, 1, 2].map(i => (
                  <StarIcon
                    key={i}
                    className="w-3 h-3"
                    filled={i < progress.stars}
                  />
                ))}
              </span>
              {progress.bestGuessCount !== null && (
                <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-ink-500">
                  best {progress.bestGuessCount}
                </span>
              )}
            </>
          ) : (
            <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-500">
              L{levelId + 1}
            </span>
          )}
        </>
      )}
    </button>
  );
}
