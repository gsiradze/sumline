import { describe, expect, it } from 'vitest';
import { initialGameState, markedCount, submitGuess, toggleMark, toggleNote } from '../game-state';
import type { ActiveGameState } from '../game-state';
import { StrokeKind, beginStroke, extendStroke, toolForStroke } from '../stroke';
import { CELL_COUNT, GRID_SIZE } from '../types';
import type { Cell, Puzzle } from '../types';

function makePuzzle(solutionIndices: readonly number[]): Puzzle {
  const solution: Cell[] = new Array<Cell>(CELL_COUNT).fill(0);
  for (const i of solutionIndices) solution[i] = 1;
  const rowSums = new Array<number>(GRID_SIZE).fill(0);
  const colSums = new Array<number>(GRID_SIZE).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = solution[r * GRID_SIZE + c] ?? 0;
      rowSums[r]! += v;
      colSums[c]! += v;
    }
  }
  return { solution, rowSums, colSums, filledCount: solutionIndices.length, seed: 0 };
}

function fresh(filled: readonly number[] = [0, 1, 2, 3]): ActiveGameState {
  return initialGameState({ puzzle: makePuzzle(filled), guessBudget: 5 });
}

/** Runs a whole stroke over `cells` and returns the board plus the cells it changed. */
function drag(
  state: ActiveGameState,
  cells: readonly number[],
  tool: 'mark' | 'note',
): { state: ActiveGameState; changed: number[] } {
  const changed: number[] = [];
  let kind: StrokeKind | null = null;
  let s = state;
  for (const i of cells) {
    if (kind === null) {
      const start = beginStroke(s, i, tool);
      if (!start) continue;
      kind = start.kind;
      s = start.state;
      changed.push(i);
    } else {
      const next = extendStroke(s, i, kind);
      if (next !== s) changed.push(i);
      s = next;
    }
  }
  return { state: s, changed };
}

describe('beginStroke', () => {
  it('on an open cell marks it, exactly like a tap', () => {
    const s = fresh();
    const start = beginStroke(s, 7, 'mark');
    expect(start?.kind).toBe(StrokeKind.Mark);
    expect(start?.state).toEqual(toggleMark(s, 7));
  });

  it('on a marked cell starts erasing', () => {
    const s = toggleMark(fresh(), 7);
    const start = beginStroke(s, 7, 'mark');
    expect(start?.kind).toBe(StrokeKind.Unmark);
    expect(start?.state.currentMarks[7]).toBe(0);
  });

  it('with the note tool pencils a dash, or rubs one out', () => {
    const s = fresh();
    const on = beginStroke(s, 9, 'note');
    expect(on?.kind).toBe(StrokeKind.Note);
    expect(on?.state.emptyNotes[9]).toBe(true);
    const off = beginStroke(on!.state, 9, 'note');
    expect(off?.kind).toBe(StrokeKind.Unnote);
    expect(off?.state.emptyNotes[9]).toBe(false);
  });

  it('a tap on a noted cell with the mark tool marks it and clears the note', () => {
    const s = toggleNote(fresh(), 9);
    const start = beginStroke(s, 9, 'mark');
    expect(start?.kind).toBe(StrokeKind.Mark);
    expect(start?.state.currentMarks[9]).toBe(1);
    expect(start?.state.emptyNotes[9]).toBe(false);
  });

  it('is null on a locked cell and when every mark is already placed', () => {
    const locked = initialGameState({
      puzzle: makePuzzle([0, 1, 2, 3]),
      guessBudget: 5,
      preLockedCells: [0],
    });
    expect(beginStroke(locked, 0, 'mark')).toBeNull();
    expect(beginStroke(locked, 0, 'note')).toBeNull();

    let full = fresh([0, 1]);
    full = toggleMark(toggleMark(full, 10), 11);
    expect(beginStroke(full, 20, 'mark')).toBeNull();
  });
});

describe('extendStroke', () => {
  it('a mark drag fills every open cell it crosses', () => {
    const { state, changed } = drag(fresh([0, 1, 2, 3, 4]), [12, 13, 14, 15], 'mark');
    expect(changed).toEqual([12, 13, 14, 15]);
    expect(markedCount(state)).toBe(4);
  });

  it('a mark drag stops at the mark limit', () => {
    const { state, changed } = drag(fresh([0, 1, 2]), [12, 13, 14, 15, 16], 'mark');
    expect(changed).toEqual([12, 13, 14]);
    expect(markedCount(state)).toBe(3);
  });

  it('a mark drag leaves the player’s notes alone', () => {
    const s = toggleNote(fresh([0, 1, 2, 3, 4]), 13);
    const { state, changed } = drag(s, [12, 13, 14], 'mark');
    expect(changed).toEqual([12, 14]);
    expect(state.emptyNotes[13]).toBe(true);
    expect(state.currentMarks[13]).toBe(0);
  });

  it('an erase drag removes marks and nothing else', () => {
    let s = fresh([0, 1, 2, 3, 4]);
    for (const i of [12, 13, 15]) s = toggleMark(s, i);
    s = toggleNote(s, 14);
    const { state, changed } = drag(s, [12, 13, 14, 15, 16], 'mark');
    expect(changed).toEqual([12, 13, 15]);
    expect(markedCount(state)).toBe(0);
    expect(state.emptyNotes[14]).toBe(true);
  });

  it('a note drag skips marked cells instead of converting them', () => {
    const s = toggleMark(fresh([0, 1, 2, 3, 4]), 13);
    const { state, changed } = drag(s, [12, 13, 14], 'note');
    expect(changed).toEqual([12, 14]);
    expect(state.currentMarks[13]).toBe(1);
    expect(state.emptyNotes[12]).toBe(true);
    expect(state.emptyNotes[14]).toBe(true);
  });

  it('a note-erase drag clears dashes only', () => {
    let s = fresh([0, 1, 2, 3, 4]);
    s = toggleNote(toggleNote(s, 12), 14);
    s = toggleMark(s, 13);
    const { state, changed } = drag(s, [12, 13, 14], 'note');
    expect(changed).toEqual([12, 14]);
    expect(state.emptyNotes.some(Boolean)).toBe(false);
    expect(state.currentMarks[13]).toBe(1);
  });

  it('never touches locked cells or a finished game', () => {
    const start = initialGameState({
      puzzle: makePuzzle([0, 1, 2, 3]),
      guessBudget: 5,
      preLockedCells: [1, 7],
    });
    const { state, changed } = drag(start, [6, 7, 8, 1], 'mark');
    expect(changed).toEqual([6, 8]);
    expect(state.lockedFilled[1]).toBe(true);
    expect(state.lockedEmpty[7]).toBe(true);

    let won = fresh([0]);
    won = submitGuess(toggleMark(won, 0));
    expect(extendStroke(won, 5, StrokeKind.Mark)).toBe(won);
    expect(beginStroke(won, 5, 'mark')).toBeNull();
  });
});

describe('toolForStroke', () => {
  it('maps each stroke to the tool that performs it', () => {
    expect(toolForStroke(StrokeKind.Mark)).toBe('mark');
    expect(toolForStroke(StrokeKind.Unmark)).toBe('mark');
    expect(toolForStroke(StrokeKind.Note)).toBe('note');
    expect(toolForStroke(StrokeKind.Unnote)).toBe('note');
  });
});
