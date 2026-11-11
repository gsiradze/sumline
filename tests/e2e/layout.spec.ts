import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { freshStart, openLevel } from './helpers';

// What the app reserves at the bottom of the screen for the banner ad and the gap above it.
const BANNER_PX = 60;
const BANNER_GAP_PX = 16;

interface Measured {
  readonly cell: number;
  readonly pitch: number;
  readonly gridRight: number;
  readonly submitRight: number;
  readonly hintBottom: number;
  readonly overflow: number;
  readonly viewport: number;
}

async function withBanner(page: Page): Promise<void> {
  await page.evaluate(
    ([banner, gap]) => {
      const root = document.documentElement.style;
      root.setProperty('--banner-height', `${banner}px`);
      root.setProperty('--banner-gap', `${gap}px`);
    },
    [BANNER_PX, BANNER_GAP_PX],
  );
}

async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const rect = (selector: string): DOMRect =>
      document.querySelector(selector)!.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('button')];
    const submit = buttons.find(b => /Submit guess/.test(b.textContent ?? ''))!;
    const hint = buttons.find(b => /Hint/.test(b.textContent ?? ''))!;
    const first = rect('[data-cell="0"] rect');
    return {
      cell: first.width,
      pitch: rect('[data-cell="1"] rect').x - first.x,
      gridRight: rect('[data-cell="5"] rect').right,
      submitRight: submit.getBoundingClientRect().right,
      hintBottom: hint.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollHeight - window.innerHeight,
      viewport: window.innerHeight,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('on a tall phone the grid uses the full width, up to the edge of the buttons', async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 956 });
  await openLevel(page, 7);
  const m = await measure(page);
  expect(Math.abs(m.gridRight - m.submitRight)).toBeLessThanOrEqual(1);
  expect(m.cell).toBeGreaterThan(54);
  expect(m.overflow).toBeLessThanOrEqual(0);
});

test('on a common 360-wide phone the level fits above the banner without scrolling', async ({
  page,
}) => {
  // 360x800 screen less the status and navigation bars.
  await page.setViewportSize({ width: 360, height: 728 });
  await openLevel(page, 7);
  await withBanner(page);
  const m = await measure(page);
  // If this fails after the header or the controls changed height, update the
  // 332px in `.board-box` (globals.css).
  expect(m.overflow).toBeLessThanOrEqual(0);
  expect(m.hintBottom).toBeLessThanOrEqual(m.viewport - BANNER_PX - BANNER_GAP_PX);
  expect(m.cell).toBeGreaterThan(40);
});

test('a tutorial level with its tip also fits on a 360x800 screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openLevel(page, 5);
  await withBanner(page);
  const m = await measure(page);
  expect(m.overflow).toBeLessThanOrEqual(0);
  expect(m.hintBottom).toBeLessThanOrEqual(m.viewport - BANNER_PX - BANNER_GAP_PX);
});

test('on a short screen the board stops shrinking while cells are still easy to hit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 568 });
  await openLevel(page, 7);
  await withBanner(page);
  const m = await measure(page);
  expect(m.pitch).toBeGreaterThanOrEqual(44);
});

test('the notice after a hint does not cover the board or its numbers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLevel(page, 7);
  await page.getByRole('button', { name: /Get a hint/ }).click();
  const notice = page.getByRole('status').filter({ hasText: 'revealed' });
  await notice.waitFor();
  const noticeBox = (await notice.boundingBox())!;
  const boardBox = (await page.locator('[data-board]').boundingBox())!;
  expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(boardBox.y);
});

// The longest label above the title, and the longest title.
const HEADER_CASES = [
  { width: 320, levelId: 62 },
  { width: 320, levelId: 209 },
  { width: 360, levelId: 62 },
  { width: 360, levelId: 209 },
] as const;

for (const { width, levelId } of HEADER_CASES) {
  test(`level ${levelId + 1} at ${width} px wide: the header buttons leave the title readable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await openLevel(page, levelId);
    const gaps = await page.evaluate(() => {
      const header = document.querySelector('header')!;
      const textBox = (el: Element): DOMRect => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect();
      };
      const title = header.querySelector('h1')!;
      const texts = [textBox(title), textBox(title.previousElementSibling!)];
      const controls = [
        ...header.querySelectorAll('button, [aria-label*="guesses remaining"]'),
      ].map(el => el.getBoundingClientRect());
      const left = Math.min(...texts.map(t => t.left));
      const right = Math.max(...texts.map(t => t.right));
      const mid = (left + right) / 2;
      return {
        buttons: controls.length,
        // Distance from the text to the nearest control on each side.
        leftGap: left - Math.max(...controls.filter(c => c.right <= mid).map(c => c.right)),
        rightGap: Math.min(...controls.filter(c => c.left >= mid).map(c => c.left)) - right,
        smallestTarget: Math.min(...controls.map(c => Math.min(c.width, c.height))),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    // Back, Settings, Rules and the guess counter.
    expect(gaps.buttons).toBe(4);
    expect(gaps.leftGap).toBeGreaterThanOrEqual(4);
    expect(gaps.rightGap).toBeGreaterThanOrEqual(4);
    expect(gaps.smallestTarget).toBeGreaterThanOrEqual(40);
    expect(gaps.overflow).toBeLessThanOrEqual(0);
  });
}
