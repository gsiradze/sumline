import { describe, expect, it } from 'vitest';
import { feedbackToBlock, generateShareText } from '../shareGrid';
import { CELL_COUNT, Feedback, GRID_SIZE, GameOutcome } from '../types';
import type { ActiveGameState } from '../game-state';
import type { Cell, Puzzle } from '../types';

function allGreen(): Feedback[] {
  return new Array<Feedback>(CELL_COUNT).fill(Feedback.Green);
}

function mixedFeedback(greenIndices: readonly number[]): Feedback[] {
  const out = new Array<Feedback>(CELL_COUNT).fill(Feedback.Red);
  for (const i of greenIndices) out[i] = Feedback.Green;
  return out;
}

function makeState(
  feedbacks: readonly (readonly Feedback[])[],
  outcome: GameOutcome,
  guessBudget = 6,
): ActiveGameState {
  const puzzle: Puzzle = {
    solution: new Array<Cell>(CELL_COUNT).fill(0),
    rowSums: new Array<number>(GRID_SIZE).fill(0),
    colSums: new Array<number>(GRID_SIZE).fill(0),
    filledCount: 0,
    seed: 0,
  };
  return {
    puzzle,
    guessBudget,
    guesses: feedbacks.map(() => new Array<Cell>(CELL_COUNT).fill(0)),
    feedbacks,
    currentMarks: new Array<Cell>(CELL_COUNT).fill(0),
    lockedFilled: new Array<boolean>(CELL_COUNT).fill(false),
    lockedEmpty: new Array<boolean>(CELL_COUNT).fill(false),
    emptyNotes: new Array<boolean>(CELL_COUNT).fill(false),
    outcome,
    hintsUsed: 0,
  };
}

describe('feedbackToBlock', () => {
  it('renders an all-green guess as GRID_SIZE rows of green squares', () => {
    const block = feedbackToBlock(allGreen());
    const expectedRow = '🟩'.repeat(GRID_SIZE);
    const rows = Array<string>(GRID_SIZE).fill(expectedRow);
    expect(block).toBe(rows.join('\n'));
  });

  it('places greens at the correct cell positions', () => {
    const fb = mixedFeedback([0, GRID_SIZE - 1]);
    const block = feedbackToBlock(fb);
    const firstRow = block.split('\n')[0];
    const middleReds = '🟥'.repeat(GRID_SIZE - 2);
    expect(firstRow).toBe(`🟩${middleReds}🟩`);
  });

  it('throws on wrong-length feedback', () => {
    expect(() => feedbackToBlock([])).toThrow();
  });
});

describe('generateShareText', () => {
  it('leads with the game name, level number and N/budget', () => {
    const state = makeState([allGreen()], GameOutcome.Won, 6);
    const text = generateShareText(state, { levelNumber: 47 });
    expect(text.startsWith('Sumline #47 1/6')).toBe(true);
  });

  it('uses the state budget in the header', () => {
    const state = makeState([allGreen()], GameOutcome.Won, 4);
    const text = generateShareText(state, { levelNumber: 200 });
    expect(text).toContain('1/4');
  });

  it('uses X/budget when the game was lost', () => {
    const state = makeState(
      [
        mixedFeedback([0, 1]),
        mixedFeedback([0, 1, 2]),
        mixedFeedback([0, 1, 2, 3]),
        mixedFeedback([0, 1, 2, 3]),
        mixedFeedback([0, 1, 2, 3]),
        mixedFeedback([0, 1, 2, 3]),
      ],
      GameOutcome.Lost,
      6,
    );
    const text = generateShareText(state, { levelNumber: 42 });
    expect(text).toContain('X/6');
  });

  it('shows earned stars in the header', () => {
    const state = makeState([allGreen()], GameOutcome.Won, 5);
    const text = generateShareText(state, { levelNumber: 3, stars: 2 });
    expect(text).toContain('Sumline #3 · ★★☆ 1/5');
  });

  it('ends with the link when one is given and never invents one', () => {
    const state = makeState([allGreen()], GameOutcome.Won, 6);
    const withUrl = generateShareText(state, { levelNumber: 1, url: 'https://example.com/x' });
    expect(withUrl.endsWith('https://example.com/x')).toBe(true);
    const without = generateShareText(state, { levelNumber: 1 });
    expect(without).not.toMatch(/https?:|\.game|\.com/);
    expect(without.endsWith('🟩')).toBe(true);
  });
});
