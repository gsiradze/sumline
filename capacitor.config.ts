import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.narnarigames.sumline',
  appName: 'Sumline',
  webDir: 'dist',
  backgroundColor: '#FAF6F0',
  ios: {
    contentInset: 'always',
    backgroundColor: '#FAF6F0',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    backgroundColor: '#FAF6F0',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#FAF6F0',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FAF6F0',
      overlaysWebView: false,
    },
    // Dark status and navigation icons whatever the system theme: the app is
    // always light paper.
    SystemBars: {
      style: 'LIGHT',
    },
    // Saves live in the Preferences plugin's default group. Never call
    // Preferences.configure({ group }) after launch: it would hide every save.
  },
};

export default config;
