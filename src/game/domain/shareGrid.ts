import { CELL_COUNT, Feedback, GRID_SIZE, GameOutcome } from './types';
import type { ActiveGameState } from './game-state';

const GREEN_EMOJI = '🟩';
const RED_EMOJI = '🟥';

export interface ShareGridOptions {
  readonly levelId: number;
  readonly url?: string;
  readonly titlePrefix?: string;
  readonly stars?: 0 | 1 | 2 | 3;
}

export function generateShareText(state: ActiveGameState, opts: ShareGridOptions): string {
  const prefix = opts.titlePrefix ?? 'Grid L';
  const count = state.guesses.length;
  const stars = opts.stars ?? 0;
  const starPart = stars > 0 ? ` · ${starRow(stars)}` : '';
  const header = `${prefix}${opts.levelId}${starPart} ${shareCount(state.outcome, count, state.guessBudget)}`;
  const blocks = state.feedbacks.map(feedbackToBlock).join('\n\n');
  const url = opts.url ?? `grid.game/L${opts.levelId}`;
  return `${header}\n\n${blocks}\n\n${url}`;
}

function starRow(stars: 0 | 1 | 2 | 3): string {
  const filled = '★'.repeat(stars);
  const hollow = '☆'.repeat(3 - stars);
  return filled + hollow;
}

export function feedbackToBlock(feedback: readonly Feedback[]): string {
  if (feedback.length !== CELL_COUNT) {
    throw new Error(`feedback must have ${CELL_COUNT} cells`);
  }
  const rows: string[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    let row = '';
    for (let c = 0; c < GRID_SIZE; c++) {
      row += feedback[r * GRID_SIZE + c] === Feedback.Green ? GREEN_EMOJI : RED_EMOJI;
    }
    rows.push(row);
  }
  return rows.join('\n');
}

function shareCount(outcome: GameOutcome, guessesUsed: number, budget: number): string {
  if (outcome === GameOutcome.Lost) return `X/${budget}`;
  return `${guessesUsed}/${budget}`;
}
