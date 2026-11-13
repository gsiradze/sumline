import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { OUTCOME_WON, getState, newPlayerStart, openLevel, waitForHook } from './helpers';
import {
  boxOf,
  caption,
  captionButton,
  centreOf,
  holes,
  marksOf,
  playToGuess,
  touch,
  veil,
} from './tour';
import type { Box } from './tour';

/** What a tap at this point would land on: the dark veil, or the game under it. */
async function topmostAt(page: Page, x: number, y: number): Promise<'veil' | 'game'> {
  return page.evaluate(
    ([px, py]) =>
      document.elementFromPoint(px!, py!)?.closest('[data-tour-veil]') ? 'veil' : 'game',
    [x, y],
  );
}

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.beforeEach(async ({ page }) => {
  await newPlayerStart(page);
});

test('level 1 walks a new player through a first solve, to three stars', async ({ page }) => {
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible();
  await expect(caption(page)).toContainText('Find the hidden beavers. This row has 5.');
  // No wall of rules first: the board is right there.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await playToGuess(page);
  // The wrong one of the two ways the numbers allow.
  await touch(page, [11, 26]);
  await expect(caption(page)).toContainText('Tap here to check. You get 5 guesses.');
  await page.getByRole('button', { name: 'Submit guess' }).click();

  await expect(caption(page)).toContainText("✕ means no beaver. So they're here.");
  const afterFirst = await getState(page);
  expect(afterFirst.guesses).toHaveLength(1);
  expect([11, 26].map(i => afterFirst.lockedEmpty[i])).toEqual([true, true]);
  await touch(page, [8, 29]);
  await expect(caption(page)).toContainText('Check again.');
  await page.getByRole('button', { name: 'Guess 2 of 5' }).click();

  await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_WON);
  await expect(veil(page)).toHaveCount(0);
  await expect(page.getByText('Solved in 2.')).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();

  // Done once: the next visit to level 1 is a normal level.
  await page.reload();
  await waitForHook(page);
  await openLevel(page, 0);
  await expect(veil(page)).toHaveCount(0);
  await expect(page.getByText('beavers are hiding.')).toBeVisible();
});

test('the right guess wins at the first check', async ({ page }) => {
  await openLevel(page, 0);
  await playToGuess(page);
  await touch(page, [8, 29]);
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_WON);
  await expect(page.getByText('Solved in 1.')).toBeVisible();
  await expect(veil(page)).toHaveCount(0);
});

test('everything but what the tour is talking about is dark, and takes no marks', async ({
  page,
}) => {
  await openLevel(page, 0);
  await captionButton(page, 'Next').click();
  await expect(caption(page)).toContainText('4 beavers, 4 free cells.');

  // Lit: the row in question. Dark: an open cell elsewhere, and the buttons.
  const lit = await centreOf(page, 30);
  const dark = await centreOf(page, 0);
  const submit = await boxOf(page.locator('[data-tour="submit"]'));
  expect(await topmostAt(page, lit.x, lit.y)).toBe('game');
  expect(await topmostAt(page, dark.x, dark.y)).toBe('veil');
  expect(await topmostAt(page, submit.x + submit.width / 2, submit.y + submit.height / 2)).toBe(
    'veil',
  );
  await expect(holes(page)).toHaveCount(1);

  // A tap on the dark part marks nothing, and is answered rather than ignored.
  const before = await getState(page);
  await expect(caption(page)).toHaveAttribute('data-nudges', '0');
  await page.mouse.click(dark.x, dark.y);
  await page.mouse.click(submit.x + submit.width / 2, submit.y + submit.height / 2);
  await expect(caption(page)).toHaveAttribute('data-nudges', '2');
  const after = await getState(page);
  expect(after.currentMarks).toEqual(before.currentMarks);
  expect(after.guesses).toHaveLength(0);

  // The lit cells work as they always do: tap to mark, tap again to unmark.
  await page.mouse.click(lit.x, lit.y);
  expect(await marksOf(page, [30])).toEqual([1]);
  await page.mouse.click(lit.x, lit.y);
  expect(await marksOf(page, [30])).toEqual([0]);
});

