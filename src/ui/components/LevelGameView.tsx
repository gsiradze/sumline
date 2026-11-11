import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { freshGame, useGameState } from '../hooks/useGameState';
import { useAudioFx } from '../hooks/useAudioFx';
import { useBackHandler } from '../hooks/useBackHandler';
import { useKeepAwake } from '../hooks/useKeepAwake';
import { useRetry } from '../hooks/useRetry';
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
import { TutorialCoach } from './TutorialCoach';
import { WinScreen } from './WinScreen';
import { RetryGate } from './RetryGate';
import { ArrowLeftIcon, GearIcon, QuestionIcon } from './icons';
import { getRulesShown, setRulesShown } from '../../storage/persistence';
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
  tutorialComplete,
} from '../../telemetry/events';
import { maybeRequestReview } from '../../platform/review';
import { GameOutcome } from '../../game/domain/types';
import { guessesRemaining, markedCount } from '../../game/domain/game-state';
import { LineAxis, findHintLine } from '../../game/domain/hint';
import { starsForWin } from '../../game/domain/stars';
import {
  COACH_READING_STEPS,
  CoachStep,
  TUTORIAL_LEVEL_ID,
  coachView,
  findForcedLine,
  isLineMarked,
} from '../../game/domain/tutorial';
import type { Stars } from '../../game/domain/stars';
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
}

