import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  BETWEEN_GUESSES_MS,
  OUTCOME_IN_PROGRESS,
  OUTCOME_LOST,
  freshStart,
  getState,
  markAnswer,
  openLevel,
  submit,
  tapCells,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('a column completed by the pre-solved row starts fully ruled out', async ({ page }) => {
  await openLevel(page, 0);
  const s = await getState(page);
  const { rowSums, colSums, solution } = s.puzzle;
  const solvedRow = rowSums.indexOf(Math.max(...rowSums));
  const closedCols = [0, 1, 2, 3, 4, 5].filter(
    c => colSums[c] === 1 && solution[solvedRow * 6 + c] === 1,
  );
  expect(closedCols.length).toBeGreaterThan(0);
  for (const c of closedCols) {
    for (let r = 0; r < 6; r++) {
      const i = r * 6 + c;
      expect(s.lockedFilled[i] || s.lockedEmpty[i], `row ${r} col ${c} should be decided`).toBe(
        true,
      );
    }
  }
});

test('a note is not a mark, and survives leaving the level', async ({ page }) => {
  await openLevel(page, 7);
  const s0 = await getState(page);
  const open = [...Array(36).keys()].filter(i => !s0.lockedFilled[i] && !s0.lockedEmpty[i]);
  const [noted, marked] = [open[0]!, open[1]!];
  const marksBefore = s0.currentMarks.filter(m => m === 1).length;

  await page.evaluate((i: number) => window.__gridTest!.noteCell(i), noted);
  await tapCells(page, [marked]);
  const s1 = await getState(page);
  expect(s1.emptyNotes[noted]).toBe(true);
  expect(s1.currentMarks[noted]).toBe(0);
  expect(s1.currentMarks.filter(m => m === 1).length).toBe(marksBefore + 1);

  await page.waitForTimeout(600);
  await page.evaluate(() => window.__gridTest!.backToHome());
  await openLevel(page, 7);
  await expect.poll(async () => (await getState(page)).emptyNotes[noted]).toBe(true);
  expect((await getState(page)).currentMarks[marked]).toBe(1);
});

test('a second submit right after the first does not spend another guess', async ({ page }) => {
  await openLevel(page, 0);
  const s0 = await getState(page);
  const wrong = [...Array(36).keys()].find(
    i => s0.puzzle.solution[i] === 0 && !s0.lockedEmpty[i] && !s0.lockedFilled[i],
  )!;
  await tapCells(page, [wrong]);
  await submit(page);
  await submit(page);
  await submit(page);
  expect((await getState(page)).guesses).toHaveLength(1);
  await page.waitForTimeout(BETWEEN_GUESSES_MS);
  await submit(page);
  expect((await getState(page)).guesses).toHaveLength(2);
});

test('an attempt survives a reload, and a loss is not reset by leaving', async ({ page }) => {
  await openLevel(page, 0);
  await submit(page);
  expect((await getState(page)).guesses).toHaveLength(1);

  await page.reload();
  await page.waitForFunction(() => typeof window.__gridTest !== 'undefined');
  await openLevel(page, 0);
  await expect.poll(async () => (await getState(page)).guesses.length).toBe(1);

  const budget = (await getState(page)).guessBudget;
  for (let g = 1; g < budget; g++) {
    await page.waitForTimeout(BETWEEN_GUESSES_MS);
    await submit(page);
  }
  expect((await getState(page)).outcome).toBe(OUTCOME_LOST);
  await expect(page.getByText('Out of guesses')).toBeVisible();
  // The answer is not put on the board after a loss.
  const lost = await getState(page);
  const revealed = lost.lockedFilled.filter(Boolean).length;
  expect(revealed).toBeLessThan(lost.puzzle.filledCount);

  await page.evaluate(() => window.__gridTest!.backToHome());
  await openLevel(page, 0);
  await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_LOST);
  await expect(page.getByRole('button', { name: /Try again/ })).toBeVisible();

  // The free retry starts the same puzzle from scratch.
  await page.getByRole('button', { name: /Try again/ }).click();
  await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_IN_PROGRESS);
  expect((await getState(page)).guesses).toHaveLength(0);
});

test('winning does not auto-advance; Next opens the next level', async ({ page }) => {
  await openLevel(page, 0);
  await markAnswer(page);
  await submit(page);
  await expect(page.getByText(/^Solved in 1\./)).toBeVisible();
  await page.waitForTimeout(5200);
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible();
  await page.getByRole('button', { name: /Next · Level 2/ }).click();
  await expect(page.getByRole('heading', { name: 'Level 2' })).toBeVisible();
});

