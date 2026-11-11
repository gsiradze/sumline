import type { Page } from '@playwright/test';

export interface TestState {
  readonly puzzle: {
    readonly solution: readonly number[];
    readonly filledCount: number;
    readonly rowSums: readonly number[];
    readonly colSums: readonly number[];
  };
  readonly guessBudget: number;
  readonly currentMarks: readonly number[];
  readonly emptyNotes: readonly boolean[];
  readonly outcome: 'in-progress' | 'won' | 'lost';
  readonly guesses: readonly (readonly number[])[];
  readonly lockedFilled: readonly boolean[];
  readonly lockedEmpty: readonly boolean[];
}

declare global {
  interface Window {
    __gridTest?: {
      openLevel: (id: number) => void;
      backToHome: () => void;
      tapCell: (index: number) => void;
      noteCell: (index: number) => void;
      submit: () => void;
      restart: () => void;
      getState: () => TestState | null;
    };
  }
}

export const OUTCOME_IN_PROGRESS = 'in-progress' as const;
export const OUTCOME_WON = 'won' as const;
export const OUTCOME_LOST = 'lost' as const;

// Longer than the app's post-submit lockout, so consecutive guesses both count.
export const BETWEEN_GUESSES_MS = 750;

export async function waitForHook(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__gridTest !== 'undefined');
}

/** Clean storage, rules already seen, app loaded with the dev hook ready. */
export async function freshStart(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('grid:v2:rulesShown', '1');
  });
  await page.reload();
  await waitForHook(page);
}

/** Clean storage and nothing seen yet: the app as a first-time player gets it. */
export async function newPlayerStart(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHook(page);
}

export async function openLevel(page: Page, id: number): Promise<void> {
  await page.evaluate((levelId: number) => {
    window.__gridTest!.openLevel(levelId);
  }, id);
  await page.waitForFunction(() => window.__gridTest?.getState() !== null);
  // A saved attempt (if any) is applied a moment after the level mounts.
  await page.waitForTimeout(150);
}

export async function getState(page: Page): Promise<TestState> {
  const s = await page.evaluate(() => window.__gridTest!.getState());
  if (!s) throw new Error('state not available');
  return s;
}

export async function tapCells(page: Page, cells: readonly number[]): Promise<void> {
  for (const i of cells) {
    await page.evaluate((idx: number) => window.__gridTest!.tapCell(idx), i);
  }
}

export async function submit(page: Page): Promise<void> {
  await page.evaluate(() => window.__gridTest!.submit());
}

/** Marks every filled cell that is not already locked, i.e. enters the answer. */
export async function markAnswer(page: Page): Promise<void> {
  const s = await getState(page);
  const cells: number[] = [];
  for (let i = 0; i < 36; i++) {
    if (s.puzzle.solution[i] === 1 && !s.lockedFilled[i] && s.currentMarks[i] !== 1) cells.push(i);
  }
  await tapCells(page, cells);
}
