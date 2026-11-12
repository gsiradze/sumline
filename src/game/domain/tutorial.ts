import { isCellLocked, markedCount } from './game-state';
import type { ActiveGameState } from './game-state';
import { LINE_COUNT, LineAxis, hintLine } from './hint';
import type { HintLine } from './hint';
import { Feedback, GRID_SIZE, GameOutcome } from './types';

/** The level that teaches the game by walking the player through a first solve. */
export const TUTORIAL_LEVEL_ID = 0;

// The tour is a guided first solve. Each step lights one thing, says one short
// thing about it, and waits for the player to do one thing. It reasons the way
// a player is meant to: a line that needs as many beavers as it has free cells
// is certain, a line that has them all rules out its other cells, and when
// neither is left the player has to guess.
export enum TourStepKind {
  /** What a number means, shown on the row that is solved for the player. */
  Clue = 'clue',
  /** A row or column that needs every one of its free cells. */
  Line = 'line',
  /** A row or column that has all its beavers: the rest of it is pencilled out. */
  RuleOut = 'rule-out',
  /** Nothing certain is left. */
  Guess = 'guess',
  /** The Submit button. */
  Check = 'check',
}

/** What moves the tour on from a step. */
export enum TourAction {
  /** The button in the caption. */
  Button = 'button',
  /** Marking the step's cells. */
  Mark = 'mark',
  /** Submitting the guess. */
  Submit = 'submit',
}

export interface TourStep {
  readonly kind: TourStepKind;
  readonly action: TourAction;
  /** Ten words at most: it is read on a phone, by someone who wants to play. */
  readonly text: string;
  /** The label of the caption's button, on the steps that have one. */
  readonly button: string | null;
  /** Rows and columns kept lit, by line id (0–5 rows from the top, 6–11 columns from the left). */
  readonly lines: readonly number[];
  /** The cells to mark: ringed, and the only ones that take a touch. */
  readonly cells: readonly number[];
  /** The cells the step pencils out when its button is pressed. */
  readonly notes: readonly number[];
  /** How many guesses had been made when the step began. */
  readonly guesses: number;
}

interface LineCount {
  readonly line: HintLine;
  /** Beavers the line still needs, counting the player's marks as beavers. */
  readonly need: number;
  /** Marks on it that are not confirmed yet. */
  readonly marked: number;
  /** Its cells that are neither locked nor marked. */
  readonly free: readonly number[];
}

function countLines(state: ActiveGameState): LineCount[] {
  const counts: LineCount[] = [];
  for (let id = 0; id < LINE_COUNT; id++) {
    const line = hintLine(id)!;
    const sums = line.axis === LineAxis.Row ? state.puzzle.rowSums : state.puzzle.colSums;
    let placed = 0;
    let marked = 0;
    const free: number[] = [];
    for (const i of line.cells) {
      if (state.lockedFilled[i]) placed++;
      else if (state.lockedEmpty[i]) continue;
      else if (state.currentMarks[i] === 1) {
        placed++;
        marked++;
      } else free.push(i);
    }
    counts.push({ line, need: (sums[line.index] ?? 0) - placed, marked, free });
  }
  return counts;
}

/** The line's free cells that could still hold a beaver: the line crossing each is not full. */
function candidates(count: LineCount, all: readonly LineCount[]): number[] {
  if (count.need <= 0) return [];
  const isRow = count.line.axis === LineAxis.Row;
  return count.free.filter(i => {
    const crossing = isRow ? all[GRID_SIZE + (i % GRID_SIZE)] : all[Math.floor(i / GRID_SIZE)];
    return (crossing?.need ?? 0) > 0;
  });
}

function findSolvedRow(state: ActiveGameState): HintLine | null {
  for (let r = 0; r < GRID_SIZE; r++) {
    const line = hintLine(r)!;
    if (line.cells.every(i => isCellLocked(state, i))) return line;
  }
  return null;
}

function lastGuessMissed(state: ActiveGameState): boolean {
  const guess = state.guesses[state.guesses.length - 1];
  const feedback = state.feedbacks[state.feedbacks.length - 1];
  if (!guess || !feedback) return false;
  return guess.some((mark, i) => mark === 1 && feedback[i] === Feedback.Red);
}

const beavers = (n: number): string => (n === 1 ? '1 beaver' : `${n} beavers`);
const sorted = (cells: Iterable<number>): number[] => [...new Set(cells)].sort((a, b) => a - b);

/**
 * How the tour opens: on the row solved for the player, to show what a number
 * means. Without such a row it starts with the first thing to do.
 */
export function firstTourStep(state: ActiveGameState): TourStep | null {
  if (state.outcome !== GameOutcome.InProgress) return null;
  const solved = findSolvedRow(state);
  if (!solved) return nextTourStep(state);
  return {
    kind: TourStepKind.Clue,
    action: TourAction.Button,
    text: `Find the hidden beavers. This row has ${state.puzzle.rowSums[solved.index] ?? 0}.`,
    button: 'Next',
    lines: [solved.id],
    cells: [],
    notes: [],
    guesses: state.guesses.length,
  };
}

