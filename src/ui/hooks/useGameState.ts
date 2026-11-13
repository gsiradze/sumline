import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  applyHint,
  canSubmit,
  submitGuess,
  toggleMark,
  toggleNote,
} from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';
import {
  guessEvent,
  hintEvent,
  isBlankAttempt,
  replayAttempt,
  snapshotOf,
} from '../../game/domain/attempt';
import type { AttemptEvent } from '../../game/domain/attempt';
import { findHintLine } from '../../game/domain/hint';
import type { HintLine } from '../../game/domain/hint';
import { sound } from '../../game/audio/soundManager';
import { haptics } from '../../game/audio/haptics';
import { startingBoard } from '../../game/domain/startingBoard';
import { GameOutcome } from '../../game/domain/types';
import { clearAttempt, loadAttempt, saveAttempt } from '../../storage/persistence';
import { puzzleOf } from '../../storage/levelsManifest';
import type { BakedLevel } from '../../storage/levelsManifest';

type Action =
  | { readonly type: 'toggle'; readonly index: number }
  | { readonly type: 'note'; readonly index: number }
  | { readonly type: 'submit' }
  | { readonly type: 'hint' }
  | { readonly type: 'restart' }
  | { readonly type: 'hydrate'; readonly raw: unknown };

interface AttemptState {
  readonly game: ActiveGameState;
  // The guesses and hints that produced `game`; this is what gets saved.
  readonly events: readonly AttemptEvent[];
  readonly hydrated: boolean;
  // The game ended in an earlier visit, so its result has already been counted.
  readonly restoredTerminal: boolean;
}

// Covers the wrong-mark flash, so a double tap cannot spend a second guess.
const SUBMIT_LOCK_MS = 650;
const SAVE_DEBOUNCE_MS = 400;

export function freshGame(level: BakedLevel): ActiveGameState {
  return startingBoard(puzzleOf(level), level);
}

function freshAttempt(level: BakedLevel): AttemptState {
  return { game: freshGame(level), events: [], hydrated: false, restoredTerminal: false };
}

function reducer(state: AttemptState, action: Action, level: BakedLevel): AttemptState {
  switch (action.type) {
    case 'toggle': {
      const game = toggleMark(state.game, action.index);
      return game === state.game ? state : { ...state, game };
    }
    case 'note': {
      const game = toggleNote(state.game, action.index);
      return game === state.game ? state : { ...state, game };
    }
    case 'submit': {
      const game = submitGuess(state.game);
      if (game === state.game) return state;
      return {
        ...state,
        game,
        events: [...state.events, guessEvent(state.game)],
        restoredTerminal: false,
      };
    }
    case 'hint': {
      // Chosen from the board as it is now, not as it was when the ad started.
      const line = findHintLine(state.game);
      if (line === null) return state;
      const game = applyHint(state.game, line.cells);
      if (game === state.game) return state;
      return { ...state, game, events: [...state.events, hintEvent(line.id)] };
    }
    case 'restart':
      return { ...freshAttempt(level), hydrated: true };
    case 'hydrate': {
      if (state.hydrated) return state;
      const replayed = replayAttempt(freshGame(level), action.raw);
      if (!replayed) return { ...state, hydrated: true };
      return {
        game: replayed.state,
        events: replayed.events,
        hydrated: true,
        restoredTerminal: replayed.state.outcome !== GameOutcome.InProgress,
      };
    }
  }
}

export interface UseGameState {
  readonly state: ActiveGameState;
  /** False for the first moments while a saved attempt is being loaded. */
  readonly hydrated: boolean;
  readonly restoredTerminal: boolean;
  readonly onCellTapped: (index: number) => void;
  readonly onCellNoted: (index: number) => void;
  readonly submit: () => void;
  /** Reveals a row or column and returns it, or null when nothing is left to reveal. */
  readonly applyHint: () => HintLine | null;
  readonly restart: () => void;
}

export function useGameState(level: BakedLevel): UseGameState {
  const levelRef = useRef(level);
  levelRef.current = level;
  const [attempt, rawDispatch] = useReducer(
    (s: AttemptState, a: Action) => reducer(s, a, levelRef.current),
    level,
    freshAttempt,
  );
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  const lastSubmitAt = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    let cancelled = false;
    void loadAttempt(level.id).then(raw => {
      if (!cancelled) rawDispatch({ type: 'hydrate', raw });
    });
    return () => {
      cancelled = true;
    };
  }, [level.id]);

  // Save the attempt so leaving the level, or the app being killed, does not
  // lose it — and so leaving is not a free restart. Guesses, hints and results
  // are written immediately; cell taps are batched.
  const pendingWrite = useRef<(() => void) | null>(null);
  const saveTimer = useRef<number | null>(null);
  const savedEvents = useRef<readonly AttemptEvent[] | null>(null);

  const flush = useCallback((): void => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const write = pendingWrite.current;
    pendingWrite.current = null;
    write?.();
  }, []);

  useEffect(() => {
    if (!attempt.hydrated) return;
    const { game, events } = attempt;
    const id = level.id;
    pendingWrite.current = (): void => {
      savedEvents.current = events;
      if (game.outcome === GameOutcome.Won) {
        void clearAttempt(id);
        return;
      }
      const snapshot = snapshotOf(game, events);
      if (isBlankAttempt(freshGame(levelRef.current), snapshot)) void clearAttempt(id);
      else void saveAttempt(id, snapshot);
    };
    const urgent = events !== savedEvents.current || game.outcome !== GameOutcome.InProgress;
    if (urgent) {
      flush();
      return;
    }
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [attempt, level.id, flush]);

  useEffect(() => {
    const onHide = (): void => {
      if (document.hidden) flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  const onCellTapped = useCallback((index: number) => {
    sound.unlock();
    const game = attemptRef.current.game;
    // No click and no buzz for a tap that changes nothing (every mark already placed).
    if (toggleMark(game, index) === game) return;
    if (game.currentMarks[index] === 1) sound.playToggleOff();
    else sound.playToggleOn();
    haptics.tap();
    rawDispatch({ type: 'toggle', index });
  }, []);

  const onCellNoted = useCallback((index: number) => {
    sound.unlock();
    const game = attemptRef.current.game;
    if (toggleNote(game, index) === game) return;
    sound.playClick();
    haptics.tap();
    rawDispatch({ type: 'note', index });
  }, []);

  const submit = useCallback(() => {
    sound.unlock();
    if (!canSubmit(attemptRef.current.game)) return;
    const now = performance.now();
    if (now - lastSubmitAt.current < SUBMIT_LOCK_MS) return;
    lastSubmitAt.current = now;
    rawDispatch({ type: 'submit' });
  }, []);

  const hint = useCallback((): HintLine | null => {
    sound.unlock();
    const line = findHintLine(attemptRef.current.game);
    if (line) rawDispatch({ type: 'hint' });
    return line;
  }, []);

  const restart = useCallback(() => {
    rawDispatch({ type: 'restart' });
  }, []);

  return {
    state: attempt.game,
    hydrated: attempt.hydrated,
    restoredTerminal: attempt.restoredTerminal,
    onCellTapped,
    onCellNoted,
    submit,
    applyHint: hint,
    restart,
  };
}
