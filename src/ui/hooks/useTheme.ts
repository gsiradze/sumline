import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Theme,
  applyTheme,
  deviceIsDark,
  onDeviceThemeChange,
  otherTheme,
  parseTheme,
  resolveTheme,
  shownTheme,
} from '../../platform/theme';
import { getThemeChoice, setThemeChoice } from '../../storage/persistence';
import { settingChanged } from '../../telemetry/events';

interface ThemeControls {
  readonly theme: Theme;
  readonly toggleTheme: () => void;
}

/**
 * The theme on screen and the switch that changes it. Until the player uses the
 * switch the game follows the device, including when the device changes while
 * the game is open; after that the choice is theirs and is remembered.
 */
export function useTheme(): ThemeControls {
  const [theme, setTheme] = useState<Theme>(shownTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const chosenRef = useRef(false);

  const show = useCallback((next: Theme) => {
    applyTheme(next);
    setTheme(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getThemeChoice().then(raw => {
      if (cancelled || chosenRef.current) return;
      const choice = parseTheme(raw);
      chosenRef.current = choice !== null;
      show(resolveTheme(choice, deviceIsDark()));
    });
    return () => {
      cancelled = true;
    };
  }, [show]);

  useEffect(
    () =>
      onDeviceThemeChange(dark => {
        if (!chosenRef.current) show(dark ? Theme.Dark : Theme.Light);
      }),
    [show],
  );

  const toggleTheme = useCallback(() => {
    const next = otherTheme(themeRef.current);
    chosenRef.current = true;
    show(next);
    void setThemeChoice(next);
    settingChanged('dark_theme', next === Theme.Dark);
  }, [show]);

  return { theme, toggleTheme };
}
