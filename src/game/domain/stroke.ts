import { toggleMark, toggleNote } from './game-state';
import type { ActiveGameState } from './game-state';

/** What a tap or drag does: place marks, or pencil "ruled out" notes. */
export type StrokeTool = 'mark' | 'note';

// One stroke does one thing to every cell it crosses. The cell it starts on
// decides what: starting on a marked cell erases marks, and so on.
export enum StrokeKind {
  Mark = 'mark',
  Unmark = 'unmark',
  Note = 'note',
  Unnote = 'unnote',
}

export interface StrokeStart {
  readonly kind: StrokeKind;
  readonly state: ActiveGameState;
}

/** The first cell of a stroke behaves exactly like a tap. Null when the tap changes nothing. */
export function beginStroke(
  state: ActiveGameState,
  index: number,
  tool: StrokeTool,
): StrokeStart | null {
  if (tool === 'mark') {
    const next = toggleMark(state, index);
    if (next === state) return null;
    return {
      kind: next.currentMarks[index] === 1 ? StrokeKind.Mark : StrokeKind.Unmark,
      state: next,
    };
  }
  const next = toggleNote(state, index);
  if (next === state) return null;
  return { kind: next.emptyNotes[index] ? StrokeKind.Note : StrokeKind.Unnote, state: next };
}

/**
 * Carries a stroke onto another cell. Painting only lands on untouched cells,
 * so dragging marks never overwrites a note and dragging notes never drops a
 * mark. Returns the same state when the cell is left alone.
 */
export function extendStroke(
  state: ActiveGameState,
  index: number,
  kind: StrokeKind,
): ActiveGameState {
  const marked = state.currentMarks[index] === 1;
  const noted = state.emptyNotes[index] === true;
  switch (kind) {
    case StrokeKind.Mark:
      return marked || noted ? state : toggleMark(state, index);
    case StrokeKind.Unmark:
      return marked ? toggleMark(state, index) : state;
    case StrokeKind.Note:
      return marked || noted ? state : toggleNote(state, index);
    case StrokeKind.Unnote:
      return noted ? toggleNote(state, index) : state;
  }
}

export function toolForStroke(kind: StrokeKind): StrokeTool {
  return kind === StrokeKind.Mark || kind === StrokeKind.Unmark ? 'mark' : 'note';
}
