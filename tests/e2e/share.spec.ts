import { expect, test } from '@playwright/test';

import { freshStart, markAnswer, openLevel, submit, waitForHook } from './helpers';

interface Shared {
  readonly title?: string;
  readonly text?: string;
  readonly file: { readonly name: string; readonly type: string; readonly head: number[] } | null;
}

declare global {
  interface Window {
    __shared?: Shared;
  }
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('a shared link opens its level and then tidies the address', async ({ page }) => {
  await page.goto('/?level=5');
  await waitForHook(page);
  await expect(page.getByRole('heading', { name: 'Level 5' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');

  // Going back from there is an ordinary step back, not a jump into the level again.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible();
});

test('a link to a level that does not exist just opens the game', async ({ page }) => {
  await page.goto('/?level=999');
  await waitForHook(page);
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
});

test('where the share sheet takes pictures, the result goes out as an image', async ({ page }) => {
  // A stand-in for a phone's share sheet that accepts files.
  await page.addInitScript(() => {
    Object.assign(navigator, {
      canShare: (data?: ShareData) => Array.isArray(data?.files),
      share: async (data: ShareData) => {
        const file = data.files?.[0];
        const head = file ? [...new Uint8Array(await file.slice(0, 8).arrayBuffer())] : [];
        window.__shared = {
          title: data.title,
          text: data.text,
          file: file ? { name: file.name, type: file.type, head } : null,
        };
      },
    });
  });
  await page.reload();
  await waitForHook(page);

  await openLevel(page, 11);
  await markAnswer(page);
  await submit(page);
  await expect(page.getByText(/^Solved in 1\./)).toBeVisible();
  // The picture is drawn as soon as the level is won, ahead of the tap.
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Share result' }).click();

  await page.waitForFunction(() => window.__shared !== undefined);
  const shared = await page.evaluate(() => window.__shared!);
  expect(shared.title).toBe('Sumline #12');
  expect(shared.text?.startsWith('Sumline #12 ')).toBe(true);
  expect(shared.file?.name).toBe('sumline-level-12.png');
  expect(shared.file?.type).toBe('image/png');
  expect(shared.file?.head).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Shared, not copied: the button does not claim a copy.
  await expect(page.getByRole('button', { name: 'Copied' })).toHaveCount(0);
});
