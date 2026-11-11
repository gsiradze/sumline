import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { freshStart, getState, openLevel } from './helpers';
import type { TestState } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
  await openLevel(page, 7);
});

interface Point {
  readonly x: number;
  readonly y: number;
}

async function centreOf(page: Page, cell: number): Promise<Point> {
  const box = await page.locator(`[data-cell="${cell}"]`).boundingBox();
  if (!box) throw new Error(`cell ${cell} is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: number, to: number): Promise<void> {
  const a = await centreOf(page, from);
  const b = await centreOf(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.mouse.up();
}

const isOpen = (s: TestState, i: number): boolean => !s.lockedFilled[i] && !s.lockedEmpty[i];

/** The longest run of open cells in one row, as [first, last]. */
function openRun(s: TestState): readonly [number, number] {
  let best: readonly [number, number] = [-1, -1];
  for (let r = 0; r < 6; r++) {
    let start = -1;
    for (let c = 0; c <= 6; c++) {
      const open = c < 6 && isOpen(s, r * 6 + c);
      if (open && start < 0) start = c;
      if (!open && start >= 0) {
        if (best[0] < 0 || c - 1 - start > best[1] - best[0]) best = [r * 6 + start, r * 6 + c - 1];
        start = -1;
      }
    }
  }
  return best;
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, k) => from + k);

test('a tap marks a cell and a second tap unmarks it', async ({ page }) => {
  const s0 = await getState(page);
  const cell = [...Array(36).keys()].find(i => isOpen(s0, i))!;
  const p = await centreOf(page, cell);

  await page.mouse.click(p.x, p.y);
  expect((await getState(page)).currentMarks[cell]).toBe(1);
  await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-look', 'marked');

  await page.mouse.click(p.x, p.y);
  expect((await getState(page)).currentMarks[cell]).toBe(0);
});

test('dragging along a row marks every open cell crossed, and dragging back erases', async ({
  page,
}) => {
  const s0 = await getState(page);
  const [first, last] = openRun(s0);
  expect(last - first).toBeGreaterThanOrEqual(2);
  const marksBefore = s0.currentMarks.filter(m => m === 1).length;

  await drag(page, first, last);
  const s1 = await getState(page);
  for (const i of range(first, last)) expect(s1.currentMarks[i], `cell ${i}`).toBe(1);
  expect(s1.currentMarks.filter(m => m === 1).length).toBe(marksBefore + (last - first + 1));

  // Starting on a marked cell makes the stroke an eraser.
  await drag(page, last, first);
  const s2 = await getState(page);
  for (const i of range(first, last)) expect(s2.currentMarks[i], `cell ${i}`).toBe(0);
});

test('a drag never changes locked cells or a note the player made', async ({ page }) => {
  const s0 = await getState(page);
  const [first, last] = openRun(s0);
  const noted = first + 1;
  await page.evaluate((i: number) => window.__gridTest!.noteCell(i), noted);

  // Sweep the whole row, edge to edge: locked cells in it must be untouched.
  const row = Math.floor(first / 6);
  await drag(page, first, last);
  const s1 = await getState(page);
  expect(s1.emptyNotes[noted]).toBe(true);
  expect(s1.currentMarks[noted]).toBe(0);
  for (let c = 0; c < 6; c++) {
    const i = row * 6 + c;
    expect(s1.lockedFilled[i]).toBe(s0.lockedFilled[i]);
    expect(s1.lockedEmpty[i]).toBe(s0.lockedEmpty[i]);
  }
});

test('holding a cell pencils a note and the release does not also mark it', async ({ page }) => {
  const s0 = await getState(page);
  const cell = [...Array(36).keys()].find(i => isOpen(s0, i))!;
  const p = await centreOf(page, cell);

  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();

  const s1 = await getState(page);
  expect(s1.emptyNotes[cell]).toBe(true);
  expect(s1.currentMarks[cell]).toBe(0);
  await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-look', 'note');
});

test('a tap that slips a little into the next cell still marks only the first', async ({
  page,
}) => {
  const s0 = await getState(page);
  const [first] = openRun(s0);
  const box = (await page.locator(`[data-cell="${first}"]`).boundingBox())!;
  const y = box.y + box.height / 2;
  const nearEdge = box.x + box.width - 2;

  await page.mouse.move(nearEdge, y);
  await page.mouse.down();
  await page.mouse.move(nearEdge + 9, y, { steps: 3 });
  await page.mouse.up();

  const s1 = await getState(page);
  expect(s1.currentMarks[first]).toBe(1);
  expect(s1.currentMarks[first + 1]).toBe(0);
});

test('in Rule out mode a drag pencils notes instead of marks', async ({ page }) => {
  const s0 = await getState(page);
  const [first, last] = openRun(s0);
  await page.getByRole('radio', { name: 'Rule out' }).click();

  await drag(page, first, last);
  const s1 = await getState(page);
  for (const i of range(first, last)) {
    expect(s1.emptyNotes[i], `cell ${i}`).toBe(true);
    expect(s1.currentMarks[i]).toBe(0);
  }
});

test('the board ignores touches while the rules are open', async ({ page }) => {
  const s0 = await getState(page);
  const cell = [...Array(36).keys()].find(i => isOpen(s0, i))!;
  const p = await centreOf(page, cell);
  await page.getByRole('button', { name: 'Show rules' }).click();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();

  await page.locator('[data-board]').dispatchEvent('pointerdown', {
    clientX: p.x,
    clientY: p.y,
    pointerId: 7,
    isPrimary: true,
    bubbles: true,
  });
  await page.locator('[data-board]').dispatchEvent('pointerup', {
    clientX: p.x,
    clientY: p.y,
    pointerId: 7,
    isPrimary: true,
    bubbles: true,
  });
  expect((await getState(page)).currentMarks[cell]).toBe(0);
});
