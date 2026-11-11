import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { OUTCOME_WON, getState, markAnswer, newPlayerStart, openLevel } from './helpers';

const coach = (page: Page) => page.locator('[data-coach]');

async function centreOf(page: Page, cell: number): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-cell="${cell}"]`).boundingBox();
  if (!box) throw new Error(`cell ${cell} is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await newPlayerStart(page);
});

test('level 1 walks a new player through a first solve', async ({ page }) => {
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible();
  await expect(coach(page)).toContainText('Each number counts the filled cells');
  // No wall of rules first: the board is right there.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // While the player is reading, the board does not react.
  const s0 = await getState(page);
  const anyOpen = [...Array(36).keys()].find(i => !s0.lockedFilled[i] && !s0.lockedEmpty[i])!;
  const p = await centreOf(page, anyOpen);
  await page.mouse.click(p.x, p.y);
  expect((await getState(page)).currentMarks[anyOpen]).toBe(0);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(coach(page)).toContainText('This row is solved for you');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(coach(page)).toContainText('Your turn. This row needs 4');

  // Only the highlighted row can be touched for now.
  const outside = [...Array(36).keys()].find(
    i => !s0.lockedFilled[i] && !s0.lockedEmpty[i] && Math.floor(i / 6) !== 5,
  )!;
  const q = await centreOf(page, outside);
  await page.mouse.click(q.x, q.y);
  expect((await getState(page)).currentMarks[outside]).toBe(0);

  const from = await centreOf(page, 30);
  const to = await centreOf(page, 35);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
  const s1 = await getState(page);
  expect([30, 31, 32, 35].map(i => s1.currentMarks[i])).toEqual([1, 1, 1, 1]);
  await expect(coach(page)).toContainText('Now the rest.');

  // The whole board is open again.
  await page.mouse.click(q.x, q.y);
  expect((await getState(page)).currentMarks[outside]).toBe(1);
  await page.mouse.click(q.x, q.y);

  await markAnswer(page);
  await expect(coach(page)).toContainText('All 16 marks are placed');
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_WON);
  await expect(coach(page)).toHaveCount(0);

  // Done once: the next visit to level 1 is a normal level.
  await page.reload();
  await page.waitForFunction(() => typeof window.__gridTest !== 'undefined');
  await openLevel(page, 0);
  await expect(coach(page)).toHaveCount(0);
  await expect(page.getByText('One row is done for you.')).toBeVisible();
});

test('after a guess the coach explains the result', async ({ page }) => {
  await openLevel(page, 0);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.evaluate(() => [30, 31, 32, 35].forEach(i => window.__gridTest!.tapCell(i)));
  await expect(coach(page)).toContainText('Now the rest.');
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await page.getByRole('button', { name: /submit anyway/ }).click();
  await expect(coach(page)).toContainText('Green cells are right and stay.');
});

test('the tutorial can be skipped, and stays skipped', async ({ page }) => {
  await openLevel(page, 0);
  await expect(coach(page)).toBeVisible();
  await page.getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(coach(page)).toHaveCount(0);
  await expect(page.getByText('One row is done for you.')).toBeVisible();

  // The board is immediately playable.
  const s = await getState(page);
  const open = [...Array(36).keys()].find(i => !s.lockedFilled[i] && !s.lockedEmpty[i])!;
  const p = await centreOf(page, open);
  await page.mouse.click(p.x, p.y);
  expect((await getState(page)).currentMarks[open]).toBe(1);

  await page.evaluate(() => window.__gridTest!.backToHome());
  await openLevel(page, 0);
  await expect(coach(page)).toHaveCount(0);
});

test('a new player who starts on another level gets the short rules instead', async ({ page }) => {
  await openLevel(page, 9);
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await expect(coach(page)).toHaveCount(0);
});
