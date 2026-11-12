# Grid

A 6×6 deduction puzzle with a 210-level ladder across 5 difficulty tiers. Web-first, Capacitor-compatible, no backend.

## Stack

- **React 19 + TypeScript** for everything on screen, including the board, which is an SVG component (`src/ui/components/Board.tsx`). There is no game engine: Phaser was removed in November 2026 (it was 1.35 MB to draw 36 squares).
- **Vite 6** for dev server and bundling.
- **Tailwind CSS 3.4** for all UI. The board's SVG uses the same palette through `fill-*` / `stroke-*` classes.
- **Vitest 3** for unit tests. Pure domain code (`src/game/domain/**`) has ≥80% coverage enforced in `vitest.config.ts`.
- **Playwright** for end-to-end tests, including real pointer input on the board (tap, drag, hold).
- **ESLint 9 (flat config)** + **Prettier 3**. Flat config lives in `eslint.config.js`.
- **tsx** runs TypeScript scripts without a separate build step (used by `scripts/build-levels.ts`).

## Commands

```
npm run dev            # Vite dev server on :8080
npm run build          # typecheck → vite build (source maps are moved to sourcemaps/, never shipped)
npm run preview        # preview the production build
npm run test           # vitest run (single pass)
npm run test:watch     # vitest watch
npm run test:cov       # vitest with coverage
npm run test:e2e       # Playwright, on its own port (4611)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src scripts
npm run format         # prettier --write .
npm run check:levels   # integrity check of public/levels.json (add --deep for a difficulty report)
npm run build:levels   # regenerate public/levels.json — manual only, the manifest is frozen
npm run cap:sync           # build with TEST ads → cap sync → patch native
npm run cap:sync:release   # check levels → build with LIVE ads → cap sync → patch → doctor --release
npm run doctor         # what is missing for a release (add -- --release to make it fail)
```

## Architecture

```
src/
  game/
    domain/                  # Pure TS. Single source of truth for game logic. Fully unit-tested.
      types.ts               # Cell, Grid, Guess, Feedback, Tier, Puzzle, GameOutcome, constants
      rng.ts                 # mulberry32 PRNG + FNV-1a string hash + shuffle
      tiers.ts               # 5-tier config table (batches, guess budget, pre-locks, star thresholds)
      levels.ts              # 210-level ladder: coords ↔ id, seed, pre-lock indices, progress helpers
      stars.ts               # Guess-count → star (1/2/3) mapping per tier
      difficulty.ts          # Difficulty scoring + per-tier target band (used by the level bake only)
      hint.ts                # Picks the row or column a rewarded hint reveals
      feedback.ts            # per-cell GREEN/RED diff, win check
      solver.ts              # row/col sum computation + unique-solution-from-sums verifier
      puzzle.ts              # deterministic generator with rejection sampling + accept predicate
      game-state.ts          # ActiveGameState reducer (mark, note, submit, hint, pre-solved init)
      stroke.ts              # What a tap or drag does to each cell it crosses
      startingBoard.ts       # The board a level starts with (tutorial row / tier pre-solved cells)
      tutorial.ts            # The guided first solve on level 1: works out each step from the board
      attempt.ts             # Save/restore of an attempt as its move list, replayed through the rules
      propagator.ts          # "Line complete → rest are empty" auto-locking
      adPolicy.ts            # Interstitial cadence (pure)
      reviewPolicy.ts        # When to ask for a store review (pure)
      stats.ts               # Total stars, levels completed, wins/losses, guess-count distribution
      shareGrid.ts           # Emoji share text per level
      __tests__/             # co-located unit tests
    audio/                   # Web Audio: tap and win sounds (soundManager), the background
                             # music loop (music), haptics
  config/
    env.ts                   # AdMob IDs and ads mode (test by default, live only in release builds)
    links.ts                 # Store URL, privacy policy URL, support email, web version URL
    version.ts               # App version, injected from package.json
    demo.ts                  # Web build is a demo capped at the first 14 levels (`?demo` in dev)
  platform/
    native.ts                # Capacitor bootstrap, Android back button, foreground events
    back.ts                  # Back-handler stack: overlays first, then screens, then leave the app
    consent.ts               # UMP consent; nothing ad-related runs until it allows ad requests
    deepLink.ts              # `?level=37` links: parse on arrival, build for sharing
    theme.ts                 # Light or dark: light until the player chooses
    share.ts, review.ts, notifications.ts, keepAwake.ts
  storage/
    persistence.ts           # Capacitor Preferences (native) / localStorage (web): progress,
                             # stats, retry state, in-progress attempts, settings
    ads.ts                   # AdMob provider (rewarded, interstitial, banner) + web stub
    adSession.ts             # In-memory interstitial cadence state
    levelsManifest.ts        # Loads public/levels.json at bundle time, exposes typed accessors
  telemetry/                 # Analytics events, crash reporting, JS stack parsing
  ui/
    App.tsx                  # View routing: home | tier | level, overlays, back handling, shared links
    shareCard.ts             # Draws the 1080×1350 share image on a canvas
    components/              # Board (the SVG board and all its touch input), boardLayout,
                             # BeaverOverlay, HomeScreen, TierView, LevelCard, LevelGameView,
                             # MarkModeToggle, SubmitButton, HintButton, LastGuessSummary,
                             # RetryGate, WinScreen, TeachingHint, TutorialTour, RulesModal,
                             # StatsModal, SettingsModal, GetAppModal, Splash, Wordmark,
                             # ErrorBoundary, icons
    hooks/                   # useGameState, useStats, useProgress, useRetry, useAudioFx,
                             # useBackHandler, useKeepAwake, useTheme, useTutorial
  dev/
    CaptureStage.tsx         # Recording stage for short-form video. Dev builds only.
  styles/
    globals.css              # Tailwind directives + every colour, for the light and dark themes
  main.tsx                   # React entry
scripts/
  build-levels.ts            # Bakes the 210 levels → public/levels.json (manual only; frozen)
  check-levels.ts            # Integrity check: structure, duplicates, rule fuzzing, save/restore
  doctor.ts                  # Release preflight
  patch-native.ts            # Writes AdMob app ID, permissions, Firebase config into android/ios
android/                     # Committed native project (signing + Firebase Gradle wiring live here)
public/
  levels.json                # Generated manifest (210 levels), committed for deterministic builds
  audio/music.m4a            # Background music loop (its master is assets/audio/music.wav)
  favicon.svg                # Simple 5-dot grid mark
```

