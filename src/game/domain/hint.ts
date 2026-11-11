import { GRID_SIZE } from './types';
import type { ActiveGameState } from './game-state';

export enum LineAxis {
  Row = 'row',
  Column = 'column',
}

export interface HintLine {
  /** 0–5 are the rows from the top, 6–11 the columns from the left. */
  readonly id: number;
  readonly axis: LineAxis;
  readonly index: number;
  readonly cells: readonly number[];
}

export const LINE_COUNT = GRID_SIZE * 2;

export function hintLine(id: number): HintLine | null {
  if (!Number.isInteger(id) || id < 0 || id >= LINE_COUNT) return null;
  const axis = id < GRID_SIZE ? LineAxis.Row : LineAxis.Column;
  const index = id % GRID_SIZE;
  const cells: number[] = [];
  for (let k = 0; k < GRID_SIZE; k++) {
    cells.push(axis === LineAxis.Row ? index * GRID_SIZE + k : k * GRID_SIZE + index);
  }
  return { id, axis, index, cells };
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

/**
 * The row or column a hint reveals: the one whose open cells could still be
 * arranged in the most ways, so its answer tells the player the most. Null
 * when nothing is left to reveal.
 */
export function findHintLine(state: ActiveGameState): HintLine | null {
  let best: HintLine | null = null;
  let bestWays = -1;
  let bestOpen = -1;
  for (let id = 0; id < LINE_COUNT; id++) {
    const line = hintLine(id)!;
    let open = 0;
    let found = 0;
    for (const i of line.cells) {
      if (state.lockedFilled[i]) found++;
      else if (!state.lockedEmpty[i]) open++;
    }
    if (open === 0) continue;
    const sums = line.axis === LineAxis.Row ? state.puzzle.rowSums : state.puzzle.colSums;
    const ways = choose(open, (sums[line.index] ?? 0) - found);
    if (ways > bestWays || (ways === bestWays && open > bestOpen)) {
      best = line;
      bestWays = ways;
      bestOpen = open;
    }
  }
  return best;
}
