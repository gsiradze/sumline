import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const PAPER = '#FAF6F0';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function platformName(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

export async function bootstrapNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: StatusBarStyle.Light });
    await StatusBar.setBackgroundColor({ color: PAPER });
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
    await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) CapacitorApp.exitApp();
      else window.history.back();
    });
  } catch {
    // non-fatal
  }
}
