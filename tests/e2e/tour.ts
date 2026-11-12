import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { OUTCOME_WON, getState } from './helpers';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const FIRST_CAPTION = 'Find the hidden beavers. This row has 5.';

export const caption = (page: Page): Locator => page.locator('[data-tour-caption]');
export const veil = (page: Page): Locator => page.locator('[data-tour-veil]');
export const holes = (page: Page): Locator => page.locator('[data-tour-hole]');
export const captionButton = (page: Page, name: string): Locator =>
  caption(page).getByRole('button', { name });

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not on screen');
  return box;
}

export async function centreOf(page: Page, cell: number): Promise<{ x: number; y: number }> {
  const box = await boxOf(page.locator(`[data-cell="${cell}"]`));
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Taps where the cells are, as a finger would: whatever is on top there gets the tap. */
export async function touch(page: Page, cells: readonly number[]): Promise<void> {
  for (const cell of cells) {
    const p = await centreOf(page, cell);
    await page.mouse.click(p.x, p.y);
  }
}

export async function marksOf(page: Page, cells: readonly number[]): Promise<number[]> {
  const s = await getState(page);
  return cells.map(i => s.currentMarks[i]!);
}

/** Level 1 is on screen with the tour at its first step, and nothing else in the way. */
export async function expectTour(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible();
  await expect(caption(page)).toContainText(FIRST_CAPTION);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** The level is on screen as a returning player gets it: no tour, no rules in the way. */
export async function expectPlainLevel(page: Page, levelNumber: number): Promise<void> {
  await expect(page.getByRole('heading', { name: `Level ${levelNumber}` })).toBeVisible();
  // Long enough for a tour or a rules page to have appeared if one were going to.
  await page.waitForTimeout(300);
  await expect(veil(page)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Follows the tour from its first step to the guess: everything up to the first check. */
export async function playToGuess(page: Page): Promise<void> {
  await captionButton(page, 'Next').click();
  await expect(caption(page)).toContainText('4 beavers, 4 free cells. Tap them.');
  await touch(page, [30, 31, 32, 35]);
  await expect(caption(page)).toContainText('This column has its 1 beaver. The rest are empty.');
  await captionButton(page, 'Rule them out').click();
  await expect(caption(page)).toContainText('3 beavers, 3 free cells. Tap them.');
  await touch(page, [13, 14, 17]);
  await expect(caption(page)).toContainText('This column has its 3 beavers. The rest are empty.');
  await captionButton(page, 'Rule them out').click();
  await expect(caption(page)).toContainText('2 beavers, 2 free cells. Tap them.');
  await touch(page, [2, 5]);
  await expect(caption(page)).toContainText('1 beaver, 2 free cells. Guess one in each row!');
}

/** Plays the whole tour, guessing right: it ends on the win screen after one check. */
export async function finishTour(page: Page): Promise<void> {
  await playToGuess(page);
  await touch(page, [8, 29]);
  await expect(caption(page)).toContainText('Tap here to check.');
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_WON);
  await expect(veil(page)).toHaveCount(0);
}
