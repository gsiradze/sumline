# Sumline

A 6×6 binary deduction puzzle. Deduce a hidden grid of filled and empty cells from the per-row and per-column totals, using guess feedback to close in on the solution. 210 levels span 5 difficulty tiers. Play in a browser; the same code is Capacitor-compatible, shipping Android-first.

## Rules

- A hidden 6×6 grid has some cells filled and the rest empty.
- Above each column and to the left of each row, you see the **total** count of filled cells in that row or column (a single number, not run-lengths).
- Tap the cells you think are filled, then submit a guess.
- Every cell is colored after submit:
  - 🟩 green — your mark matches the solution at that cell (it stays locked).
  - 🟥 red — your mark is wrong (the cell stays editable next guess).
- You win when every cell is green. Each tier has its own guess budget; run out and the attempt is lost.

Every puzzle is ambiguous from its row/column totals alone by design, so guess feedback is required to solve. Levels are baked deterministically at build time and frozen — everyone plays the same 210 puzzles.

## Progression

- **5 tiers**: Beginner, Intermediate, Advanced, Expert, Master.
- **210 levels** in uneven batches of 7 (4 / 5 / 6 / 7 / 8 batches per tier).
- Batches within a tier unlock sequentially; all tiers are accessible from the start.
- Stars (1–3) are earned by the guess count of the winning attempt.

## Monetization & platform

- Rewarded ads grant hints and extra retries; interstitials run after level completion; a bottom banner shows during play.
- Firebase Analytics + Crashlytics for telemetry. General 13+ audience, not child-directed.
- AdMob, Firebase, and native config are applied at Capacitor sync time.

## Development

Requires Node 20+ and npm.

```bash
npm install
npm run dev            # Vite dev server on http://localhost:8080
npm run test           # vitest (single pass)
npm run test:e2e       # Playwright end-to-end tests
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src scripts
npm run build          # typecheck + vite build
npm run preview        # preview the production build locally
npm run build:levels   # regenerate public/levels.json (manual only; the manifest is frozen)
```

Capacitor / native:

```bash
npm run cap:sync       # build → cap sync → patch native projects
npm run patch:native   # apply native config patches
npm run doctor         # check native/tooling prerequisites
npm run version:apply  # sync app version from package.json to native projects
```

## Project layout

See [CLAUDE.md](./CLAUDE.md) for the full stack, architecture, and conventions. Short version:

- `src/game/domain/` — pure TypeScript game logic (puzzle generation, solver, feedback, tiers, stars). Fully unit-tested with ≥80% coverage.
- `src/game/` — Phaser renderer and scenes; reads domain state, owns input, never owns state.
- `src/ui/` — React UI shell (home, tier picker, level grid, overlays).
- `src/storage/`, `src/platform/`, `src/telemetry/`, `src/config/` — async persistence, native helpers, Firebase telemetry, and env/AdMob config.
- `scripts/build-levels.ts` — bakes the 210-level ladder into `public/levels.json` (committed, frozen).

## Attribution

Design system and visual direction from a Claude Design handoff (warm paper-and-ink tactile palette, Fraunces + Geist pairing). See `src/styles/globals.css` for the tokens.

Scaffolded from the official [Phaser React-TS template](https://github.com/phaserjs/template-react-ts).

## License

MIT.
