import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOTAL_LEVELS, configForTier } from '../src/game/domain/tiers';
import { coordsForLevelId } from '../src/game/domain/levels';
import {
  applyHint,
  canSubmit,
  isOverMarkCap,
  markedCount,
  submitGuess,
  toggleMark,
  toggleNote,
} from '../src/game/domain/game-state';
import type { ActiveGameState } from '../src/game/domain/game-state';
import { guessEvent, hintEvent, replayAttempt, snapshotOf } from '../src/game/domain/attempt';
import type { AttemptEvent } from '../src/game/domain/attempt';
import { LINE_COUNT, findHintLine } from '../src/game/domain/hint';
import { mulberry32 } from '../src/game/domain/rng';
import { startingBoard } from '../src/game/domain/startingBoard';
import { CELL_COUNT, GRID_SIZE, GameOutcome } from '../src/game/domain/types';
import type { Cell, Puzzle } from '../src/game/domain/types';

/* Integrity check for the frozen level manifest. Run: npm run check:levels

   Verifies, for all levels: structure (sums, counts, ids, tier rules), no
   duplicates (exact, rotated/reflected, or identical clue sets), and that the
   rules keep the game valid under random play — hints, guesses, notes, restart
   and save/restore never produce a board that contradicts the answer or that
   the player cannot finish.

   Pass --deep to also simulate a near-perfect player and print how hard each
   tier really is (slower; informational, never fails the check). */

const PLAYOUTS_PER_LEVEL = 40;
const N = GRID_SIZE;

interface RawLevel {
  id: number;
  tier: string;
  batchIndexInTier: number;
  indexInBatch: number;
  solution: number[];
  rowSums: number[];
  colSums: number[];
  filledCount: number;
  seed: number;
  guessBudget: number;
  preLockedCellCount: number;
}

const levels = (
  JSON.parse(readFileSync(resolve(process.cwd(), 'public/levels.json'), 'utf8')) as {
    levels: RawLevel[];
  }
).levels;

const problems: string[] = [];

function puzzleOf(l: RawLevel): Puzzle {
  return {
    solution: l.solution as Cell[],
    rowSums: l.rowSums,
    colSums: l.colSums,
    filledCount: l.filledCount,
    seed: l.seed,
  };
}

function checkStructure(): void {
  if (levels.length !== TOTAL_LEVELS) {
    problems.push(`manifest has ${levels.length} levels, expected ${TOTAL_LEVELS}`);
  }
  for (let i = 0; i < levels.length; i++) {
    const l = levels[i]!;
    const tag = `level ${i + 1}`;
    if (l.id !== i) problems.push(`${tag}: id field is ${l.id}`);
    const co = coordsForLevelId(i);
    if (co.tier !== l.tier) problems.push(`${tag}: tier ${l.tier}, expected ${co.tier}`);
    if (co.batchIndexInTier !== l.batchIndexInTier || co.indexInBatch !== l.indexInBatch) {
      problems.push(`${tag}: set/position fields do not match its id`);
    }
    if (l.solution.length !== CELL_COUNT || l.solution.some(v => v !== 0 && v !== 1)) {
      problems.push(`${tag}: solution is not ${CELL_COUNT} cells of 0/1`);
      continue;
    }
    const rs = new Array<number>(N).fill(0);
    const cs = new Array<number>(N).fill(0);
    let filled = 0;
    for (let c = 0; c < CELL_COUNT; c++) {
      if (l.solution[c] !== 1) continue;
      rs[Math.floor(c / N)]!++;
      cs[c % N]!++;
      filled++;
    }
    if (rs.join() !== l.rowSums.join()) problems.push(`${tag}: row sums do not match the solution`);
    if (cs.join() !== l.colSums.join())
      problems.push(`${tag}: column sums do not match the solution`);
    if (filled !== l.filledCount)
      problems.push(`${tag}: filledCount ${l.filledCount}, actual ${filled}`);
    const cfg = configForTier(co.tier);
    if (cfg.guessBudget !== l.guessBudget)
      problems.push(`${tag}: guess budget differs from its tier`);
    if (cfg.preLockedCells !== l.preLockedCellCount) {
      problems.push(`${tag}: pre-solved cell count differs from its tier`);
    }
    if ([...l.rowSums, ...l.colSums].some(s => s === 0 || s === N)) {
      problems.push(`${tag}: has a trivial sum (0 or ${N})`);
    }
  }
}

