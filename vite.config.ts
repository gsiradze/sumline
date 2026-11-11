import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

// Source maps are needed to decode crash stacks but must not ship inside the
// app (they contain the full source). They are built, then moved out of dist/.
function stashSourceMaps(): Plugin {
  return {
    name: 'stash-source-maps',
    apply: 'build',
    closeBundle() {
      const assets = resolve(__dirname, 'dist/assets');
      if (!existsSync(assets)) return;
      const maps = readdirSync(assets).filter(f => f.endsWith('.map'));
      if (maps.length === 0) return;
      const target = resolve(__dirname, 'sourcemaps', pkg.version);
      rmSync(target, { recursive: true, force: true });
      mkdirSync(target, { recursive: true });
      for (const file of maps) renameSync(resolve(assets, file), resolve(target, file));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), stashSourceMaps()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
    sourcemap: 'hidden',
    rollupOptions: {
      // Firebase is native-only here (providers are dynamic-imported behind
      // isNative()); the @capacitor-firebase web shims depend on the firebase
      // JS SDK, which we don't ship. Keep it external so the web build never
      // tries to bundle it.
      external: [/^firebase\//],
    },
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false },
    },
  },
});
