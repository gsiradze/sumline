import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* Release preflight. Hard checks (FAIL, exit 1) guard shipping a broken build:
   the bundle id must be personalized and the frozen 210-level manifest must be
   intact. Soft checks (WARN) cover assets and AdMob keys that legitimately lag
   behind the first cap-wrap. Run as the first step of a release lane. */

const ROOT = process.cwd();

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly hint: string;
  readonly fatal: boolean;
}

function readFile(path: string): string {
  const full = resolve(ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function parseEnvKeys(): Set<string> {
  const content = readFile('.env');
  const keys = new Set<string>();
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const value = t.slice(eq + 1).trim();
    if (value && !value.includes('xxxx')) keys.add(t.slice(0, eq).trim());
  }
  return keys;
}

function levelsCount(): number {
  try {
    const parsed = JSON.parse(readFile('public/levels.json')) as { levels?: unknown };
    return Array.isArray(parsed.levels) ? parsed.levels.length : -1;
  } catch {
    return -1;
  }
}

function run(): void {
  const capConfig = readFile('capacitor.config.ts');
  const env = parseEnvKeys();
  const adMobEnv = [
    'VITE_ADMOB_APP_ID_IOS',
    'VITE_ADMOB_APP_ID_ANDROID',
    'VITE_ADMOB_REWARDED_IOS',
    'VITE_ADMOB_REWARDED_ANDROID',
    'VITE_ADMOB_INTERSTITIAL_IOS',
    'VITE_ADMOB_INTERSTITIAL_ANDROID',
    'VITE_ADMOB_BANNER_IOS',
    'VITE_ADMOB_BANNER_ANDROID',
  ];
  const missingEnv = adMobEnv.filter(k => !env.has(k));

  const checks: Check[] = [
    {
      name: 'App ID is not the placeholder',
      ok: !/appId:\s*['"]com\.example/.test(capConfig),
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
      name: 'All AdMob env vars set (real values)',
      ok: missingEnv.length === 0,
      hint: `Fill ${missingEnv.join(', ') || 'nothing'} in .env before a real-ads build`,
      fatal: false,
    },
    {
      name: 'App icon source art present',
      ok: existsSync(resolve(ROOT, 'assets/icon.png')),
      hint: 'Add assets/icon.png (1024×1024) and run `npx capacitor-assets generate`',
      fatal: false,
    },
    {
      name: 'PWA manifest has PNG icons',
      ok: readFile('public/manifest.webmanifest').includes('.png'),
      hint: 'Add PNG (192/512 + maskable) icons to public/ and the manifest',
      fatal: false,
    },
  ];

  let failed = 0;
  let warned = 0;
  for (const c of checks) {
    if (c.ok) {
      console.log(`  ✓ ${c.name}`);
    } else if (c.fatal) {
      failed++;
      console.error(`  ✗ ${c.name}\n      → ${c.hint}`);
    } else {
      warned++;
      console.warn(`  ! ${c.name}\n      → ${c.hint}`);
    }
  }

  if (failed > 0) {
    console.error(`\ndoctor: ${failed} check(s) failed, ${warned} warning(s).`);
    process.exit(1);
  }
  console.log(`\ndoctor: all hard checks passed${warned > 0 ? `, ${warned} warning(s)` : ''}.`);
}

run();
