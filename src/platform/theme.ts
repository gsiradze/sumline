import { setSystemBarsTheme } from './native';

export enum Theme {
  Light = 'light',
  Dark = 'dark',
}

/** Where the player's choice is saved. index.html reads the same key before the first paint. */
export const THEME_STORAGE_KEY = 'grid:v2:theme';

/** Each theme's page colour (--paper-100), for the bars the browser or the phone draws itself. */
export const THEME_PAGE_COLOR: Readonly<Record<Theme, string>> = {
  [Theme.Light]: '#faf6f0',
  [Theme.Dark]: '#1c1815',
};

export function parseTheme(raw: string | null): Theme | null {
  return raw === Theme.Light || raw === Theme.Dark ? raw : null;
}

/** Light until the player chooses. The device's own light or dark setting is not followed. */
export function resolveTheme(choice: Theme | null): Theme {
  return choice ?? Theme.Light;
}

export function otherTheme(theme: Theme): Theme {
  return theme === Theme.Dark ? Theme.Light : Theme.Dark;
}

/** The theme on screen now. index.html has already set it by the time any of this runs. */
export function shownTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? Theme.Dark : Theme.Light;
}

export function applyTheme(theme: Theme): void {
  const dark = theme === Theme.Dark;
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_PAGE_COLOR[theme]);
  void setSystemBarsTheme(dark);
}
