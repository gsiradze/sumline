import { describe, expect, it } from 'vitest';
import {
  CELL_PITCH,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  cellAtPoint,
  cellOrigin,
  cellsAlong,
  layout,
} from '../boardLayout';

const centre = (index: number): { x: number; y: number } => {
  const o = cellOrigin(index);
  return { x: o.x + layout.cellSize / 2, y: o.y + layout.cellSize / 2 };
};

describe('cellAtPoint', () => {
  it('finds every cell from its centre', () => {
    for (let i = 0; i < 36; i++) expect(cellAtPoint(centre(i))).toBe(i);
  });

  it('gives each cell half of the gap next to it, leaving no dead strip', () => {
    const o = cellOrigin(7);
    const justRight = { x: o.x + layout.cellSize + layout.cellGap / 2 - 0.1, y: o.y + 5 };
    const pastTheMiddle = { x: o.x + layout.cellSize + layout.cellGap / 2 + 0.1, y: o.y + 5 };
    expect(cellAtPoint(justRight)).toBe(7);
    expect(cellAtPoint(pastTheMiddle)).toBe(8);
  });

  it('is null outside the grid, including over the clue numbers', () => {
    expect(cellAtPoint({ x: GRID_ORIGIN_X - layout.clueGutter, y: GRID_ORIGIN_Y + 10 })).toBeNull();
    expect(cellAtPoint({ x: GRID_ORIGIN_X + 10, y: GRID_ORIGIN_Y - layout.clueGutter })).toBeNull();
    expect(
      cellAtPoint({ x: GRID_ORIGIN_X + 6 * CELL_PITCH + 1, y: GRID_ORIGIN_Y + 10 }),
    ).toBeNull();
    expect(cellAtPoint({ x: layout.width + 50, y: layout.height + 50 })).toBeNull();
  });
});

describe('cellsAlong', () => {
  it('lists every cell of a fast swipe along a row, in order', () => {
    expect(cellsAlong(centre(6), centre(11))).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it('works down a column and backwards', () => {
    expect(cellsAlong(centre(32), centre(2))).toEqual([32, 26, 20, 14, 8, 2]);
  });

  it('is a single cell when the finger has not left it', () => {
    const c = centre(14);
    expect(cellsAlong(c, { x: c.x + 3, y: c.y - 4 })).toEqual([14]);
  });

  it('skips the part of a movement that is off the grid', () => {
    const off = { x: GRID_ORIGIN_X - 30, y: centre(12).y };
    expect(cellsAlong(off, centre(13))).toEqual([12, 13]);
  });
});
