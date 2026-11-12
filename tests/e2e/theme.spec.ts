import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { freshStart, openLevel, waitForHook } from './helpers';

const LIGHT_PAGE = 'rgb(250, 246, 240)';
const DARK_PAGE = 'rgb(28, 24, 21)';

const isDark = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));

const pageColor = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const barColor = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  );

async function restart(page: Page): Promise<void> {
  await page.reload();
  await waitForHook(page);
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('the theme button switches to dark and back, and the choice survives a restart', async ({
  page,
}) => {
  expect(await isDark(page)).toBe(false);
  expect(await pageColor(page)).toBe(LIGHT_PAGE);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  expect(await isDark(page)).toBe(true);
  expect(await pageColor(page)).toBe(DARK_PAGE);
  expect((await barColor(page))?.toLowerCase()).toBe('#1c1815');

  await restart(page);
  expect(await isDark(page)).toBe(true);

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  expect(await isDark(page)).toBe(false);
  expect(await pageColor(page)).toBe(LIGHT_PAGE);
  expect((await barColor(page))?.toLowerCase()).toBe('#faf6f0');

  await restart(page);
  expect(await isDark(page)).toBe(false);
});

test('the game starts light, even on a phone set to dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await restart(page);
  expect(await isDark(page)).toBe(false);
  expect(await pageColor(page)).toBe(LIGHT_PAGE);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  // The device changing while the game is open changes nothing either.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(100);
  expect(await isDark(page)).toBe(false);
});

test("the player's choice is all that decides the theme", async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  expect(await isDark(page)).toBe(true);

  await page.emulateMedia({ colorScheme: 'light' });
  await restart(page);
  expect(await isDark(page)).toBe(true);

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(100);
  expect(await isDark(page)).toBe(true);
});

test('a dark-theme player never sees a light page while the game loads', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  // Record the theme at the moment the page body exists, before the app's code has run.
  await page.addInitScript(() => {
    new MutationObserver((_records, observer) => {
      if (!document.body) return;
      (window as unknown as { __themeAtFirstPaint?: string }).__themeAtFirstPaint =
        document.documentElement.className;
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await restart(page);
  const atFirstPaint = await page.evaluate(
    () => (window as unknown as { __themeAtFirstPaint?: string }).__themeAtFirstPaint,
  );
  expect(atFirstPaint).toContain('dark');
});

test('Settings has the same switch, and it works from inside a level', async ({ page }) => {
  await openLevel(page, 7);
  await page.getByRole('button', { name: 'Settings' }).click();
  const darkSwitch = page.getByRole('switch', { name: 'Dark theme' });
  await expect(darkSwitch).toHaveAttribute('aria-checked', 'false');

  await darkSwitch.click();
  await expect(darkSwitch).toHaveAttribute('aria-checked', 'true');
  expect(await isDark(page)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Level 8' })).toBeVisible();
  expect(await pageColor(page)).toBe(DARK_PAGE);
});

test('the light theme keeps its colours', async ({ page }) => {
  const token = (name: string): Promise<string> =>
    page.evaluate(
      n => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase(),
      name,
    );
  expect(await token('--paper-100')).toBe('#faf6f0');
  expect(await token('--paper-50')).toBe('#fdfbf6');
  expect(await token('--ink-900')).toBe('#2a2722');
  expect(await token('--ink-fill-800')).toBe('#263348');
  expect(await token('--sage-500')).toBe('#7b9875');
  expect(await token('--clay-500')).toBe('#c46a47');
  expect(await token('--ochre-500')).toBe('#c39a3e');
});
