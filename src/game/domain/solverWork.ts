import { CELL_COUNT, GRID_SIZE } from './types';
import type { Puzzle } from './types';

export interface SolverWorkResult {
  readonly forcedMoves: number;
  readonly branches: number;
  readonly maxDepth: number;
  readonly solved: boolean;
  readonly workScore: number;
}

interface KnownState {
  filled: boolean[];
  empty: boolean[];
}

interface Counters {
  forcedMoves: number;
  branches: number;
  maxDepth: number;
}

function makeKnown(): KnownState {
  return {
    filled: new Array<boolean>(CELL_COUNT).fill(false),
    empty: new Array<boolean>(CELL_COUNT).fill(false),
  };
}

function cloneKnown(k: KnownState): KnownState {
  return { filled: [...k.filled], empty: [...k.empty] };
}

function lineStats(
  known: KnownState,
  indices: readonly number[],
): { filled: number; empty: number; unknown: number } {
  let filled = 0;
  let empty = 0;
  let unknown = 0;
  for (const i of indices) {
    if (known.filled[i]) filled++;
    else if (known.empty[i]) empty++;
    else unknown++;
  }
  return { filled, empty, unknown };
}

function rowIndices(r: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < GRID_SIZE; c++) out.push(r * GRID_SIZE + c);
  return out;
}

function colIndices(c: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) out.push(r * GRID_SIZE + c);
  return out;
}

interface PropagateResult {
  added: number;
  contradiction: boolean;
}

function propagate(
  known: KnownState,
  rowSums: readonly number[],
  colSums: readonly number[],
): PropagateResult {
  let totalAdded = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < GRID_SIZE; r++) {
      const indices = rowIndices(r);
      const st = lineStats(known, indices);
      const target = rowSums[r] ?? 0;
      if (st.filled > target) return { added: totalAdded, contradiction: true };
      if (st.filled + st.unknown < target) return { added: totalAdded, contradiction: true };
      const need = target - st.filled;
      if (st.unknown > 0 && need === 0) {
        for (const i of indices) {
          if (!known.filled[i] && !known.empty[i]) {
            known.empty[i] = true;
            totalAdded++;
            changed = true;
          }
        }
      } else if (st.unknown > 0 && need === st.unknown) {
        for (const i of indices) {
          if (!known.filled[i] && !known.empty[i]) {
            known.filled[i] = true;
            totalAdded++;
            changed = true;
          }
        }
      }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      const indices = colIndices(c);
      const st = lineStats(known, indices);
      const target = colSums[c] ?? 0;
      if (st.filled > target) return { added: totalAdded, contradiction: true };
      if (st.filled + st.unknown < target) return { added: totalAdded, contradiction: true };
      const need = target - st.filled;
      if (st.unknown > 0 && need === 0) {
        for (const i of indices) {
          if (!known.filled[i] && !known.empty[i]) {
            known.empty[i] = true;
            totalAdded++;
            changed = true;
          }
        }
      } else if (st.unknown > 0 && need === st.unknown) {
        for (const i of indices) {
          if (!known.filled[i] && !known.empty[i]) {
            known.filled[i] = true;
            totalAdded++;
            changed = true;
          }
        }
      }
    }
  }
  return { added: totalAdded, contradiction: false };
}

function firstUnknown(known: KnownState): number {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!known.filled[i] && !known.empty[i]) return i;
  }
  return -1;
}

function isComplete(known: KnownState): boolean {
  return firstUnknown(known) === -1;
}

function solve(
  known: KnownState,
  rowSums: readonly number[],
  colSums: readonly number[],
  depth: number,
  counters: Counters,
): boolean {
  const { added, contradiction } = propagate(known, rowSums, colSums);
  counters.forcedMoves += added;
  if (contradiction) return false;
  if (isComplete(known)) return true;

  const cell = firstUnknown(known);
  if (cell === -1) return true;

  counters.branches++;
  if (depth + 1 > counters.maxDepth) counters.maxDepth = depth + 1;

  const tryFilled = cloneKnown(known);
  tryFilled.filled[cell] = true;
  if (solve(tryFilled, rowSums, colSums, depth + 1, counters)) {
    for (let i = 0; i < CELL_COUNT; i++) {
      known.filled[i] = tryFilled.filled[i]!;
      known.empty[i] = tryFilled.empty[i]!;
    }
    return true;
  }

  const tryEmpty = cloneKnown(known);
  tryEmpty.empty[cell] = true;
  if (solve(tryEmpty, rowSums, colSums, depth + 1, counters)) {
    for (let i = 0; i < CELL_COUNT; i++) {
      known.filled[i] = tryEmpty.filled[i]!;
      known.empty[i] = tryEmpty.empty[i]!;
    }
    return true;
  }

  return false;
}

export function measureSolverWork(puzzle: Puzzle): SolverWorkResult {
  const known = makeKnown();
  const counters: Counters = { forcedMoves: 0, branches: 0, maxDepth: 0 };
  const solved = solve(known, puzzle.rowSums, puzzle.colSums, 0, counters);
  const workScore = computeWorkScore(counters);
  return {
    forcedMoves: counters.forcedMoves,
    branches: counters.branches,
    maxDepth: counters.maxDepth,
    solved,
    workScore,
  };
}

function computeWorkScore(c: Counters): number {
  if (c.branches === 0) {
    const earlyForced = Math.min(c.forcedMoves, 25);
    return Math.max(5, 25 - earlyForced * 0.8);
  }
  const branchComponent = Math.min(60, c.branches * 7);
  const depthComponent = Math.min(30, c.maxDepth * 10);
  return Math.min(100, 30 + branchComponent + depthComponent);
}
