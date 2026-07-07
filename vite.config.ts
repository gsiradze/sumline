import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
  },
  // Pre-bundle the Capacitor plugins imported at boot so the dev server never
  // does a mid-session re-optimize + reload (which otherwise flakes the e2e
  // hook wait on a cold cache in CI). Firebase plugins are excluded — they are
  // dynamic-imported only under isNative(), so the web build never loads them.
  optimizeDeps: {
    include: [
      '@capacitor/core',
      '@capacitor/preferences',
      '@capacitor/share',
      '@capacitor/app',
      '@capacitor/status-bar',
      '@capacitor/splash-screen',
      '@capacitor/screen-orientation',
      '@capacitor/haptics',
      '@capacitor/local-notifications',
      '@capacitor-community/admob',
      '@capacitor-community/keep-awake',
      '@capacitor-community/in-app-review',
    ],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Firebase is native-only here (providers are dynamic-imported behind
      // isNative()); the @capacitor-firebase web shims depend on the firebase
      // JS SDK, which we don't ship. Keep it external so the web build never
      // tries to bundle it.
      external: [/^firebase\//],
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false },
    },
  },
});