function symmetries(sol: number[]): string[] {
  const at = (r: number, c: number): number => sol[r * N + c]!;
  const build = (f: (r: number, c: number) => number): string => {
    let s = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) s += f(r, c);
    return s;
  };
  return [
    build((r, c) => at(r, c)),
    build((r, c) => at(N - 1 - c, r)),
    build((r, c) => at(N - 1 - r, N - 1 - c)),
    build((r, c) => at(c, N - 1 - r)),
    build((r, c) => at(r, N - 1 - c)),
    build((r, c) => at(N - 1 - r, c)),
    build((r, c) => at(c, r)),
    build((r, c) => at(N - 1 - c, N - 1 - r)),
  ];
}

function checkDuplicates(): void {
  const byShape = new Map<string, number>();
  const byClues = new Map<string, number>();
  for (const l of levels) {
    if (l.solution.length !== CELL_COUNT) continue;
    const shape = [...symmetries(l.solution)].sort()[0]!;
    const clues = `${l.rowSums.join('')}|${l.colSums.join('')}`;
    const sameShape = byShape.get(shape);
    if (sameShape !== undefined) {
      problems.push(
        `level ${l.id + 1} repeats level ${sameShape + 1} (same grid, possibly rotated or mirrored)`,
      );
    } else {
      byShape.set(shape, l.id);
    }
    const sameClues = byClues.get(clues);
    if (sameClues !== undefined) {
      problems.push(`level ${l.id + 1} shows the same clues as level ${sameClues + 1}`);
    } else {
      byClues.set(clues, l.id);
    }
  }
}

function assertValid(l: RawLevel, s: ActiveGameState, where: string): void {
  const tag = `level ${l.id + 1} (${where})`;
  let locked = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const f = s.lockedFilled[i] === true;
    const e = s.lockedEmpty[i] === true;
    if (f || e) locked++;
    if (f && e) problems.push(`${tag}: cell ${i} locked both ways`);
    if (f && l.solution[i] !== 1) problems.push(`${tag}: cell ${i} locked filled but is empty`);
    if (e && l.solution[i] !== 0) problems.push(`${tag}: cell ${i} locked empty but is filled`);
    if (f && s.currentMarks[i] !== 1)
      problems.push(`${tag}: locked-filled cell ${i} is not marked`);
    if (e && s.currentMarks[i] !== 0) problems.push(`${tag}: locked-empty cell ${i} is marked`);
    if ((f || e) && s.emptyNotes[i]) problems.push(`${tag}: locked cell ${i} still carries a note`);
    if (s.emptyNotes[i] && s.currentMarks[i] === 1)
      problems.push(`${tag}: cell ${i} is both marked and noted`);
  }
  if (s.guesses.length > s.guessBudget) problems.push(`${tag}: more guesses than the budget`);
  const last = s.guesses[s.guesses.length - 1];
  const lastIsSolution = !!last && last.every((v, i) => v === l.solution[i]);
  if (s.guesses.length > 0 && (s.outcome === GameOutcome.Won) !== lastIsSolution) {
    problems.push(`${tag}: outcome ${s.outcome} disagrees with the last guess`);
  }
  if (s.outcome === GameOutcome.Lost && locked === CELL_COUNT) {
    problems.push(`${tag}: lost with the whole board resolved`);
  }
  if (s.outcome !== GameOutcome.InProgress) return;
  const hint = findHintLine(s);
  if (hint !== null && hint.cells.every(i => s.lockedFilled[i] || s.lockedEmpty[i])) {
    problems.push(`${tag}: hint points at a line that is already known`);
  }
  if (hint === null && locked < CELL_COUNT)
    problems.push(`${tag}: no hint offered while cells are unknown`);
  if (isOverMarkCap(s)) {
    if (canSubmit(s)) problems.push(`${tag}: an over-cap guess can be submitted`);
    let removable = false;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (s.currentMarks[i] === 1 && !s.lockedFilled[i]) removable = true;
    }
    if (!removable) problems.push(`${tag}: over the mark cap with no mark the player can remove`);
  }
  if (markedCount(s) > s.puzzle.filledCount + s.hintsUsed * N) {
    problems.push(`${tag}: more marks than the cap plus hints can explain`);
  }
}

