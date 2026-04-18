import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePuzzle } from '../src/game/domain/puzzle';
import { LAUNCH_EPOCH_ISO, isoDateForPuzzleId, seedForPuzzleId } from '../src/game/domain/daily';
import { isUniquelySolvableFromSums } from '../src/game/domain/solver';
import type { Puzzle } from '../src/game/domain/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(HERE, '..', 'public', 'puzzles.json');
const PUZZLE_COUNT = 365;

interface ManifestEntry {
  id: number;
  date: string;
  solution: readonly (0 | 1)[];
  rowSums: readonly number[];
  colSums: readonly number[];
  filledCount: number;
  seed: number;
}

interface Manifest {
  version: 1;
  launchDate: string;
  generatedAt: string;
  count: number;
  puzzles: ManifestEntry[];
}

function toEntry(id: number, puzzle: Puzzle): ManifestEntry {
  return {
    id,
    date: isoDateForPuzzleId(id),
    solution: [...puzzle.solution],
    rowSums: [...puzzle.rowSums],
    colSums: [...puzzle.colSums],
    filledCount: puzzle.filledCount,
    seed: puzzle.seed,
  };
}

function serializeManifest(manifest: Manifest): string {
  const puzzleLines = manifest.puzzles
    .map((p, i) => {
      const line = JSON.stringify(p);
      const comma = i === manifest.puzzles.length - 1 ? '' : ',';
      return `    ${line}${comma}`;
    })
    .join('\n');
  return [
    '{',
    `  "version": ${manifest.version},`,
    `  "launchDate": ${JSON.stringify(manifest.launchDate)},`,
    `  "generatedAt": ${JSON.stringify(manifest.generatedAt)},`,
    `  "count": ${manifest.count},`,
    `  "puzzles": [`,
    puzzleLines,
    '  ]',
    '}',
    '',
  ].join('\n');
}

function main(): void {
  const started = Date.now();
  const puzzles: ManifestEntry[] = [];

  for (let id = 0; id < PUZZLE_COUNT; id++) {
    const seed = seedForPuzzleId(id);
    const p = generatePuzzle(seed);
    if (!isUniquelySolvableFromSums(p.solution)) {
      throw new Error(`puzzle ${id} is not uniquely solvable from sums (generator bug)`);
    }
    puzzles.push(toEntry(id, p));
  }

  const manifest: Manifest = {
    version: 1,
    launchDate: LAUNCH_EPOCH_ISO,
    generatedAt: new Date().toISOString(),
    count: puzzles.length,
    puzzles,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serializeManifest(manifest), 'utf8');

  const ms = Date.now() - started;
  const minFilled = Math.min(...puzzles.map(p => p.filledCount));
  const maxFilled = Math.max(...puzzles.map(p => p.filledCount));
  console.log(
    `wrote ${puzzles.length} puzzles → ${OUTPUT_PATH} (${ms}ms, filled ${minFilled}–${maxFilled})`,
  );
}

main();