test('a drag marks the lit cells it crosses and nothing outside them', async ({ page }) => {
  await openLevel(page, 0);
  await captionButton(page, 'Next').click();
  await expect(caption(page)).toContainText('4 beavers, 4 free cells.');

  // Up the first column, out of the lit row: only the cell it started on is marked.
  const from = await centreOf(page, 30);
  const up = await centreOf(page, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(up.x, up.y, { steps: 16 });
  await page.mouse.up();
  expect(await marksOf(page, [30, 24, 12, 6, 0])).toEqual([1, 0, 0, 0, 0]);

  // Along the lit row: the rest of it.
  const start = await centreOf(page, 31);
  const end = await centreOf(page, 35);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 14 });
  await page.mouse.up();
  expect(await marksOf(page, [30, 31, 32, 35])).toEqual([1, 1, 1, 1]);
  await expect(caption(page)).toContainText('This column has its 1 beaver.');
});

test('the words sit on the board, next to what they are about', async ({ page }) => {
  await openLevel(page, 0);
  const board = await boxOf(page.locator('[data-board]'));
  const onBoard = async (): Promise<void> => {
    const text = await boxOf(caption(page));
    const middle = text.y + text.height / 2;
    expect(middle, 'caption is over the board').toBeGreaterThan(board.y);
    expect(middle, 'caption is over the board').toBeLessThan(board.y + board.height);
    for (const hole of await holes(page).all()) {
      expect(overlap(text, await boxOf(hole)), 'caption covers what it points at').toBe(false);
    }
  };

  await expect(caption(page)).toContainText('This row has 5.');
  await onBoard();
  await captionButton(page, 'Next').click();
  await expect(caption(page)).toContainText('4 beavers, 4 free cells.');
  await onBoard();
  await touch(page, [30, 31, 32, 35]);
  await expect(caption(page)).toContainText('This column has its 1 beaver.');
  await onBoard();
});

test('ruling out pencils the dashes the player could have drawn', async ({ page }) => {
  await openLevel(page, 0);
  await captionButton(page, 'Next').click();
  await touch(page, [30, 31, 32, 35]);
  await captionButton(page, 'Rule them out').click();
  await expect
    .poll(async () => {
      const s = await getState(page);
      return [0, 6, 12, 24].map(i => s.emptyNotes[i]);
    })
    .toEqual([true, true, true, true]);
  for (const i of [0, 6, 12, 24]) {
    await expect(page.locator(`[data-cell="${i}"]`)).toHaveAttribute('data-look', 'note');
  }
});

test('the dashes can be drawn by hand too, one cell at a time', async ({ page }) => {
  await openLevel(page, 0);
  await captionButton(page, 'Next').click();
  await touch(page, [30, 31, 32, 35]);
  await expect(caption(page)).toContainText('This column has its 1 beaver.');

  await touch(page, [0, 12]);
  const s = await getState(page);
  expect([0, 6, 12, 24].map(i => s.emptyNotes[i])).toEqual([true, false, true, false]);
  expect(await marksOf(page, [0, 12])).toEqual([0, 0]);

  // The button finishes what is left; or the player does.
  await touch(page, [6, 24]);
  await expect(caption(page)).toContainText('3 beavers, 3 free cells.');
  await touch(page, [13, 14, 17]);
  await expect(caption(page)).toContainText('This column has its 3 beavers.');
  await touch(page, [1]);
  await captionButton(page, 'Rule them out').click();
  await expect(caption(page)).toContainText('2 beavers, 2 free cells.');
  const after = await getState(page);
  expect([1, 7, 25].map(i => after.emptyNotes[i])).toEqual([true, true, true]);
});

