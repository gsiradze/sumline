import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveGameState } from '../../game/domain/game-state';
import {
  TourAction,
  TourStepKind,
  firstTourStep,
  isTourStepDone,
  nextTourStep,
  tourTargets,
} from '../../game/domain/tutorial';
import type { TourStep } from '../../game/domain/tutorial';
import { GameOutcome } from '../../game/domain/types';
import { tutorialStep } from '../../telemetry/events';

// A finished step stays lit for a moment, so the player sees it was right.
const SETTLE_MS = 420;
// Between the dashes of a rule-out, so they are seen being drawn one by one.
const PENCIL_STEP_MS = 110;
// After a guess the veil lifts while the whole board takes the result.
const REVEAL_MS = 1500;

const NO_CELLS: ReadonlySet<number> = new Set<number>();

interface UseTutorialArgs {
  readonly state: ActiveGameState;
  /** The board the level starts with: the tour always runs from it. Null on other levels. */
  readonly start: ActiveGameState | null;
  readonly onRestart: () => void;
  readonly onNote: (index: number) => void;
  readonly onEnd: (skipped: boolean) => void;
}

export interface Tutorial {
  /** True from the first step until the puzzle is solved or the tour is skipped. */
  readonly active: boolean;
  /** The step on screen. Null while the board is showing the result of a guess. */
  readonly step: TourStep | null;
  /** The step has just been done and is about to give way to the next. */
  readonly settled: boolean;
  /** The cells that take a touch while the tour runs; null when it does not. */
  readonly only: ReadonlySet<number> | null;
  /** How many touches the current step has turned away. Each one jolts the caption. */
  readonly nudges: number;
  readonly nudge: () => void;
  readonly begin: () => void;
  readonly onButton: () => void;
  readonly skip: () => void;
}

/**
 * Runs the guided first solve (see tutorial.ts): shows a step, waits until the
 * player has done it, then works out the next from the board as it is.
 */
export function useTutorial({ state, start, onRestart, onNote, onEnd }: UseTutorialArgs): Tutorial {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<TourStep | null>(null);
  const [settled, setSettled] = useState(false);
  const [nudges, setNudges] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const timers = useRef<number[]>([]);
  const shownCount = useRef(0);
  const pencilling = useRef<TourStep | null>(null);

  const clearTimers = useCallback((): void => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const later = useCallback((run: () => void, ms: number): void => {
    const t = window.setTimeout(() => {
      timers.current = timers.current.filter(other => other !== t);
      run();
    }, ms);
    timers.current.push(t);
  }, []);

  const show = useCallback((next: TourStep | null): void => {
    setSettled(false);
    setNudges(0);
    setStep(next);
    if (next) tutorialStep(next.kind, shownCount.current++);
  }, []);

  const begin = useCallback((): void => {
    if (!start) return;
    clearTimers();
    // A half-played attempt would not match what the steps say: start clean.
    onRestart();
    shownCount.current = 0;
    setActive(true);
    show(firstTourStep(start));
  }, [start, clearTimers, onRestart, show]);

  useEffect(() => {
    if (!active || !step || settled || !isTourStepDone(step, state)) return;
    if (step.kind === TourStepKind.Check) {
      setStep(null);
      later(() => {
        const now = stateRef.current;
        if (now.outcome === GameOutcome.InProgress) show(nextTourStep(now));
      }, REVEAL_MS);
      return;
    }
    setSettled(true);
    later(() => show(nextTourStep(stateRef.current)), SETTLE_MS);
  }, [active, step, settled, state, later, show]);

  useEffect(() => {
    if (!active || state.outcome === GameOutcome.InProgress) return;
    clearTimers();
    setActive(false);
    setStep(null);
    onEndRef.current(false);
  }, [active, state.outcome, clearTimers]);

  const onButton = useCallback((): void => {
    if (!step || settled) return;
    if (step.kind === TourStepKind.Clue) {
      show(nextTourStep(stateRef.current));
      return;
    }
    if (step.kind !== TourStepKind.RuleOut || pencilling.current === step) return;
    pencilling.current = step;
    step.notes.forEach((cell, k) => {
      later(() => {
        // onNote toggles, so a cell that somehow has its dash already is left alone.
        if (!stateRef.current.emptyNotes[cell]) onNote(cell);
      }, k * PENCIL_STEP_MS);
    });
  }, [step, settled, later, onNote, show]);

  const skip = useCallback((): void => {
    clearTimers();
    setActive(false);
    setStep(null);
    onEndRef.current(true);
  }, [clearTimers]);

  const nudge = useCallback((): void => setNudges(n => n + 1), []);

  const only = useMemo((): ReadonlySet<number> | null => {
    if (!active) return null;
    if (!step || settled || step.action !== TourAction.Mark) return NO_CELLS;
    // What is still to mark, and what has been: a mark can always be taken back.
    const marked = step.cells.filter(i => state.currentMarks[i] === 1);
    return new Set([...tourTargets(step, state), ...marked]);
  }, [active, step, settled, state]);

  return { active, step, settled, only, nudges, nudge, begin, onButton, skip };
}
