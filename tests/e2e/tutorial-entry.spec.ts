import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  BETWEEN_GUESSES_MS,
  OUTCOME_IN_PROGRESS,
  OUTCOME_LOST,
  freshStart,
  getState,
  newPlayerStart,
  openLevel,
  submit,
  tapCells,
  waitForHook,
} from './helpers';
import {
  boxOf,
  caption,
  captionButton,
  expectPlainLevel,
  expectTour,
  finishTour,
  holes,
  marksOf,
  playToGuess,
  touch,
  veil,
} from './tour';

// Every way into a level, and every way back to the tutorial. A new player gets
// the same guided first solve whichever door they came through; a player who
// has had it (or skipped it) never gets it unasked, and can always ask.

const skip = (page: Page): Promise<void> =>
  page.getByRole('button', { name: 'Skip tutorial' }).click();

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
}

const levelOneStars = (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('grid:v2:progress');
    const progress = raw ? (JSON.parse(raw) as Record<string, { stars?: number }>) : {};
    return progress['0']?.stars ?? null;
  });

test.describe('a new player, whichever way they come in', () => {
  test.beforeEach(async ({ page }) => {
    await newPlayerStart(page);
  });

  test('level 1 picked from the level list runs the tour', async ({ page }) => {
    await page.getByRole('button', { name: /Pond tier/ }).click();
    await page.getByRole('button', { name: 'Level 1', exact: true }).click();
    await expectTour(page);
  });

  test('any other level runs the tour first, and "Next" then goes where they were headed', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Pond tier/ }).click();
    await page.getByRole('button', { name: 'Level 3', exact: true }).click();
    await expectTour(page);

    await finishTour(page);
    await page.getByRole('button', { name: 'Next · Level 3' }).click();
    await expectPlainLevel(page, 3);
  });

  test('skipping the tour on the way to another level lands on that level', async ({ page }) => {
    await page.getByRole('button', { name: /Stream tier/ }).click();
    await page.getByRole('button', { name: 'Level 29', exact: true }).click();
    await expectTour(page);

    await skip(page);
    await expectPlainLevel(page, 29);
  });

  test('a shared link runs the tour first, then opens its level', async ({ page }) => {
    await page.goto('/?level=10');
    await waitForHook(page);
    await expectTour(page);
    expect(new URL(page.url()).search).toBe('');

    await skip(page);
    await expectPlainLevel(page, 10);
  });

  test('a shared link into a set that is still locked is honoured after the tour too', async ({
    page,
  }) => {
    await page.goto('/?level=150');
    await waitForHook(page);
    await expectTour(page);

    await finishTour(page);
    await page.getByRole('button', { name: 'Next · Level 150' }).click();
    await expectPlainLevel(page, 150);
  });

  test('the pages of rules never open: there is one tutorial', async ({ page }) => {
    await openLevel(page, 9);
    await expectTour(page);
    await expect(page.getByText('How to play')).toHaveCount(0);
  });

  test('backing out of the tour returns to the list the level was picked from', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Stream tier/ }).click();
    await page.getByRole('button', { name: 'Level 29', exact: true }).click();
    await expectTour(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Intermediate' })).toBeVisible();
    await expect(veil(page)).toHaveCount(0);
  });

  test('leaving for the level list forgets where they were headed', async ({ page }) => {
    await page.getByRole('button', { name: /Pond tier/ }).click();
    await page.getByRole('button', { name: 'Level 3', exact: true }).click();
    await expectTour(page);

    // Back out, then choose level 1 itself: after the tour, "Next" is plain level 2.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Level 1', exact: true }).click();
    await expectTour(page);
    await finishTour(page);
    await expect(page.getByRole('button', { name: 'Next · Level 2' })).toBeVisible();
  });
});

