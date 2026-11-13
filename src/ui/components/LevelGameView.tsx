import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { freshGame, useGameState } from '../hooks/useGameState';
import { useAudioFx } from '../hooks/useAudioFx';
import { useBackHandler } from '../hooks/useBackHandler';
import { useKeepAwake } from '../hooks/useKeepAwake';
import { useRetry } from '../hooks/useRetry';
import { useTutorial } from '../hooks/useTutorial';
import { Board } from './Board';
import type { BoardSpotlight } from './Board';
import { boardSizeVars } from './boardLayout';
import { SubmitButton } from './SubmitButton';
import { BeaverOverlay } from './BeaverOverlay';
import { LastGuessSummary } from './LastGuessSummary';
import { MarkModeToggle } from './MarkModeToggle';
import type { MarkMode } from './MarkModeToggle';
import { RulesModal } from './RulesModal';
import { HintButton } from './HintButton';
import { TeachingHint } from './TeachingHint';
import { TutorialTour } from './TutorialTour';
import { WinScreen } from './WinScreen';
import { RetryGate } from './RetryGate';
import { ArrowLeftIcon, GearIcon, QuestionIcon } from './icons';
import { adProvider } from '../../storage/ads';
import { currentSessionCount, noteAdShown } from '../../storage/adSession';
import {
  adResult,
  hintUsed,
  levelComplete,
  levelFail,
  levelQuit,
  levelStart,
  tutorialBegin,
} from '../../telemetry/events';
import { maybeRequestReview } from '../../platform/review';
import { GRID_SIZE, GameOutcome } from '../../game/domain/types';
import { guessesRemaining, markedCount } from '../../game/domain/game-state';
import { LineAxis, findHintLine } from '../../game/domain/hint';
import { starsForWin } from '../../game/domain/stars';
import { TUTORIAL_LEVEL_ID, TourStepKind, tourTargets } from '../../game/domain/tutorial';
import type { Stars } from '../../game/domain/stars';
import type { DailyResult } from '../../game/domain/daily';
import { coordsForLevelId, isLevelAccessible, progressForLevel } from '../../game/domain/levels';
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
  /** Resolves false when the app did not move on (the level screen stays up). */
  readonly onGotoLevel: (levelId: number, opts?: { readonly skipAd?: boolean }) => Promise<boolean>;
  readonly onOpenSettings: () => void;
  /** This is level 1 and the player has not had the guided first solve yet: run it. */
  readonly runTutorial: boolean;
  readonly onTutorialEnd: (skipped: boolean) => void;
  /** Takes the player to level 1 and runs the guided first solve again. */
  readonly onReplayTutorial: () => void;
  /** The level a new player was headed for when the tutorial came first: "Next" leads there. */
  readonly resumeLevelId: number | null;
  /** Set when the level is the day's puzzle: one attempt, recorded by day. */
  readonly daily?: {
    readonly title: string;
    readonly onResult: (result: DailyResult) => void;
  };
}

// One line per tutorial level. Each is true of every puzzle, not just this one.
// One line above the board on a few early levels, by level id. The tour on
// level 1 teaches the rest, and people did not read a tip on every level.
const TEACHING_TIPS: Readonly<Record<number, string>> = {
  3: 'Sure a cell is empty? Switch to Rule out, or hold the cell, to pencil a dash.',
  4: 'Use every mark: a wrong one costs nothing, and each one tells you something.',
  5: 'Fewer guesses, more stars. Solve in two for all three.',
};

// Header buttons. Below 360 px wide everything in the header tightens a little
// so four controls and the title still fit (tests/e2e/layout.spec.ts).
const HEADER_BUTTON =
  'w-11 h-11 max-[359px]:w-10 max-[359px]:h-10 rounded-[10px] border border-rule-200 bg-paper-50 flex items-center justify-center active:scale-95 transition-transform duration-nudge';

const NOTICE_MS = 2800;
const HINT_SPOTLIGHT_MS = 1800;

