import { useCallback, useEffect, useRef, useState } from 'react';
import { PhaserGame } from '../PhaserGame';
import { useGameState } from '../hooks/useGameState';
import { useAudioFx } from '../hooks/useAudioFx';
import { useRetry } from '../hooks/useRetry';
import { SubmitButton } from './SubmitButton';
import { LastGuessSummary } from './LastGuessSummary';
import { RulesModal } from './RulesModal';
import { HintButton } from './HintButton';
import { TeachingHint } from './TeachingHint';
import { WinScreen } from './WinScreen';
import { RetryGate } from './RetryGate';
import { ArrowLeftIcon, QuestionIcon } from './icons';
import { getRulesShown, setRulesShown } from '../../storage/persistence';
import { GameOutcome } from '../../game/domain/types';
import { guessesRemaining } from '../../game/domain/game-state';
import { starsForWin } from '../../game/domain/stars';
import type { Stars } from '../../game/domain/stars';
import { coordsForLevelId, progressForLevel } from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import type { LevelWin } from '../../game/domain/stats';

import { TOTAL_LEVELS, configForTier } from '../../game/domain/tiers';
import type { BakedLevel } from '../../storage/levelsManifest';
import { registerGame } from '../../testHook';

interface LevelGameViewProps {
  readonly level: BakedLevel;
  readonly progress: LevelProgressMap;
  readonly onRecordWin: (levelId: number, guessCount: number, stars: Stars) => void;
  readonly onRecordStatsWin: (win: LevelWin) => void;
  readonly onRecordStatsLoss: () => void;
  readonly onBack: () => void;
  readonly onGotoLevel: (levelId: number) => void;
}

export function LevelGameView({
  level,
  progress,
  onRecordWin,
  onRecordStatsWin,
  onRecordStatsLoss,
  onBack,
  onGotoLevel,
}: LevelGameViewProps) {
  const game = useGameState(level);
  useAudioFx(game.state);
  const retry = useRetry(level.id);
  const recordedRef = useRef(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const gameStateRef = useRef(game.state);
  gameStateRef.current = game.state;
  const [showRules, setShowRules] = useState(() => !getRulesShown());

  useEffect(
    () =>
      registerGame({
        tapCell: game.onCellTapped,
        submit: game.submit,
        restart: game.restart,
        getState: () => gameStateRef.current,
      }),
    [game.onCellTapped, game.submit, game.restart],
  );

  const handleDismissRules = useCallback(() => {
    setShowRules(false);
    setRulesShown(true);
  }, []);

  useEffect(() => {
    if (recordedRef.current) return;
    if (game.state.outcome === GameOutcome.Won) {
      const used = game.state.guesses.length;
      const stars = starsForWin(level.tier, used);
      const existing = progressForLevel(progressRef.current, level.id);
      const firstCompletion = !existing.completed;
      onRecordWin(level.id, used, stars);
      onRecordStatsWin({ guessCount: used, stars, firstCompletion });
      retry.reset();
      recordedRef.current = true;
    } else if (game.state.outcome === GameOutcome.Lost) {
      onRecordStatsLoss();
      recordedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.state.outcome]);

  const handleRetry = useCallback(() => {
    game.restart();
    recordedRef.current = false;
  }, [game]);

  const remaining = guessesRemaining(game.state);
  const isTerminal = game.state.outcome !== GameOutcome.InProgress;
  const config = configForTier(level.tier);

  const nextLevelId = level.id + 1 < TOTAL_LEVELS ? level.id + 1 : null;
  const onNext = useCallback(() => {
    if (nextLevelId !== null) onGotoLevel(nextLevelId);
    else onBack();
  }, [nextLevelId, onBack, onGotoLevel]);

  const tierLabel = config.label;
  const { indexInBatch, batchIndexInTier } = coordsForLevelId(level.id);
  const withinSet = indexInBatch + 1;
  const setNumber = batchIndexInTier + 1;

  const stars: Stars =
    game.state.outcome === GameOutcome.Won
      ? starsForWin(level.tier, game.state.guesses.length)
      : 0;

  return (
    <main
      className="min-h-screen flex flex-col font-sans text-ink-900 bg-paper-100 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <header className="px-4 pt-8 pb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to levels"
          className="w-10 h-10 rounded-[10px] border border-rule-200 bg-paper-50 text-ink-700 flex items-center justify-center active:scale-95 transition-transform duration-nudge shrink-0"
        >
          <ArrowLeftIcon className="w-[18px] h-[18px]" />
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-500 whitespace-nowrap">
            {tierLabel} · {setNumber}.{withinSet}
          </div>
          <h1 className="font-serif text-[22px] font-medium leading-[1.15] tracking-[-0.01em] text-ink-900 mt-0.5">
            Level {level.id + 1}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            aria-label="Show rules"
            className="w-10 h-10 rounded-[10px] border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
          >
            <QuestionIcon className="w-[18px] h-[18px]" />
          </button>
          <div
            className="h-10 min-w-[52px] px-2.5 rounded-[10px] border border-rule-200 bg-paper-50 flex items-center justify-center"
            aria-label={`${remaining} of ${level.guessBudget} guesses remaining`}
          >
            <span className="inline-flex items-baseline gap-[2px] leading-none">
              <span className="font-serif text-[22px] font-semibold text-ink-900 tabular-nums">
                {remaining}
              </span>
              <span className="font-mono text-[12px] text-ink-500 tabular-nums">
                /{level.guessBudget}
              </span>
            </span>
          </div>
        </div>
      </header>

      {!isTerminal && (level.id < 7 || level.teachingHint) && (
        <TeachingHint
          hint={
            level.id < 7
              ? 'One row is already solved — green = filled, blank = empty. Use the sums to deduce the rest, then submit.'
              : level.teachingHint!
          }
        />
      )}

      <div className="flex justify-center px-3">
        <div className="w-full max-w-md aspect-[500/520] mx-auto">
          <PhaserGame
            state={game.state}
            onCellTapped={game.onCellTapped}
            inputDisabled={showRules}
          />
        </div>
      </div>

      {game.state.outcome === GameOutcome.Won && (
        <WinScreen
          state={game.state}
          levelId={level.id + 1}
          stars={stars}
          onNext={nextLevelId !== null ? onNext : null}
          onBack={onBack}
        />
      )}
      {game.state.outcome === GameOutcome.Lost && (
        <RetryGate
          state={game.state}
          retry={retry}
          onRetry={handleRetry}
          onBack={onBack}
        />
      )}

      {!isTerminal && game.state.guesses.length > 0 && (
        <LastGuessSummary state={game.state} budget={level.guessBudget} />
      )}

      {!isTerminal && (
        <div
          className="px-4 pt-4 flex flex-col gap-2.5"
          style={{
            paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
            background:
              'linear-gradient(to top, var(--paper-100) 70%, rgba(250,246,240,0) 100%)',
          }}
        >
          <SubmitButton state={game.state} onSubmit={game.submit} />
          <div className="flex justify-center">
            <HintButton state={game.state} onHintCell={game.applyHint} />
          </div>
        </div>
      )}

      {showRules && <RulesModal onDismiss={handleDismissRules} variant="intro" />}
    </main>
  );
}
