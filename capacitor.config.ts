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
    Preferences: {
      group: 'sumline',
    },
  },
};

export default config;
