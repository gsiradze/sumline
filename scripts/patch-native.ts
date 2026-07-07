import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* =========================================================================
   Idempotent native patcher. Run AFTER `npx cap add` / `npx cap sync`, since
   ios/ and android/ are gitignored and regenerated per build.

   Applies: ATT usage string, AdMob app IDs, encryption exemption, notification
   permission, and copies committed native config files (google-services.json /
   GoogleService-Info.plist) from native-config/. Each edit greps its own output
   first, so re-running is safe. Gradle plugin lines and Firebase setup that this
   cannot safely automate live in the native checklist.

   Usage: npm run patch:native
   ========================================================================= */

const ROOT = process.cwd();

const ATT_MESSAGE = 'Your data will be used to show you fewer, more relevant ads.';

interface EnvMap {
  [key: string]: string;
}

function readEnv(): EnvMap {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) {
    console.warn('[patch-native] no .env found — AdMob app IDs will be skipped.');
    return {};
  }
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

/** Insert `<key>…</key><value>` after the first <dict> if the key is absent. */
export function ensureInPlist(content: string, key: string, valueXml: string): string {
  if (content.includes(`<key>${key}</key>`)) return content;
  const marker = '<dict>';
  const idx = content.indexOf(marker);
  if (idx < 0) return content;
  const insertAt = idx + marker.length;
  const block = `\n\t<key>${key}</key>\n\t${valueXml}`;
  return content.slice(0, insertAt) + block + content.slice(insertAt);
}

export function ensureAndroidPermission(content: string, permission: string): string {
  const line = `<uses-permission android:name="${permission}" />`;
  if (content.includes(permission)) return content;
  return content.replace(/(<manifest[^>]*>)/, `$1\n    ${line}`);
}

export function ensureAndroidMetaData(content: string, name: string, value: string): string {
  if (content.includes(name)) return content;
  const meta = `<meta-data android:name="${name}" android:value="${value}" />`;
  return content.replace(/(<application[^>]*>)/, `$1\n        ${meta}`);
}

function patchIos(env: EnvMap): void {
  const plist = resolve(ROOT, 'ios/App/App/Info.plist');
  if (!existsSync(plist)) {
    console.warn('[patch-native] ios/ not found — run `npx cap add ios` first. Skipping iOS.');
    return;
  }
  let content = readFileSync(plist, 'utf8');
  content = ensureInPlist(
    content,
    'NSUserTrackingUsageDescription',
    `<string>${ATT_MESSAGE}</string>`,
  );
  content = ensureInPlist(content, 'ITSAppUsesNonExemptEncryption', '<false/>');
  const appId = env.VITE_ADMOB_APP_ID_IOS;
  if (appId) content = ensureInPlist(content, 'GADApplicationIdentifier', `<string>${appId}</string>`);
  else console.warn('[patch-native] VITE_ADMOB_APP_ID_IOS not set — skipped GADApplicationIdentifier.');
  writeFileSync(plist, content);

  copyIfPresent('native-config/ios/GoogleService-Info.plist', 'ios/App/App/GoogleService-Info.plist');
  console.log('[patch-native] iOS Info.plist patched.');
}

function patchAndroid(env: EnvMap): void {
  const manifest = resolve(ROOT, 'android/app/src/main/AndroidManifest.xml');
  if (!existsSync(manifest)) {
    console.warn('[patch-native] android/ not found — run `npx cap add android` first. Skipping Android.');
    return;
  }
  let content = readFileSync(manifest, 'utf8');
  content = ensureAndroidPermission(content, 'android.permission.POST_NOTIFICATIONS');
  const appId = env.VITE_ADMOB_APP_ID_ANDROID;
  if (appId) content = ensureAndroidMetaData(content, 'com.google.android.gms.ads.APPLICATION_ID', appId);
  else console.warn('[patch-native] VITE_ADMOB_APP_ID_ANDROID not set — skipped AdMob meta-data.');
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
  patchIos(env);
  patchAndroid(env);
  console.log('[patch-native] Done. See the native checklist for Gradle/Firebase steps this cannot automate.');
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('patch-native.ts')) {
  main();
}
