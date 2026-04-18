# Grid

A daily 5×5 deduction puzzle. Web-first, Capacitor-compatible, no backend.

## Stack

- **Phaser 4.0.0** for the game canvas (grid rendering, input, animations). The brief specified `3.90+`; the official Phaser React-TS template ships with 4.0.0 so we adopted it. Not expected to cause issues; flag if API-surface conflicts appear.
- **React 19 + TypeScript** for the UI shell (header, modals, share screen).
- **Vite 6** for dev server and bundling.
- **Tailwind CSS 3.4** for the React UI shell only. Phaser handles its own rendering; do not style Phaser game objects with Tailwind classes.
- **Vitest 3** for unit tests. Pure domain code (`src/game/domain/**`) has ≥80% coverage enforced in `vitest.config.ts`.
- **ESLint 9 (flat config)** + **Prettier 3**. Flat config lives in `eslint.config.js`.
- **tsx** runs TypeScript scripts without a separate build step (used by `scripts/build-puzzles.ts`).

## Commands

```
npm run dev            # Vite dev server on :8080
npm run build          # build:puzzles → typecheck → vite build
npm run preview        # preview the production build
npm run test           # vitest run (single pass)
npm run test:watch     # vitest watch
npm run test:cov       # vitest with coverage
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src scripts
npm run format         # prettier --write .
npm run build:puzzles  # regenerate public/puzzles.json (365 puzzles, committed)
```

## Architecture

```
src/
  game/
    EventBus.ts              # Phaser Events emitter, bridge between React and Phaser (Phase 4+)
    domain/                  # Pure TS. Single source of truth for game logic. Fully unit-tested.
      types.ts               # Cell, Grid, Guess, Feedback, Puzzle, GameState, constants
      rng.ts                 # mulberry32 PRNG + FNV-1a string hash + shuffle
      daily.ts               # launch epoch (2026-01-01), date ↔ puzzleId mapping, seed helpers
      feedback.ts            # per-cell GREEN/RED diff, win check, locked-cell projection
      solver.ts              # row/col sum computation + unique-solution-from-sums verifier
      puzzle.ts              # deterministic generator with rejection sampling
      __tests__/             # co-located unit tests
  styles/
    globals.css              # Tailwind directives + design-system CSS custom properties + dark mode
  main.tsx                   # React entry
  App.tsx                    # minimal Phase 1 placeholder; Phase 4 expands into the full shell
scripts/
  build-puzzles.ts           # bakes 365 puzzles at build time → public/puzzles.json
public/
  puzzles.json               # generated manifest, committed for deterministic builds
  favicon.svg                # simple 5-dot grid mark
```

### Layering rules

- `domain/` is pure TypeScript. No Phaser, no React, no DOM, no localStorage, no network. Fully deterministic. All puzzle logic lives here.
- Phaser code (Phase 2+) renders the grid and owns input but never owns state. It reads from `domain/` and emits events via `EventBus`.
- React code (Phase 4+) owns UI chrome and subscribes to `EventBus` via hooks. It never imports Phaser types directly except via the scene ref.

## Game mechanic — important notes

The spec's binary per-cell feedback is mathematically 2-guess solvable (guess anything, flip all REDs). The "3–6 guesses" constraint in the brief is treated as a **human UX budget**, not a mathematical floor. The solver's actual job is to verify that each puzzle has a **unique solution given its row/column sums alone**, so a patient player can deduce it without needing guess feedback. Puzzles that admit multiple row/col-consistent solutions are rejected — without that, a player trying to deduce cleanly would hit ambiguous forks.

Generator pipeline (`puzzle.ts`):

1. Seed → mulberry32 → random 5×5 binary grid with 10–14 filled cells.
2. Reject if >2 row/col sums are trivial (0 or 5).
3. Reject if `isUniquelySolvableFromSums` returns false.
4. Retry up to 500 attempts per seed; nudge seed by the golden-ratio constant up to 50 times. If all fail, throw.

The solver (`solver.ts`) enumerates 5-bit row patterns with the required popcount and backtracks with column-feasibility pruning. Short-circuits at `maxSolutions=2` to cheaply decide "unique vs not-unique."

## Conventions

- Single quotes, 2-space indent, semicolons, trailing commas, 100-char width. Enforced by Prettier.
- `import type` for type-only imports; ESLint rule `consistent-type-imports` flags violations.
- Strict TypeScript (`strict: true` + `noImplicitOverride` + `noImplicitReturns`).
- No comments on obvious code. Comment only non-obvious WHY (an invariant, a subtle constraint, a workaround for a specific bug).
- No console.log in committed code outside of `scripts/` and tests. ESLint enforces `no-console` in src.
- Tests live in `__tests__/` sibling folders. One test file per module. Pure domain has ≥80% coverage.
- Commits use Conventional Commits prefixes (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`).
- No new runtime dependencies without discussion. Especially: no state-management library (React + EventBus is enough), no CSS-in-JS (Tailwind only), no router (single screen).

## Out of scope for v0.1

- Real ad SDK integration. Placeholder `AdProvider` stub will land in Phase 4.
- Capacitor wrapper. Code stays Capacitor-compatible (no Node-only APIs, no server calls).
- Backend / accounts / leaderboards / friends.
- Sound effects.
- Multiple grid sizes (5×5 only).
- Localization (English only, but strings go through a simple `t()` function for future extraction).
- Visual polish — colors/fonts/animations are pulled from `design-system.html`; fine-tuning comes from a separate design pass.

## Phase plan

- **Phase 1 (this):** scaffold, domain types, RNG, puzzle generator, solver, manifest build, tests.
- **Phase 2:** Phaser scene, grid rendering, cell input, guess submission animation.
- **Phase 3:** feedback resolution, game state machine, win/lose handling.
- **Phase 4:** React UI shell (header, stats modal, share modal, how-to-play), localStorage persistence, share grid.
- **Phase 5:** polish, accessibility audit, Lighthouse perf pass, practice mode endgame UX.
