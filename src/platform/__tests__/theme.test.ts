import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  THEME_PAGE_COLOR,
  THEME_STORAGE_KEY,
  Theme,
  otherTheme,
  parseTheme,
  resolveTheme,
} from '../theme';

const ROOT = resolve(__dirname, '../../..');

describe('parseTheme', () => {
  it('reads a saved choice', () => {
    expect(parseTheme('light')).toBe(Theme.Light);
    expect(parseTheme('dark')).toBe(Theme.Dark);
  });

  it('treats anything else as no choice', () => {
    for (const raw of [null, '', 'auto', 'DARK', '1']) expect(parseTheme(raw)).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('follows the device while the player has not chosen', () => {
    expect(resolveTheme(null, true)).toBe(Theme.Dark);
    expect(resolveTheme(null, false)).toBe(Theme.Light);
  });

  it("keeps the player's choice whatever the device says", () => {
    expect(resolveTheme(Theme.Light, true)).toBe(Theme.Light);
    expect(resolveTheme(Theme.Dark, false)).toBe(Theme.Dark);
  });
});

describe('otherTheme', () => {
  it('is what the switch changes to', () => {
    expect(otherTheme(Theme.Light)).toBe(Theme.Dark);
    expect(otherTheme(Theme.Dark)).toBe(Theme.Light);
  });
});

// index.html sets the theme before the first paint with a few lines of its own.
// They cannot import from here, so these keep the two in step.
describe('the theme script in index.html', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const css = readFileSync(resolve(ROOT, 'src/styles/globals.css'), 'utf8');
  const pageColor = (block: string): string => {
    const body = new RegExp(`${block}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    return /--paper-100:\s*(#[0-9a-f]{6})/i.exec(body)?.[1]?.toLowerCase() ?? '';
  };

  it('reads the same saved choice as the app', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });

  it("colours the browser's own bars with each theme's page colour", () => {
    expect(THEME_PAGE_COLOR[Theme.Light]).toBe(pageColor(':root'));
    expect(THEME_PAGE_COLOR[Theme.Dark]).toBe(pageColor('\\.dark'));
    expect(html.toLowerCase()).toContain(
      `<meta name="theme-color" content="${THEME_PAGE_COLOR[Theme.Light]}"`,
    );
    expect(html).toContain(`'${THEME_PAGE_COLOR[Theme.Dark]}'`);
  });

  it('matches the colours the app gives the status bar', () => {
    const native = readFileSync(resolve(ROOT, 'src/platform/native.ts'), 'utf8').toLowerCase();
    expect(native).toContain(`const paper = '${THEME_PAGE_COLOR[Theme.Light]}'`);
    expect(native).toContain(`const paper_dark = '${THEME_PAGE_COLOR[Theme.Dark]}'`);
  });
});