### Layering rules

- `domain/` is pure TypeScript. No React, no DOM, no localStorage, no network. Fully deterministic.
- `storage/` wraps platform side-effects (localStorage, ad SDK). Depends on `domain/` for types.
- React code (`src/ui/`) owns navigation (home ↔ tier ↔ level), chrome and the board. The board draws domain state and turns touches into moves; it never owns game state. What a touch means (`stroke.ts`) and what the tutorial says (`tutorial.ts`) are domain rules, not component logic.

## Game mechanic — important notes

The rules as shipped (older notes described a different feedback model; these are current):

- The player marks cells and submits. **Only marked cells are judged.** A correct mark locks filled; a wrong mark locks empty (shown as ✕). Unmarked cells get no feedback.
- A tap marks or unmarks one cell; a drag does the same to every open cell it crosses (starting on a marked cell erases). A drag never overwrites a note with a mark or a mark with a note, and never touches a locked cell.
- Marks are capped at the puzzle's filled-cell count. A hint can push the count past the cap (it force-marks the filled cells it reveals); the guess is then blocked until marks are removed.
- When a row or column has all its filled cells locked, the rest of that line auto-locks empty (`propagator.ts`). This also runs on the starting board, so a pre-solved cell can rule out a line before the first guess. The opposite direction ("remaining cells must be filled") is left to the player.
- Win = submitting exactly the solution within the tier's guess budget.
- Notes: the player can pencil a "ruled out" dash on any open cell (Rule out mode, or hold a cell; holding and then dragging pencils several). Notes are never judged and are cleared when the cell locks.
- A loss does **not** reveal the answer: the retry is the same puzzle. An attempt (in progress or lost) is saved as its move list and replayed on return, so leaving a level is not a free restart.

**Every puzzle is ambiguous from its sums alone.** Levels 1–63 have 4–15 grids consistent with their clues, with one exception: level 7, the last of the teaching set, has 70,287 (3,386 with its solved row), because its numbers have no extremes. Levels 64–210 have roughly 24,000–190,000 (the intended solution-count bands for the top three tiers were not reachable with their sum filter, so the bake fell back to unfiltered grids). Consequences worth knowing before changing balance: Advanced, Expert and Master are the same puzzle distribution and differ only by guess budget; and in those tiers even a perfect solver needs more than two guesses on about half the levels, so 3★ there is partly luck. `npm run check:levels -- --deep` prints the numbers.

