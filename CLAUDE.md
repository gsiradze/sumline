# Grid

A 6×6 deduction puzzle with a 210-level ladder across 5 difficulty tiers. Web-first, Capacitor-compatible, no backend.

## Stack

- **Phaser 4.0.0** for the game canvas (grid rendering, input, animations). Brief specified 3.90+; the React-TS template ships with 4.0.0.
- **React 19 + TypeScript** for the UI shell (home, tier picker, level grid, share screen, retry/win overlays).
- **Vite 6** for dev server and bundling.
- **Tailwind CSS 3.4** for the React UI shell only. Phaser handles its own rendering; do not style Phaser game objects with Tailwind classes.
- **Vitest 3** for unit tests. Pure domain code (`src/game/domain/**`) has ≥80% coverage enforced in `vitest.config.ts`.
- **ESLint 9 (flat config)** + **Prettier 3**. Flat config lives in `eslint.config.js`.
- **tsx** runs TypeScript scripts without a separate build step (used by `scripts/build-levels.ts`).

## Commands

```
npm run dev            # Vite dev server on :8080
npm run build          # build:levels → typecheck → vite build
npm run preview        # preview the production build
npm run test           # vitest run (single pass)
npm run test:watch     # vitest watch
npm run test:cov       # vitest with coverage
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src scripts
npm run format         # prettier --write .
npm run build:levels   # regenerate public/levels.json (210 levels, committed)
```

## Architecture

```
src/
  game/
    EventBus.ts              # Phaser Events emitter, bridge between React and Phaser
    domain/                  # Pure TS. Single source of truth for game logic. Fully unit-tested.
      types.ts               # Cell, Grid, Guess, Feedback, Tier, Puzzle, GameOutcome, constants
      rng.ts                 # mulberry32 PRNG + FNV-1a string hash + shuffle
      tiers.ts               # 5-tier config table (batches, guess budget, pre-locks, star thresholds)
      levels.ts              # 210-level ladder: coords ↔ id, seed, pre-lock indices, progress helpers
      stars.ts               # Guess-count → star (1/2/3) mapping per tier
      difficulty.ts          # Difficulty scoring + per-tier target band
      hint.ts                # Pick most-unblocking cell for ad-rewarded hint
      feedback.ts            # per-cell GREEN/RED diff, win check
      solver.ts              # row/col sum computation + unique-solution-from-sums verifier
      puzzle.ts              # deterministic generator with rejection sampling + accept predicate
      game-state.ts          # ActiveGameState reducer (toggle, submit, hint, pre-locked init)
      stats.ts               # Total stars, levels completed, wins/losses, guess-count distribution
      shareGrid.ts           # Emoji share text per level
      __tests__/             # co-located unit tests
    audio/                   # Web Audio sound manager + haptics
    rendering/tokens.ts      # colors/layout/motion tokens for Phaser (kept in sync with Tailwind)
    scenes/                  # BootScene + GridScene
    main.ts                  # Phaser config
  storage/
    persistence.ts           # localStorage wrappers: progress, retry state, stats, mute, tutorial
    ads.ts                   # AdProvider stub (placeholder rewarded-ad surface)
    levelsManifest.ts        # Loads public/levels.json at bundle time, exposes typed accessors
  ui/
    PhaserGame.tsx           # Mounts Phaser, bridges state via EventBus
    App.tsx                  # View routing: home | tier | level
    components/              # HomeScreen, TierView, LevelCard, LevelGameView, HintButton,
                             # RetryGate, WinScreen, TeachingHint, HistoryStrip, HeroCounter,
                             # SubmitButton, ShareGridPreview, icons
    hooks/                   # useGameState, useStats, useProgress, useRetry, useAudioFx
  styles/
    globals.css              # Tailwind directives + design-system CSS custom properties
  main.tsx                   # React entry
scripts/
  build-levels.ts            # Bakes 210 levels at build time → public/levels.json
public/
  levels.json                # Generated manifest (210 levels), committed for deterministic builds
  favicon.svg                # Simple 5-dot grid mark
```

### Layering rules

- `domain/` is pure TypeScript. No Phaser, no React, no DOM, no localStorage, no network. Fully deterministic.
- `storage/` wraps platform side-effects (localStorage, ad SDK). Depends on `domain/` for types.
- Phaser code (`src/game/` outside `domain/` and `audio/`) renders the grid and owns input but never owns state. It reads from domain state and emits events via `EventBus`.
- React code (`src/ui/`) owns navigation (home ↔ tier ↔ level) and chrome, subscribes to `EventBus` via `PhaserGame`.