/** The next thing to do on the board as it is now, or null once the puzzle is over. */
export function nextTourStep(state: ActiveGameState): TourStep | null {
  if (state.outcome !== GameOutcome.InProgress) return null;
  const guesses = state.guesses.length;
  const step = { button: null, lines: [], cells: [], notes: [], guesses } as const;

  const left = state.puzzle.filledCount - markedCount(state);
  if (left <= 0) {
    const budget = state.guessBudget;
    return {
      ...step,
      kind: TourStepKind.Check,
      action: TourAction.Submit,
      text:
        guesses === 0
          ? `Tap here to check. You get ${budget} ${budget === 1 ? 'guess' : 'guesses'}.`
          : 'Check again.',
    };
  }

  const counts = countLines(state);

  // A line the player's own marks have filled: its other cells cannot be beavers.
  const full = counts.find(
    c => c.need === 0 && c.marked > 0 && c.free.some(i => !state.emptyNotes[i]),
  );
  if (full) {
    const notes = full.free.filter(i => !state.emptyNotes[i]);
    const isRow = full.line.axis === LineAxis.Row;
    const sum = (isRow ? state.puzzle.rowSums : state.puzzle.colSums)[full.line.index] ?? 0;
    const one = notes.length === 1;
    return {
      ...step,
      kind: TourStepKind.RuleOut,
      action: TourAction.Button,
      text:
        `This ${isRow ? 'row' : 'column'} has its ${beavers(sum)}. ` +
        (one ? 'The last cell is empty.' : 'The rest are empty.'),
      button: one ? 'Rule it out' : 'Rule them out',
      lines: [full.line.id],
      notes,
    };
  }

  const certain = counts
    .map(count => ({ id: count.line.id, axis: count.line.axis, cells: candidates(count, counts) }))
    .filter((c, k) => c.cells.length > 0 && c.cells.length === counts[k]!.need);

  if (certain.length > 0 && lastGuessMissed(state)) {
    // Straight after a wrong guess everything that follows from it is shown at once.
    const rows = certain.filter(c => c.axis === LineAxis.Row);
    const shown = rows.length > 0 ? rows : certain;
    const cells = sorted(shown.flatMap(c => c.cells));
    return {
      ...step,
      kind: TourStepKind.Line,
      action: TourAction.Mark,
      text: `✕ means no beaver. So ${cells.length === 1 ? "it's" : "they're"} here.`,
      lines: shown.map(c => c.id),
      cells,
    };
  }

  if (certain.length > 0) {
    // The longest first; rows before columns.
    const best = [...certain].sort((a, b) => b.cells.length - a.cells.length || a.id - b.id)[0]!;
    const n = best.cells.length;
    return {
      ...step,
      kind: TourStepKind.Line,
      action: TourAction.Mark,
      text: n === 1 ? '1 beaver, 1 free cell. Tap it.' : `${n} beavers, ${n} free cells. Tap them.`,
      lines: [best.id],
      cells: best.cells,
    };
  }

  const rows = counts
    .slice(0, GRID_SIZE)
    .map(count => ({ count, cells: candidates(count, counts) }))
    .filter(r => r.cells.length > 0);
  const first = rows[0];
  const alike =
    first !== undefined &&
    rows.every(r => r.count.need === first.count.need && r.cells.length === first.cells.length);
  return {
    ...step,
    kind: TourStepKind.Guess,
    action: TourAction.Mark,
    // Said the way the certain rows were, so the player sees what is different:
    // fewer beavers than free cells. Every row in question gets its own guess.
    text: alike
      ? `${beavers(first.count.need)}, ${first.cells.length} free cells. ` +
        `Guess${first.count.need === 1 ? ' one' : ''} in each row!`
      : `${beavers(left)} left. The numbers can't say where. Guess!`,
    lines: rows.map(r => r.count.line.id),
    // With no cell that fits the numbers left, any free cell may be tried.
    cells: sorted(rows.length > 0 ? rows.flatMap(r => r.cells) : counts.flatMap(c => c.free)),
  };
}

/**
 * The step's cells that still await a mark. In a guess a row takes only as many
 * marks as it needs beavers: one row, one guess.
 */
export function tourTargets(step: TourStep, state: ActiveGameState): number[] {
  if (step.action !== TourAction.Mark) return [];
  const open = step.cells.filter(i => state.currentMarks[i] !== 1);
  if (step.kind !== TourStepKind.Guess) return open;
  const counts = countLines(state);
  return open.filter(i => (counts[Math.floor(i / GRID_SIZE)]?.need ?? 0) > 0);
}

/** Whether the player has done what the step asks. A Clue is only ever left by its button. */
export function isTourStepDone(step: TourStep, state: ActiveGameState): boolean {
  switch (step.kind) {
    case TourStepKind.Clue:
      return false;
    case TourStepKind.Line:
      return step.cells.every(i => state.currentMarks[i] === 1);
    case TourStepKind.RuleOut:
      return step.notes.every(i => state.emptyNotes[i] === true || state.lockedEmpty[i] === true);
    case TourStepKind.Guess:
      return markedCount(state) >= state.puzzle.filledCount;
    case TourStepKind.Check:
      return state.guesses.length > step.guesses;
  }
}
