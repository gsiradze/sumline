import { applyHint, isCellLocked, submitGuess } from './game-state';
import type { ActiveGameState } from './game-state';
import { hintLine } from './hint';
import { CELL_COUNT, GameOutcome } from './types';
import type { Cell } from './types';

// An attempt is stored as the moves that produced it, not as the resulting
// board. Restoring replays the moves through the real rules, so a saved
// attempt can never put the game in a state the rules could not reach.
// 'g' is a guess (the marks submitted); 'l' is a hint (the line it revealed).
export type AttemptEvent =
  | { readonly t: 'g'; readonly m: string }
  | { readonly t: 'l'; readonly i: number };

export interface AttemptSnapshot {
  readonly v: 1;
  readonly events: readonly AttemptEvent[];
  readonly marks: string;
  readonly notes: string;
}

const MAX_EVENTS = 64;

export function encodeCells(cells: readonly (Cell | boolean)[]): string {
  let out = '';
  for (let i = 0; i < CELL_COUNT; i++) out += cells[i] ? '1' : '0';
  return out;
}

function decodeCells(value: unknown): boolean[] | null {
  if (typeof value !== 'string' || value.length !== CELL_COUNT) return null;
  const out: boolean[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = value[i];
    if (ch !== '0' && ch !== '1') return null;
    out.push(ch === '1');
  }
  return out;
}

export function guessEvent(state: ActiveGameState): AttemptEvent {
  return { t: 'g', m: encodeCells(state.currentMarks) };
}

export function hintEvent(lineId: number): AttemptEvent {
  return { t: 'l', i: lineId };
}

export function snapshotOf(
  state: ActiveGameState,
  events: readonly AttemptEvent[],
): AttemptSnapshot {
  return {
    v: 1,
    events,
    marks: encodeCells(state.currentMarks),
    notes: encodeCells(state.emptyNotes),
  };
}

export function isBlankAttempt(initial: ActiveGameState, snapshot: AttemptSnapshot): boolean {
  return (
    snapshot.events.length === 0 &&
    snapshot.marks === encodeCells(initial.currentMarks) &&
    !snapshot.notes.includes('1')
  );
}

// Puts the player's own marks and notes back on the cells that are still open.
// Locked cells always keep what the rules gave them.
function withPlayerCells(
  state: ActiveGameState,
  marks: readonly boolean[] | null,
  notes: readonly boolean[] | null,
): ActiveGameState {
  const nextMarks: Cell[] = [...state.currentMarks];
  const nextNotes = [...state.emptyNotes];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (isCellLocked(state, i)) continue;
    if (marks) nextMarks[i] = marks[i] ? 1 : 0;
    if (notes) nextNotes[i] = notes[i] === true && nextMarks[i] !== 1;
  }
  return { ...state, currentMarks: nextMarks, emptyNotes: nextNotes };
}

export interface ReplayedAttempt {
  readonly state: ActiveGameState;
  readonly events: readonly AttemptEvent[];
}

/** Returns null when the snapshot is missing, malformed, or describes a finished win. */
export function replayAttempt(initial: ActiveGameState, raw: unknown): ReplayedAttempt | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const snap = raw as Partial<AttemptSnapshot>;
  if (snap.v !== 1 || !Array.isArray(snap.events) || snap.events.length > MAX_EVENTS) return null;
  const marks = decodeCells(snap.marks);
  const notes = decodeCells(snap.notes);
  if (!marks || !notes) return null;

  let state = initial;
  const events: AttemptEvent[] = [];
  for (const entry of snap.events as readonly unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    if (state.outcome !== GameOutcome.InProgress) return null;
    const e = entry as { t?: unknown; m?: unknown; i?: unknown };
    if (e.t === 'g') {
      const guess = decodeCells(e.m);
      if (!guess) return null;
      const before = withPlayerCells(state, guess, null);
      const after = submitGuess(before);
      if (after === before) return null;
      state = after;
      events.push(guessEvent(before));
    } else if (e.t === 'l') {
      const line = typeof e.i === 'number' ? hintLine(e.i) : null;
      if (!line) return null;
      const after = applyHint(state, line.cells);
      if (after === state) return null;
      state = after;
      events.push(hintEvent(line.id));
    } else {
      return null;
    }
  }
  if (state.outcome === GameOutcome.Won) return null;
  // After a loss the marks are whatever the last guess left; only notes are the player's.
  state = withPlayerCells(state, state.outcome === GameOutcome.InProgress ? marks : null, notes);
  return { state, events };
}
