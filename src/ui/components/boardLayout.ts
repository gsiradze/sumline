import type { CSSProperties } from 'react';
import { GRID_SIZE } from '../../game/domain/types';

// The board is drawn in these units and scaled to the screen by its viewBox.
// The grid fills the box: only the clue numbers sit to its left and above it,
// and its right edge lines up with the buttons below. Every unit of margin
// here is a unit the cells cannot use on a phone.
export const layout = {
  width: 432,
  height: 442,
  cellSize: 58,
  cellGap: 8,
  cellRadius: 6,
  // From the grid's edge to the middle of a clue number.
  clueGutter: 30,
  clueFontSize: 22,
  gridOriginX: 40,
  gridOriginY: 46,
} as const;

// The narrowest the board may get, as a share of the column it sits in, on a
// screen too short for the whole level: a cell plus its gap is then still a
// 44 px touch target on a 360 px-wide phone.
const BOARD_FLOOR = 0.864;

// Height of the tip shown above the board on the tutorial levels (two lines of text).
const TIP_HEIGHT_PX = 76;

/** Read by `.board-box` in globals.css, which sizes the board to the screen. */
export function boardSizeVars(hasTip: boolean): CSSProperties {
  return {
    '--board-ratio': String(layout.width / layout.height),
    '--board-floor': String(BOARD_FLOOR),
    '--board-above': hasTip ? `${TIP_HEIGHT_PX}px` : '0px',
  } as CSSProperties;
}

export const motion = {
  wrongFlashMs: 520,
  longPressMs: 380,
} as const;

export const CELL_PITCH = layout.cellSize + layout.cellGap;

export const GRID_ORIGIN_X = layout.gridOriginX;
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
