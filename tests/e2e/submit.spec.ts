import { expect, test } from '@playwright/test';

interface TestCell {
  readonly value: 0 | 1;
}

interface TestState {
  readonly puzzle: {
    readonly solution: readonly number[];
    readonly filledCount: number;
    readonly rowSums: readonly number[];
    readonly colSums: readonly number[];
  };
  readonly currentMarks: readonly number[];
  readonly outcome: 'in-progress' | 'won' | 'lost';
  readonly guesses: readonly TestCell[][];
  readonly lockedFilled: readonly boolean[];
  readonly lockedEmpty: readonly boolean[];
}

declare global {
  interface Window {
    __gridTest?: {
      openLevel: (id: number) => void;
      backToHome: () => void;
      tapCell: (index: number) => void;
      submit: () => void;
      restart: () => void;
      getState: () => TestState | null;
    };
  }
}

async function waitForHook(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__gridTest !== 'undefined');
}

async function openLevel(page: import('@playwright/test').Page, id: number): Promise<void> {
  await page.evaluate((levelId: number) => {
    window.__gridTest!.openLevel(levelId);
  }, id);
  await page.waitForFunction(() => window.__gridTest?.getState() !== null);
}

async function getState(page: import('@playwright/test').Page): Promise<TestState> {
  const s = await page.evaluate(() => window.__gridTest!.getState());
  if (!s) throw new Error('state not available');
  return s;
}

const OUTCOME_IN_PROGRESS = 'in-progress' as const;
const OUTCOME_WON = 'won' as const;
const OUTCOME_LOST = 'lost' as const;
void OUTCOME_LOST;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHook(page);
});

test('wrong guess with enough right marks does NOT auto-win (Level 4 regression)', async ({
  page,
}) => {
  // Level index for "Beginner · Set 1 · Level 4" = id 3 (0-indexed).
  await openLevel(page, 3);
  const s0 = await getState(page);

  // Confirm puzzle shape.
  expect(s0.puzzle.solution).toHaveLength(36);
  expect(s0.outcome).toBe(OUTCOME_IN_PROGRESS);

  const solution = s0.puzzle.solution;
  // Construct a wrong guess: flip one correct cell off and turn one empty cell on.
  // Preserve filledCount so the mark cap doesn't reject.
  const firstFilled = solution.findIndex(v => v === 1);
  const firstEmpty = solution.findIndex(v => v === 0);
  expect(firstFilled).toBeGreaterThanOrEqual(0);
  expect(firstEmpty).toBeGreaterThanOrEqual(0);

  const marks: number[] = [];
  for (let i = 0; i < 36; i++) {
    if (i === firstFilled) continue; // drop one correct mark
    if (solution[i] === 1) marks.push(i);
  }
  marks.push(firstEmpty); // add one wrong mark

  // Also skip already-pre-locked cells.
  const preLockedFilled = s0.lockedFilled;
  const preLockedEmpty = s0.lockedEmpty;
  const toTap = marks.filter(i => !preLockedFilled[i] && !preLockedEmpty[i]);

  for (const i of toTap) {
    await page.evaluate((idx: number) => window.__gridTest!.tapCell(idx), i);
  }

  await page.evaluate(() => window.__gridTest!.submit());

  const s1 = await getState(page);
  expect(s1.guesses.length).toBe(1);
  expect(s1.outcome, 'outcome should NOT be Won on a wrong guess').not.toBe(OUTCOME_WON);
});

test('exactly-correct guess wins on first submit', async ({ page }) => {
  await openLevel(page, 3);
  const s0 = await getState(page);
  const solution = s0.puzzle.solution;

  // Tap every filled cell that isn't already pre-locked-filled.
  const preLockedFilled = s0.lockedFilled;
  const preLockedEmpty = s0.lockedEmpty;
  for (let i = 0; i < 36; i++) {
    if (solution[i] !== 1) continue;
    if (preLockedFilled[i]) continue;
    if (preLockedEmpty[i]) continue; // can't happen for a filled cell but guard anyway
    await page.evaluate((idx: number) => window.__gridTest!.tapCell(idx), i);
  }

  await page.evaluate(() => window.__gridTest!.submit());

  const s1 = await getState(page);
  expect(s1.outcome).toBe(OUTCOME_WON);
});

