# Sumline

A 6×6 binary deduction puzzle. Deduce a hidden grid of filled and empty cells from the per-row and per-column totals, using guess feedback to close in on the solution. 210 levels span 5 difficulty tiers. Play in a browser; the same code is Capacitor-compatible, shipping Android-first.

## Rules

- A hidden 6×6 grid has some cells filled and the rest empty.
- Above each column and to the left of each row, you see the **total** count of filled cells in that row or column (a single number, not run-lengths).
- Tap the cells you think are filled, or drag across several (you can mark exactly as many as the puzzle has), then submit a guess.
- Only your marks are judged:
  - a correct mark locks in green;
  - a wrong mark is crossed out and stays ruled out.
- When a row or column has all its filled cells found, the rest of that line is ruled out for you. This also applies to cells the level pre-solves.
- Switch to **Rule out** (or hold a cell) to pencil a dash on cells you believe are empty. Dashes are your own notes and are never judged.
- You win by submitting exactly the hidden grid. Each tier has its own guess budget; run out and the attempt is lost. A lost puzzle is not revealed: you retry the same one.

Every puzzle is ambiguous from its row/column totals alone by design, so guess feedback is required to solve. Levels are baked deterministically and frozen — everyone plays the same 210 puzzles.

## Progression

- **5 tiers**: Beginner, Intermediate, Advanced, Expert, Master.
- **210 levels** in uneven batches of 7 (4 / 5 / 6 / 7 / 8 batches per tier).
- Batches within a tier unlock sequentially; all tiers are accessible from the start.
- Stars (1–3) are earned by the guess count of the winning attempt.
- Level 1 is a guided first solve for new players: a spotlight tour that lights one row or column at a time. A new player who opens any other level first (from the list, or from a shared link) is taken through it, then on to the level they picked. "Replay tutorial" is in Settings.

## Monetization & platform

- Rewarded ads grant hints (one reveals a whole row or column) and extra retries; an interstitial may show when the player taps "Next" after a win; a bottom banner shows once the tutorial is done.
- Every build shows Google's test ads unless it is made with `npm run cap:sync:release`.
- Firebase Analytics + Crashlytics for telemetry. General 13+ audience, not child-directed.
- The web build is a demo of the first 14 levels with a pointer to the store. The dev server has no such limit; add `?demo` to its address to see the demo there.
- A shared result links to its level: `https://your-site/?level=37` opens level 37 in the web version. Set `VITE_WEB_URL` in `.env` to turn that on; without it the link goes to the store listing.

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
npm run check:levels   # verify the 210 levels and the rules (add -- --deep for a difficulty report)
npm run build:levels   # regenerate public/levels.json (manual only; the manifest is frozen)
```

Capacitor / native (`android/` is committed):

```bash
npm run cap:sync           # build with test ads → cap sync → patch native projects
npm run cap:sync:release   # build with live ads → cap sync → patch → release preflight
npm run patch:native       # write AdMob app ID, permissions and Firebase config into the native project
npm run doctor             # list what is still missing for a release
npm run version:apply      # sync app version from package.json to native projects
```

### Recording gameplay (dev only)

`http://localhost:8080/?capture=1&level=12&autoplay=1` shows only the board in a 9:16 frame on a clean background and plays a scripted two-guess solve. Options: `level` (1–210), `autoplay=1`, `speed` (0.25–4), `label=0` to hide the wordmark. Keys: Enter/Space submit, R restart, ←/→ change level, A toggle autoplay. The stage is not part of production builds. It is drawn in whichever theme the game last showed in that browser, light or dark: switch on the home screen before recording.

## Project layout

See [CLAUDE.md](./CLAUDE.md) for the full stack, architecture, and conventions. Short version:

- `src/game/domain/` — pure TypeScript game logic (puzzle generation, solver, feedback, tiers, stars). Fully unit-tested with ≥80% coverage.
- `src/game/audio/` — tap sounds, the background music loop, and haptics. Music plays `public/audio/music.m4a`; see `assets/README.md` for how to replace it.
- `src/ui/` — everything on screen in React, including the board (an SVG component that draws domain state and turns touches into moves).
- `src/storage/`, `src/platform/`, `src/telemetry/`, `src/config/` — async persistence, native helpers, Firebase telemetry, and env/AdMob config.
- `src/styles/globals.css` — every colour, for the light theme and the dark one. See "Themes" in CLAUDE.md before changing any.
- `scripts/build-levels.ts` — bakes the 210-level ladder into `public/levels.json` (committed, frozen).
- `RELEASE_REVIEW.md` — the pre-release audit, what was fixed, and the on-device test checklist.

## Attribution

Design system and visual direction from a Claude Design handoff (warm paper-and-ink tactile palette, Geist for the interface with Fraunces numerals on the board). See `src/styles/globals.css` for the tokens.

Originally scaffolded from the official [Phaser React-TS template](https://github.com/phaserjs/template-react-ts). The board has since been rebuilt in React and SVG, and Phaser removed.

## License

MIT.