## Game mechanic — important notes

The spec's binary per-cell feedback is mathematically 2-guess solvable (guess anything, flip all REDs). The "3–6 guesses" constraint in the brief is treated as a **human UX budget** per tier, not a mathematical floor. The solver verifies each puzzle has a **unique solution given its row/column sums alone**, so a patient player can deduce it without guess feedback.

**Empirical property**: every puzzle in `levels.json` is multi-solution (ambiguous from row/col sums alone). Beginner/Intermediate exclude only trivial sums (0 and GRID_SIZE); Advanced/Expert/Master also exclude near-trivial sums (1 and GRID_SIZE-1). Player must use guess feedback — patient deduction from sums alone is impossible by design.

Generator pipeline (`puzzle.ts`):

1. Seed → mulberry32 → random 6×6 binary grid with 14–22 filled cells (configurable via `GenerateOptions`).
2. Apply optional `accept` predicate (used by `scripts/build-levels.ts` to enforce sum filters, teaching-batch features, and difficulty-band targeting). Callers own all rejection logic — the generator itself applies no filters.
3. Retry up to 500 attempts per seed; nudge seed by golden-ratio constant up to 50 times. If all fail, throw.

Solver (`solver.ts`) enumerates 6-bit row patterns with required popcount and backtracks with column-feasibility pruning. Short-circuits at `maxSolutions=2`.

## Level ladder

- **5 tiers**: Beginner, Intermediate, Advanced, Expert, Master.
- **Uneven batches**: 4 / 5 / 6 / 7 / 8 batches of 7 levels each → 210 total levels.
- **Teaching**: Beginner Batch 1 (levels 0–6) uses curated `accept` predicates so each introduces a distinct deduction technique (empty row/col, full row/col, singleton cross, near-full cross, review).
- **Procedural**: Remaining 203 levels are generated to match a target difficulty score inside the tier's band, with progressive widening of tolerance.
- **Scaffolding** (tuned tight — 3★ always means "solve in the mathematical minimum of 2 guesses"):
  - Beginner: 5-guess budget, 2 pre-locked cells, 3★ ≤2, 2★ ≤3.
  - Intermediate: 4 guesses, 1 pre-lock, 3★ ≤2, 2★ ≤3.
  - Advanced: 4 guesses, 0 pre-locks, 3★ ≤2, 2★ ≤3.
  - Expert: 3 guesses, 0 pre-locks, 3★ ≤2 — solve in 2 or scrape a 1★.
  - Master: 3 guesses, 0 pre-locks — as Expert, but with near-trivial sum filter.
- **Unlock**: Batches within a tier unlock sequentially (complete all 7 to unlock next). Tiers are all accessible from start.
- **Retry**: First attempt free. Losing grants 1 free instant retry. After that, each rewarded ad grants 2 more retries. Loop indefinitely.
- **Stars**: Based on guess count of the winning attempt (first try or retry). Retries remain eligible for 3★.
- **Hints**: 1 rewarded ad = 1 hint. Game picks the most-unblocking cell (forced by row/col-sum projection) and reveals its true state.

## Conventions

- Single quotes, 2-space indent, semicolons, trailing commas, 100-char width. Enforced by Prettier.
- `import type` for type-only imports; ESLint rule `consistent-type-imports` flags violations.
- Strict TypeScript (`strict: true` + `noImplicitOverride` + `noImplicitReturns` + `noUnusedLocals` + `noUnusedParameters`).
- No comments on obvious code. Comment only non-obvious WHY.
- No console.log in committed code outside of `scripts/` and tests.
- Tests live in `__tests__/` sibling folders. Pure domain has ≥80% coverage.
- Commits use Conventional Commits prefixes (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`).
- No new runtime dependencies without discussion. No state-management library, no CSS-in-JS, no router.

## Out of scope for v0.1

- Real ad SDK integration. `src/storage/ads.ts` is a placeholder that grants immediately.
- Capacitor wrapper (code stays compatible).
- Backend, accounts, leaderboards.
- Multiple grid sizes (6×6 only; the 5×5 predecessor was replaced).
- Localization (English only).
- Endless mode after level 210.
- Visual polish beyond current pass.
