import { CELL_COUNT, Feedback } from './types';
import type { FeedbackGrid, Grid, Guess } from './types';

export function computeFeedback(guess: Guess, solution: Grid): FeedbackGrid {
  if (guess.length !== CELL_COUNT || solution.length !== CELL_COUNT) {
    throw new Error(`grids must have exactly ${CELL_COUNT} cells`);
  }
  const result: Feedback[] = new Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    result[i] = guess[i] === solution[i] ? Feedback.Green : Feedback.Red;
  }
  return result;
}

export function isWinningFeedback(feedback: FeedbackGrid): boolean {
  if (feedback.length !== CELL_COUNT) return false;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (feedback[i] !== Feedback.Green) return false;
  }
  return true;
}

export function lockedFromHistory(feedbacks: readonly FeedbackGrid[]): boolean[] {
  const locked = new Array<boolean>(CELL_COUNT).fill(false);
  for (const fb of feedbacks) {
    for (let i = 0; i < CELL_COUNT; i++) {
      if (fb[i] === Feedback.Green) locked[i] = true;
    }
  }
  return locked;
}
