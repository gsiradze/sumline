import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { freshStart, openLevel, waitForHook } from './helpers';
import type { AudioState } from './helpers';

const audio = (page: Page): Promise<AudioState> => page.evaluate(() => window.__gridTest!.audio());

// The track is 320,727 frames at 22,050 Hz.
const LOOP_SECONDS = 320_727 / 22_050;

async function setPageHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate(isHidden => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('music waits for the first touch, then plays as a loop of exactly the track', async ({
  page,
}) => {
  expect(await audio(page)).toMatchObject({ playing: false, engine: 'none' });

  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(true);

  const state = await audio(page);
  expect(state.engine).toBe('running');
  // Whatever padding this browser's decoder leaves, the loop is the track itself.
  expect(state.loop).not.toBeNull();
  expect(state.loop!.end - state.loop!.start).toBeCloseTo(LOOP_SECONDS, 4);

  // It keeps playing from screen to screen.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
  expect((await audio(page)).playing).toBe(true);
});

test('the Music switch turns it off, and the choice survives a restart', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  const musicSwitch = page.getByRole('switch', { name: 'Music' });
  await expect(musicSwitch).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await audio(page)).playing).toBe(true);

  await musicSwitch.click();
  await expect(musicSwitch).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await audio(page)).playing).toBe(false);

  await page.reload();
  await waitForHook(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Music' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  // Taps elsewhere do not bring it back.
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.waitForTimeout(400);
  expect((await audio(page)).playing).toBe(false);

  // Turning it on again starts it straight away.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Music' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(true);
});

test('Sound off silences the music too, without forgetting the Music choice', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(true);

  await page.getByRole('switch', { name: 'Sound' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(false);
  const musicSwitch = page.getByRole('switch', { name: 'Music' });
  await expect(musicSwitch).toBeDisabled();
  await expect(musicSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Sound is off')).toBeVisible();

  await page.getByRole('switch', { name: 'Sound' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(true);
  await expect(musicSwitch).toBeEnabled();
});

test('nothing plays while the app is in the background', async ({ page }) => {
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect.poll(async () => (await audio(page)).engine).toBe('running');

  await setPageHidden(page, true);
  await expect.poll(async () => (await audio(page)).engine).toBe('suspended');

  await setPageHidden(page, false);
  await expect.poll(async () => (await audio(page)).engine).toBe('running');
  expect((await audio(page)).playing).toBe(true);
});

test('music can be switched off from inside a level', async ({ page }) => {
  await openLevel(page, 7);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(true);

  await page.getByRole('switch', { name: 'Music' }).click();
  await expect.poll(async () => (await audio(page)).playing).toBe(false);

  // Back closes Settings, not the level.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Level 8' })).toBeVisible();
  expect((await audio(page)).playing).toBe(false);
});
