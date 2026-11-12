import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { markAnswer, openLevel, submit, waitForHook } from './helpers';
import { expectPlainLevel, expectTour, veil } from './tour';

// The public web build is a demo: it stops after level 14. The dev server has
// no limit unless the address asks for the demo (`/?demo`), which is how these
// tests reach it. Every way of running into the limit, and every way out of
// the prompt it raises, has to leave the player somewhere they can play.

const DEMO_LEVELS = 14;

const prompt = (page: Page): Locator => page.getByRole('dialog', { name: 'Get the app' });
const keepPlaying = (page: Page): Locator =>
  page.getByRole('button', { name: 'Keep playing the demo' });

/** The demo as a visitor with this many levels solved gets it. None: a first visit. */
async function demoStart(page: Page, solved = 0, path = '/?demo'): Promise<void> {
  await page.goto('/');
  await page.evaluate(count => {
    localStorage.clear();
    if (count === 0) return;
    const progress: Record<number, unknown> = {};
    for (let id = 0; id < count; id++) {
      progress[id] = { completed: true, bestGuessCount: 2, stars: 3 };
    }
    localStorage.setItem('grid:v2:progress', JSON.stringify(progress));
    localStorage.setItem('grid:v2:rulesShown', '1');
  }, solved);
  await page.goto(path);
  await waitForHook(page);
}

async function pickLevel(page: Page, tier: RegExp, levelNumber: number): Promise<void> {
  await page.getByRole('button', { name: tier }).click();
  await page.getByRole('button', { name: `Level ${levelNumber}`, exact: true }).click();
}

test.describe('where the demo ends', () => {
  test('its own levels open as they do in the app', async ({ page }) => {
    await demoStart(page, 3);
    await openLevel(page, DEMO_LEVELS - 1);
    await expectPlainLevel(page, DEMO_LEVELS);
  });

  test('a level past it is not opened: the app is offered instead', async ({ page }) => {
    await demoStart(page, 3);
    await pickLevel(page, /Stream tier/, 29);
    await expect(prompt(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Intermediate' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Sumline on Google Play' })).toBeVisible();
  });

  test('without the demo the same level simply opens', async ({ page }) => {
    await demoStart(page, 3, '/');
    await pickLevel(page, /Stream tier/, 29);
    await expectPlainLevel(page, 29);
  });
});

test.describe('"Keep playing the demo" leads somewhere playable', () => {
  test('a first-time visitor who picked a level past the demo gets the tutorial', async ({
    page,
  }) => {
    await demoStart(page);
    await pickLevel(page, /Stream tier/, 29);
    await expect(prompt(page)).toBeVisible();

    await keepPlaying(page).click();
    await expectTour(page);
  });

  test('…and backing out of it shows a list with levels the demo has', async ({ page }) => {
    await demoStart(page);
    await pickLevel(page, /Waterfall tier/, 106);
    await keepPlaying(page).click();
    await expectTour(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible();
    await expect(veil(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Level 1', exact: true })).toBeEnabled();
  });

  test('a first-time visitor who followed a link past the demo gets the tutorial', async ({
    page,
  }) => {
    await demoStart(page, 0, '/?demo&level=37');
    await expect(prompt(page)).toBeVisible();

    await keepPlaying(page).click();
    await expectTour(page);
  });

  test('a player part-way through goes on with their next unsolved level', async ({ page }) => {
    await demoStart(page, 3);
    await pickLevel(page, /River tier/, 64);
    await expect(prompt(page)).toBeVisible();

    await keepPlaying(page).click();
    await expectPlainLevel(page, 4);
  });

  test('after the last demo level, "Next" offers the app and the way on is the level list', async ({
    page,
  }) => {
    await demoStart(page, DEMO_LEVELS - 1);
    await openLevel(page, DEMO_LEVELS - 1);
    await markAnswer(page);
    await submit(page);
    await page.getByRole('button', { name: `Next · Level ${DEMO_LEVELS + 1}` }).click();
    await expect(prompt(page)).toBeVisible();

    await keepPlaying(page).click();
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Level 1', exact: true })).toBeEnabled();
  });

  test('with the whole demo solved, PLAY offers the app and the way on is the level list', async ({
    page,
  }) => {
    await demoStart(page, DEMO_LEVELS);
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expect(prompt(page)).toBeVisible();

    await keepPlaying(page).click();
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible();
  });
});

test.describe('closing the prompt any other way', () => {
  test('a tap outside it closes it and changes nothing else', async ({ page }) => {
    await demoStart(page, 3);
    await pickLevel(page, /Stream tier/, 29);
    await expect(prompt(page)).toBeVisible();

    await page.mouse.click(8, 8);
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Intermediate' })).toBeVisible();
  });

  test('Escape closes it and changes nothing else', async ({ page }) => {
    await demoStart(page, 3);
    await pickLevel(page, /Stream tier/, 29);
    await expect(prompt(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Intermediate' })).toBeVisible();
  });
});
