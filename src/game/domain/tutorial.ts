import { isCellLocked, markedCount } from './game-state';
import type { ActiveGameState } from './game-state';
import { LINE_COUNT, LineAxis, hintLine } from './hint';
import type { HintLine } from './hint';
import { GRID_SIZE, GameOutcome } from './types';

/** The level that teaches the game by walking the player through a first solve. */
export const TUTORIAL_LEVEL_ID = 0;

// In the order a new player meets them. The coach only ever points and explains:
// the board and its buttons stay live throughout, so nothing on screen is dead.
export enum CoachStep {
  Clues = 'clues',
  SolvedRow = 'solved-row',
  ForcedLine = 'forced-line',
  Place = 'place',
  Submit = 'submit',
  Feedback = 'feedback',
}

/** How many steps are only read (and moved past with "Next"). */
export const COACH_READING_STEPS = 2;

export interface CoachView {
  readonly step: CoachStep;
  readonly text: string;
  /** Cells to ring on the board. */
  readonly cells: readonly number[];
  readonly rows: readonly number[];
  readonly cols: readonly number[];
}

export interface OpenLine {
  readonly line: HintLine;
  /** The cells of the line that are not locked yet. */
  readonly open: readonly number[];
  /** How many more filled cells the line still needs. */
  readonly need: number;
}

function openLine(state: ActiveGameState, line: HintLine): OpenLine {
  const sums = line.axis === LineAxis.Row ? state.puzzle.rowSums : state.puzzle.colSums;
  let found = 0;
  const open: number[] = [];
  for (const i of line.cells) {
    if (state.lockedFilled[i]) found++;
    else if (!state.lockedEmpty[i]) open.push(i);
  }
  return { line, open, need: (sums[line.index] ?? 0) - found };
}

/** A row that is completely locked: on a tutorial level, the one solved for the player. */
export function findSolvedRow(state: ActiveGameState): HintLine | null {
  for (let r = 0; r < GRID_SIZE; r++) {
    const line = hintLine(r)!;
    if (line.cells.every(i => isCellLocked(state, i))) return line;
  }
  return null;
}

/**
 * A row or column that needs exactly as many filled cells as it has open ones,
 * so every open cell in it is filled. The longest such line, or null.
 */
export function findForcedLine(state: ActiveGameState): OpenLine | null {
  let best: OpenLine | null = null;
  for (let id = 0; id < LINE_COUNT; id++) {
    const candidate = openLine(state, hintLine(id)!);
    if (candidate.open.length === 0 || candidate.need !== candidate.open.length) continue;
    if (!best || candidate.open.length > best.open.length) best = candidate;
  }
  return best;
}

export function isLineMarked(state: ActiveGameState, forced: OpenLine): boolean {
  return forced.open.every(i => state.currentMarks[i] === 1);
}

const ALL_LINES: readonly number[] = Array.from({ length: GRID_SIZE }, (_, i) => i);

/**
 * What the coach says and points at. `reached` is how far the player has got
 * before their first guess: 0 and 1 are the reading steps, 2 is the forced line,
 * 3 is free play. `forced` is the line found when the level started, if any.
 */
export function coachView(
  state: ActiveGameState,
  reached: number,
  forced: OpenLine | null,
): CoachView | null {
  if (state.outcome !== GameOutcome.InProgress) return null;
  const quiet = { cells: [], rows: [], cols: [] } as const;

  if (state.guesses.length > 0) {
    return {
      step: CoachStep.Feedback,
      text: 'Green cells are right and stay. ✕ cells were wrong and are ruled out. Place the rest and submit again.',
      ...quiet,
    };
  }

  if (reached <= 0) {
    return {
      step: CoachStep.Clues,
      text: 'Each number counts the filled cells in its row or column.',
      cells: [],
      rows: ALL_LINES,
      cols: ALL_LINES,
    };
  }

  const solved = findSolvedRow(state);
  if (reached === 1 && solved) {
    const doneCols = ALL_LINES.filter(c => {
      const col = openLine(state, hintLine(GRID_SIZE + c)!);
      return col.need === 0 && col.open.length === 0;
    });
    const sum = state.puzzle.rowSums[solved.index] ?? 0;
    return {
      step: CoachStep.SolvedRow,
      text:
        `This row is solved for you: ${sum} filled, like its number. ` +
        'A column that already has all its filled cells is dashed out.',
      cells: solved.cells,
      rows: [solved.index],
      cols: doneCols,
    };
  }

  const cap = state.puzzle.filledCount;
  const left = cap - markedCount(state);
  const ready = {
    step: CoachStep.Submit,
    text: `All ${cap} marks are placed. Press Submit to check them.`,
    ...quiet,
  };
  // A player who went their own way and placed every mark is told to submit,
  // not sent back to the line the coach had in mind.
  if (left <= 0) return ready;

  if (reached <= 2 && forced && !isLineMarked(state, forced)) {
    const isRow = forced.line.axis === LineAxis.Row;
    const count = forced.open.length;
    return {
      step: CoachStep.ForcedLine,
      text:
        `Your turn. This ${isRow ? 'row' : 'column'} needs ${forced.need} and has exactly ` +
        `${count} open ${count === 1 ? 'cell' : 'cells'}, so ${count === 1 ? 'it is' : 'they are all'} filled. ` +
        `Tap ${count === 1 ? 'it' : 'them, or drag across'}.`,
      cells: forced.open,
      rows: isRow ? [forced.line.index] : [],
      cols: isRow ? [] : [forced.line.index],
    };
  }

  return {
    step: CoachStep.Place,
    text:
      `Now the rest. ${cap} cells are filled in all, so you have ${left} ` +
      `${left === 1 ? 'mark' : 'marks'} left to place. Let the numbers guide you.`,
    ...quiet,
  };
}
