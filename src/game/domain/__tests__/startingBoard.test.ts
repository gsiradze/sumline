import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCellLocked } from '../game-state';
import { TEACHING_LEVEL_COUNT, startingBoard } from '../startingBoard';
import { CELL_COUNT, GRID_SIZE } from '../types';
import type { Cell, Puzzle } from '../types';

interface RawLevel {
  id: number;
  solution: Cell[];
  rowSums: number[];
  colSums: number[];
  filledCount: number;
  seed: number;
  guessBudget: number;
  preLockedCellCount: number;
}

const levels = (
  JSON.parse(readFileSync(resolve(__dirname, '../../../../public/levels.json'), 'utf8')) as {
    levels: RawLevel[];
  }
).levels;

function puzzleOf(l: RawLevel): Puzzle {
  return {
    solution: l.solution,
    rowSums: l.rowSums,
    colSums: l.colSums,
    filledCount: l.filledCount,
    seed: l.seed,
  };
}

describe('startingBoard on the shipped levels', () => {
  it('level 1: columns the pre-solved row already completes start ruled out', () => {
    // Reported from play: with a row pre-solved, a column whose only filled
    // cell is in that row still looked open.
    const l = levels[0]!;
    const s = startingBoard(puzzleOf(l), l);
    const solvedRow = l.rowSums.indexOf(Math.max(...l.rowSums));
    const closedCols = [0, 1, 2, 3, 4, 5].filter(
      c => l.colSums[c] === 1 && l.solution[solvedRow * GRID_SIZE + c] === 1,
    );
    expect(closedCols.length).toBeGreaterThan(0);
    for (const c of closedCols) {
      for (let r = 0; r < GRID_SIZE; r++) {
        expect(isCellLocked(s, r * GRID_SIZE + c), `(${r},${c})`).toBe(true);
      }
    }
  });

  it('tutorial levels start with exactly one whole row solved', () => {
    for (const l of levels.slice(0, TEACHING_LEVEL_COUNT)) {
      const s = startingBoard(puzzleOf(l), l);
      const fullRows = [0, 1, 2, 3, 4, 5].filter(r =>
        [0, 1, 2, 3, 4, 5].every(c => isCellLocked(s, r * GRID_SIZE + c)),
      );
      expect(fullRows.length, `level ${l.id + 1}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every level starts consistent with its answer and never already solved', () => {
    for (const l of levels) {
      const s = startingBoard(puzzleOf(l), l);
      let locked = 0;
      for (let i = 0; i < CELL_COUNT; i++) {
        if (s.lockedFilled[i]) {
          expect(l.solution[i], `level ${l.id + 1} cell ${i}`).toBe(1);
          expect(s.currentMarks[i]).toBe(1);
        }
        if (s.lockedEmpty[i]) {
          expect(l.solution[i], `level ${l.id + 1} cell ${i}`).toBe(0);
          expect(s.currentMarks[i]).toBe(0);
        }
        if (isCellLocked(s, i)) locked++;
      }
      expect(locked, `level ${l.id + 1} starts fully solved`).toBeLessThan(CELL_COUNT);
      expect(s.guessBudget).toBe(l.guessBudget);
    }
  });
});
