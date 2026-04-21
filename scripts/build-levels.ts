import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { TIER_CONFIGS, TOTAL_LEVELS } from '../src/game/domain/tiers';
import { coordsForLevelId } from '../src/game/domain/levels';
import type { Tier } from '../src/game/domain/types';
import type { BakedLevel, Manifest, WorkerResult } from './build-levels-types';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(HERE, '..', 'public', 'levels.json');
const LEGACY_PUZZLES_PATH = resolve(HERE, '..', 'public', 'puzzles.json');

function serializeManifest(manifest: Manifest): string {
  const levelLines = manifest.levels
    .map((l, i) => {
      const line = JSON.stringify(l);
      const comma = i === manifest.levels.length - 1 ? '' : ',';
      return `    ${line}${comma}`;
    })
    .join('\n');
  return [
    '{',
    `  "version": ${manifest.version},`,
    `  "generatedAt": ${JSON.stringify(manifest.generatedAt)},`,
    `  "count": ${manifest.count},`,
    '  "levels": [',
    levelLines,
    '  ]',
    '}',
    '',
  ].join('\n');
}

async function bakeParallel(): Promise<BakedLevel[]> {
  const workerUrl = new URL('./build-levels-worker.mjs', import.meta.url);
  const workerCount = Math.max(1, Math.min(availableParallelism() - 1, TOTAL_LEVELS));
  const levels: BakedLevel[] = new Array(TOTAL_LEVELS);
  let nextId = 0;
  let completed = 0;

  return new Promise((resolvePromise, reject) => {
    const workers: Worker[] = [];
    let settled = false;
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      for (const w of workers) w.terminate().catch(() => {});
      reject(err);
    };

    // Workers stay alive (idle) once they run out of work. Main terminates
    // all of them in one pass after the last result lands. This avoids the
    // race where a self-terminating worker's `exit` fires with the default
    // "terminated" code before `settled` flips true.
    const dispatch = (w: Worker): void => {
      if (nextId < TOTAL_LEVELS) {
        w.postMessage(nextId++);
      }
    };

    for (let i = 0; i < workerCount; i++) {
      const w = new Worker(workerUrl);
      workers.push(w);
      w.on('message', (msg: WorkerResult) => {
        if (msg.error !== undefined) {
          fail(
            new Error(`level ${msg.id} (${coordsForLevelId(msg.id).tier}): ${msg.error}`),
          );
          return;
        }
        if (!msg.baked) {
          fail(new Error(`level ${msg.id}: worker returned no baked level`));
          return;
        }
        levels[msg.id] = msg.baked;
        completed++;
        if (completed === TOTAL_LEVELS) {
          if (!settled) {
            settled = true;
            for (const worker of workers) worker.terminate().catch(() => {});
            resolvePromise(levels);
          }
          return;
        }
        dispatch(w);
      });
      w.on('error', fail);
      w.on('exit', code => {
        if (!settled && code !== 0) fail(new Error(`worker exited prematurely with code ${code}`));
      });
    }

    for (const w of workers) dispatch(w);
  });
}

async function main(): Promise<void> {
  const started = Date.now();
  const levels = await bakeParallel();

  const manifest: Manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    count: levels.length,
    levels,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serializeManifest(manifest), 'utf8');
  try {
    rmSync(LEGACY_PUZZLES_PATH, { force: true });
  } catch {
    // ignore
  }

  const ms = Date.now() - started;
  const byTier = new Map<Tier, number[]>();
  for (const l of levels) {
    if (!byTier.has(l.tier)) byTier.set(l.tier, []);
    byTier.get(l.tier)!.push(l.difficultyScore);
  }
  const summary = TIER_CONFIGS.map(c => {
    const scores = byTier.get(c.tier) ?? [];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return `${c.label} ${scores.length} levels, score ${min.toFixed(1)}–${max.toFixed(1)} avg ${avg.toFixed(1)}`;
  }).join(' | ');
  console.log(`wrote ${levels.length} levels → ${OUTPUT_PATH} (${ms}ms)`);
  console.log(summary);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
