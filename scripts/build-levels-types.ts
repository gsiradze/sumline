import type { Tier } from '../src/game/domain/types';

export interface BakedLevel {
  readonly id: number;
  readonly tier: Tier;
  readonly batchIndexInTier: number;
  readonly indexInBatch: number;
  readonly technique: string | null;
  readonly teachingHint: string | null;
  readonly solution: readonly (0 | 1)[];
  readonly rowSums: readonly number[];
  readonly colSums: readonly number[];
  readonly filledCount: number;
  readonly seed: number;
  readonly difficultyScore: number;
  readonly guessBudget: number;
  readonly preLockedCellCount: number;
}

export interface Manifest {
  readonly version: 2;
  readonly generatedAt: string;
  readonly count: number;
  readonly levels: readonly BakedLevel[];
}

export interface WorkerResult {
  readonly id: number;
  readonly baked?: BakedLevel;
  readonly error?: string;
}