**Do not soften the top tiers with pre-solved cells.** A taper of extra pre-solved cells (12 at level 64 down to none at level 204) was built and removed on 2026-11-11. The owner's rule: a higher tier never starts with more help than a lower one (Beginner 2 cells, Intermediate 1, the rest none), and Expert is not to be made easier. Ask before proposing anything that changes how hard a tier is.

Generator pipeline (`puzzle.ts`, used only by `scripts/build-levels.ts`):

1. Seed → mulberry32 → random 6×6 binary grid with 14–22 filled cells (configurable via `GenerateOptions`).
2. Apply optional `accept` predicate (sum filters, teaching-batch features, difficulty-band targeting). Callers own all rejection logic — the generator itself applies no filters.
3. Retry up to 500 attempts per seed; nudge seed by golden-ratio constant up to 50 times. If all fail, throw.

Solver (`solver.ts`) enumerates 6-bit row patterns with required popcount and backtracks with column-feasibility pruning. Short-circuits at `maxSolutions=2`.

## Level ladder

- **5 tiers**: Beginner, Intermediate, Advanced, Expert, Master.
- **Uneven batches**: 4 / 5 / 6 / 7 / 8 batches of 7 levels each → 210 total levels.
- **Teaching**: Beginner Batch 1 (levels 0–6) starts with one whole row pre-solved and shows a one-line tip per level (`TEACHING_TIPS` in `LevelGameView.tsx`). A new player is taught by the tour on level 1: see "Tutorial" below. The per-level `teachingHint` strings baked into `levels.json` predate the current rules and are not shown.
- **Procedural**: Remaining 203 levels are generated to match a target difficulty score inside the tier's band, with progressive widening of tolerance.
- **Scaffolding** (3★ = solved in at most 2 guesses):
  - Beginner: 5-guess budget, 2 pre-locked cells, 3★ ≤2, 2★ ≤3.
  - Intermediate: 4 guesses, 1 pre-lock, 3★ ≤2, 2★ ≤3.
  - Advanced: 4 guesses, 0 pre-locks, 3★ ≤2, 2★ ≤3.
  - Expert: 3 guesses, 0 pre-locks, 3★ ≤2, 2★ for a win on the last guess.
  - Master: 3 guesses, 0 pre-locks — as Expert, but with near-trivial sum filter.
- **Unlock**: Batches within a tier unlock sequentially (complete all 7 to unlock next). Tiers are all accessible from start. "Next" after a win never opens a locked set.
- **Retry**: First attempt free. Losing grants 1 free instant retry per level. After that, each rewarded ad grants 2 more retries. A lost level stays lost (and gated) until retried; the answer is never shown.
- **Stars**: Based on guess count of the winning attempt (first try or retry). Retries remain eligible for 3★.
- **Hints**: 1 rewarded ad = 1 hint. A hint reveals a whole row or column: the one whose open cells could still be arranged in the most ways (`findHintLine`). The line is chosen when the ad pays out, from the board as it is then.
- **Sharing**: the win screen shares the emoji result plus a link. Where the platform's share sheet takes files (mobile browsers), a 1080×1350 image of the unsolved puzzle with the result goes with it (`shareCard.ts`). In the Android app it is text and link only: handing an image to the native share sheet needs `@capacitor/filesystem`, which is not installed. The link is `VITE_WEB_URL/?level=N` when that is set, the store listing otherwise; the web version opens `?level=N` directly on that level.
- **Ads**: banner app-wide (never before a new player has finished the tutorial), interstitial only on an explicit "Next" tap per `adPolicy.ts`, rewarded for hints and retries. The layout reserves banner height + safe area + a gap (`--bottom-reserve` in `globals.css`); no control may sit inside it.
- **Web demo**: the public web build stops after level 14 (`demo.ts`); the app has no limit. A level past it raises the "get the app" prompt instead of opening, whichever way it was asked for: a card in a level list, a shared link, "Next" after level 14, PLAY once all 14 are solved. Four of the five tiers lie wholly past the demo and their lists do not say so, so the prompt's "Keep playing the demo" must lead somewhere playable: it opens the lowest unsolved demo level (the tutorial, on a first visit), or the Beginner list once all 14 are solved. Until 2026-11-12 it only closed the prompt, and the owner, trying the site as a new visitor, could not start a game. **The dev server has no limit either**, which is how that went unseen: add `?demo` to its address to get the demo, and give any change to how levels are opened a test in `tests/e2e/demo.spec.ts`.

