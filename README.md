# Grid

A daily 5×5 deduction puzzle. One puzzle per calendar day (UTC), six guesses, binary per-cell feedback. Play in a browser; the same code is Capacitor-compatible for iOS / Android.

## Rules

- A hidden 5×5 grid has between 10 and 14 filled cells.
- Above each column and to the left of each row, you see the **total** count of filled cells in that row or column (single number, not run-lengths).
- On each guess, tap cells you think are filled and submit.
- Every cell is colored after submit:
  - 🟩 green — your mark matches the solution at that cell (it stays locked).
  - 🟥 red — your mark is wrong (the cell stays editable next guess).
- You win when every cell is green. You have **six guesses**. Miss all six and the solution is revealed.

Puzzles are **deterministic per calendar date in UTC** — everyone sees the same puzzle on the same day. There's also a practice mode that generates an unlimited stream of puzzles from a per-session seed.

## Development

Requires Node 20+ and npm.

```bash
npm install
npm run dev            # Vite dev server on http://localhost:8080
npm run test           # vitest
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # build puzzle manifest, typecheck, and bundle
npm run preview        # preview the production build locally
```

## Project layout

See [CLAUDE.md](./CLAUDE.md) for the full stack, architecture, and conventions. Short version:

- `src/game/domain/` — pure TypeScript game logic (puzzle generation, solver, feedback). Fully unit-tested with ≥80% coverage.
- `src/game/` — Phaser renderer (lands in Phase 2).
- `src/` — React UI shell (lands in Phase 4).
- `scripts/build-puzzles.ts` — bakes 365 daily puzzles into `public/puzzles.json` at build time.

## Attribution

Design system and visual direction from a Claude Design handoff (warm paper-and-ink tactile palette, Fraunces + Geist pairing). See `src/styles/globals.css` for the tokens.

Scaffolded from the official [Phaser React-TS template](https://github.com/phaserjs/template-react-ts).

## License

MIT.
