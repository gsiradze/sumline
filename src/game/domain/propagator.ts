import { CELL_COUNT, GRID_SIZE } from './types';

export interface Locks {
  readonly lockedFilled: readonly boolean[];
  readonly lockedEmpty: readonly boolean[];
}

/**
 * Completion propagation: in any row/column where all filled cells are already
 * locked (locked-filled count equals the row/column sum), the remaining unknowns
 * must be empty — so we lock them. This is the only direction we propagate:
 * the player is expected to deduce "remaining must be filled" themselves.
 * Cascades until no more changes.
 */
export function propagateForcedLocks(
  initial: Locks,
  rowSums: readonly number[],
  colSums: readonly number[],
): { lockedFilled: boolean[]; lockedEmpty: boolean[] } {
  const filled = [...initial.lockedFilled];
  const empty = [...initial.lockedEmpty];
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < GRID_SIZE; r++) {
      let f = 0;
      let u = 0;
      for (let c = 0; c < GRID_SIZE; c++) {
        const i = r * GRID_SIZE + c;
        if (filled[i]) f++;
        else if (!empty[i]) u++;
      }
      if (u === 0) continue;
      if (f === 0) continue; // don't propagate from sums alone
      if (f !== (rowSums[r] ?? 0)) continue;
      for (let c = 0; c < GRID_SIZE; c++) {
        const i = r * GRID_SIZE + c;
        if (!filled[i] && !empty[i]) {
          empty[i] = true;
          changed = true;
        }
      }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let f = 0;
      let u = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        const i = r * GRID_SIZE + c;
        if (filled[i]) f++;
        else if (!empty[i]) u++;
      }
      if (u === 0) continue;
      if (f === 0) continue;
      if (f !== (colSums[c] ?? 0)) continue;
      for (let r = 0; r < GRID_SIZE; r++) {
        const i = r * GRID_SIZE + c;
        if (!filled[i] && !empty[i]) {
          empty[i] = true;
          changed = true;
        }
      }
    }
  }
  if (filled.length !== CELL_COUNT || empty.length !== CELL_COUNT) {
    throw new Error('propagator produced the wrong grid size');
  }
  return { lockedFilled: filled, lockedEmpty: empty };
}