export function LevelGameView({
  level,
  progress,
  onRecordWin,
  onRecordStatsWin,
  onRecordStatsLoss,
  onBack,
  onGotoLevel,
  onOpenSettings,
  runTutorial,
  onTutorialEnd,
  onReplayTutorial,
  resumeLevelId,
  daily,
}: LevelGameViewProps) {
  const dailyRef = useRef(daily);
  dailyRef.current = daily;
  const game = useGameState(level);
  useAudioFx(game.state, game.hydrated);
  useKeepAwake(game.state.outcome === GameOutcome.InProgress);
  const retry = useRetry(level.id);
  const recordedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const gameStateRef = useRef(game.state);
  gameStateRef.current = game.state;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [markMode, setMarkMode] = useState<MarkMode>('mark');
  const [adBusy, setAdBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hinted, setHinted] = useState<BoardSpotlight | null>(null);
  // Level 1 teaches a new player by walking them through it (see tutorial.ts).
  const tourBegun = useRef(false);
  const tutorialStart = useMemo(
    () => (level.id === TUTORIAL_LEVEL_ID ? freshGame(level) : null),
    [level],
  );

  useEffect(() => {
    mountedAtRef.current = Date.now();
    levelStart(level.id);
  }, [level.id]);

  useEffect(() => {
    if (notice === null) return;
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (hinted === null) return;
    const t = window.setTimeout(() => setHinted(null), HINT_SPOTLIGHT_MS);
    return () => window.clearTimeout(t);
  }, [hinted]);

  useEffect(
    () =>
      registerGame({
        tapCell: game.onCellTapped,
        noteCell: game.onCellNoted,
        submit: game.submit,
        restart: game.restart,
        getState: () => gameStateRef.current,
      }),
    [game.onCellTapped, game.onCellNoted, game.submit, game.restart],
  );

  useEffect(() => {
    if (!game.hydrated || recordedRef.current) return;
    const outcome = game.state.outcome;
    if (outcome === GameOutcome.InProgress) return;
    recordedRef.current = true;
    // A result restored from an earlier visit was counted when it happened.
    if (game.restoredTerminal) return;
    const durationS = Math.round((Date.now() - mountedAtRef.current) / 1000);
    const used = game.state.guesses.length;
    const today = dailyRef.current;
    if (today) {
      // Kept by day, not as a level: no stars toward a tier, no "levels completed".
      const stars = outcome === GameOutcome.Won ? starsForWin(level.tier, used) : 0;
      today.onResult({ won: outcome === GameOutcome.Won, guesses: used, stars });
      if (outcome === GameOutcome.Won) {
        onRecordStatsWin({ guessCount: used, stars, firstCompletion: false });
      } else onRecordStatsLoss();
      return;
    }
    if (outcome === GameOutcome.Won) {
      const stars = starsForWin(level.tier, used);
      const firstCompletion = !progressForLevel(progressRef.current, level.id).completed;
      onRecordWin(level.id, used, stars);
      onRecordStatsWin({ guessCount: used, stars, firstCompletion });
      levelComplete(level.id, used, stars, durationS, firstCompletion);
      retry.reset();
    } else {
      onRecordStatsLoss();
      levelFail(level.id, used, durationS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.state.outcome, game.hydrated]);

  const restart = game.restart;
  const handleRetry = useCallback(() => {
    recordedRef.current = false;
    mountedAtRef.current = Date.now();
    restart();
  }, [restart]);

  const tutorial = useTutorial({
    state: game.state,
    start: tutorialStart,
    onRestart: handleRetry,
    onNote: game.onCellNoted,
    onEnd: onTutorialEnd,
  });
  const beginTutorial = tutorial.begin;
  useEffect(() => {
    // Not before a saved attempt has loaded: the tour starts from a clean board.
    if (!runTutorial || !game.hydrated || tourBegun.current) return;
    tourBegun.current = true;
    tutorialBegin();
    beginTutorial();
  }, [runTutorial, game.hydrated, beginTutorial]);

  const applyHint = game.applyHint;
  const handleHint = useCallback(async () => {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const outcome = await adProvider.showRewardedAd('hint');
      adResult('hint', outcome);
      if (outcome === 'error') {
        setNotice('No ad available right now. Try again soon.');
        return;
      }
      if (outcome !== 'granted') return;
      noteAdShown(Date.now());
      const line = applyHint();
      if (!line) return;
      hintUsed(level.id);
      const isRow = line.axis === LineAxis.Row;
      setHinted({
        cells: line.cells,
        rows: isRow ? [line.index] : [],
        cols: isRow ? [] : [line.index],
      });
      setNotice(`${isRow ? 'Row' : 'Column'} ${line.index + 1} revealed.`);
    } finally {
      setAdBusy(false);
    }
  }, [adBusy, applyHint, level.id]);

  // Replaying a solved level is the same puzzle with the answer just seen, so
  // the better result is not free: it costs an ad, as a hint does.
  const handleReplay = useCallback(async () => {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const outcome = await adProvider.showRewardedAd('replay');
      adResult('replay', outcome);
      if (outcome === 'error') {
        setNotice('No ad available right now. Try again soon.');
        return;
      }
      if (outcome !== 'granted') return;
      noteAdShown(Date.now());
      handleRetry();
    } finally {
      setAdBusy(false);
    }
  }, [adBusy, handleRetry]);

  const handleHeaderBack = useCallback(() => {
    const st = gameStateRef.current;
    if (st.outcome === GameOutcome.InProgress) {
      levelQuit(
        level.id,
        st.guesses.length,
        Math.round((Date.now() - mountedAtRef.current) / 1000),
      );
    }
    onBack();
  }, [onBack, level.id]);
  useBackHandler(handleHeaderBack);

  const outcome = game.state.outcome;
  const isWon = outcome === GameOutcome.Won;
  const isLost = outcome === GameOutcome.Lost;
  const isTerminal = isWon || isLost;
  const remaining = guessesRemaining(game.state);
  const config = configForTier(level.tier);
  const used = game.state.guesses.length;
  const stars: Stars = isWon ? starsForWin(level.tier, used) : 0;

  // "Next" only leads somewhere the player may go: the next set stays locked
  // until this one is complete. The win itself counts toward that. A new player
  // who was sent here for the tutorial goes on to the level they had picked.
  const nextLevelId = daily
    ? null
    : (resumeLevelId ?? (level.id + 1 < TOTAL_LEVELS ? level.id + 1 : null));
  const progressWithWin: LevelProgressMap = isWon
    ? { ...progress, [level.id]: { completed: true, bestGuessCount: used, stars } }
    : progress;
  const nextOpen =
    nextLevelId !== null &&
    (resumeLevelId !== null || isLevelAccessible(progressWithWin, nextLevelId));

  const handleNext = useCallback(() => {
    if (advancing || nextLevelId === null) return;
    setAdvancing(true);
    void (async () => {
      // A review prompt and an ad never share the same tap.
      const reviewRequested =
        stars === 3 &&
        (await maybeRequestReview({
          stars,
          level: level.id,
          sessionCount: currentSessionCount(),
        }));
      const moved = await onGotoLevel(nextLevelId, { skipAd: reviewRequested });
      if (!moved) setAdvancing(false);
    })();
  }, [advancing, nextLevelId, stars, level.id, onGotoLevel]);

  const coords = daily ? null : coordsForLevelId(level.id);
  const tip = TEACHING_TIPS[level.id] ?? null;
  const inputBlocked = rulesOpen || adBusy || !game.hydrated;
  const tourStep = tutorial.step;
  const tourSpotlight = tourStep && {
    // A ring comes off its cell as soon as the cell is marked.
    cells: tourTargets(tourStep, game.state),
    rows: tourStep.lines.filter(id => id < GRID_SIZE),
    cols: tourStep.lines.filter(id => id >= GRID_SIZE).map(id => id - GRID_SIZE),
  };
  const marked = markedCount(game.state);
  const cap = game.state.puzzle.filledCount;

  return (
    <main className="screen-min-h flex flex-col font-sans text-ink-900 bg-paper-100">
      <header className="px-4 max-[359px]:px-3 pt-3 pb-3 flex items-center justify-between gap-3 max-[359px]:gap-2">
        <div className="flex items-center gap-2 max-[359px]:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleHeaderBack}
            aria-label="Back to levels"
            className={`${HEADER_BUTTON} text-ink-700`}
          >
            <ArrowLeftIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className={`${HEADER_BUTTON} text-ink-500 hover:text-ink-900`}
          >
            <GearIcon className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="flex-1 text-center min-w-0">
          {/* One line high: where the set and level do not fit beside the tier
              name they wrap out of sight, and the name stays centred. */}
          <div className="h-[15px] overflow-hidden flex flex-wrap justify-center font-mono text-[10px] leading-[15px] tracking-[0.12em] uppercase text-ink-500 whitespace-nowrap">
            {coords ? (
              <>
                <span>{config.label}</span>
                <span>
                  {'\u00A0'}· {coords.batchIndexInTier + 1}.{coords.indexInBatch + 1}
                </span>
              </>
            ) : (
              <span>One try a day</span>
            )}
          </div>
          <h1 className="font-serif text-[22px] max-[359px]:text-[20px] font-medium leading-[1.15] tracking-[-0.01em] text-ink-900 mt-0.5">
            {daily ? daily.title : `Level ${level.id + 1}`}
          </h1>
        </div>
        <div className="flex items-center gap-2 max-[359px]:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            aria-label="Show rules"
            className={`${HEADER_BUTTON} text-ink-500 hover:text-ink-900`}
          >
            <QuestionIcon className="w-[18px] h-[18px]" />
          </button>
          <div
            data-tour="guesses"
            className="h-11 max-[359px]:h-10 min-w-[52px] max-[359px]:min-w-[46px] px-2.5 max-[359px]:px-2 rounded-[10px] border border-rule-200 bg-paper-50 flex items-center justify-center"
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

      {!isTerminal && tip && (
        // The tour says what there is to say, next to what it is about. The tip
        // keeps its place meanwhile, so the board does not move when the tour ends.
        <div className={runTutorial || tutorial.active ? 'invisible' : undefined}>
          <TeachingHint hint={tip} />
        </div>
      )}

      <div className="px-3">
        <div className="board-box" style={boardSizeVars(Boolean(tip))}>
          <Board
            state={game.state}
            tool={tourStep?.kind === TourStepKind.RuleOut ? 'note' : markMode}
            onMark={game.onCellTapped}
            onNote={game.onCellNoted}
            inputDisabled={inputBlocked}
            animate={game.hydrated}
            spotlight={hinted ?? tourSpotlight}
            only={tutorial.only}
            onRefused={tutorial.nudge}
          />
          <BeaverOverlay state={game.state} levelId={level.id} />
        </div>
      </div>

      {isWon && (
        <WinScreen
          state={game.state}
          levelNumber={level.id + 1}
          tierLabel={config.label}
          dailyTitle={daily?.title ?? null}
          stars={stars}
          nextLevelNumber={nextOpen && nextLevelId !== null ? nextLevelId + 1 : null}
          onNext={handleNext}
          onReplay={() => void handleReplay()}
          replayPending={adBusy}
          onBack={onBack}
          busy={advancing || adBusy}
        />
      )}
      {isLost && !daily && (
        <RetryGate state={game.state} retry={retry} onRetry={handleRetry} onBack={onBack} />
      )}
      {isLost && daily && (
        <section className="px-4 pt-2 pb-5 text-center" role="status" aria-live="polite">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-clay-700">
            Out of guesses
          </div>
          <h2 className="font-serif text-[26px] font-medium leading-[1.1] tracking-[-0.01em] text-ink-900 mt-1.5">
            Not this time.
          </h2>
          <p className="mt-2 font-sans text-[13px] text-ink-500">A new puzzle arrives tomorrow.</p>
          <div className="mx-auto mt-5 w-full max-w-md">
            <button
              type="button"
              onClick={onBack}
              className="w-full h-[54px] rounded-[14px] bg-fill-800 text-paper-50 font-sans text-[16px] font-semibold active:scale-[0.98] transition-transform duration-nudge shadow-sh-2"
            >
              Done
            </button>
          </div>
        </section>
      )}

      {!isTerminal && (
        <div className="mx-auto w-full max-w-md px-4 pt-2 pb-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5" aria-live="polite">
              <span
                className={`font-serif text-[20px] font-semibold leading-none tabular-nums ${
                  marked === cap ? 'text-sage-700' : marked > cap ? 'text-clay-700' : 'text-ink-900'
                }`}
              >
                {marked}
              </span>
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-500">
                of
              </span>
              <span className="font-serif text-[20px] font-semibold leading-none tabular-nums text-ink-900">
                {cap}
              </span>
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 max-[359px]:hidden">
                marked
              </span>
            </div>
            <MarkModeToggle mode={markMode} onChange={setMarkMode} disabled={inputBlocked} />
          </div>
          <LastGuessSummary state={game.state} />
          <SubmitButton state={game.state} onSubmit={game.submit} disabled={inputBlocked} />
          <div className="flex justify-center">
            <HintButton
              onRequest={() => void handleHint()}
              pending={adBusy}
              disabled={inputBlocked || findHintLine(game.state) === null}
            />
          </div>
        </div>
      )}

      {notice !== null && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-32px)] px-4 py-2 rounded-full bg-fill-800 text-paper-50 font-sans text-[13px] shadow-sh-3 text-center pointer-events-none"
          // Over the title, which can spare the space for a moment. Any lower and
          // it would cover the column numbers a hint has just highlighted.
          style={{ top: 'calc(var(--safe-top) + 17px)' }}
        >
          {notice}
        </div>
      )}

      {tutorial.active && (
        <TutorialTour
          step={tourStep}
          state={game.state}
          settled={tutorial.settled}
          nudges={tutorial.nudges}
          onNudge={tutorial.nudge}
          onButton={tutorial.onButton}
          onSkip={tutorial.skip}
        />
      )}

      {rulesOpen && (
        <RulesModal
          onDismiss={() => setRulesOpen(false)}
          onReplay={() => {
            setRulesOpen(false);
            onReplayTutorial();
          }}
        />
      )}
    </main>
  );
}