## Tutorial

Built on 2026-11-12, after the owner watched people aged 7 to 30 fail to work out the game from an earlier tutorial that explained it in a text box above the board. Their brief, in their words: "make all other columns dark and only show what you're talking about", "this text should not be in the top of the game, put it over the boxes", "make it more interactive".

- **What it is.** A guided first solve of level 1 (`tutorial.ts` plans it, `useTutorial.ts` runs it, `TutorialTour.tsx` draws it). Each step lights one thing, says one thing next to it, and waits for one action: read what a number means, fill a row that needs all its free cells, rule out a full column, guess where the numbers cannot decide, check, and read the ✕. It ends in a win within two guesses whichever way the guess goes, so always three stars.
- **Planned from the board, not scripted.** `nextTourStep(state)` reasons the way a player is meant to (a line that needs as many as it has free cells is certain; a full line rules out the rest; otherwise guess). A unit test walks level 1 through every possible guess. Change level 1's starting board and the tour follows; it does not have to be re-authored.
- **One tutorial, every way in.** `App.tsx` owns "has this player had it" (`grid:v2:rulesShown`, or any solved level). A new player who opens any level, from the list or from a shared link, is taken to level 1 first; "Next" after the win, or Skip, then goes to the level they asked for. The old three pages of rules are deleted. Do not add a second way to teach the game.
- **Dark veil, lit cut-outs.** Everything but what the step is about is under a veil. The veil is one element with holes cut by `clip-path`; the holes let touches through, the rest takes them. Lit lines are either rows or a single column, so two holes never overlap (overlapping holes would fill in).
- **Never dead.** An earlier version blocked touches with nothing on screen to show it, and on an iPad it read as the game being broken. Now a touch the tour does not take is always answered: the caption jolts (`nudge`), whether it landed on the veil or on a lit cell the step does not ask for. Skip is always on screen. Keep it that way.
- **Only the lit cells take marks** (`only` on `Board`), and a hold does not pencil while guiding, so a step cannot go astray. Ruling out is done by a button in the caption, which pencils the same dashes the player could draw.
- **Words.** Ten at most per caption, checked by a unit test (the Plants vs. Zombies rule is eight). Captions say "beavers", which is what a found cell shows; the rest of the game still says "filled cells".
- **Getting it back.** "Replay tutorial" in Settings and in the "?" sheet. A replay restarts level 1 clean and keeps earned stars.
- **Measuring.** `tutorial_begin`, one `tutorial_step` per step shown (kind and position), `tutorial_complete` (skipped or not). The funnel shows where new players stop.
- **Not on a phone yet.** The veil's cut-outs and touch pass-through are tested in Chromium and in Safari's engine, not on a device.

## Board size

- The grid fills the board box: only the clue numbers sit left of it and above it, and its right edge lines up with the buttons below (`boardLayout.ts`). Margin inside the box is width the cells cannot use on a phone.
- `.board-box` (globals.css) makes the board as wide as its column when the screen is tall enough for the header and the controls too, and narrower when it is not, down to 86% of the column (a cell and its gap are then still a 44 px target on a 360 px phone). The height budget in that rule (header 68 + controls 264, plus 76 for a tip) is checked by `tests/e2e/layout.spec.ts`.
- Keep `.board-box` a block, not a flex item: Safari takes a flex item's height from its column width and ignores the narrower width.
- CI runs the browser tests in Chromium only. The suite also passes in Safari's engine (WebKit), which is what an iPad uses; run it there after touching the board, input or layout.

## Audio

