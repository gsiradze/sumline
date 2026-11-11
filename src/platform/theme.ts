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

/** The player's choice if they made one; otherwise whatever the device is set to. */
export function resolveTheme(choice: Theme | null, deviceIsDark: boolean): Theme {
  return choice ?? (deviceIsDark ? Theme.Dark : Theme.Light);
}

export function otherTheme(theme: Theme): Theme {
  return theme === Theme.Dark ? Theme.Light : Theme.Dark;
}

const DEVICE_DARK = '(prefers-color-scheme: dark)';

export function deviceIsDark(): boolean {
  return window.matchMedia(DEVICE_DARK).matches;
}

/** Calls back when the device switches between light and dark. Returns how to stop. */
export function onDeviceThemeChange(listener: (dark: boolean) => void): () => void {
  const query = window.matchMedia(DEVICE_DARK);
  // Safari before 14 has no events here; such a browser simply does not follow the change.
  if (typeof query.addEventListener !== 'function') return () => {};
  const handle = (): void => listener(query.matches);
  query.addEventListener('change', handle);
  return () => query.removeEventListener('change', handle);
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
