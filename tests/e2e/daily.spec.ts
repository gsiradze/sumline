import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
  BETWEEN_GUESSES_MS,
  OUTCOME_LOST,
  freshStart,
  getState,
  markAnswer,
  newPlayerStart,
  submit,
  tapCells,
} from './helpers';

// One puzzle a day, one attempt at it, and a streak of the days it was solved.

const card = (page: Page): Locator => page.getByRole('button', { name: /^Daily puzzle/ });
const saved = (
  page: Page,
): Promise<{ results: Record<string, { won: boolean }>; streak: number } | null> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('grid:v2:daily') ?? 'null'));

async function openDaily(page: Page): Promise<void> {
  await card(page).click();
  await expect(page.getByRole('heading', { name: /^Daily #\d+$/ })).toBeVisible();
  await page.waitForFunction(() => window.__gridTest?.getState() !== null);
  await page.waitForTimeout(150);
}

test('a new player is not offered the daily before they have had the tutorial', async ({
  page,
}) => {
  await newPlayerStart(page);
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test('solving it is recorded, starts a streak, and closes it for the day', async ({ page }) => {
  await freshStart(page);
  await openDaily(page);
  const s = await getState(page);
  expect(s.guessBudget).toBe(4);

  await markAnswer(page);
  await submit(page);
  await expect(page.getByText('Solved in 1.')).toBeVisible();
  // One attempt: nothing to replay, no next level.
  await expect(page.getByRole('button', { name: /^Replay/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Next/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
  await expect(card(page)).toBeDisabled();
  await expect(card(page)).toContainText('Solved in 1');
  await expect(card(page)).toContainText('1 day');

  const record = await saved(page);
  expect(Object.values(record!.results)).toEqual([{ won: true, guesses: 1, stars: 3 }]);
  expect(record!.streak).toBe(1);

  // Still closed after a reload: it is not a fresh board to solve again.
  await page.reload();
  await expect(card(page)).toBeDisabled();
});

test('running out of guesses ends it for the day: there is no retry', async ({ page }) => {
  await freshStart(page);
  await openDaily(page);
  const s0 = await getState(page);
  const wrong = [...Array(36).keys()]
    .filter(i => s0.puzzle.solution[i] === 0 && !s0.lockedEmpty[i])
    .slice(0, s0.guessBudget);
  for (const cell of wrong) {
    const now = await getState(page);
    if (now.outcome !== 'in-progress') break;
    if (!now.lockedEmpty[cell]) await tapCells(page, [cell]);
    await submit(page);
    await page.waitForTimeout(BETWEEN_GUESSES_MS);
  }
  expect((await getState(page)).outcome).toBe(OUTCOME_LOST);
  await expect(page.getByText('A new puzzle arrives tomorrow.')).toBeVisible();
  await expect(page.getByRole('button', { name: /retry/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(card(page)).toBeDisabled();
  await expect(card(page)).toContainText('Missed today');
  expect((await saved(page))!.streak).toBe(0);
});

test('a half-played daily is still there on coming back', async ({ page }) => {
  await freshStart(page);
  await openDaily(page);
  const s = await getState(page);
  const open = [...Array(36).keys()].find(i => !s.lockedFilled[i] && !s.lockedEmpty[i])!;
  await tapCells(page, [open]);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__gridTest!.backToHome());
  await expect(card(page)).toBeEnabled();
  await openDaily(page);
  expect((await getState(page)).currentMarks[open]).toBe(1);
});

test('Reset progress erases the daily results too', async ({ page }) => {
  await freshStart(page);
  await openDaily(page);
  await markAnswer(page);
  await submit(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: /Erase everything\?/ }).click();
  await page.waitForTimeout(500);
  expect(await saved(page)).toBeNull();
});