// One line per tutorial level. Each is true of every puzzle, not just this one.
const TEACHING_TIPS: readonly string[] = [
  'One row is done for you. Each number counts the filled cells in its row or column.',
  'Right marks lock in green. Wrong marks turn into ✕ and stay ruled out.',
  'When a row or column has all its filled cells, the rest are dashed out for you.',
  'Sure a cell is empty? Switch to Rule out, or hold the cell, to pencil a dash.',
  'You can only mark as many cells as are filled. Use every mark: each one tells you something.',
  'Fewer guesses, more stars. Solve in two for all three.',
  'No easy lines in this one. Make a careful first guess, then work from what locks in.',
];

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
}: LevelGameViewProps) {
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
  const [rules, setRules] = useState<'intro' | 'reference' | null>(null);
  const [markMode, setMarkMode] = useState<MarkMode>('mark');
  const [adBusy, setAdBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hinted, setHinted] = useState<BoardSpotlight | null>(null);
  // Level 1 teaches a new player by walking them through it (see tutorial.ts).
  const [coaching, setCoaching] = useState(false);
  const [coachReached, setCoachReached] = useState(0);
  const tutorialStart = useMemo(
    () => (level.id === TUTORIAL_LEVEL_ID ? freshGame(level) : null),
    [level],
  );
  const forcedLine = useMemo(
    () => (tutorialStart ? findForcedLine(tutorialStart) : null),
    [tutorialStart],
  );

  useEffect(() => {
    mountedAtRef.current = Date.now();
    levelStart(level.id);
  }, [level.id]);

  useEffect(() => {
    let cancelled = false;
    void getRulesShown().then(shown => {
      if (cancelled || shown) return;
      // A new player who opens some other level first gets the short rules instead.
      if (level.id === TUTORIAL_LEVEL_ID) setCoaching(true);
      else setRules('intro');
      tutorialBegin();
    });
    return () => {
      cancelled = true;
    };
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

  const handleDismissIntro = useCallback((skipped: boolean) => {
    setRules(null);
    setCoaching(false);
    void setRulesShown(true);
    tutorialComplete(skipped);
    // The banner stays off until a new player has finished the tutorial.
    void adProvider.showBanner();
  }, []);

  const handleDismissReference = useCallback(() => {
    setRules(null);
  }, []);

  const coach = coaching ? coachView(game.state, coachReached, forcedLine) : null;
  const coachReading =
    coach !== null && (coach.step === CoachStep.Clues || coach.step === CoachStep.SolvedRow);
  const forcedLineDone = forcedLine === null || isLineMarked(game.state, forcedLine);
  // The coach never locks the board. A player who starts marking while it is
  // still explaining has plainly read enough: it moves on with them.
  const startedPlaying =
    tutorialStart !== null &&
    (markedCount(game.state) !== markedCount(tutorialStart) ||
      game.state.emptyNotes.includes(true));
  useEffect(() => {
    if (!coaching) return;
    if (coachReached < COACH_READING_STEPS && startedPlaying) {
      setCoachReached(COACH_READING_STEPS);
    } else if (coachReached === COACH_READING_STEPS && forcedLineDone) {
      setCoachReached(COACH_READING_STEPS + 1);
    }
  }, [coaching, coachReached, startedPlaying, forcedLineDone]);
  useEffect(() => {
    if (coaching && game.state.outcome === GameOutcome.Won) handleDismissIntro(false);
  }, [coaching, game.state.outcome, handleDismissIntro]);

  useEffect(() => {
    if (!game.hydrated || recordedRef.current) return;
    const outcome = game.state.outcome;
    if (outcome === GameOutcome.InProgress) return;
    recordedRef.current = true;
    // A result restored from an earlier visit was counted when it happened.
    if (game.restoredTerminal) return;
    const durationS = Math.round((Date.now() - mountedAtRef.current) / 1000);
    const used = game.state.guesses.length;
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
  // until this one is complete. The win itself counts toward that.
  const nextLevelId = level.id + 1 < TOTAL_LEVELS ? level.id + 1 : null;
  const progressWithWin: LevelProgressMap = isWon
    ? { ...progress, [level.id]: { completed: true, bestGuessCount: used, stars } }
    : progress;
  const nextOpen = nextLevelId !== null && isLevelAccessible(progressWithWin, nextLevelId);

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

  const { indexInBatch, batchIndexInTier } = coordsForLevelId(level.id);
  const tip = level.id < TEACHING_TIPS.length ? TEACHING_TIPS[level.id] : level.teachingHint;
  const inputBlocked = rules !== null || adBusy || !game.hydrated;
  const coachSpotlight =
    coach && coach.cells.length + coach.rows.length + coach.cols.length > 0 ? coach : null;
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
            <span>{config.label}</span>
            <span>
              {'\u00A0'}· {batchIndexInTier + 1}.{indexInBatch + 1}
            </span>
          </div>
          <h1 className="font-serif text-[22px] max-[359px]:text-[20px] font-medium leading-[1.15] tracking-[-0.01em] text-ink-900 mt-0.5">
            Level {level.id + 1}
          </h1>
        </div>
        <div className="flex items-center gap-2 max-[359px]:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setRules('reference')}
            aria-label="Show rules"
            className={`${HEADER_BUTTON} text-ink-500 hover:text-ink-900`}
          >
            <QuestionIcon className="w-[18px] h-[18px]" />
          </button>
          <div
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

      {coach ? (
        <TutorialCoach
          text={coach.text}
          onNext={coachReading ? () => setCoachReached(n => n + 1) : null}
          onSkip={() => handleDismissIntro(true)}
        />
      ) : (
        !isTerminal && tip && <TeachingHint hint={tip} />
      )}

      <div className="px-3">
        <div className="board-box" style={boardSizeVars(Boolean(tip))}>
          <Board
            state={game.state}
            tool={markMode}
            onMark={game.onCellTapped}
            onNote={game.onCellNoted}
            inputDisabled={inputBlocked}
            animate={game.hydrated}
            spotlight={hinted ?? coachSpotlight}
          />
          <BeaverOverlay state={game.state} levelId={level.id} />
        </div>
      </div>

      {isWon && (
        <WinScreen
          state={game.state}
          levelNumber={level.id + 1}
          tierLabel={config.label}
          stars={stars}
          nextLevelNumber={nextOpen && nextLevelId !== null ? nextLevelId + 1 : null}
          onNext={handleNext}
          onBack={onBack}
          busy={advancing}
        />
      )}
      {isLost && (
        <RetryGate state={game.state} retry={retry} onRetry={handleRetry} onBack={onBack} />
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

      {rules === 'intro' && <RulesModal onDismiss={handleDismissIntro} variant="intro" />}
      {rules === 'reference' && (
        <RulesModal onDismiss={handleDismissReference} variant="reference" />
      )}
    </main>
  );
}
