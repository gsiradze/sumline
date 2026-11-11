import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { handleBack } from './back';

// The page colour of each theme (--paper-100).
const PAPER = '#FAF6F0';
const PAPER_DARK = '#1C1815';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function platformName(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/** Status and navigation bars that read on the theme's page: dark icons on light, light on dark. */
export async function setSystemBarsTheme(dark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: dark ? StatusBarStyle.Dark : StatusBarStyle.Light });
    await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: dark ? PAPER_DARK : PAPER });
    }
  } catch {
    // non-fatal
  }
}

export async function bootstrapNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // index.html has already put the theme on the page.
  await setSystemBarsTheme(document.documentElement.classList.contains('dark'));
  try {
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch {
    // non-fatal
  }

  try {
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {
    // non-fatal
  }

  try {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    // non-fatal
  }

  try {
    // Navigation is React state, so the WebView never has history to go back
    // through. Screens and overlays own "back" via platform/back.ts.
    await CapacitorApp.addListener('backButton', () => {
      if (handleBack()) return;
      void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
    });
  } catch {
    // non-fatal
  }
}

/** Fires when the app goes to the background (native) or the tab is hidden (web). */
export function onAppBackground(listener: () => void): void {
  if (Capacitor.isNativePlatform()) {
    void CapacitorApp.addListener('pause', listener).catch(() => {});
    return;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') listener();
  });
}

/** Fires when the app returns to the foreground (native) or the tab becomes visible (web). */
export function onAppForeground(listener: () => void): void {
  if (Capacitor.isNativePlatform()) {
    void CapacitorApp.addListener('resume', listener).catch(() => {});
    return;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') listener();
  });
}
