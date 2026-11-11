import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* =========================================================================
   Idempotent native patcher. Run AFTER `npx cap add` / `npx cap sync`.

   Applies: ATT usage string, AdMob app IDs, encryption exemption, notification
   permission, and copies committed native config files (google-services.json /
   GoogleService-Info.plist) from native-config/. Every edit can be re-run: an
   existing value is replaced, not duplicated and not left stale.

   The AdMob app ID is always written. With no ID in .env it is Google's sample
   ID, so a test build runs (the Google Mobile Ads SDK crashes the app at launch
   when the entry is missing). `npm run doctor -- --release` refuses a store
   build that still carries the sample ID.

   Usage: npm run patch:native
   ========================================================================= */

const ROOT = process.cwd();

const ATT_MESSAGE = 'Your data will be used to show you fewer, more relevant ads.';
const ADMOB_APP_ID_KEY = 'com.google.android.gms.ads.APPLICATION_ID';
const SAMPLE_ADMOB_APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const SAMPLE_ADMOB_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511';

interface EnvMap {
  [key: string]: string;
}

function readEnv(): EnvMap {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return {};
  const env: EnvMap = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function realId(value: string | undefined): string | null {
  return value && !value.includes('xxxx') ? value : null;
}

/** Sets `<key>…</key><value>` in a plist, replacing an existing value. */
export function setInPlist(content: string, key: string, valueXml: string): string {
  const existing = new RegExp(`(<key>${key}</key>\\s*)(<string>[^<]*</string>|<true/>|<false/>)`);
  if (existing.test(content)) return content.replace(existing, `$1${valueXml}`);
  const marker = '<dict>';
  const idx = content.indexOf(marker);
  if (idx < 0) return content;
  const insertAt = idx + marker.length;
  return `${content.slice(0, insertAt)}\n\t<key>${key}</key>\n\t${valueXml}${content.slice(insertAt)}`;
}

export function ensureAndroidPermission(content: string, permission: string): string {
  const line = `<uses-permission android:name="${permission}" />`;
  if (content.includes(permission)) return content;
  return content.replace(/(<manifest[^>]*>)/, `$1\n    ${line}`);
}

/** Sets an application-level `<meta-data>`, replacing an existing value. */
export function setAndroidMetaData(content: string, name: string, value: string): string {
  const escaped = name.replace(/\./g, '\\.');
  const existing = new RegExp(
    `(<meta-data\\s+android:name="${escaped}"\\s+android:value=")[^"]*(")`,
  );
  if (existing.test(content)) return content.replace(existing, `$1${value}$2`);
  const meta = `<meta-data android:name="${name}" android:value="${value}" />`;
  return content.replace(/(<application[^>]*>)/, `$1\n        ${meta}`);
}

function patchIos(env: EnvMap): void {
  const plist = resolve(ROOT, 'ios/App/App/Info.plist');
  if (!existsSync(plist)) return;
  let content = readFileSync(plist, 'utf8');
  content = setInPlist(
    content,
    'NSUserTrackingUsageDescription',
    `<string>${ATT_MESSAGE}</string>`,
  );
  content = setInPlist(content, 'ITSAppUsesNonExemptEncryption', '<false/>');
  const appId = realId(env.VITE_ADMOB_APP_ID_IOS);
  if (!appId)
    console.warn(
      '[patch-native] VITE_ADMOB_APP_ID_IOS not set — using the sample AdMob app ID (test builds only).',
    );
  content = setInPlist(
    content,
    'GADApplicationIdentifier',
    `<string>${appId ?? SAMPLE_ADMOB_APP_ID_IOS}</string>`,
  );
  writeFileSync(plist, content);

  copyIfPresent(
    'native-config/ios/GoogleService-Info.plist',
    'ios/App/App/GoogleService-Info.plist',
  );
  console.log('[patch-native] iOS Info.plist patched.');
}

function patchAndroid(env: EnvMap): void {
  const manifest = resolve(ROOT, 'android/app/src/main/AndroidManifest.xml');
  if (!existsSync(manifest)) {
    console.warn(
      '[patch-native] android/ not found — run `npx cap add android` first. Skipping Android.',
    );
    return;
  }
  let content = readFileSync(manifest, 'utf8');
  content = ensureAndroidPermission(content, 'android.permission.POST_NOTIFICATIONS');
  const appId = realId(env.VITE_ADMOB_APP_ID_ANDROID);
  if (!appId) {
    console.warn(
      '[patch-native] VITE_ADMOB_APP_ID_ANDROID not set — using the sample AdMob app ID. Fine for test builds; `doctor --release` blocks a store build like this.',
    );
  }
  content = setAndroidMetaData(content, ADMOB_APP_ID_KEY, appId ?? SAMPLE_ADMOB_APP_ID_ANDROID);
  writeFileSync(manifest, content);

  copyIfPresent('native-config/android/google-services.json', 'android/app/google-services.json');
  console.log('[patch-native] Android manifest patched.');
}

function copyIfPresent(from: string, to: string): void {
  const src = resolve(ROOT, from);
  if (!existsSync(src)) {
    console.warn(`[patch-native] ${from} not present — skipped (add it before a release build).`);
    return;
  }
  writeFileSync(resolve(ROOT, to), readFileSync(src));
  console.log(`[patch-native] copied ${from} → ${to}`);
}

function main(): void {
  const env = readEnv();
  if (Object.keys(env).length === 0)
    console.warn('[patch-native] no .env found — sample AdMob app IDs will be used.');
  patchIos(env);
  patchAndroid(env);
  console.log('[patch-native] Done.');
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('patch-native.ts')) {
  main();
}
