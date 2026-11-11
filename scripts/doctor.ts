import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/* Preflight. `npm run doctor` reports what is missing and fails only on things
   that are always wrong. `npm run doctor -- --release` (run by
   `npm run cap:sync:release`) fails on anything that must not reach a store
   build: test ad units, a missing AdMob app ID (the app would crash on launch),
   no privacy policy link, no crash reporting, source maps inside the app. */

const ROOT = process.cwd();
const RELEASE = process.argv.includes('--release');

const SAMPLE_ADMOB_PREFIX = 'ca-app-pub-3940256099942544';
const ANDROID_MANIFEST = 'android/app/src/main/AndroidManifest.xml';

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly hint: string;
  /** Fails the run in every mode. */
  readonly fatal?: boolean;
  /** Fails the run only with --release. */
  readonly releaseBlocker?: boolean;
}

function readFile(path: string): string {
  const full = resolve(ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function has(path: string): boolean {
  return existsSync(resolve(ROOT, path));
}

function parseEnv(): Map<string, string> {
  const env = new Map<string, string>();
  for (const line of readFile('.env').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    env.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim());
  }
  return env;
}

function isRealAdMobId(value: string | undefined): boolean {
  return !!value && !value.includes('xxxx') && !value.startsWith(SAMPLE_ADMOB_PREFIX);
}

function levelsCount(): number {
  try {
    const parsed = JSON.parse(readFile('public/levels.json')) as { levels?: unknown };
    return Array.isArray(parsed.levels) ? parsed.levels.length : -1;
  } catch {
    return -1;
  }
}

function manifestAdMobAppId(): string | null {
  const m =
    /android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s+android:value="([^"]*)"/.exec(
      readFile(ANDROID_MANIFEST),
    );
  return m ? (m[1] ?? null) : null;
}

function mapsInsideApp(): number {
  const dir = resolve(ROOT, 'android/app/src/main/assets/public/assets');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.map')).length;
}