test.describe('once the tour is done or skipped', () => {
  test('a player who already has levels behind them is never sent to the tutorial', async ({
    page,
  }) => {
    // Progress from an earlier version, without the "has seen the tutorial" flag.
    await newPlayerStart(page);
    await page.evaluate(() => {
      localStorage.setItem(
        'grid:v2:progress',
        JSON.stringify({ 4: { completed: true, bestGuessCount: 2, stars: 3 } }),
      );
    });
    await page.reload();
    await waitForHook(page);

    await openLevel(page, 9);
    await expectPlainLevel(page, 10);
    await page.evaluate(() => window.__gridTest!.backToHome());
    await openLevel(page, 0);
    await expectPlainLevel(page, 1);
  });

  test('no door runs it again', async ({ page }) => {
    await newPlayerStart(page);
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expectTour(page);
    await skip(page);
    await expectPlainLevel(page, 1);

    await page.evaluate(() => window.__gridTest!.backToHome());
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expectPlainLevel(page, 1);

    await page.evaluate(() => window.__gridTest!.backToHome());
    await page.getByRole('button', { name: /Pond tier/ }).click();
    await page.getByRole('button', { name: 'Level 3', exact: true }).click();
    await expectPlainLevel(page, 3);

    await page.goto('/?level=10');
    await waitForHook(page);
    await expectPlainLevel(page, 10);
  });

  test('Settings on the home screen brings it back', async ({ page }) => {
    await freshStart(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Replay tutorial' }).click();
    await expectTour(page);
  });

  test('Settings inside any level brings it back, on level 1', async ({ page }) => {
    await freshStart(page);
    await openLevel(page, 9);
    await openSettings(page);
    await page.getByRole('button', { name: 'Replay tutorial' }).click();
    await expectTour(page);

    // A replay was not on the way to anywhere: skipping it stays on level 1.
    await skip(page);
    await expectPlainLevel(page, 1);
  });

  test('right after skipping, Settings is one tap away and brings it back', async ({ page }) => {
    await newPlayerStart(page);
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expectTour(page);
    await skip(page);

    await openSettings(page);
    await page.getByRole('button', { name: 'Replay tutorial' }).click();
    await expectTour(page);
  });

  test('a replay keeps the stars already earned', async ({ page }) => {
    await newPlayerStart(page);
    await openLevel(page, 0);
    await finishTour(page);
    await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
    await expect.poll(() => levelOneStars(page)).toBe(3);

    await openSettings(page);
    await page.getByRole('button', { name: 'Replay tutorial' }).click();
    await expectTour(page);
    const restarted = await getState(page);
    expect(restarted.outcome).toBe(OUTCOME_IN_PROGRESS);
    expect(restarted.guesses).toHaveLength(0);

    // Slower this time (the wrong guess first): the three stars stay.
    await playToGuess(page);
    await touch(page, [11, 26]);
    await page.getByRole('button', { name: 'Submit guess' }).click();
    await expect(caption(page)).toContainText("So they're here.");
    await touch(page, [8, 29]);
    await page.getByRole('button', { name: 'Guess 2 of 5' }).click();
    await expect(page.getByText('Solved in 2.')).toBeVisible();
    expect(await levelOneStars(page)).toBe(3);
  });

  test('a replay starts clean even when level 1 was lost', async ({ page }) => {
    await freshStart(page);
    await openLevel(page, 0);
    const start = await getState(page);
    const wrong = [...Array(36).keys()].filter(
      i => start.puzzle.solution[i] === 0 && !start.lockedEmpty[i],
    );
    for (let g = 0; g < start.guessBudget; g++) {
      await tapCells(page, [wrong[g]!]);
      await submit(page);
      await page.waitForTimeout(BETWEEN_GUESSES_MS);
    }
    expect((await getState(page)).outcome).toBe(OUTCOME_LOST);

    await openSettings(page);
    await page.getByRole('button', { name: 'Replay tutorial' }).click();
    await expectTour(page);
    const clean = await getState(page);
    expect(clean.outcome).toBe(OUTCOME_IN_PROGRESS);
    expect(clean.guesses).toHaveLength(0);
    expect(clean.lockedEmpty).toEqual(start.lockedEmpty);
  });
});

test.describe('in the middle of the tour', () => {
  test.beforeEach(async ({ page }) => {
    await newPlayerStart(page);
    await openLevel(page, 0);
    await expectTour(page);
  });

  test('Escape leaves the level, and the tour starts over next time', async ({ page }) => {
    await captionButton(page, 'Next').click();
    await touch(page, [30, 31]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Level 1' })).toHaveCount(0);
    await expect(veil(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Level 1', exact: true }).click();
    await expectTour(page);
    expect(await marksOf(page, [30, 31])).toEqual([0, 0]);
  });

  test('a reload starts it over', async ({ page }) => {
    await captionButton(page, 'Next').click();
    await touch(page, [30, 31, 32, 35]);
    await expect(caption(page)).toContainText('This column has its 1 beaver.');
    await page.waitForTimeout(600);

    await page.reload();
    await waitForHook(page);
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expectTour(page);
    expect(await marksOf(page, [30, 31, 32, 35])).toEqual([0, 0, 0, 0]);
  });

  test('a second tap on "Rule them out" does not rub the dashes out again', async ({ page }) => {
    await captionButton(page, 'Next').click();
    await touch(page, [30, 31, 32, 35]);
    await captionButton(page, 'Rule them out').dblclick();
    await expect(caption(page)).toContainText('3 beavers, 3 free cells.');
    const s = await getState(page);
    expect([0, 6, 12, 24].map(i => s.emptyNotes[i])).toEqual([true, true, true, true]);
  });

  test('holding a lit cell marks it; it does not pencil a dash', async ({ page }) => {
    await captionButton(page, 'Next').click();
    await expect(caption(page)).toContainText('4 beavers, 4 free cells.');
    const cell = await boxOf(page.locator('[data-cell="30"]'));
    await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    const s = await getState(page);
    expect(s.currentMarks[30]).toBe(1);
    expect(s.emptyNotes[30]).toBe(false);
  });

  test('a tap on the lit part that the step does not ask for is answered, and changes nothing', async ({
    page,
  }) => {
    await captionButton(page, 'Next').click();
    await touch(page, [30, 31, 32, 35]);
    await expect(caption(page)).toContainText('This column has its 1 beaver.');
    await expect(caption(page)).toHaveAttribute('data-nudges', '0');

    // The beaver inside the lit column: the step is about the cells around it.
    const before = await getState(page);
    await touch(page, [30]);
    await expect(caption(page)).toHaveAttribute('data-nudges', '1');
    const after = await getState(page);
    expect(after.currentMarks).toEqual(before.currentMarks);
    expect(after.emptyNotes).toEqual(before.emptyNotes);
  });

  test('the guess is one cell in each row, and can be changed until both are made', async ({
    page,
  }) => {
    await playToGuess(page);
    await touch(page, [8]);
    expect(await marksOf(page, [8])).toEqual([1]);

    // The same row again: it has its guess, so the other cell does not take one.
    await touch(page, [11]);
    expect(await marksOf(page, [8, 11])).toEqual([1, 0]);
    await expect(caption(page)).toHaveAttribute('data-nudges', '1');

    // Changing one's mind: take the mark back, then the other cell is open again.
    await touch(page, [8]);
    await touch(page, [11]);
    expect(await marksOf(page, [8, 11])).toEqual([0, 1]);

    await touch(page, [26]);
    await expect(caption(page)).toContainText('Tap here to check.');
    expect(await marksOf(page, [8, 11, 26, 29])).toEqual([0, 1, 1, 0]);
  });

  test('taps while a guess is being judged do nothing: one check, one guess', async ({ page }) => {
    await playToGuess(page);
    await touch(page, [11, 26]);
    await expect(caption(page)).toContainText('Tap here to check.');
    const button = await boxOf(page.getByRole('button', { name: 'Submit guess' }));
    const at = { x: button.x + button.width / 2, y: button.y + button.height / 2 };
    await page.mouse.click(at.x, at.y);
    // Past the short lock on the button itself, while the result is still showing.
    await page.waitForTimeout(800);
    await page.mouse.click(at.x, at.y);
    await touch(page, [8]);

    await expect(caption(page)).toContainText("So they're here.");
    const s = await getState(page);
    expect(s.guesses).toHaveLength(1);
    expect(s.currentMarks[8]).toBe(0);
  });

  test('the light follows the board when the screen changes size', async ({ page }) => {
    await captionButton(page, 'Next').click();
    await expect(caption(page)).toContainText('4 beavers, 4 free cells.');
    await page.setViewportSize({ width: 600, height: 900 });

    await expect
      .poll(async () => {
        const lit = await boxOf(holes(page).first());
        const first = await boxOf(page.locator('[data-cell="30"]'));
        const last = await boxOf(page.locator('[data-cell="35"]'));
        return (
          lit.x <= first.x &&
          lit.y <= first.y &&
          lit.x + lit.width >= last.x + last.width &&
          lit.y + lit.height >= last.y + last.height &&
          lit.height < first.height * 1.6
        );
      })
      .toBe(true);
    await touch(page, [30, 31, 32, 35]);
    expect(await marksOf(page, [30, 31, 32, 35])).toEqual([1, 1, 1, 1]);
  });
});
