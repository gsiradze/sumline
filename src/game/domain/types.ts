export const GRID_SIZE = 6;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const MIN_FILLED = 14;
export const MAX_FILLED = 22;
export const BATCH_SIZE = 7;
export const MAX_GUESS_BUDGET = 8;

export type Cell = 0 | 1;

export type Grid = readonly Cell[];

export type Guess = Grid;

export enum Feedback {
  Green = 'green',
  Red = 'red',
}

export type FeedbackGrid = readonly Feedback[];

export enum Tier {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Expert = 'expert',
  Master = 'master',
}

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