test('spam-all-16 does not auto-win on Level 4', async ({ page }) => {
  // The literal scenario from the user's screenshot:
  // marks = row 0 col 1 + all of row 1 + all of row 2 + (3,1), (4,1), (5,1)
  await openLevel(page, 3);
  const s0 = await getState(page);

  const idx = (r: number, c: number): number => r * 6 + c;
  const marks: number[] = [
    idx(0, 1),
    idx(1, 0), idx(1, 1), idx(1, 2), idx(1, 3), idx(1, 4), idx(1, 5),
    idx(2, 0), idx(2, 1), idx(2, 2), idx(2, 3), idx(2, 4), idx(2, 5),
    idx(3, 1),
    idx(4, 1),
    idx(5, 1),
  ];
  const preFilled = s0.lockedFilled;
  const preEmpty = s0.lockedEmpty;
  const toTap = marks.filter(i => !preFilled[i] && !preEmpty[i]);

  for (const i of toTap) {
    await page.evaluate((x: number) => window.__gridTest!.tapCell(x), i);
  }

  await page.evaluate(() => window.__gridTest!.submit());
  const s1 = await getState(page);

  // Whether or not this exact set equals the solution depends on which cells
  // were pre-locked and which ones are actually filled in the baked puzzle.
  // The test asserts the universal rule: outcome Won iff guess === solution.
  const guess = s1.guesses[0]!;
  const matchesSolution = guess.every((v, i) => v === s0.puzzle.solution[i]);

  if (matchesSolution) {
    expect(s1.outcome).toBe(OUTCOME_WON);
  } else {
    expect(s1.outcome, 'outcome must not be Won when guess ≠ solution').not.toBe(OUTCOME_WON);
  }
});

test('propagator does not over-solve the board on a wrong guess', async ({ page }) => {
  // The user's real complaint: even though outcome stays InProgress, the
  // propagator deduces the entire board from <sums + earned locks>, leaving
  // the player no cells to mark on the next submit. This test enforces that
  // at least one cell remains unlocked after a wrong single-guess submit on
  // Level 4 — so the game is not trivially one-click-win on guess 2.
  await openLevel(page, 3);
  const s0 = await getState(page);
  const idx = (r: number, c: number): number => r * 6 + c;
  const marks: number[] = [
    idx(0, 1),
    idx(1, 0), idx(1, 1), idx(1, 2), idx(1, 3), idx(1, 4), idx(1, 5),
    idx(2, 0), idx(2, 1), idx(2, 2), idx(2, 3), idx(2, 4), idx(2, 5),
    idx(3, 1),
    idx(4, 1),
    idx(5, 1),
  ];
  const toTap = marks.filter(i => !s0.lockedFilled[i] && !s0.lockedEmpty[i]);
  for (const i of toTap) {
    await page.evaluate((x: number) => window.__gridTest!.tapCell(x), i);
  }
  await page.evaluate(() => window.__gridTest!.submit());

  const s1 = await getState(page);
  const lockedCount =
    s1.lockedFilled.filter(Boolean).length + s1.lockedEmpty.filter(Boolean).length;
  expect(lockedCount, 'some cells must remain unlocked for the player to deduce').toBeLessThan(36);
  expect(s1.outcome).not.toBe(OUTCOME_WON);
});

test('WinScreen does not appear on a wrong guess (visible DOM check)', async ({ page }) => {
  await openLevel(page, 3);
  const s0 = await getState(page);
  const solution = s0.puzzle.solution;
  const firstFilled = solution.findIndex(v => v === 1);
  const firstEmpty = solution.findIndex(v => v === 0);

  const marks: number[] = [];
  for (let i = 0; i < 36; i++) {
    if (i === firstFilled) continue;
    if (solution[i] === 1) marks.push(i);
  }
  marks.push(firstEmpty);
  const toTap = marks.filter(i => !s0.lockedFilled[i] && !s0.lockedEmpty[i]);
  for (const i of toTap) {
    await page.evaluate((idx: number) => window.__gridTest!.tapCell(idx), i);
  }

  await page.evaluate(() => window.__gridTest!.submit());

  // The WinScreen contains text "Nice deduction." — must not be in the DOM.
  const winVisible = await page.getByText('Nice deduction.').count();
  expect(winVisible).toBe(0);
});

// Silence the unused-type warning.
void ({} as TestCell);