test('the tour can be skipped, and stays skipped', async ({ page }) => {
  await openLevel(page, 0);
  await expect(caption(page)).toBeVisible();
  await page.getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(veil(page)).toHaveCount(0);
  await expect(page.getByText('beavers are hiding.')).toBeVisible();

  // The whole board is immediately playable.
  const s = await getState(page);
  const open = [...Array(36).keys()].find(i => !s.lockedFilled[i] && !s.lockedEmpty[i])!;
  await touch(page, [open]);
  expect(await marksOf(page, [open])).toEqual([1]);

  await page.evaluate(() => window.__gridTest!.backToHome());
  await openLevel(page, 0);
  await expect(veil(page)).toHaveCount(0);
});

test('the tour can be played again from the rules, on a clean board', async ({ page }) => {
  await openLevel(page, 0);
  await page.getByRole('button', { name: 'Skip tutorial' }).click();
  await touch(page, [0, 1, 2]);
  expect(await marksOf(page, [0, 1, 2])).toEqual([1, 1, 1]);

  await page.getByRole('button', { name: 'Show rules' }).click();
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(caption(page)).toContainText('Find the hidden beavers. This row has 5.');
  expect(await marksOf(page, [0, 1, 2])).toEqual([0, 0, 0]);

  // And from any other level: it takes the player to level 1.
  await page.getByRole('button', { name: 'Skip tutorial' }).click();
  await openLevel(page, 9);
  await page.getByRole('button', { name: 'Show rules' }).click();
  await page.getByRole('button', { name: 'Replay tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible();
  await expect(caption(page)).toContainText('Find the hidden beavers. This row has 5.');
});

test('a player who left half way starts the tour over', async ({ page }) => {
  await openLevel(page, 0);
  await captionButton(page, 'Next').click();
  await touch(page, [30, 31]);
  expect(await marksOf(page, [30, 31])).toEqual([1, 1]);
  // Long enough for the half-made attempt to be saved.
  await page.waitForTimeout(600);

  await page.evaluate(() => window.__gridTest!.backToHome());
  await openLevel(page, 0);
  await expect(caption(page)).toContainText('Find the hidden beavers. This row has 5.');
  expect(await marksOf(page, [30, 31])).toEqual([0, 0]);
});

for (const size of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
]) {
  test(`every step fits a ${size.width}x${size.height} screen`, async ({ page }) => {
    await page.setViewportSize(size);
    await openLevel(page, 0);

    const fits = async (what: string): Promise<void> => {
      await expect(caption(page), what).toContainText(what);
      const text = await boxOf(caption(page));
      expect(text.x, `${what}: left`).toBeGreaterThanOrEqual(0);
      expect(text.y, `${what}: top`).toBeGreaterThanOrEqual(0);
      expect(text.x + text.width, `${what}: right`).toBeLessThanOrEqual(size.width);
      expect(text.y + text.height, `${what}: bottom`).toBeLessThanOrEqual(size.height);
      for (const hole of await holes(page).all()) {
        const lit = await boxOf(hole);
        expect(overlap(text, lit), `${what}: covers what it points at`).toBe(false);
        expect(lit.y, `${what}: lit part is on screen`).toBeGreaterThanOrEqual(0);
        expect(lit.y + lit.height, `${what}: lit part is on screen`).toBeLessThanOrEqual(
          size.height,
        );
      }
    };

    await fits('This row has 5.');
    await captionButton(page, 'Next').click();
    await fits('4 beavers, 4 free cells.');
    await touch(page, [30, 31, 32, 35]);
    await fits('This column has its 1 beaver.');
    await captionButton(page, 'Rule them out').click();
    await fits('3 beavers, 3 free cells.');
    await touch(page, [13, 14, 17]);
    await fits('This column has its 3 beavers.');
    await captionButton(page, 'Rule them out').click();
    await fits('2 beavers, 2 free cells.');
    await touch(page, [2, 5]);
    await fits('Guess one in each row!');
    await touch(page, [11, 26]);
    await fits('Tap here to check.');
    await page.getByRole('button', { name: 'Submit guess' }).click();
    await fits("So they're here.");
    await touch(page, [8, 29]);
    await fits('Check again.');
    await page.getByRole('button', { name: 'Guess 2 of 5' }).click();
    await expect.poll(async () => (await getState(page)).outcome).toBe(OUTCOME_WON);
  });
}
