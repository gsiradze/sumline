# Sumline — Release Review

> **Status, 2026-11-11 (after the fix pass).** Sections 0–9 are the audit **as found**, kept for
> reference. Most of it is now fixed: see **section 10** for what changed and what is still open,
> and **section 11** for what you must test on a real phone before uploading.
> The verdict has moved from "not ready" to **"ready for a first device build"**. It is not ready
> for the store until that build has been tested and your inputs (ad IDs, Firebase, art, privacy
> policy, signing key) are in. Nothing has been committed to git.
>
> **Later the same day: an improvements pass** (new board, drag to mark, guided tutorial, line
> hints, share image and links). It is described in **section 12**, which also
> adds to the phone checklist. Where sections 0–11 mention Phaser, a canvas, a one-cell hint or a
> three-page tutorial, section 12 is the current state.

## Phase 1 audit

Audited 2026-11-11 at `main` @ `42675aa`. Read-only: no source file was changed; this file was the only addition.

## 0. Read this first

**The brief does not match the repo.** I audited what is actually there:

| Brief said | Repo says |
|---|---|
| PixiJS | **Phaser 4.0.0** (board only) + **React 19** (all UI) + Tailwind 3.4, Vite 6, TypeScript 5.7 |
| Capacitor | Capacitor **8.4.1**, Android `compileSdk`/`targetSdk` 36, `minSdk` 24, AGP 8.13 |
| AppLovin MAX / AdMob | **AdMob only** (`@capacitor-community/admob` 8.0.0, GMA 24.9.x, UMP 4.0.0) |
| "Remove Ads" IAP | **No IAP code exists.** `HANDOFF.md` defers it. The purchase/restore checks do not apply to v1. |
| Analytics / crash | Firebase Analytics 23.0.0 + Crashlytics 20.0.3, native only |

Unfilled placeholders I assumed (correct me): Android first, iOS later; general 13+ audience, not child-directed; no release date; unknown whether testers have save data (I propose no save-format changes, so it should not matter).

**What I ran**

| Check | Result |
|---|---|
| `npm run typecheck` | Pass, 0 errors |
| `npm run lint` | Pass, 0 warnings |
| `npm run test:cov` | 141/141 pass. 91.9% line coverage, but only `src/game/domain/**` is measured. Storage, ads, consent and UI have **zero** tests. |
| `npm run build` | Pass. `dist/` is 15 MB, of which **12.5 MB is source maps**. Phaser chunk 1,353 KB (350 KB gzip), app 324 KB, level view 41 KB, CSS 117 KB, 72 font files (810 KB). One chunk-size warning. |
| `npm run test:e2e` | **5/5 fail as configured, 5/5 pass on a free port.** Port 8080 on this machine is a Docker Adminer container and Playwright silently reused it (CODE-02). |
| Level audit script (new, in scratchpad) | 210/210 structurally valid, 0 duplicates, 8,400 fuzz playouts with 0 invariant failures. Details in §6. |
| Headless Chromium on the production build | 5 viewports (320×568 → 800×1280), full flows. **No page errors, no failed requests, no 4xx.** Layout, probes and perf numbers are quoted in the findings. |

**What I could not run:** any Android build. This machine has no JDK, no Android Studio and no Android SDK (the paths in `docs/native-checklist.md` do not exist), and `android/app/build` is empty. Everything native below is traced from code and plugin sources and marked as needing a device.

---

## 1. How the game works (tell me where this is wrong)

