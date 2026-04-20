import { computeFeedback, isWinningFeedback } from './feedback';
import { propagateForcedLocks } from './propagator';
import { CELL_COUNT, Feedback, GameOutcome } from './types';
import type { Cell, FeedbackGrid, Guess, Puzzle } from './types';

export interface ActiveGameState {
  readonly puzzle: Puzzle;
  readonly guessBudget: number;
  readonly guesses: readonly Guess[];
  readonly feedbacks: readonly FeedbackGrid[];
  readonly currentMarks: readonly Cell[];
  readonly lockedFilled: readonly boolean[];
  readonly lockedEmpty: readonly boolean[];
  readonly outcome: GameOutcome;
  readonly hintsUsed: number;
}

export interface InitialGameStateOptions {
  readonly puzzle: Puzzle;
  readonly guessBudget: number;
  readonly preLockedCells?: readonly number[];
}

export function initialGameState(opts: InitialGameStateOptions): ActiveGameState {
  const lockedFilled = new Array<boolean>(CELL_COUNT).fill(false);
  const lockedEmpty = new Array<boolean>(CELL_COUNT).fill(false);
  const currentMarks = new Array<Cell>(CELL_COUNT).fill(0);
  const preLocks = opts.preLockedCells ?? [];
  for (const i of preLocks) {
    if (i < 0 || i >= CELL_COUNT) continue;
    if (opts.puzzle.solution[i] === 1) {
      lockedFilled[i] = true;
      currentMarks[i] = 1;
    } else {
      lockedEmpty[i] = true;
    }
  }
  return {
    puzzle: opts.puzzle,
    guessBudget: opts.guessBudget,
    guesses: [],
    feedbacks: [],
    currentMarks,
    lockedFilled,
    lockedEmpty,
    outcome: GameOutcome.InProgress,
    hintsUsed: 0,
  };
}

export function isCellLocked(state: ActiveGameState, index: number): boolean {
  return state.lockedFilled[index] === true || state.lockedEmpty[index] === true;
}

export function canToggle(state: ActiveGameState, index: number): boolean {
  return state.outcome === GameOutcome.InProgress && !isCellLocked(state, index);
}

export function canSubmit(state: ActiveGameState): boolean {
  return state.outcome === GameOutcome.InProgress;
}

export function guessesUsed(state: ActiveGameState): number {
  return state.guesses.length;
}

export function guessesRemaining(state: ActiveGameState): number {
  return Math.max(0, state.guessBudget - state.guesses.length);
}

export function markedCount(state: ActiveGameState): number {
  let count = 0;
  for (const m of state.currentMarks) count += m;
  return count;
}

export function remainingMarkBudget(state: ActiveGameState): number {
  return Math.max(0, state.puzzle.filledCount - markedCount(state));
}

export function toggleMark(state: ActiveGameState, index: number): ActiveGameState {
  if (!canToggle(state, index)) return state;
  if (index < 0 || index >= CELL_COUNT) return state;
  const currentlyMarked = state.currentMarks[index] === 1;
  // Hard cap: never allow more marks than the puzzle has filled cells.
  if (!currentlyMarked && markedCount(state) >= state.puzzle.filledCount) {
    return state;
  }
  const nextMarks = [...state.currentMarks];
  nextMarks[index] = currentlyMarked ? 0 : 1;
  return { ...state, currentMarks: nextMarks };
}

export function submitGuess(state: ActiveGameState): ActiveGameState {
  if (!canSubmit(state)) return state;
  const guess: Guess = [...state.currentMarks];
  const feedback = computeFeedback(guess, state.puzzle.solution);

  const preFilled = [...state.lockedFilled];
  const preEmpty = [...state.lockedEmpty];
  const nextMarks: Cell[] = [...guess];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (preFilled[i] || preEmpty[i]) continue;
    if (guess[i] !== 1) continue;
    if (feedback[i] === Feedback.Green) {
      preFilled[i] = true;
    } else {
      preEmpty[i] = true;
      nextMarks[i] = 0;
    }
  }

  // Completion propagation from the (new) locked set.
  const propagated = propagateForcedLocks(
    { lockedFilled: preFilled, lockedEmpty: preEmpty },
    state.puzzle.rowSums,
    state.puzzle.colSums,
  );
  // Sync marks with any newly-forced-filled cells (they're proven filled).
  for (let i = 0; i < CELL_COUNT; i++) {
    if (propagated.lockedFilled[i]) nextMarks[i] = 1;
    else if (propagated.lockedEmpty[i]) nextMarks[i] = 0;
  }

  const nextGuesses = [...state.guesses, guess];
  const nextFeedbacks = [...state.feedbacks, feedback];
  let outcome: GameOutcome;
  if (isWinningFeedback(feedback)) outcome = GameOutcome.Won;
  else if (nextGuesses.length >= state.guessBudget) outcome = GameOutcome.Lost;
  else outcome = GameOutcome.InProgress;

  return {
    ...state,
    guesses: nextGuesses,
    feedbacks: nextFeedbacks,
    currentMarks: nextMarks,
    lockedFilled: propagated.lockedFilled,
    lockedEmpty: propagated.lockedEmpty,
    outcome,
  };
}

export function applyHint(state: ActiveGameState, cellIndex: number): ActiveGameState {
  if (state.outcome !== GameOutcome.InProgress) return state;
  if (cellIndex < 0 || cellIndex >= CELL_COUNT) return state;
  if (isCellLocked(state, cellIndex)) return state;
  const truth = state.puzzle.solution[cellIndex];
  const preFilled = [...state.lockedFilled];
  const preEmpty = [...state.lockedEmpty];
  if (truth === 1) preFilled[cellIndex] = true;
  else preEmpty[cellIndex] = true;
  const propagated = propagateForcedLocks(
    { lockedFilled: preFilled, lockedEmpty: preEmpty },
    state.puzzle.rowSums,
    state.puzzle.colSums,
  );
  const nextMarks = [...state.currentMarks];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (propagated.lockedFilled[i]) nextMarks[i] = 1;
    else if (propagated.lockedEmpty[i]) nextMarks[i] = 0;
  }
  return {
    ...state,
    lockedFilled: propagated.lockedFilled,
    lockedEmpty: propagated.lockedEmpty,
    currentMarks: nextMarks,
    hintsUsed: state.hintsUsed + 1,
  };
}
