import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Theme,
  applyTheme,
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
 * The theme on screen and the switch that changes it. The game is light until
 * the player switches; the choice is then remembered.
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
      // A switch made while the saved choice was still loading wins.
      if (cancelled || chosenRef.current) return;
      show(resolveTheme(parseTheme(raw)));
    });
    return () => {
      cancelled = true;
    };
  }, [show]);

  const toggleTheme = useCallback(() => {
    const next = otherTheme(themeRef.current);
    chosenRef.current = true;
    show(next);
    void setThemeChoice(next);
    settingChanged('dark_theme', next === Theme.Dark);
  }, [show]);

  return { theme, toggleTheme };
}
