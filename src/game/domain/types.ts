export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const MAX_GUESSES = 6;
export const MIN_FILLED = 10;
export const MAX_FILLED = 14;

export type Cell = 0 | 1;

export type Grid = readonly Cell[];

export type Guess = Grid;

export enum Feedback {
  Green = 'green',
  Red = 'red',
}

export type FeedbackGrid = readonly Feedback[];

export interface Puzzle {
  readonly solution: Grid;
  readonly rowSums: readonly number[];
  readonly colSums: readonly number[];
  readonly filledCount: number;
  readonly seed: number;
}

export enum GameOutcome {
  InProgress = 'in-progress',
  Won = 'won',
  Lost = 'lost',
}

export interface GameState {
  readonly puzzle: Puzzle;
  readonly guesses: readonly Guess[];
  readonly feedbacks: readonly FeedbackGrid[];
  readonly outcome: GameOutcome;
}
