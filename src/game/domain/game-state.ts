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
  // Player-only "I think this is empty" pencil notes. Never judged, never part of a guess.
  readonly emptyNotes: readonly boolean[];
  readonly outcome: GameOutcome;
  readonly hintsUsed: number;
}

export interface InitialGameStateOptions {
  readonly puzzle: Puzzle;
  readonly guessBudget: number;
  readonly preLockedCells?: readonly number[];
}

export function initialGameState(opts: InitialGameStateOptions): ActiveGameState {
  const preFilled = new Array<boolean>(CELL_COUNT).fill(false);
  const preEmpty = new Array<boolean>(CELL_COUNT).fill(false);
  const preLocks = opts.preLockedCells ?? [];
  for (const i of preLocks) {
    if (i < 0 || i >= CELL_COUNT) continue;
    if (opts.puzzle.solution[i] === 1) preFilled[i] = true;
    else preEmpty[i] = true;
  }
  // A pre-solved cell can already complete its row or column; the rest of that
  // line is then known empty, exactly as it would be after a guess.
  const { lockedFilled, lockedEmpty } = propagateForcedLocks(
    { lockedFilled: preFilled, lockedEmpty: preEmpty },
    opts.puzzle.rowSums,
    opts.puzzle.colSums,
  );
  const currentMarks = new Array<Cell>(CELL_COUNT).fill(0);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (lockedFilled[i]) currentMarks[i] = 1;
  }
  return {
    puzzle: opts.puzzle,
    guessBudget: opts.guessBudget,
    guesses: [],
    feedbacks: [],
    currentMarks,
    lockedFilled,
    lockedEmpty,
    emptyNotes: new Array<boolean>(CELL_COUNT).fill(false),
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

// Only a hint can push marks past the cap: it force-marks the filled cells it
// reveals on top of a full set of player marks. Such a guess can never be the solution.
export function isOverMarkCap(state: ActiveGameState): boolean {
  return markedCount(state) > state.puzzle.filledCount;
}

export function canSubmit(state: ActiveGameState): boolean {
  return state.outcome === GameOutcome.InProgress && !isOverMarkCap(state);
}

function notesWithoutLocked(
  notes: readonly boolean[],
  lockedFilled: readonly boolean[],
  lockedEmpty: readonly boolean[],
): boolean[] {
  const next = [...notes];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (lockedFilled[i] || lockedEmpty[i]) next[i] = false;
  }
  return next;
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
  if (!state.emptyNotes[index]) return { ...state, currentMarks: nextMarks };
  const nextNotes = [...state.emptyNotes];
  nextNotes[index] = false;
  return { ...state, currentMarks: nextMarks, emptyNotes: nextNotes };
}

export function toggleNote(state: ActiveGameState, index: number): ActiveGameState {
  if (!canToggle(state, index)) return state;
  if (index < 0 || index >= CELL_COUNT) return state;
  const nextNotes = [...state.emptyNotes];
  nextNotes[index] = !state.emptyNotes[index];
  if (state.currentMarks[index] !== 1) return { ...state, emptyNotes: nextNotes };
  const nextMarks = [...state.currentMarks];
  nextMarks[index] = 0;
  return { ...state, currentMarks: nextMarks, emptyNotes: nextNotes };
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
    emptyNotes: notesWithoutLocked(
      state.emptyNotes,
      propagated.lockedFilled,
      propagated.lockedEmpty,
    ),
    outcome,
  };
}

/** A hint: the true state of every still-open cell in `cells` is locked in. */
export function applyHint(state: ActiveGameState, cells: readonly number[]): ActiveGameState {
  if (state.outcome !== GameOutcome.InProgress) return state;
  const preFilled = [...state.lockedFilled];
  const preEmpty = [...state.lockedEmpty];
  let revealed = 0;
  for (const i of cells) {
    if (!Number.isInteger(i) || i < 0 || i >= CELL_COUNT) continue;
    if (preFilled[i] || preEmpty[i]) continue;
    if (state.puzzle.solution[i] === 1) preFilled[i] = true;
    else preEmpty[i] = true;
    revealed++;
  }
  if (revealed === 0) return state;
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
    emptyNotes: notesWithoutLocked(
      state.emptyNotes,
      propagated.lockedFilled,
      propagated.lockedEmpty,
    ),
    hintsUsed: state.hintsUsed + 1,
  };
}