function run(): void {
  const env = parseEnv();
  const androidAds = [
    'VITE_ADMOB_APP_ID_ANDROID',
    'VITE_ADMOB_REWARDED_ANDROID',
    'VITE_ADMOB_INTERSTITIAL_ANDROID',
    'VITE_ADMOB_BANNER_ANDROID',
  ];
  const missingAds = androidAds.filter(k => !isRealAdMobId(env.get(k)));
  const privacyUrl = env.get('VITE_PRIVACY_URL') ?? '';
  const supportEmail = env.get('VITE_SUPPORT_EMAIL') ?? '';
  const hasAndroid = has(ANDROID_MANIFEST);
  const hasFirebase = has('native-config/android/google-services.json');
  const appId = manifestAdMobAppId();
  const maps = mapsInsideApp();
  const pkgVersion = (JSON.parse(readFile('package.json')) as { version: string }).version;
  const appGradle = readFile('android/app/build.gradle');
  const nativeVersion = /versionName\s+"([^"]+)"/.exec(appGradle)?.[1] ?? null;

  const checks: Check[] = [
    {
      name: 'App ID is not the placeholder',
      ok: !/appId:\s*['"]com\.example/.test(readFile('capacitor.config.ts')),
      hint: 'Set a real appId in capacitor.config.ts (com.example… is a placeholder)',
      fatal: true,
    },
    {
      name: 'levels.json intact (210 levels)',
      ok: levelsCount() === 210,
      hint: 'public/levels.json must parse to exactly 210 levels — do not regenerate the frozen manifest',
      fatal: true,
    },
    {
      name: 'AdMob Android IDs are real (not sample or placeholder)',
      ok: missingAds.length === 0,
      hint: `Set ${missingAds.join(', ') || 'nothing'} in .env. Without them a live build shows no ads.`,
      releaseBlocker: true,
    },
    {
      name: 'Privacy policy URL set',
      ok: /^https:\/\//.test(privacyUrl) && !privacyUrl.includes('example.com'),
      hint: 'Set VITE_PRIVACY_URL (https://…) in .env. Play requires the policy to be reachable from inside the app.',
      releaseBlocker: true,
    },
    {
      name: 'Support email set',
      ok: supportEmail.includes('@') && !supportEmail.includes('example.com'),
      hint: 'Set VITE_SUPPORT_EMAIL in .env to show "Contact support" in Settings',
    },
    {
      name: 'Web version URL set (shared results link to their level)',
      ok: /^https:\/\//.test(env.get('VITE_WEB_URL') ?? ''),
      hint: 'Optional. Set VITE_WEB_URL in .env once the web version is hosted; until then shared results link to the store listing.',
    },
    {
      name: 'Firebase config present',
      ok: hasFirebase,
      hint: 'Add native-config/android/google-services.json (no analytics or crash reports without it)',
      releaseBlocker: true,
    },
    {
      name: 'App icon source art present',
      ok: has('assets/icon.png'),
      hint: 'Add assets/icon.png (1024×1024) and run `npm run gen:assets` — the app still has the default Capacitor icon',
      releaseBlocker: true,
    },
    {
      name: 'Android project present',
      ok: hasAndroid,
      hint: 'Run `npx cap add android`, then `npm run cap:sync`',
      releaseBlocker: true,
    },
  ];

  if (hasAndroid) {
    checks.push(
      {
        name: 'AndroidManifest has an AdMob app ID',
        ok: appId !== null && appId !== '',
        hint: 'Run `npm run patch:native`. Without this entry the Google Mobile Ads SDK crashes the app at launch.',
        fatal: true,
      },
      {
        name: 'AndroidManifest AdMob app ID is the live one from .env',
        ok:
          appId !== null && isRealAdMobId(appId) && appId === env.get('VITE_ADMOB_APP_ID_ANDROID'),
        hint: 'Set VITE_ADMOB_APP_ID_ANDROID in .env and run `npm run patch:native` (it currently holds the sample ID or a stale value)',
        releaseBlocker: true,
      },
      {
        name: 'No source maps inside the app',
        ok: maps === 0,
        hint: `${maps} .map file(s) in android/app/src/main/assets/public — rebuild and sync (maps belong in sourcemaps/, not in the app)`,
        releaseBlocker: true,
      },
      {
        name: 'Crashlytics Gradle plugin applied',
        ok:
          readFile('android/build.gradle').includes('firebase-crashlytics-gradle') &&
          appGradle.includes('com.google.firebase.crashlytics'),
        hint: 'See docs/native-checklist.md — with google-services.json present and this plugin missing, Crashlytics fails at startup',
        releaseBlocker: true,
      },
      {
        name: 'Release signing configured',
        ok: has('android/keystore.properties') && appGradle.includes('signingConfigs'),
        hint: 'Create android/keystore.properties (see docs/release-manual.md). Never commit it or the keystore.',
        releaseBlocker: true,
      },
      {
        name: `Native version matches package.json (${pkgVersion})`,
        ok: nativeVersion === pkgVersion,
        hint: `android versionName is ${nativeVersion ?? 'unknown'} — run \`npm run version:apply\` and bump versionCode for every upload`,
      },
    );
  }

  checks.push({
    name: 'PWA manifest has PNG icons',
    ok: has('public/icon-192.png') && has('public/icon-512.png'),
    hint: 'Add PNG (192/512 + maskable) icons to public/ for the web build',
  });

  let failed = 0;
  let warned = 0;
  for (const c of checks) {
    if (c.ok) {
      console.log(`  ✓ ${c.name}`);
    } else if (c.fatal || (RELEASE && c.releaseBlocker)) {
      failed++;
      console.error(`  ✗ ${c.name}\n      → ${c.hint}`);
    } else {
      warned++;
      console.warn(`  ! ${c.name}\n      → ${c.hint}`);
    }
  }

  const mode = RELEASE ? 'doctor (release)' : 'doctor';
  if (failed > 0) {
    console.error(`\n${mode}: ${failed} check(s) failed, ${warned} warning(s).`);
    process.exit(1);
  }
  console.log(
    `\n${mode}: all ${RELEASE ? 'release' : 'hard'} checks passed${warned > 0 ? `, ${warned} warning(s)` : ''}.`,
  );
}

run();