Sumline is a 6×6 hidden-grid deduction puzzle. Each level shows how many cells are filled in every row and column. The player marks cells (hard-capped at the level's total filled count) and submits. **Only marked cells are judged**: correct marks lock green and get a beaver, wrong marks lock as known-empty. When a row or column has all its filled cells found, its remaining cells auto-lock empty. You win by submitting exactly the solution within the tier's guess budget (5 / 4 / 4 / 3 / 3); stars come from guesses used (≤2 is 3★). There are 210 fixed levels baked into `public/levels.json`, in 5 tiers of 4/5/6/7/8 sets of 7; sets unlock in order, all tiers are open from the start. Levels 1–7 start with one row pre-solved; Beginner/Intermediate otherwise pre-solve 2/1 cells. Losing reveals the full answer and offers one free retry, then rewarded-ad retries (+2 per ad). A rewarded-ad hint reveals one cell. A bottom banner shows app-wide; an interstitial may show when advancing after every third completed level, from the second session, at least 90 s after any ad. Progress, stats and a day streak live in Capacitor Preferences. React renders every screen; Phaser renders only the board. No backend.

Note: `CLAUDE.md` and `README.md` still describe an older mechanic (every cell coloured after a guess, "2-guess solvable"). The shipped rules are the ones above.

---

## 2. Verdict: **not ready**

The web layer is clean (types, lint, tests, build, no runtime errors). The release is not close, for three reasons:

1. **No native build has ever been run on a device**, and there is no toolchain on this machine to make one. Ads, consent, the banner layout, safe areas, back button, notifications, crash reporting and saves are all untested on hardware.
2. **The ad integration will get the AdMob account in trouble as written.** The banner covers the tutorial's "Next" button and the Hint button on common phones (UX-01), and an interstitial can fire from a timer with no tap, including after the app was backgrounded (MON-02). Both are textbook accidental-click / unexpected-ad violations.
3. **Owner inputs are all still missing**: AdMob IDs, Firebase config, icon and splash art, privacy policy URL, signing key. Without the AdMob app ID the app crashes on launch; without the unit IDs a release build silently ships Google's test ads (MON-01).

Top risks after those: the share message advertises "Grid" and someone else's domain (UNF-01); Android back exits the app from every screen (BUG-01); the retry/star economy is self-defeating because a loss reveals the answer and the retry is the same puzzle (LVL-04).

Realistic path: about 2–3 days of code work for batch 1, a first device build, then Google's closed test (≥12 testers for 14 days on a new personal account; your docs say 20, Google lowered it in Dec 2024, check the Console). Launch is 3–5 weeks out, not days.

---

## 3. What's left to finish

**Only you can do (blocks everything native)**
- [ ] Install JDK + Android Studio + SDK; produce the first device build (REL-01)
- [ ] AdMob app + 3 ad units → `.env`; register your own phones as AdMob test devices (MON-01, MON-03)
- [ ] Firebase project → `native-config/android/google-services.json` (UNF-06)
- [ ] Icon 1024² and splash 2732² art → `assets/` (UNF-05). The app currently ships the default Capacitor icon and splash.
- [ ] Privacy policy URL (must mention the advertising ID) and a support email (UNF-04)
- [ ] Upload keystore, backed up
- [ ] Play Console: listing, Data Safety (§7), target audience, closed test

**Code, before launch** — batch 1 and 2 in §8.

**Decisions I need from you** — §4. Several findings change ads, scoring, art direction or game rules, so I will not touch them without an answer.

---

## 4. Decisions needed

| # | Decision | My recommendation |
|---|---|---|
| D1 | **Typeface** (UX-03): headings were designed in Fraunces but have always rendered in Geist because of a CSS bug. Fix the bug (app changes look) or keep the Geist look and delete Fraunces? | I generate before/after screenshots of every screen and you pick. If no time: keep Geist. |
| D2 | **"Daily" card** (UNF-03): hide it for launch, or keep it? | Hide the card and the "Daily puzzles" taglines. Ship a real daily later. |
| D3 | **Loss reveal and retry stars** (LVL-04, MON-05) | On loss show only your wrong marks; reveal the answer only on "Back to levels". Persist the lost state so Back → reopen is not a free retry. |
| D4 | **Auto-advance** after a win (UX-08, MON-02) | Remove it. "Next" becomes an explicit tap. |
| D5 | **Banner in the first session / tutorial** (UX-01) | No banner while the tutorial is open; consider no banner at all in session 1. |
| D6 | **"Next" into a locked set** (BUG-05) | Enforce the lock: return to the tier screen. |
| D7 | **Hint over the mark cap, and under-filled submits** (BUG-06, UX-09) | Block Submit while over the cap; confirm when under it. |
| D8 | **Commit `android/` to git** (REL-02) | Yes. |
| D9 | **Streak day boundary**: UTC → local date (BUG-04) | Yes. Stored format is unchanged; worst case one odd day at the switch. |
| D10 | **Public web build** with ad stubs that always grant (MON-10) | Keep as a demo but cap it (e.g. first 14 levels + "Get the app"), or stop deploying. |
| D11 | **Tier difficulty** (LVL-01..03) | Accept for v1 (levels are frozen). Fix the copy. Rebalance by appending levels later. |
| D12 | **Share image card** needs `@capacitor/filesystem` (new dependency) | Text-only share for v1; image card as fast-follow. |
| D13 | **Pin WebView text zoom to 100%** (BUG-13) — native tweak or `@capacitor/text-zoom` | Decide after the device test at the largest system font. |

---

## 5. Findings

Severity: Blocker / High / Medium / Low. Effort: S < 1 h, M < 1 day, L longer. "Headless" means reproduced in headless Chromium against the production build.

### 5.1 Unfinished work

**UNF-01 · Blocker · Confirmed (headless clipboard)** — Share text ships the old name and a foreign domain
- Where: `src/game/domain/shareGrid.ts:15,21`; `src/ui/components/WinScreen.tsx:38-41,67`
- Problem: `WinScreen` never passes `titlePrefix` or `url`, so the shared text is `Grid L1 · ★★★ 1/5 … grid.game/L1`.
- Impact: Your only growth hook sends every recipient to a domain you do not own, under the wrong name.
- Fix: `Sumline #N` and the Play Store URL (`…/details?id=com.narnarigames.sumline`). Update the unit test.
- Effort S · before launch

**UNF-02 · Blocker · Confirmed** — Home button reads "PARENTS · STATS"
- Where: `src/ui/components/HomeScreen.tsx:154`
- Problem: Leftover from a kids-oriented design.
- Impact: With a cartoon mascot it signals a children's app to Play reviewers (REL-07). Confusing to everyone else.
- Fix: "STATS".
- Effort S · before launch

**UNF-03 · High · Confirmed (headless)** — The "daily puzzle" is a prototype
- Where: `HomeScreen.tsx:33-41,67-68,203,443-517`; `Splash.tsx:63`
- Problem: "Today's puzzle" is ladder level `UTC yyyymmdd % 63`. It opens locked sets (a brand-new player got **Level 59, Intermediate 5.3**). It shows "✓ Come back tomorrow" if you ever beat that ladder level. "Ends at midnight" is UTC midnight. Your own `docs/store/checklist.md` says not to claim daily puzzles.
- Impact: A new player's most inviting card drops them into a mid-tier puzzle; the claim is false advertising in the listing.
- Fix: Hide the card and change both taglines (D2). Real daily after launch.
- Effort S · before launch

**UNF-04 · Blocker · Confirmed** — No privacy policy link in the app
- Where: `src/ui/components/SettingsModal.tsx:137-159` (headless: Settings contains 0 links)
- Problem: Play requires the policy in the listing **and** in the app for apps using the advertising ID. The URL does not exist yet either.
- Fix: Settings rows "Privacy policy" and "Contact support" opening the system browser / mail.
- Effort S (plus your URL) · before launch

**UNF-05 · Blocker · Confirmed** — Default Capacitor icon and splash
- Where: `assets/` holds only a README; `android/app/src/main/res/mipmap-*`, `drawable/splash.png` are template files
- Fix: Your art, then `npm run gen:assets`. Also set a monochrome notification icon (REL-10).
- Effort S after art exists · before launch

**UNF-06 · Blocker · Confirmed** — Ads, analytics, crash reporting and signing are not configured in any build
- Where: no `.env`; `native-config/android/` has only `.gitkeep`; generated `android/app/build.gradle` has no `signingConfig` and no Crashlytics plugin
- Fix: Owner inputs in §3, then MON-01 and REL-02 make the build refuse to proceed without them.
- Effort M · before launch

**UNF-07 · Medium · Confirmed** — Home shows tiers as "locked" that are not locked
- Where: `HomeScreen.tsx:614-619,682,701`
- Problem: Untouched tiers show a door icon and "locked", but tapping opens them. Home calls tiers Pond/Stream/River; every other screen says Beginner/Intermediate/Advanced.
- Fix: Show `★ 0/105` instead of "locked"; pick one naming scheme.
- Effort S · before launch

**UNF-08 · Low · Confirmed** — Four hard-coded version strings
- Where: `Splash.tsx:69` ("v 0.1"), `SettingsModal.tsx:16`, `src/platform/review.ts:11`, `package.json`; native says `1.0`
- Fix: One Vite `define` from `package.json`; drop the splash version.
- Effort S · before launch

**UNF-09 · Low · Confirmed in code** — "Privacy & ad choices" does nothing outside the EEA
- Where: `SettingsModal.tsx:148-159`; `src/platform/consent.ts:60-67`
- Problem: UMP rejects the form when not required; the error is swallowed.
- Fix: Show the row only when `privacyOptionsRequirementStatus === 'REQUIRED'` (the plugin already returns it).
- Effort S · before launch

**UNF-10 · Low · Confirmed (headless)** — Stats shows 8 guess-distribution rows; the largest budget is 5
- Where: `src/game/domain/types.ts:6`; `StatsModal.tsx:113`
- Effort S · before launch

**UNF-11 · Low · Confirmed** — Prototype leftovers
- Unused components `HeroCounter`, `HistoryStrip`, `ShareGridPreview`, `StreakMilestone`; an unused `.dark` theme; the 7 authored teaching hints in `levels.json` are never shown (`LevelGameView.tsx:201-208` overrides them); `streakAdvanced` is never fired; an e2e test asserts on copy that no longer exists (`tests/e2e/submit.spec.ts:216`, so it can never fail); `test-results/.last-run.json` is committed.
- Effort M · after launch

**UNF-12 · Low · Confirmed** — No end state after level 210
- Where: `HomeScreen.tsx:26-31` (PLAY replays level 210 forever)
- Effort S · after launch

### 5.2 Bugs and stability

**BUG-01 · Blocker · Confirmed in code, needs a device** — Android back exits the app from every screen
- Where: `src/platform/native.ts:44-47`
- Problem: The handler calls `history.back()` only if the WebView can go back. Navigation is React state; nothing ever pushes history, so it always calls `exitApp()`. The in-progress attempt is not persisted, so it is lost.
- Impact: Back inside a level, a modal or the tier list kills the app. This will be the first one-star review theme.
- Fix: One back handler in `App.tsx`: close modal → level to tier → tier to home → home exits.
- Effort S–M · before launch

**BUG-02 · High · Confirmed (headless: 4 → 2 guesses left)** — Double-tap on Submit burns two guesses
- Where: `src/ui/hooks/useGameState.ts:98-101`; `SubmitButton.tsx:39-45`
- Problem: No lockout after a submit. It only "works" on the first guess because the button jumps 116 px (UX-09).
- Impact: On a 3-guess Expert level one fat-finger is a lost level.
- Fix: Ignore submits for ~600 ms after one (the wrong-mark flash lasts 520 ms).
- Effort S · before launch

**BUG-03 · High · Confirmed in code** — Win-screen countdown keeps running after "Next", behind the share sheet, and in the background
- Where: `WinScreen.tsx:50-64,146-150`; `src/ui/App.tsx:118-128`
- Problem: The interval is wall-clock based and never stops once Next is tapped. `handleAdvanceLevel` awaits the interstitial before navigating, so the timer (or a second tap) re-enters it: double cadence counting and a second `showInterstitial` while one is on screen. Capacitor does not pause WebView timers, so it also fires behind the share sheet.
- Impact: Level changes under the share sheet; duplicate ad calls; see MON-02.
- Fix: One-shot "advancing" guard that disables the button and stops the timer. Or remove auto-advance (D4).
- Effort S · before launch

**BUG-04 · High · Confirmed in code** — Streak and "today" use UTC dates
- Where: `src/game/domain/stats.ts:58-63`; `useStats.ts:31,39`; `src/platform/notifications.ts:58`
- Problem: The day rolls over at UTC midnight, which is 4–7 pm in the Americas. Mon 5 pm, Tue 3 pm, Wed 5 pm Pacific is three local days but UTC sees Tue, Tue, Thu: streak resets to 1.
- Impact: US evening players lose streaks they kept. You will not see it in UTC+4.
- Fix: Local-date key. Same string format, no migration (D9).
- Effort S · before launch

**BUG-05 · Medium · Confirmed (headless)** — "Next" walks into locked sets
- Where: `LevelGameView.tsx:124-132`; `App.tsx:114-128`; `isLevelAccessible` (`levels.ts:141`) is never called
- Problem: Won Level 7 first, tapped Next, landed in Level 8 while the tier screen still shows Set 2 locked. From there the whole tier chains open.
- Fix: If the next level is not accessible, return to the tier screen (D6).
- Effort S · before launch

**BUG-06 · Medium · Confirmed (fuzz)** — A hint can push marks over the cap; that guess cannot win
- Where: `src/game/domain/game-state.ts:143-169`; `SubmitButton.tsx:11-15`
- Problem: With all N marks placed, a hint that reveals an unmarked filled cell gives N+1 ("19 of 18 marked"). Fuzz: 54 such states across 24 levels, and one loss with the whole board already solved on screen.
- Impact: Watch an ad, then lose a guess because of it.
- Fix: Block Submit while over the cap with "Remove 1 mark" (D7).
- Effort S · before launch

**BUG-07 · Medium · Confirmed in code (reducer no-op reproduced by fuzz)** — A rewarded hint can reveal nothing
- Where: `HintButton.tsx:19-34`
- Problem: The hint cell is computed from the state captured at tap time, and the board stays interactive while the ad loads. Submit in between and the ad pays out a cell that is already locked.
- Fix: Compute at grant time from current state; block input while pending.
- Effort S · before launch

**BUG-08 · Medium · Confirmed (headless)** — Scroll position carries over between screens
- Where: `App.tsx` view switch
- Problem: On 360×640 the Home screen needs scrolling to reach the tier pins; the tier screen then opens 156 px down with its header off-screen.
- Fix: `window.scrollTo(0, 0)` on view change.
- Effort S · before launch

**BUG-09 · Medium · Confirmed in code** — "Next" can hang on an ad
- Where: `src/storage/ads.ts:126-133,203-239`; `App.tsx:118-127`
- Problem: If the interstitial is not preloaded, `showInterstitial` awaits a network load before showing, with the button looking dead. The show promise has no timeout, and navigation waits on it.
- Impact: Seconds of dead UI on slow networks; a stuck win screen if a dismiss event is ever dropped.
- Fix: Show only if already loaded; watchdog; navigate regardless.
- Effort S · before launch

**BUG-10 · Low · Confirmed (headless)** — Stats load does not validate field types
- Where: `src/storage/persistence.ts:131-147`
- Problem: Garbage JSON is handled, but valid JSON with wrong types renders "NaN streak" and "x levels". `loadProgress` validates properly; `loadStats` does not.
- Fix: Per-field validation. No format change.
- Effort S · before launch

**BUG-11 · Low · Confirmed in plugin source** — `Preferences: { group: 'sumline' }` is a no-op and a trap
- Where: `capacitor.config.ts:36-38`
- Problem: The plugin only honours `Preferences.configure()` at runtime; saves live in the default `CapacitorStorage` group. If someone later "fixes" this, every existing save disappears.
- Fix: Delete the config entry and leave a comment.
- Effort S · before launch

**BUG-12 · Medium · Suspected, needs a device** — Keep-awake is held for the whole level screen
- Where: `LevelGameView.tsx:53`; `src/ui/hooks/useKeepAwake.ts`
- Problem: Includes win and lose screens, with Phaser rendering at full rate (PERF-01). A phone put down mid-level never sleeps.
- Fix: Release after ~2 minutes without input, or drop it. This is a turn-based puzzle.
- Effort S · before launch

**BUG-13 · Medium · Suspected, needs a device** — System font size will scale DOM text but not the layout or the board
- Problem: Android WebView applies the system font scale to text; Capacitor does not pin it. Fixed-height pills, the 96 px PLAY button and 8–11 px labels grow while the canvas clues do not.
- Test: Settings → Display → Font size → largest, then walk every screen.
- Fix: Pin text zoom to 100% (D13).
- Effort S · before launch if the test looks bad

**BUG-14 · Low · Suspected, needs a tablet** — Portrait lock is runtime-only and ignored on large screens
- Where: `native.ts:31-35`; no `screenOrientation` in the manifest
- Problem: At `targetSdk` 36, Android 16 ignores orientation locks on ≥600 dp screens. Layout is a phone column (on 800×1280 the Submit button is 768 px wide under a 448 px board).
- Effort S to test · after launch unless it looks broken

**Verified fine:** corrupted saves fall back cleanly; WebGL context loss and restore redraws the board (headless; Phaser logs "Context restored"); Phaser sleeps on `visibilitychange`; saves use Capacitor Preferences with a one-time localStorage migration; global `error` and `unhandledrejection` handlers exist; multi-touch and rapid cell taps do not corrupt state; pinch zoom is off by default in Capacitor.

### 5.3 Level integrity (script results in §6)

**LVL-01 · High · Confirmed (script)** — Difficulty is a cliff, then flat
- Where: `public/levels.json`; `src/game/domain/difficulty.ts:44-50`; `scripts/build-levels-worker-impl.ts:105-116`
- Problem: Levels 1–63 have 2–15 grids consistent with their clues. Level 64 onward has **24,000–190,000**. The intended bands for Advanced/Expert/Master (12–28, 25–60, 50–120) are impossible once all sums are forced into 2–4, so the bake silently fell back to unfiltered random grids. Advanced, Expert and Master are statistically the same puzzle; Expert and Master also have identical rules (`tiers.ts:41-58`).
- Impact: A wall at level 64, then 147 levels with no progression.
- Fix: Levels are frozen, so accept for v1 and rebalance by appending levels (D11).
- Effort L · after launch

**LVL-02 · Medium · Confirmed (script)** — Tutorial level 7 is an Advanced-class puzzle
- Problem: 70,287 solutions from its sums (3,386 after the pre-solved row). Levels 1–6 and 8–63 have 2–15. Even perfect play gets 3★ there only 51% of the time.
- Fix: Cannot change the level. Give it its own hint copy; consider pre-solving a second row for it.
- Effort S · before launch

**LVL-03 · Medium · Confirmed (script)** — In tiers 3–5, three stars is mostly luck
- Problem: A perfect solver makes ≤2 guesses on only ~45% of levels 64–210 (10–90% per level). "Solved in 1" is 1 in 25,000+. The docs' claim that 3★ means "the mathematical minimum of 2 guesses" belongs to the old rules.
- Impact: Skilled players cannot earn 3★ reliably.
- Fix: Scoring change (e.g. 3★ ≤3 where the budget is 4), your call (D11). At minimum fix the docs.
- Effort S · decision, then before or after launch

**LVL-04 · High · Confirmed (headless)** — Losing is the best hint in the game
- Where: `src/game/scenes/GridScene.ts:259-261`; `RetryGate.tsx:52-54`
- Problem: A loss reveals the full solution, the retry is the same puzzle, and retries keep full star eligibility. I lost on purpose, tapped "Try again FREE", entered the answer: "Solved in 1." ★★★.
- Impact: Stars mean nothing; any future leaderboard is dead on arrival; the retry ad sells nothing.
- Fix: D3.
- Effort S–M · before launch if you agree

**LVL-05 · Low** — No level-integrity check in the repo
- Fix: Add my script as `npm run check:levels` and call it from `doctor`.
- Effort S · before launch

### 5.4 Performance

**PERF-01 · High · Measured headless, confirm on a device** — The level screen never idles
- Where: `src/game/main.ts:7-22`; `GridScene.ts` (36 Graphics re-tessellated each frame); `PhaserGame.tsx:45-57`
- Problem: Phaser steps ~120 times a second to redraw a static board: 0.74 ms per frame unthrottled, **4.2 ms at 6× CPU throttle, main thread 99–100% busy**. Hiding the beaver overlay changes nothing; the cost is the loop. Home idles at 4–8%.
- Impact: Heat and battery on low-end phones during a thinking game, made worse by keep-awake.
- Fix: `fps: { limit: 60 }`, and sleep the loop ~1.5 s after the last state change, waking on pointer-down and state updates.
- Effort S–M · before launch

**PERF-02 · Medium · Confirmed (headless)** — The board renders at 500×520 on every screen
- Where: `main.ts`; `src/game/rendering/tokens.ts:43-52`
- Problem: On a 360 dp, DPR 3 phone the canvas is stretched 2×. Clue numbers (14.8 CSS px, the most important text in the game) are visibly soft next to the DOM text.
- Fix: Render at 2× with camera zoom and Text resolution.
- Effort M · before launch if the device looks soft

**PERF-03 · Medium · Measured headless** — A new Phaser game and WebGL context per level
- Where: `App.tsx:207` (`key`); `PhaserGame.tsx:18-28`
- Problem: Every level change shows a blank board for 174 ms (461 ms at 6×). First PLAY takes 0.7–1.0 s including parsing 1.35 MB of Phaser. 30 open/close cycles: heap flat (7.4 → 7.6 MB), no context exhaustion, one event listener leaked per cycle.
- Fix now: Prefetch the level chunk while Home is idle (S). Later: keep one game alive (M).
- Before launch (prefetch) · after launch (rest)

**PERF-04 · Low · Confirmed** — Bundle weight
- 1.35 MB of Phaser draws 36 rounded rectangles; 72 font files include `.woff` duplicates and Cyrillic/Vietnamese subsets for an English-only app; `levels.json` ships twice.
- Effort S (fonts) / L (drop Phaser) · after launch

### 5.5 Code quality

**CODE-01 · Medium** — Tests cover the part that works
- The domain layer is pure and well tested. Every Blocker in this report is in `storage/`, `platform/` or `ui/`, which have no tests.
- Effort M · after launch (add tests alongside each batch-1 fix where cheap)

**CODE-02 · Medium · Confirmed** — e2e silently tests whatever is on port 8080
- Where: `playwright.config.ts:12,17-20`
- Fix: Dedicated port with `--strictPort`, no server reuse.
- Effort S · before launch

**CODE-03 · Low** — Side effects inside React state updaters (`useProgress.ts:31-46`, `useRetry.ts:46-76`, `useStats.ts:29-43`, `App.tsx:101-108`). Harmless in production, double-fires in dev. After launch.

**CODE-04 · Low** — Magic numbers: `level.id < 7` in two files; grid geometry duplicated in `tokens.ts`, `BeaverOverlay.tsx` and tests. After launch.

**CODE-05 · Low** — Docs drift: `CLAUDE.md` and `README.md` describe rules and guarantees the game no longer has. S, before launch (you will hand these to reviewers and to me).

### 5.6 Game feel and UX

**UX-01 · Blocker · Confirmed (headless, simulated 60 px banner; real size needs a device)** — The banner covers interactive UI
- Where: `src/styles/globals.css:6-8` (only `min-height` is reduced); `RulesModal.tsx:50-58,96-113`; `LevelGameView.tsx:244-258`; `StatsModal.tsx:33-39`; `TierView.tsx:40`
- Problem, measured:
  - **Tutorial "Next" / "Got it": 36 of 44 px under the banner on every phone size.** The tutorial is `fixed inset-0` and ignores the banner.
  - **Hint button**: 32 of 36 px under the banner on 360×640 always, and on 360×800 during levels 1–7 after the first guess; it cannot be scrolled clear. On 360×640 Submit also starts under the banner until you scroll. On Android 15+ (edge-to-edge) the gap between Hint and the banner is 0–4 px on every phone.
  - **Home tier pins** "Stream" and "Waterfall" are cut by the banner on any screen shorter than ~856 dp, which is most phones.
  - Win-screen text links sit 19 px above the banner (0 px on Android 15+). Stats and tier lists end underneath it.
- Impact: The first thing a new player taps may be an ad. That is invalid traffic and a broken first minute.
- Fix: Reserve `banner + safe-area-bottom` once at the root (padding on `#root`, `bottom` offset on fixed overlays) with at least 16–24 px clear above the ad. No banner while the tutorial is open (D5). Note for the fix: the JS wrapper's hide → show path leaves the native view hidden; it must call `resumeBanner`.
- Effort M · before launch

**UX-02 · High · Confirmed in code (safe-area emulation)** — Tier screen ignores the status bar
- Where: `TierView.tsx:40-49`
- Problem: Edge-to-edge is mandatory at `targetSdk` 36 and Capacitor 8 hands insets to CSS. Home and Level pad for them; the tier screen does not, so the 17 dp "← Tiers" link sits inside the status bar.
- Fix: Covered by the root reserve in UX-01, for top as well.
- Effort S · before launch

**UX-03 · High · Confirmed (headless)** — The serif typeface never renders
- Where: `tailwind.config.ts:55`
- Problem: Tailwind emits `font-family: Fraunces,Source Serif 4,Georgia,serif`. The unquoted `4` makes the declaration invalid and the browser drops it (`CSS.supports` is false; the parsed rule is empty). All 30 `font-serif` usages (wordmark, PLAY, level titles, counters, "Solved in N.") render in Geist. Fraunces appears only in the canvas clue numbers, and loads late there.
- Impact: The app you have been looking at is not the designed one, and the board's font does not match the rest.
- Fix: D1. Quoting the name is one line but restyles every screen.
- Effort S + a visual pass · before launch

**UX-04 · High · Confirmed (screenshot)** — The Home wordmark is broken
- Where: `HomeScreen.tsx:170-201`
- Problem: The hand-built "i" has a zero-height wrapper, so its square tile hangs below the baseline and the stem fuses with the "l". It reads "Sumllne" with a blob. The splash uses a correct `Wordmark` component.
- Fix: Reuse `<Wordmark>`.
- Effort S · before launch (it will be in your store screenshots)

**UX-05 · Medium · Confirmed (screenshot)** — "Lake" tier pin is clipped on 360 dp-wide phones
- Where: `HomeScreen.tsx:573,656`
- Effort S · before launch

**UX-06 · Medium · Confirmed (screenshot)** — Every marked cell has a stray grey strip above its top edge
- Where: `GridScene.ts:299-302,309-312`
- Problem: A 4 px-tall highlight drawn with corner radius 6.
- Fix: Clamp the radius or use a plain rect.
- Effort S · before launch

**UX-07 · High · Confirmed (headless measurements)** — Touch targets under 48 dp
- Problem: Cells are 39 dp on a 360 dp phone (34 at 320, 45 at 412) and the hit area equals the visual, with 8 px dead gaps (`GridScene.ts:62-72`). "← Tiers" is 63×17. Tutorial "Skip" 42×20 and "← Back" 44×15. Win-screen links 84×20. Stats pill 124×25. Header buttons 40×40.
- Fix: Extend cell hit zones to the full 66 px pitch (44 dp at 360); pad text links to 44–48 dp. Larger cells need a layout change: the grid uses only 78% of the canvas width.
- Effort S · before launch

**UX-08 · High · Confirmed (headless)** — The win moment is rushed and partly hidden
- Where: `WinScreen.tsx:18,91,137-186`
- Problem: Auto-advance fires after 4.5 s. On 360×640 the share card is below the fold, behind the fixed footer. "Cancel auto-advance" is a 13 px link.
- Impact: The moment people would share is the moment the game leaves.
- Fix: D4, and bring Share into the fixed footer.
- Effort S · before launch

**UX-09 · Medium · Confirmed (headless)** — Submit jumps 116 px after the first guess, and there is no guard on under-filled guesses
- Where: `LevelGameView.tsx:240-242`
- Problem: The "last guess" card is inserted above the button. A guess with fewer marks than the cap can never win and never tells you more than a full one.
- Fix: Reserve the card's slot; confirm when short (D7).
- Effort S–M · before launch

**UX-10 · Medium** — First-time experience is three pages of text, then one generic hint
- Where: `RulesModal.tsx:18-37`; `LevelGameView.tsx:201-208`; `Splash.tsx:12`
- Problem: Launch to first cell tap is a fixed 1.4 s splash, PLAY, then three "Next" taps. The seven authored per-level hints are never shown.
- Fix now: Shorten the splash to ~0.9 s and show the baked hints (S). Later: make level 1 the tutorial.
- Before launch (cheap part) · after launch (rest)

**UX-11 · Medium** — No drag-to-mark; a guess is 14–22 separate taps. M · after launch.

**UX-12 · Low** — WebView polish: no `-webkit-tap-highlight-color` reset (Android flashes a grey box on every button); tier screen and modals allow long-press text selection; haptics are tied to the Sound toggle (`App.tsx:76-80`), so muted players lose them. S · before launch.

**Verified fine:** audio unlocks on first tap; mute persists; every cell state has a glyph as well as a colour; `prefers-reduced-motion` is honoured; overscroll is disabled.

### 5.7 Sharing and retention (proposals, need your approval)

**SHARE-01** — Fix the share payload (UNF-01), then an image card: draw level, stars and guess blocks on an offscreen canvas and share the PNG. Needs `@capacitor/filesystem` (D12). M · fast-follow.

**SHARE-02** — The in-app review prompt already exists and follows the rules (3★ win, level ≥ 10, session ≥ 3, once per version; `src/game/domain/reviewPolicy.ts`). Two fixes: never on the same tap as an interstitial (MON-08), and single-source the version. S · before launch.

**SHARE-03** — Dev-only capture mode for TikTok/Reels: `?capture=1` behind `import.meta.env.DEV` hides chrome and banner reserve, frames the board 9:16 on clean paper, and can auto-play a solution through the existing dev hook (`src/testHook.ts`, already stripped from production: verified absent from `dist/`). S–M · before launch if you want footage for launch day.

**After launch:** a real daily puzzle with its own set and local-date streak; share deep links to `/L{n}` on the web build; streak milestones (component already written); per-level leaderboards, only after LVL-04 is fixed.

### 5.8 Monetization

**MON-01 · Blocker · Confirmed in code** — A release build can ship test ads, or crash on launch, with no warning
- Where: `src/config/env.ts:28-35`; `ads.ts:80,246`; `scripts/doctor.ts:75-79`; `scripts/patch-native.ts:59-63,95-97`
- Problem: Missing unit IDs fall back to Google's test units in production. The error report is lost because it fires before the crash reporter is installed. `doctor` only warns. Separately, the AdMob app ID is not in the manifest today and the plugin does not supply one: the Google Mobile Ads SDK crashes the app at startup without it. `patch-native` only warns, and never updates an ID that is already there.
- Fix: Fail `cap:sync` and `doctor` when any production ID or the manifest entry is missing; make the patch replace values.
- Effort S · before launch

**MON-02 · Blocker · Confirmed in code** — Interstitials can appear without a tap
- Where: `WinScreen.tsx:50-64` → `App.tsx:118-127`
- Problem: The auto-advance timer calls the same path as the Next button, which may show an interstitial. It also fires on return from the share sheet, and can fire after the app is backgrounded because the timer is wall-clock based and nothing checks visibility.
- Impact: "Unexpected" and out-of-app interstitials violate AdMob and Play's disruptive-ads policies.
- Fix: Interstitial only from an explicit tap, only while the page is visible, never from a timer.
- Effort S · before launch

**MON-03 · High · Confirmed in code** — No test-ads mode for device builds
- Where: `env.ts:22,59-61`
- Problem: Test IDs are used only under the Vite dev server. Every device build uses live units once `.env` exists, so you will be viewing and tapping your own live ads while testing.
- Fix: `VITE_ADS_MODE=test|live` (or a staging mode), and register your devices in AdMob.
- Effort S · before launch

**MON-04 · High · Confirmed in code, needs a device** — Ads are requested even when consent says not yet
- Where: `consent.ts:27-50`; `src/main.tsx:53-55`; `ads.ts:90-103`
- Problem: `canRequestAds` is read but not enforced: the SDK initialises, preloads and shows the banner regardless (an EEA user offline at first launch, for example). `analyticsGranted` is hard-coded `true`.
- Fix: Gate init, preload and banner on `canRequestAds`; retry on next launch or resume. Test with UMP debug geography.
- Effort S–M · before launch

**MON-05 · High · Confirmed (headless)** — The retry ad is optional in the wrong way
- Where: `LevelGameView.tsx:51`; `useGameState.ts:44-55`; `RetryGate.tsx:83-89`
- Problem: After two losses the gate says "Watch ad · retry". "Back to levels" and reopening gives a fresh 5/5 attempt for free.
- Fix: D3.
- Effort S–M · before launch if you agree

**MON-06 · Medium · Confirmed in plugin source** — The banner never comes back after one failed load
- Where: `ads.ts:135-155`
- Problem: The plugin destroys the view on a failed load or refresh. The wrapper keeps `bannerShown = true` and does not listen for the failure.
- Impact: Launch offline, or hit one bad refresh, and there is no banner for the rest of the session.
- Fix: Listen for `FailedToLoad`, retry with backoff and on resume.
- Effort S · before launch

**MON-07 · Medium · Confirmed in code** — Rewarded-ad failures are silent
- Where: `RetryGate.tsx:29-37`; `HintButton.tsx:23-25`; `ads.ts:77,117-124,195-201`
- Problem: Offline, no fill, or an ad older than an hour: the button flips back with no message. Preloading gives up after five tries (~165 s), so a session that started offline never preloads again.
- Fix: Say "No ad available right now"; reload and retry once; preload again on resume.
- Effort S · before launch

**MON-08 · Medium · Confirmed in code** — Review prompt and interstitial can fire on the same tap
- Where: `LevelGameView.tsx:125-131`
- Fix: Skip the interstitial when a review was requested.
- Effort S · before launch

**MON-09 · Low** — A hint reveals one cell for a full video. Low opt-in likely. A whole row or column would be worth watching. Balance, your call. After launch.

**MON-10 · Medium · Confirmed** — The public web build is the full game with ads that always grant
- Where: `.github/workflows/deploy.yml`; `ads.ts:37-75,242-244`
- Fix: D10.
- Effort S · before launch

**Verified fine:** nothing ad-related blocks startup (the UI renders before `boot()` finishes); no interstitials in session 1 or mid-level; cadence (every 3 completions, 90 s) is pure and tested.

### 5.9 Google Play release readiness

**REL-01 · Blocker · Confirmed** — No native build exists or can be made here
- See §0. Fix: install the toolchain, `npm run cap:sync`, run on a phone.
- Effort M · before launch

**REL-02 · High · Confirmed** — `android/` is gitignored while release-critical edits are manual
- Where: `.gitignore:31-34`; `docs/native-checklist.md`
- Problem: Signing config, `versionCode`, and the Crashlytics and google-services Gradle lines exist only in a folder that is regenerated. The current generated file has `versionCode 1`, `versionName "1.0"`, no signing and no Crashlytics plugin. With `google-services.json` present but that plugin missing, Crashlytics is known to throw at startup (verify on the first build).
- Fix: Commit `android/` (D8).
- Effort M · before launch

**REL-03 · High · Confirmed** — Source maps ship inside the app
- Where: `vite.config.ts:33`
- Problem: 17 `.map` files, 12.5 MB, containing the full TypeScript source. They are already in `android/app/src/main/assets/public/assets`.
- Fix: No maps in the native bundle; keep them outside `dist/` for decoding crash stacks.
- Effort S · before launch

**REL-04 · Medium · Confirmed in code** — JS errors reach Crashlytics without a stack
- Where: `src/telemetry/firebaseCrash.ts:15-24`
- Problem: Only the message is sent, so every JS error groups into one issue with no location.
- Fix: Pass parsed stack frames (the plugin accepts them).
- Effort S · before launch

**REL-05 · Medium · Confirmed in code** — The analytics funnel cannot be built from these events
- Where: `src/telemetry/events.ts:10-12,34-40`
- Problem: `session_start` is a reserved Firebase name, so the custom event is dropped. The custom `ad_impression` collides with AdMob's automatic one and counts failures and dismissals as impressions. There are no tutorial events. `level` is 0-based while the UI is 1-based.
- Fix: Rename (`session_begin`, `ad_result`), add `tutorial_begin` / `tutorial_complete` and `level_1/5/10_complete`, send 1-based levels. Day-1 return comes free from Firebase retention.
- Effort S · before launch (history cannot be backfilled)

**REL-06 · Medium** — Families-policy exposure
- Problem: A cartoon mascot, "PARENTS", and "Tap to unwrap" read as a kids' app. If Play decides it appeals to children, the Families policy applies to your ads. `maxAdContentRating` is not set (`ads.ts:93-97`).
- Fix: UNF-02; declare a 13+ audience and answer the "appeals to children" question carefully; set a content-rating cap.
- Effort S · before launch

**REL-07 · Medium** — `docs/store/data-safety.md` is incomplete. Corrected facts in §7.

**REL-08 · Low · Suspected, needs a device** — System bars in dark mode
- Problem: Capacitor's SystemBars picks icon colour from the system theme; only the status bar is forced to dark icons. In system dark mode the navigation icons (and, after a configuration change, the status icons) can be white on the paper background.
- Fix: `plugins.SystemBars.style: 'LIGHT'`.
- Effort S · before launch

**REL-09 · Low** — Web/PWA only: `public/manifest.webmanifest` points at three PNG icons that do not exist; root-absolute paths in `index.html` break on a GitHub Pages subpath. S · after launch.

**REL-10 · Low** — No notification icon configured for local reminders (reminders are opt-in via Settings only). S · before launch.

**Verified fine or expected fine:** `targetSdk` 36 meets the current Play requirement as far as I know (the Console will confirm at upload). No native `.so` libraries are expected in the bundle, so 16 KB page size should be a non-issue; confirm with the Play pre-launch report. `webContentsDebuggingEnabled` is false. Merged permissions are minimal (internet, network state, notifications, boot, wake lock, vibrate, ad ID). Fonts are bundled, no CDN. App code does not log to the console in production. `minifyEnabled false` is the safer choice for v1. `allowBackup` is on, so Android should restore progress on reinstall: test it.

### 5.10 Security

**SEC-01 · Info** — No secrets in the bundle. AdMob and Firebase IDs are public by design; `.env` is gitignored.

**SEC-02 · Low** — Progress, stars and banked retries are plain local data, and all 210 solutions are plaintext in the bundle (and again as a static `levels.json`). Irrelevant today; it matters the day you add leaderboards or purchases. After launch.

**SEC-03** — See REL-03 (source maps expose the full source).

---

## 6. Level audit results

Script: enumerates every grid consistent with each level's clues, checks structure and duplicates, fuzzes the reducer, and simulates a near-optimal player under the real rules (only marked cells are judged).

| Tier | Levels | Budget | Grids consistent with the clues (min / median / max) | Perfect player: ≤2 guesses | Perfect player: wins in budget |
|---|---|---|---|---|---|
| Beginner | 28 | 5 | 4 / 6 / 70,287 | 98% | 100% |
| Intermediate | 35 | 4 | 6 / 14 / 15 | 100% | 100% |
| Advanced | 42 | 4 | 25,018 / 70,287 / 116,640 | 43% | 100% |
| Expert | 49 | 3 | 25,018 / 48,279 / 183,420 | 46% | 100% (min 97%) |
| Master | 56 | 3 | 23,952 / 60,246 / 190,000 | 45% | 99% (min 95%) |

- **Solvable:** yes, all 210. No level is unwinnable; the worst case for perfect play is 95%.
- **Structure:** 0 problems (sums, counts, ids, tier rules, sum filters all consistent).
- **Duplicates:** none, including rotations, reflections and identical clue sets.
- **Hints / restart:** hints alone always finish the board; restart always returns the identical state; 0 invariant failures in 8,400 random playouts. Edge cases found: BUG-06 and BUG-07.
- **Difficulty curve:** not a curve. See LVL-01 to LVL-03.

Real players cannot enumerate 60,000 grids, so their numbers will be well below the "perfect player" columns.

---

## 7. Data Safety form facts

| Data type | Collected | Shared | By | Purpose |
|---|---|---|---|---|
| Device or other IDs (advertising ID, app instance ID, install ID) | Yes | Yes (ads) | AdMob, Firebase | Advertising, analytics, fraud prevention |
| Approximate location (derived from IP) | Yes | Yes (ads) | AdMob | Advertising. **Missing from your doc.** |
| App interactions (levels, sessions, ad events) | Yes | Yes (ads) | Firebase Analytics, AdMob | Analytics, advertising |
| Crash logs | Yes | No | Crashlytics | App functionality |
| Diagnostics / performance | Yes | Yes (ads) | Crashlytics, AdMob | Analytics, advertising |

No accounts, no name/email/contacts/precise location/purchases. Encrypted in transit. Not all collection is optional (ads and analytics run by default). Game progress stays on the device (plus Android's own backup). You need a live privacy policy URL and a support contact; both are placeholders today.

---

## 8. The plan

**Batch 1 — blockers** (one commit per ID, on a new branch; build, typecheck, lint and tests after the batch)
1. UX-01 + UX-02: root reserve for banner and safe areas; no banner on the tutorial
2. MON-02 + BUG-03 + UX-08: remove auto-advance (D4), single-shot Next, interstitial only on a visible tap
3. BUG-01: Android back handler
4. UNF-01, UNF-02, UNF-03 (D2), UNF-04 (needs your URL)
5. MON-01, MON-03: build guards and ads mode
6. MON-04: consent gating
7. REL-03: source maps out of the app
8. BUG-02: Submit lockout
9. REL-05: analytics names, before the first real user
10. REL-02 (D8), then REL-01: first device build. Everything marked "needs a device" gets tested here.

**Batch 2 — low-risk, high-value polish**
- Visual: UX-04, UX-05, UX-06, UX-07, UX-03 (after D1), UNF-07, UNF-08, UNF-10, UX-12
- Fairness: BUG-04 (D9), BUG-05 (D6), BUG-06 and UX-09 (D7), BUG-07, LVL-04 + MON-05 (D3), LVL-02
- Ads hygiene: BUG-09, MON-06, MON-07, MON-08, UNF-09
- Performance: PERF-01, PERF-03 prefetch, PERF-02 if the device shows blur
- Housekeeping: BUG-08, BUG-10, BUG-11, BUG-12, REL-04, REL-06, REL-08, REL-10, CODE-02, CODE-05, LVL-05, MON-10 (D10)
- Optional: SHARE-03 capture mode, UX-10 cheap part

**After launch**
- Rebalance by appending levels 211+ (LVL-01, LVL-03); real daily puzzle; share image card and deep links; Remove Ads IAP
- One Phaser instance or no Phaser (PERF-03, PERF-04); drag-to-mark (UX-11); interactive tutorial (UX-10)
- Tests for storage, ads and consent (CODE-01); dead-code removal (UNF-11); end-of-game state (UNF-12); R8

---

## 9. Evidence

Kept outside the repo, in this session's scratchpad:

- Level audit: `/private/tmp/claude-501/-Users-gsiradze-Documents-projects-games-sumline/6881c098-47f5-43bf-affe-3e382e40801e/scratchpad/level-audit.ts` (results in `level-audit.json` beside it)
- Browser audit: `/private/tmp/claude-501/-Users-gsiradze-Documents-projects-games-sumline/6881c098-47f5-43bf-affe-3e382e40801e/scratchpad/browser-audit.cjs` (results in `browser-audit-layout.json`, `browser-audit-probes.json`, `browser-audit-perf.json`, `browser-audit-double.json`)
- Screenshots: `/private/tmp/claude-501/-Users-gsiradze-Documents-projects-games-sumline/6881c098-47f5-43bf-affe-3e382e40801e/scratchpad/shots/` — start with `360x800-03-rules-intro-banner.png`, `360x800-06-level-after-guess-banner-bottom.png`, `360x800-02-home-banner-scrolled-bottom.png`, `crop-home-wordmark.png`, `crop-marked-before.png`, `probe-retry-solved-in-1.png`

The scratchpad is temporary. If you want the scripts kept, say so and I will add them under `scripts/` in Phase 2 (LVL-05).

---

## 10. Phase 2: what was fixed

Everything recommended in section 4 was applied as recommended, plus your two requests. Nothing was committed.

**Verified on this machine after the last change**

| Check | Result |
|---|---|
| Typecheck, lint | Pass, 0 warnings |
| Unit tests | 185/185 (was 141), 95% line coverage of the game logic |
| e2e | 14/14 (was 5), on a dedicated port |
| `npm run check:levels` | 210 levels valid, no duplicates, 8,400 random playouts consistent |
| Production build | Pass. 2.5 MB (was 15 MB), no source maps inside, no dev code inside |
| Headless browser, production build | 154/154 checks on four phone sizes, no console errors |

**Not verified:** anything that needs Android. No JDK or SDK here, so no APK was built. The Gradle edits in `android/` are written but have never been run.

### Your two requests

- **Pre-solved cells now rule out completed lines at the start.** In your screenshot, the column with sum 1 whose only filled cell is in the pre-solved row now starts as dashes. The same rule that runs after a guess now also runs on the starting board. Covered by a unit test on the real level 1 and an e2e test.
- **Personal "ruled out" notes.** A **Mark / Rule out** switch under the board chooses what a tap does; holding a cell pencils a dash in either mode. Notes are plain dashes on a white cell (the game's own ruled-out cells are tinted). They are never judged, never count as marks, are saved with the attempt, and disappear when the cell is decided.

### Findings

| ID | Status | Note |
|---|---|---|
| UNF-01 | Fixed | "Sumline #N", Play Store link. Confirmed from the clipboard. |
| UNF-02 | Fixed | Button reads "STATS". |
| UNF-03 | Fixed | Daily card and both "daily" taglines removed. |
| UNF-04 | Needs your URL | Settings shows "Privacy policy" and "Contact support" once `VITE_PRIVACY_URL` / `VITE_SUPPORT_EMAIL` are in `.env`. A release build is refused without the URL. |
| UNF-05, UNF-06 | Yours | Art, AdMob IDs, Firebase config, keystore. `npm run doctor` lists what is missing. |
| UNF-07 | Fixed | Untouched tiers show stars instead of "locked"; the tier screen shows both names. |
| UNF-08 | Fixed | One version string, from `package.json`. Splash no longer shows a version. |
| UNF-09 | Fixed | "Privacy & ad choices" appears only where the consent platform requires it. |
| UNF-10 | Fixed | 5 rows. |
| UNF-11, UNF-12 | Not done | After launch, as planned. `test-results/` is now gitignored, but `test-results/.last-run.json` is still tracked: `git rm --cached test-results/.last-run.json`. |
| BUG-01 | Fixed, test on device | Back closes an overlay, then goes level → tier → home, then leaves the app. Tested with the Escape key, which uses the same handler. |
| BUG-02 | Fixed | 650 ms lockout after a guess. |
| BUG-03 | Fixed | Auto-advance removed; "Next" works once. |
| BUG-04 | Fixed | Streak days are local days. |
| BUG-05 | Fixed | No "Next" into a locked set; the button becomes "Back to levels". |
| BUG-06 | Fixed | A guess over the mark cap is refused: "Remove 1 mark to submit". |
| BUG-07 | Fixed | The hint cell is chosen when the ad pays out; the board is locked while the ad loads. |
| BUG-08 | Fixed | Every screen opens at the top. |
| BUG-09 | Fixed, test on device | Interstitials show only if already loaded; ad calls time out instead of hanging. |
| BUG-10, BUG-11 | Fixed | |
| BUG-12 | Fixed, test on device | Screen stays on only while a level is in play and touched in the last 2 minutes. |
| BUG-13, BUG-14 | Open | Need the device tests in section 11 first. |
| LVL-01, LVL-03 | Accepted for v1 | Levels are frozen. Documented in `CLAUDE.md`; numbers via `npm run check:levels -- --deep`. |
| LVL-02 | Partly | Level 7 has its own tip. It still has only one pre-solved row. |
| LVL-04 | Fixed | A loss shows your own result, not the answer. Attempts (in progress or lost) are saved and restored, so leaving a level is not a free retry. |
| LVL-05 | Fixed | `npm run check:levels`, also in CI. |
| PERF-01 | Fixed | The render loop sleeps after 2 s without input: 0 frames when idle, was ~120 per second. No frame-rate cap (Phaser's limiter distorts animation speed on 90 and 144 Hz screens). |
| PERF-02 | Fixed, check a low-end phone | Board renders at 2×; clue numbers are sharp at phone densities. |
| PERF-03 | Partly | The level screen is fetched while Home is idle. One game instance per level remains. |
| PERF-04 | Partly | 50 font files instead of 72. |
| CODE-01 | Partly | 44 new unit tests and 9 new e2e tests, mostly around the new logic. Ads and consent still have none. |
| CODE-02, CODE-05 | Fixed | |
| CODE-03, CODE-04 | Not done | After launch. |
| UX-01, UX-02 | Fixed, test on device | One reserve for banner + navigation bar + 16 px gap, used by every screen and overlay. Measured on four sizes with a simulated banner and safe areas. Real banner height and position need a phone. |
| UX-03 | Decided: keep the current look | The broken declaration is replaced by an explicit one, so nothing changes visually. Fraunces is kept only for the clue numbers and is now loaded before they are drawn. Switching the app to the serif design is a two-line change described in `tailwind.config.ts`. |
| UX-04 | Fixed | Home uses the same wordmark as the splash. |
| UX-05 | Fixed | Tier pins are evenly spaced; none clip or overlap at 360 dp. |
| UX-06 | Fixed | |
| UX-07 | Fixed | Cell touch areas cover the gaps (44 dp at 360 dp wide). Every control is at least 44 px tall. A tap that slides a few pixels into the next cell still counts for the first one. Cells themselves are the same size. |
| UX-08 | Fixed | Share is in the fixed footer; the headline scrolls into view on short screens. |
| UX-09 | Fixed | Submit no longer moves. A guess with unused marks asks once before submitting. |
| UX-10 | Partly | Splash is 0.9 s. Seven per-level tips. The tutorial itself is unchanged. |
| UX-11 | Not done | After launch. |
| UX-12 | Fixed | No tap flash, no text selection, separate Vibration switch. |
| SHARE-01 | Text only | Image card is the fast-follow (needs a new dependency). |
| SHARE-02 | Fixed | |
| SHARE-03 | Done | `?capture=1` in dev builds. See the README. |
| MON-01 | Fixed | Test builds get Google's sample app ID so they do not crash. `doctor --release` refuses sample or missing IDs. |
| MON-02 | Fixed | No timer shows ads. Full-screen ads are refused while the app is not visible. |
| MON-03 | Fixed | Test ads unless built with `npm run cap:sync:release`. |
| MON-04 | Fixed, test on device | Nothing ad-related runs until consent allows it; retried when the app returns to the foreground. Analytics stays off until then. |
| MON-05 | Fixed | See LVL-04. |
| MON-06, MON-07 | Fixed, test on device | Banner retries after a failed load. "No ad available right now" is shown. Expired ads are reloaded once. |
| MON-08 | Fixed | |
| MON-09 | Not done | After launch. |
| MON-10 | Fixed | The web build stops at level 14 and points to the store. |
| REL-01 | Yours | Install the toolchain and build. |
| REL-02 | Done, never built | `android/` is no longer gitignored. Signing and Crashlytics wiring are in its Gradle files. |
| REL-03 | Fixed | Maps go to `sourcemaps/<version>/`. Keep that folder for each uploaded build. |
| REL-04, REL-05 | Fixed | Events renamed; set up any dashboards against the new names. |
| REL-06 | Partly | Ads are capped at a parental-guidance rating. The audience declaration is yours. |
| REL-07 | Fixed | `docs/store/data-safety.md`. |
| REL-08 | Set, test on device | |
| REL-09, REL-10 | Not done | Web icons; notification icon needs art. |

### Choices I made that you may want to reverse

1. **No free retry when an ad cannot load.** With the bypass closed, an offline player who has used the free retry is stuck on that level until an ad loads. They are told why. Say if you want an unavailable ad to grant the retry.
2. **The banner waits only for the tutorial**, not for the whole first session.
3. **Typeface stays as it has always rendered** (UX-03).
4. **Web demo ends at level 14.** The store link is dead until the listing is live.
5. **Back on the home screen minimises the app** instead of killing it, as Android does by default.
6. **Tier pins on Home moved** to even spacing.
7. **Board height trimmed** (dead space under the grid removed) so the controls fit above the banner on more phones.

---

## 11. Before you upload: test on a real phone

Use `npm run cap:sync` (test ads) for all of this. Tick each on at least one Android 15 or 16 phone; repeat the starred ones on the oldest and smallest phone you can find.

**First build**
- [ ] The project builds in Android Studio. If Gradle complains about `firebase-crashlytics-gradle`, bump its version in `android/build.gradle`.
- [ ] The app launches (a crash at launch means the AdMob app ID or the Crashlytics wiring).
- [ ] Custom icon and splash show; no Capacitor logo anywhere.

**Back button** ★
- [ ] In a level: back goes to the tier, then home, then leaves the app.
- [ ] With rules, stats or settings open: back closes only that.
- [ ] Mid-level, press back twice, reopen the level: guesses used, marks and dashes are all still there.
- [ ] Predictive back gesture (swipe from the edge) behaves the same.

**Background and resume** ★
- [ ] Mid-level, switch apps for a minute and return: board intact, taps and animation work.
- [ ] Lock the phone for 10 minutes on a level and unlock: board is drawn, not black.
- [ ] Force-stop the app mid-level and relaunch: the attempt is restored.
- [ ] Leave the phone untouched on a level: the screen sleeps after about 2 minutes plus the system timeout.
- [ ] Open the share sheet from the win screen and come back: still on the win screen.

**Ads (test mode)** ★
- [ ] First launch: no banner during the tutorial on level 1; it appears once level 1 is won or the tutorial is skipped.
- [ ] The banner never touches or covers a button on Home, a level, the win screen, Stats, Settings or the tier list. Check with gesture navigation and with 3-button navigation.
- [ ] Hint: the ad plays and a whole row or column is revealed, with a short highlight and a message naming it. Close the ad early: nothing is revealed and nothing breaks.
- [ ] Lose twice on one level: the second time asks for an ad; watching it gives 2 retries. Back and reopen: still asks.
- [ ] Second launch, win three levels with "Next": an interstitial shows on a "Next" tap, never by itself and never over another app.
- [ ] Airplane mode: Hint and "Watch ad" say no ad is available; the game stays playable. Turn the network back on: the banner returns within a few minutes or on the next resume.
- [ ] With the consent debug geography set to EEA (AdMob console test device): the consent form appears before any ad; "Privacy & ad choices" appears in Settings.

**Offline**
- [ ] First launch in airplane mode: the game is fully playable, no ads, no errors.
- [ ] Fonts and all screens look the same offline.

**Screens** ★
- [ ] Smallest phone you have (ideally 360×640 dp or smaller): every button reachable, nothing under the banner.
- [ ] Largest phone, and a tablet or foldable if you have one: nothing stretched or clipped. Rotate it.
- [ ] System font size at maximum (Settings → Display): walk every screen. If text overflows, this is BUG-13: tell me.
- [ ] System dark mode: status and navigation icons are visible on the light background.

**Feel and performance**
- [ ] 120 Hz phone: animations run at normal speed.
- [ ] Low-end phone: tapping cells feels instant; the first PLAY opens in about a second; ten minutes of play does not heat the phone.
- [ ] Hold a cell: a dash appears with a small vibration. Tap near cell edges: the cell you touched responds.
- [ ] Sound off, Vibration on: taps still vibrate.

**Data**
- [ ] Uninstall and reinstall from the same Google account: progress is restored (Android backup), or note that it is not.
- [ ] Settings → Reminders on, allow notifications: a reminder arrives the next morning with a proper icon.
- [ ] Crashlytics: a test crash from the Firebase console's instructions shows up. Analytics DebugView shows `level_start`, `level_complete`, `tutorial_complete`, `ad_result`.
- [ ] Share: the text says "Sumline #N" and the link opens your listing (or the level on your web version, once `VITE_WEB_URL` is set).

**Release build**
- [ ] `npm run cap:sync:release` ends with "all release checks passed".
- [ ] On a phone registered as an AdMob test device, the release build shows ads labelled "Test Ad". Do not view or tap live ads on an unregistered phone of your own.
- [ ] `versionCode` raised; `sourcemaps/<version>/` archived.

There is no purchase or restore to test: the app has no in-app purchases.

---

## 12. Improvements pass

Changes made after section 10, at your request, and one that was built and then taken out.

**Verified on this machine after the last change**

| Check | Result |
|---|---|
| Typecheck, lint | Pass, 0 warnings |
| Unit tests | 243/243 (was 185), 97% line coverage of the game logic |
| e2e | 37/37 (was 14), now with real taps, drags and holds on the board, music and layout |
| The same suite in Safari's engine | 36/37; the one failure is a clipboard permission that engine's test driver lacks |
| `npm run check:levels` | 210 levels valid, no duplicates, 8,400 random playouts consistent |
| Production build | Pass. 1.3 MB including the music (was 2.5 MB); JavaScript 0.4 MB (was about 1.7 MB) |
| Headless browser, production build | 180/180 checks on four phone sizes, no console errors |
| `npm run cap:sync` | Pass |

**Not verified:** anything on a real phone. Dragging was tested with synthetic touch events in a headless browser, which is not the same as a finger on glass.

### What changed

| Change | What the player sees | Where |
|---|---|---|
| Board without a game engine | The same board, drawn as SVG by React. Phaser is removed. Nothing runs per frame any more. | `src/ui/components/Board.tsx`, `boardLayout.ts` |
| Drag to mark | Drag across cells to mark them; start on a marked cell to erase. Hold, then drag, to pencil several dashes. A drag never overwrites a dash with a mark or a mark with a dash. | `src/game/domain/stroke.ts` |
| Guided tutorial | A new player's level 1 is a walked-through solve: read the clues, see the solved row, fill the one certain row, place the rest, read the result. Nothing is locked while it runs, and it follows a player who just starts marking. "Skip tutorial" is always there. It runs once. | `src/game/domain/tutorial.ts`, `TutorialCoach.tsx` |
| Line hints | One ad reveals a whole row or column: the one whose open cells could be arranged in the most ways. | `src/game/domain/hint.ts` |
| Stars in Expert and Master | A win on the last (third) guess is 2★. It was 1★. | `src/game/domain/tiers.ts` |
| Bigger board | The grid now runs from the row numbers to the same right edge as the buttons, so cells are about 16% larger wherever the screen has room (47 → 55 px on a 440-wide phone, 38 → 44 px on a 360-wide one). On a screen too short for everything, the board narrows instead of pushing Submit off screen. | `boardLayout.ts`, `.board-box` in `globals.css` |
| Background music | The 14.5-second loop you supplied plays on every screen from the first touch. Settings has a Music switch; Sound off silences it too. Nothing plays while the app is in the background or under a full-screen ad. | `src/game/audio/music.ts` |
| Share image and links | Where the share sheet takes files, a picture of the unsolved puzzle with the result. The link opens that level on the web version when `VITE_WEB_URL` is set. `?level=37` opens level 37. | `src/ui/shareCard.ts`, `src/platform/deepLink.ts` |

### Difficulty: tried, and taken out

I built a taper of extra pre-solved cells for levels 64–210 (12 at the start of Advanced down to none for the last set of Master). You rejected it the same day: a higher tier should not start with more help than a lower one, and Expert should not get easier. It is removed. Every level starts exactly as it did before this pass (Beginner 2 cells, Intermediate 1, the rest none; tutorial levels one row), and `levels.json` was never touched. LVL-01 to LVL-03 therefore stand as written in section 5.3, apart from the star change above.

For reference, should you ever want it, this is what pre-solved cells do to levels 64–210 (measured, not estimated):

| Cells solved at the start | Grids still possible (median) | Near-perfect player solves in 2 guesses |
|---|---|---|
| 0 (as shipped) | 60,246 | 44% |
| 4 | 4,798 | 67% |
| 8 | 476 | 88% |
| 12 | 48 | 99% |

### Choices I made that you may want to reverse

1. **A last-guess win in Expert and Master is 2★** (it was 1★). On these levels even perfect play needs the third guess about half the time. It does not make any level easier to win. To put it back, set `twoStarMaxGuesses` to 2 for both tiers in `tiers.ts`.
2. **A hint reveals a whole row or column**, so it is worth much more than before, and it can put you over the mark limit by more than one because it marks every filled cell it reveals. The Submit button already says how many marks to remove.
3. **Sliding a finger away no longer cancels a tap**: it is a drag and marks what it crosses. Only sliding straight off the board from an edge cell cancels.
4. **The three rules pages are no longer the first thing a new player sees.** They remain behind the "?" button, and they still open first for a new player who starts on a level other than 1.
5. **Attempts saved by earlier test builds that used a one-cell hint are dropped** when reopened (the level starts fresh). No released build ever wrote that format.
6. **The level screen is no longer loaded lazily.** It was split off only to keep the engine out of the first load.

### Needs your decision

- **Sharing the image from the Android app.** The share sheet there takes files, not pictures in memory, and writing a file needs `@capacitor/filesystem` (an official Capacitor plugin). The project rule is no new runtime dependencies without discussion, so I stopped short: in the app, Share sends the text and the link, as before. With the plugin it is about twenty more lines in `src/platform/share.ts`.
- **A web address for shared links** (`VITE_WEB_URL`). Until it is set, shared results link to the store listing.

### Found, not changed

- The Geist font imports pull in Cyrillic, Vietnamese and extended-Latin subsets. They add about 76 KB to the stylesheet and about 30 font files to the build that an English-only game never uses. Importing only the `latin-*` files, as is already done for Fraunces, removes them.

### Add to the phone checklist (section 11)

**Board and dragging** ★
- [ ] Tap a cell: it marks at once. Tap near an edge or a corner: the cell under the finger responds.
- [ ] Drag along a row and down a column: every open cell crossed is marked, locked cells are skipped, and marking stops at the limit.
- [ ] Drag starting on a marked cell: it erases. Drag fast: no cell on the way is missed.
- [ ] Hold a cell: a dash appears after a moment. Keep holding and drag: more dashes.
- [ ] While dragging on the board the page does not scroll, and no text-selection or "copy" bubble appears.
- [ ] Two fingers on the board at once: nothing odd happens.
- [ ] Switch apps mid-drag and come back: the board still responds to the next touch.
- [ ] Clue numbers are sharp and in the serif face from the first frame, including with no network.

**Tutorial**
- [ ] Fresh install, tap PLAY: level 1 opens with the coach, not with pages of rules.
- [ ] Nothing is ever locked: tapping a cell or Submit works from the first second, and marking a cell moves the coach on.
- [ ] On "Your turn" the suggested row is ringed; dragging across it moves the coach on.
- [ ] Win level 1: the coach is gone for good. Fresh install, "Skip tutorial": same.
- [ ] On the smallest phone the coach card, the board and the Submit button can all be reached.

**Music** ★
- [ ] Music starts on the first touch and loops with no click or gap (listen through at least three passes).
- [ ] It is quieter than the tap sounds, and both are comfortable at half volume. If not, change `MUSIC_VOLUME` in `src/game/audio/music.ts`.
- [ ] Press Home, lock the phone, take a call: the music stops at once, and comes back when you return.
- [ ] Watch a rewarded ad and an interstitial: no game music under the ad; it returns after.
- [ ] Settings → Music off: silence, and still off after restarting the app. Sound off: everything silent.
- [ ] Start a song in another app, then open the game: decide whether the game's music over it is acceptable.

**Board size**
- [ ] The grid's right edge lines up with the Submit button, and the row numbers with the "N of M marked" text.
- [ ] On the smallest phone you have: Submit is on screen without scrolling on an ordinary level.

**iPad and Safari (web version)**
- [ ] On a fresh iPad, PLAY then tap cells and Submit straight away: everything responds.
- [ ] Drag across cells with a finger: the page does not scroll and every cell crossed is marked.

**Sharing**
- [ ] Share from the win screen in the app: the share sheet opens with the text and link.
- [ ] On the web version on a phone: the share sheet offers the picture.