function checkPlay(): { playouts: number } {
  let playouts = 0;
  for (const l of levels) {
    if (l.solution.length !== CELL_COUNT) continue;
    const puzzle = puzzleOf(l);
    const start = startingBoard(puzzle, l);
    assertValid(l, start, 'start');

    // Hints alone must finish the board, and one guess then wins.
    let s = start;
    for (let steps = 0; ; steps++) {
      const h = findHintLine(s);
      if (h === null) break;
      const next = applyHint(s, h.cells);
      if (next === s || steps > LINE_COUNT) {
        problems.push(`level ${l.id + 1}: hint chain stalled`);
        break;
      }
      s = next;
      assertValid(l, s, 'hints only');
    }
    if (submitGuess(s).outcome !== GameOutcome.Won) {
      problems.push(`level ${l.id + 1}: the fully hinted board does not win`);
    }

    const rng = mulberry32((l.seed ^ 0x1234abcd) >>> 0);
    for (let p = 0; p < PLAYOUTS_PER_LEVEL; p++) {
      let state = start;
      const events: AttemptEvent[] = [];
      for (let step = 0; step < 600 && state.outcome === GameOutcome.InProgress; step++) {
        const roll = rng();
        if (roll < 0.62) {
          state = toggleMark(state, Math.floor(rng() * CELL_COUNT));
        } else if (roll < 0.74) {
          state = toggleNote(state, Math.floor(rng() * CELL_COUNT));
        } else if (roll < 0.87) {
          if (canSubmit(state)) {
            events.push(guessEvent(state));
            state = submitGuess(state);
          }
        } else {
          const h = findHintLine(state);
          if (h !== null) {
            events.push(hintEvent(h.id));
            state = applyHint(state, h.cells);
          }
        }
        assertValid(l, state, `playout ${p}`);
        // Leaving and coming back must give exactly the same board.
        if (step % 25 === 0 && state.outcome !== GameOutcome.Won) {
          const saved = JSON.parse(JSON.stringify(snapshotOf(state, events))) as unknown;
          const restored = replayAttempt(start, saved);
          if (!restored || JSON.stringify(restored.state) !== JSON.stringify(state)) {
            problems.push(
              `level ${l.id + 1} (playout ${p}): a saved attempt did not restore exactly`,
            );
          }
        }
      }
      playouts++;
      if (JSON.stringify(startingBoard(puzzle, l)) !== JSON.stringify(start)) {
        problems.push(`level ${l.id + 1}: restart does not return the same starting board`);
      }
    }
  }
  return { playouts };
}

// ---------- --deep: how hard is each tier for a near-perfect player? ----------

const POP = new Uint8Array(64);
for (let i = 0; i < 64; i++) POP[i] = (i & 1) + POP[i >> 1]!;

function enumerate(rowSums: number[], colSums: number[], kf: number[], ke: number[]): Uint8Array {
  const pats: number[][] = [];
  for (let r = 0; r < N; r++) {
    const list: number[] = [];
    for (let p = 0; p < 64; p++) {
      if (POP[p] !== rowSums[r] || (p & kf[r]!) !== kf[r] || (p & ke[r]!) !== 0) continue;
      list.push(p);
    }
    pats.push(list);
  }
  const out: number[] = [];
  const cur = new Array<number>(N).fill(0);
  const col = new Array<number>(N).fill(0);
  const rec = (r: number): void => {
    if (r === N) {
      for (let c = 0; c < N; c++) if (col[c] !== colSums[c]) return;
      for (let i = 0; i < N; i++) out.push(cur[i]!);
      return;
    }
    const left = N - r - 1;
    for (const p of pats[r]!) {
      let ok = true;
      for (let c = 0; c < N; c++) {
        const nx = col[c]! + ((p >> c) & 1);
        if (nx > colSums[c]! || nx + left < colSums[c]!) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let c = 0; c < N; c++) col[c]! += (p >> c) & 1;
      cur[r] = p;
      rec(r + 1);
      for (let c = 0; c < N; c++) col[c]! -= (p >> c) & 1;
    }
  };
  rec(0);
  return Uint8Array.from(out);
}

// Only marked cells are judged, so what a guess teaches is the answer's value
// at each cell the guess marks.
function feedbackKey(cand: Uint8Array, truth: number, guess: number): number {
  const t = truth * 6;
  const g = guess * 6;
  const lo =
    (cand[t]! & cand[g]!) |
    ((cand[t + 1]! & cand[g + 1]!) << 6) |
    ((cand[t + 2]! & cand[g + 2]!) << 12);
  const hi =
    (cand[t + 3]! & cand[g + 3]!) |
    ((cand[t + 4]! & cand[g + 4]!) << 6) |
    ((cand[t + 5]! & cand[g + 5]!) << 12);
  return hi * 262144 + lo;
}

function sample(set: Int32Array, max: number, rng: () => number): Int32Array {
  if (set.length <= max) return set;
  const copy = Int32Array.from(set);
  for (let i = 0; i < max; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    const t = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = t;
  }
  return copy.subarray(0, max);
}

