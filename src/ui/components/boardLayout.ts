import { GRID_SIZE } from '../../game/domain/types';

// The board is drawn in these units and scaled to the screen by its viewBox.
export const layout = {
  width: 500,
  height: 460,
  cellSize: 58,
  cellGap: 8,
  cellRadius: 6,
  clueGutter: 38,
  clueFontSize: 22,
  gridOriginY: 56,
} as const;

export const motion = {
  wrongFlashMs: 520,
  longPressMs: 380,
} as const;

export const CELL_PITCH = layout.cellSize + layout.cellGap;

const GRID_SPAN = GRID_SIZE * layout.cellSize + (GRID_SIZE - 1) * layout.cellGap;
export const GRID_ORIGIN_X = Math.round((layout.width - GRID_SPAN) / 2);
export const GRID_ORIGIN_Y = layout.gridOriginY;

export interface BoardPoint {
  readonly x: number;
  readonly y: number;
}

export function cellOrigin(index: number): BoardPoint {
  return {
    x: GRID_ORIGIN_X + (index % GRID_SIZE) * CELL_PITCH,
    y: GRID_ORIGIN_Y + Math.floor(index / GRID_SIZE) * CELL_PITCH,
  };
}

/**
 * The cell under a point, or null outside the grid. Each cell owns half of the
 * gap around it, so there are no dead strips between cells.
 */
export function cellAtPoint(p: BoardPoint): number | null {
  const pad = layout.cellGap / 2;
  const col = Math.floor((p.x - GRID_ORIGIN_X + pad) / CELL_PITCH);
  const row = Math.floor((p.y - GRID_ORIGIN_Y + pad) / CELL_PITCH);
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
  return row * GRID_SIZE + col;
}

/** The cells a straight finger movement passes over, in the order it reaches them. */
export function cellsAlong(from: BoardPoint, to: BoardPoint): number[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (layout.cellSize / 3)));
  const cells: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const cell = cellAtPoint({ x: from.x + (dx * s) / steps, y: from.y + (dy * s) / steps });
    if (cell !== null && cells[cells.length - 1] !== cell) cells.push(cell);
  }
  return cells;
}
