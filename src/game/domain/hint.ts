import { CELL_COUNT, GRID_SIZE } from './types';
import type { ActiveGameState } from './game-state';

export function findHintCell(state: ActiveGameState): number | null {
  const solution = state.puzzle.solution;
  const rowSums = state.puzzle.rowSums;
  const colSums = state.puzzle.colSums;

  const rowFilled = new Array<number>(GRID_SIZE).fill(0);
  const rowEmpty = new Array<number>(GRID_SIZE).fill(0);
  const colFilled = new Array<number>(GRID_SIZE).fill(0);
  const colEmpty = new Array<number>(GRID_SIZE).fill(0);

  for (let i = 0; i < CELL_COUNT; i++) {
    const r = Math.floor(i / GRID_SIZE);
    const c = i % GRID_SIZE;
    if (state.lockedFilled[i]) {
      rowFilled[r]!++;
      colFilled[c]!++;
    } else if (state.lockedEmpty[i]) {
      rowEmpty[r]!++;
      colEmpty[c]!++;
    }
  }

  const candidates: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.lockedFilled[i] || state.lockedEmpty[i]) continue;
    const r = Math.floor(i / GRID_SIZE);
    const c = i % GRID_SIZE;
    const rowUnknownsForFill = GRID_SIZE - rowFilled[r]! - rowEmpty[r]!;
    const rowStillNeeded = rowSums[r]! - rowFilled[r]!;
    const colUnknownsForFill = GRID_SIZE - colFilled[c]! - colEmpty[c]!;
    const colStillNeeded = colSums[c]! - colFilled[c]!;

    const rowForcesFilled = rowStillNeeded === rowUnknownsForFill && rowUnknownsForFill > 0;
    const rowForcesEmpty = rowStillNeeded === 0 && rowUnknownsForFill > 0;
    const colForcesFilled = colStillNeeded === colUnknownsForFill && colUnknownsForFill > 0;
    const colForcesEmpty = colStillNeeded === 0 && colUnknownsForFill > 0;

    if (rowForcesFilled || rowForcesEmpty || colForcesFilled || colForcesEmpty) {
      return i;
    }
    candidates.push(i);
  }

  if (candidates.length === 0) return null;

  let bestIdx = candidates[0]!;
  let bestScore = -Infinity;
  for (const i of candidates) {
    const r = Math.floor(i / GRID_SIZE);
    const c = i % GRID_SIZE;
    const rowScore = extremity(rowSums[r]!);
    const colScore = extremity(colSums[c]!);
    const revealFilled = solution[i] === 1 ? 2 : 1;
    const score = rowScore + colScore + revealFilled;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function extremity(sum: number): number {
  const mid = GRID_SIZE / 2;
  return Math.abs(sum - mid);
}