// Always guesses a grid that could still be the answer, choosing the one
// expected to leave the fewest possibilities.
function chooseGuess(cand: Uint8Array, set: Int32Array, rng: () => number): number {
  if (set.length <= 2) return set[0]!;
  const guesses = sample(set, 120, rng);
  const truths = sample(set, 1500, rng);
  let best = guesses[0]!;
  let bestScore = Infinity;
  for (const g of guesses) {
    const winKey = feedbackKey(cand, g, g);
    const counts = new Map<number, number>();
    for (const t of truths) {
      const k = feedbackKey(cand, t, g);
      if (k !== winKey) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let score = 0;
    for (const v of counts.values()) score += v * v;
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best;
}

function guessesNeeded(
  cand: Uint8Array,
  set: Int32Array,
  truths: Int32Array,
  depth: number,
  rng: () => number,
  out: Map<number, number>,
): void {
  const g = chooseGuess(cand, set, rng);
  const winKey = feedbackKey(cand, g, g);
  const groups = new Map<number, number[]>();
  for (const t of truths) {
    const k = feedbackKey(cand, t, g);
    if (k === winKey) {
      out.set(t, depth);
      continue;
    }
    const group = groups.get(k);
    if (group) group.push(t);
    else groups.set(k, [t]);
  }
  if (groups.size === 0 || depth >= 9) return;
  const subsets = new Map<number, number[]>();
  for (const k of groups.keys()) subsets.set(k, []);
  for (const e of set) subsets.get(feedbackKey(cand, e, g))?.push(e);
  for (const [k, ts] of groups) {
    guessesNeeded(cand, Int32Array.from(subsets.get(k)!), Int32Array.from(ts), depth + 1, rng, out);
  }
}

function deepReport(): void {
  const tiers = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
  const rows = new Map<string, { answers: number[]; inTwo: number[]; inBudget: number[] }>();
  for (const t of tiers) rows.set(t, { answers: [], inTwo: [], inBudget: [] });
  for (const l of levels) {
    const start = startingBoard(puzzleOf(l), l);
    const kf = new Array<number>(N).fill(0);
    const ke = new Array<number>(N).fill(0);
    for (let i = 0; i < CELL_COUNT; i++) {
      if (start.lockedFilled[i]) kf[Math.floor(i / N)]! |= 1 << (i % N);
      if (start.lockedEmpty[i]) ke[Math.floor(i / N)]! |= 1 << (i % N);
    }
    const cand = enumerate(l.rowSums, l.colSums, kf, ke);
    const count = cand.length / 6;
    const rng = mulberry32((l.seed ^ 0x5bd1e995) >>> 0);
    const all = Int32Array.from({ length: count }, (_, i) => i);
    const truths = sample(all, 300, rng);
    const out = new Map<number, number>();
    guessesNeeded(cand, all, truths, 1, rng, out);
    let two = 0;
    let budget = 0;
    for (const t of truths) {
      const d = out.get(t) ?? Infinity;
      if (d <= 2) two++;
      if (d <= l.guessBudget) budget++;
    }
    const row = rows.get(l.tier);
    if (!row) continue;
    row.answers.push(count);
    row.inTwo.push(two / truths.length);
    row.inBudget.push(budget / truths.length);
  }
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const median = (xs: number[]): number =>
    [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const pct = (x: number): string => `${Math.round(x * 100)}%`.padStart(4);
  console.log(
    '\nNear-perfect player, by tier (grids still possible at the start; chance of finishing):',
  );
  console.log(
    '  tier          levels  possible grids (min / median / max)   in 2 guesses   within budget',
  );
  for (const t of tiers) {
    const r = rows.get(t)!;
    console.log(
      `  ${t.padEnd(13)} ${String(r.answers.length).padStart(5)}  ` +
        `${Math.min(...r.answers)} / ${median(r.answers)} / ${Math.max(...r.answers)}`.padEnd(38) +
        `${pct(mean(r.inTwo))}           ${pct(mean(r.inBudget))} (worst level ${pct(Math.min(...r.inBudget))})`,
    );
  }
}

checkStructure();
checkDuplicates();
const { playouts } = checkPlay();

if (problems.length > 0) {
  console.error(`check:levels FAILED — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 50)) console.error(`  ✗ ${p}`);
  if (problems.length > 50) console.error(`  … and ${problems.length - 50} more`);
  process.exit(1);
}
console.log(
  `check:levels: ${levels.length} levels valid, no duplicates, ${playouts} random playouts ` +
    'kept every board consistent and finishable.',
);
if (process.argv.includes('--deep')) deepReport();