test('Next never leads into a locked set', async ({ page }) => {
  // Level 7 is the last of set 1. With the rest of the set unsolved, set 2 is locked.
  await openLevel(page, 6);
  await markAnswer(page);
  await submit(page);
  await expect(page.getByText(/^Solved in 1\./)).toBeVisible();
  await expect(page.getByRole('button', { name: /Next · Level/ })).toHaveCount(0);
  await page.getByText('Back to levels', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Level 8 (locked)' })).toBeDisabled();
});

test('Escape goes back one step at a time and closes overlays first', async ({ page }) => {
  await openLevel(page, 2);
  await expect(page.getByRole('heading', { name: 'Level 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Show rules' }).click();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Level 3' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
});

test('the share text names the game and links to the store', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openLevel(page, 0);
  await markAnswer(page);
  await submit(page);
  await page.getByRole('button', { name: 'Share result' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith('Sumline #1 ')).toBe(true);
  expect(
    text.endsWith('https://play.google.com/store/apps/details?id=com.narnarigames.sumline'),
  ).toBe(true);
});

test('capture mode (dev only) shows the board without the app chrome', async ({ page }) => {
  await page.goto('/?capture=1&level=3');
  await expect(page.locator('[data-board]')).toBeVisible();
  await expect(page.getByText('Level 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to levels' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Submit guess/ })).toHaveCount(0);
});

test('a win short of three stars can be replayed, and the better result is kept', async ({
  page,
}) => {
  await openLevel(page, 1);
  const s0 = await getState(page);
  const wrong = [...Array(36).keys()]
    .filter(i => s0.puzzle.solution[i] === 0 && !s0.lockedEmpty[i])
    .slice(0, 3);
  for (const cell of wrong) {
    const now = await getState(page);
    if (!now.lockedEmpty[cell]) await tapCells(page, [cell]);
    await submit(page);
    await page.waitForTimeout(BETWEEN_GUESSES_MS);
  }
  await markAnswer(page);
  await submit(page);
  await expect(page.getByText('Solved in 4.')).toBeVisible();
  await expect(page.getByLabel('1 of 3 stars')).toBeVisible();

  await page.getByRole('button', { name: 'Replay' }).click();
  const fresh = await getState(page);
  expect(fresh.outcome).toBe(OUTCOME_IN_PROGRESS);
  expect(fresh.guesses).toHaveLength(0);

  await page.waitForTimeout(BETWEEN_GUESSES_MS);
  await markAnswer(page);
  await submit(page);
  await expect(page.getByText('Solved in 1.')).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  // Nothing left to improve.
  await expect(page.getByRole('button', { name: 'Replay' })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('grid:v2:progress') ?? '{}')['1']?.stars),
    )
    .toBe(3);
});

test.describe('Reset progress, in Settings', () => {
  const stored = (page: Page): Promise<string[]> =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter(k => /^grid:v2:(progress|stats|rulesShown|attempt:|retry:)/.test(k))
        .sort(),
    );

  test('asks twice, then the game is as a new player gets it; settings are kept', async ({
    page,
  }) => {
    await openLevel(page, 0);
    await markAnswer(page);
    await submit(page);
    await expect(page.getByText(/^Solved in 1\./)).toBeVisible();
    // A half-played level too, so there is a saved attempt to erase.
    await page.evaluate(() => window.__gridTest!.backToHome());
    await openLevel(page, 1);
    const s = await getState(page);
    const open = [...Array(36).keys()].find(i => !s.lockedFilled[i] && !s.lockedEmpty[i])!;
    await tapCells(page, [open]);
    await page.evaluate(() => localStorage.setItem('grid:v2:muted', '1'));

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Reset progress' }).click();
    // One tap erases nothing.
    expect(await stored(page)).toContain('grid:v2:progress');
    await page.getByRole('button', { name: /Erase everything\?/ }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
    await expect(page.getByText(/LEVEL 1 ·/)).toBeVisible();
    await page.waitForTimeout(700);
    expect(await stored(page)).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('grid:v2:muted'))).toBe('1');

    // And it stays that way: the tutorial is back, level 2 is untouched.
    await page.reload();
    await page.waitForFunction(() => typeof window.__gridTest !== 'undefined');
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expect(page.locator('[data-tour-caption]')).toContainText('Find the hidden beavers');
  });

  test('the question goes away if it is not answered', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Reset progress' }).click();
    await expect(page.getByRole('button', { name: /Erase everything\?/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset progress' })).toBeVisible({
      timeout: 6000,
    });
  });
});