- **Music** is one seamless loop, `public/audio/music.m4a`, played through Web Audio by `src/game/audio/music.ts`. It plays on every screen, not in the dev capture stage.
- **Looping exactly.** AAC files carry padding, and browsers differ in how much of it they leave after decoding (measured: Chrome trims all of it, another Chromium build leaves 34 ms at the end). So the player loops the exact length in `MUSIC_TRACK`, not the decoded buffer. To change the music, replace both `public/audio/music.m4a` and its master `assets/audio/music.wav`, and update `MUSIC_TRACK` (`afinfo` prints the numbers). A unit test fails if the master and `MUSIC_TRACK` disagree.
- **Starting.** Browsers only let audio begin from a touch or key press, so music starts on the first one (`App.tsx`).
- **Settings.** "Sound" off silences everything; "Music" only chooses whether the tune plays (`grid:v2:musicOff`; on by default).
- **Background.** All audio is suspended while the app is in the background (`sound.pause()` in `main.tsx`). That is also what silences it under a full-screen ad, which puts the app behind it.
- **Level.** `MUSIC_VOLUME` in `music.ts` was set from measurement to sit just under the tap sounds. Nobody has listened to the mix on a phone yet.

## Themes

- **Two themes, one set of names.** Every colour is a CSS variable in `globals.css`: `:root` holds the light values, `.dark` the dark ones. Components use the Tailwind names (`bg-paper-50`, `text-ink-900`) and need no theme logic. `dark` is put on `<html>` by a few lines in `index.html` before the first paint, so a dark-theme player never sees a light flash, and by `src/platform/theme.ts` after that. A unit test keeps the two in step.
- **Which theme.** Light, until the player uses the switch (the sun or moon on the home screen, or "Dark theme" in Settings). After that it is their choice, saved as `grid:v2:theme`. The device's own light or dark setting is not followed: the owner asked for light by default on 2026-11-12, after a first version that followed the device. In the app a copy of the choice is kept in localStorage, the only store `index.html` can read at once.
- **The light theme's colours are the owner's.** On 2026-11-12 they asked for a dark theme and said, in their words, "keep white mode with this colors". Do not change a light value. The check used then: screenshot every screen before and after and compare pixel by pixel.
- **The dark palette is held to published guidance by a test** (`src/styles/__tests__/darkPalette.test.ts`): a dark grey page, not black; cream text, not white; text at least 4.5:1 against what it sits on; raised surfaces lighter, because shadows do not show. Sources: Apple's Dark Mode guidelines, Google's Material dark theme, WCAG 2.2. The comment above `.dark` explains the scales.
- **Not everything flips.** In dark the accent scales run the other way round (700 is the pale shade used for text, 100 the deep tint). Anything drawn as an object keeps fixed colours instead: the PLAY button, the mascot, the edge of the tier buttons (`--pin-edge`). The share image is always the light one.
- **Traps.** An opacity suffix on these names (`bg-paper-50/70`, `text-ochre-500/25`) generates no CSS at all: the colours are plain `var()` values and Tailwind 3 cannot add alpha to them. Sixteen such classes exist and do nothing; making them work would change the light theme, so they were left. Do not add more. For a difference that applies in dark only, use a `dark:` variant.
- **Native.** `setSystemBarsTheme()` in `native.ts` switches the status and navigation bar icons with the theme. The launch screen is native and shows before any of this runs, so it follows the phone, not the player's choice: a dark one needs `assets/splash-dark.png`.

## Conventions

- Single quotes, 2-space indent, semicolons, trailing commas, 100-char width. Enforced by Prettier.
- `import type` for type-only imports; ESLint rule `consistent-type-imports` flags violations.
- Strict TypeScript (`strict: true` + `noImplicitOverride` + `noImplicitReturns` + `noUnusedLocals` + `noUnusedParameters`).
- No comments on obvious code. Comment only non-obvious WHY.
- No console.log in committed code outside of `scripts/` and tests.
- Tests live in `__tests__/` sibling folders. Pure domain has ≥80% coverage.
- Commits use Conventional Commits prefixes (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`).
- No new runtime dependencies without discussion. No state-management library, no CSS-in-JS, no router.
- `public/levels.json` is frozen: never reorder or alter existing levels (saved attempts and shared results depend on it). Append only.
- Saves: new data goes under new keys; never change the meaning of an existing key without a migration.
- `font-serif` currently resolves to Geist on purpose (see the comment in `tailwind.config.ts`); Fraunces is used only for the board's clue numbers.

## Out of scope for v0.1

- In-app purchases (a "Remove Ads" purchase is the planned fast-follow).
- iOS (code is compatible; the project is Android-first).
- Backend, accounts, leaderboards.
- Multiple grid sizes (6×6 only; the 5×5 predecessor was replaced).
- Localization (English only).
- Endless mode after level 210.
- Visual polish beyond current pass.
