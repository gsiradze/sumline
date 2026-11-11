import { describe, expect, it } from 'vitest';
import { displayLink, levelIdFromSearch, levelLink } from '../deepLink';

describe('levelIdFromSearch', () => {
  it('reads the level a link points at', () => {
    expect(levelIdFromSearch('?level=1')).toBe(0);
    expect(levelIdFromSearch('?level=37')).toBe(36);
    expect(levelIdFromSearch('?utm_source=share&level=210')).toBe(209);
  });

  it.each([
    '',
    '?level=',
    '?level=0',
    '?level=211',
    '?level=-3',
    '?level=3.5',
    '?level=abc',
    '?lvl=4',
  ])('ignores %j', search => {
    expect(levelIdFromSearch(search)).toBeNull();
  });
});

describe('levelLink', () => {
  it('points at the level on the web version', () => {
    expect(levelLink('https://sumline.example', 37)).toBe('https://sumline.example/?level=37');
    expect(levelLink('https://sumline.example/play/', 2)).toBe(
      'https://sumline.example/play/?level=2',
    );
  });

  it('is null without a real web address', () => {
    expect(levelLink('', 5)).toBeNull();
    expect(levelLink('   ', 5)).toBeNull();
    expect(levelLink('sumline.example', 5)).toBeNull();
  });

  it('round-trips through levelIdFromSearch', () => {
    const link = levelLink('https://sumline.example', 120)!;
    expect(levelIdFromSearch(new URL(link).search)).toBe(119);
  });
});

describe('displayLink', () => {
  it('drops the scheme and www', () => {
    expect(displayLink('https://www.sumline.example/?level=4')).toBe('sumline.example/?level=4');
    expect(displayLink('http://sumline.example/?level=4')).toBe('sumline.example/?level=4');
  });
});
