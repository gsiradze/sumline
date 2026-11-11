import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The dark theme's colours are checked against published guidance rather than by eye:
// - Apple, Human Interface Guidelines, Dark Mode: contrast never below 4.5:1.
// - WCAG 2.2, 1.4.3 and 1.4.11: 4.5:1 for text, 3:1 for large type and for the
//   shapes a player has to tell apart.
// - Google, Material dark theme: the page is a dark grey, not black, and text
//   is an off-white, not white (pure white "vibrates" on a dark page).

const css = readFileSync(resolve(__dirname, '../globals.css'), 'utf8');

function tokens(selector: string): Record<string, string> {
  const body = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (body === undefined) throw new Error(`no ${selector} block in globals.css`);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out[m[1]!] = m[2]!.toLowerCase();
  }
  return out;
}

const dark = { ...tokens(':root'), ...tokens('\\.dark') };

function color(token: string): string {
  const value = dark[token];
  if (value === undefined) throw new Error(`no --${token} in globals.css`);
  return value;
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** CIELAB lightness, 0 (black) to 100 (white): the "tone" Material's palettes are built on. */
function lightness(hex: string): number {
  const y = luminance(hex);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (y * 24389) / 27;
}

type Pair = readonly [what: string, foreground: string, background: string];

const TEXT: readonly Pair[] = [
  ['body text on the page', 'ink-900', 'paper-100'],
  ['body text on a card', 'ink-900', 'paper-50'],
  ['secondary text on the page', 'ink-700', 'paper-100'],
  ['secondary text on a card', 'ink-700', 'paper-50'],
  ['labels on the page', 'ink-500', 'paper-100'],
  ['labels on a card', 'ink-500', 'paper-50'],
  ['labels in a well', 'ink-500', 'paper-200'],
  ['faint labels on the page', 'ink-400', 'paper-100'],
  ['faint labels on a card', 'ink-400', 'paper-50'],
  ['the label of a main button', 'paper-50', 'ink-fill-800'],
  ['the label of the confirm button', 'paper-50', 'clay-600'],
  ['a number on a green bar', 'paper-50', 'sage-500'],
  ['a number on an ochre bar', 'paper-50', 'ochre-500'],
  ['a number on a clay bar', 'paper-50', 'clay-500'],
  ['accent text on the page', 'ochre-700', 'paper-100'],
  ['accent text on a card', 'ochre-700', 'paper-50'],
  ['accent text on its tint', 'ochre-700', 'ochre-100'],
  ['"correct" text on a card', 'sage-700', 'paper-50'],
  ['"wrong" text on a card', 'clay-700', 'paper-50'],
  ['"wrong" text on the page', 'clay-700', 'paper-100'],
];

const SHAPES: readonly Pair[] = [
  ['a marked cell beside an open one', 'ink-fill-800', 'paper-50'],
  ['a correct cell beside an open one', 'sage-500', 'paper-50'],
  ['the cross on a wrong cell', 'clay-700', 'clay-100'],
  ['the cross on a cell as it is judged wrong', 'paper-50', 'clay-500'],
  ['the dash on a ruled-out cell', 'sage-600', 'sage-100'],
  ["the player's own dash on an open cell", 'ink-400', 'paper-50'],
  ['the ring around a hinted cell', 'ochre-500', 'paper-100'],
  ['stars on the page', 'ochre-600', 'paper-100'],
  ['stars on a card', 'ochre-600', 'paper-50'],
  ['the big numbers on the stats cards', 'ochre-500', 'paper-50'],
  ['a switch that is on', 'sage-500', 'paper-50'],
];

describe('the dark palette', () => {
  it.each(TEXT)('%s is readable (4.5:1)', (_what, fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SHAPES)('%s stands out (3:1)', (_what, fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(3);
  });

  it('uses a dark grey page, not black', () => {
    const page = lightness(color('paper-100'));
    expect(page).toBeGreaterThan(4);
    expect(page).toBeLessThan(12);
  });

  it('uses off-white text, not white', () => {
    const text = lightness(color('ink-900'));
    expect(text).toBeGreaterThan(85);
    expect(text).toBeLessThan(95);
  });

  it('shows what is raised by making it lighter, as shadows do not show on a dark page', () => {
    const [page, well, card] = ['paper-100', 'paper-200', 'paper-50'].map(t => lightness(color(t)));
    expect(well!).toBeGreaterThan(page!);
    expect(card!).toBeGreaterThan(well!);
  });

  it('tells a marked cell from a correct one by lightness as well as by colour', () => {
    const marked = lightness(color('ink-fill-800'));
    const correct = lightness(color('sage-500'));
    expect(marked - correct).toBeGreaterThanOrEqual(15);
  });
});
