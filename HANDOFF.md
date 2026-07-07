# Sumline — Production Handoff

The production infrastructure from the `game-template` repo has been ported into Sumline and
adapted to its actual shape (web-only prototype → Capacitor-wrapped, monetized, instrumented app).
This file is the current-state snapshot + the ordered list of the **external** work only you can do.
The process docs live in `docs/`; the design source of truth is `game-template/PRODUCTION.md`.

## What was implemented (all verified: typecheck, lint, 141 unit tests, 5 e2e, prod build, `cap add android`, `patch:native`)

- **Capacitor 8 wrap** — `capacitor.config.ts` (`com.narnarigames.sumline` / "Sumline"), Android added and validated; iOS-ready.
- **Durable storage** — `persistence.ts` rewritten async: `@capacitor/preferences` on native / localStorage on web, with a one-time localStorage→Preferences migration. Reader hooks (`useProgress`/`useStats`/`useRetry`) hydrate asynchronously; the game's `grid:v2:` keys and per-field validation are preserved.
- **Ads (AdMob)** — real `AdMobAdProvider` (rewarded + interstitial + **bottom banner**) with preload/backoff; web keeps the dev stub. Interstitial cadence is a pure, tested `adPolicy.ts` (never session 1, every 3 solves, 90s gap; a rewarded ad resets the cooldown). Banner space is reserved via `--banner-height` so it never overlaps the grid.
- **Consent** — UMP + iOS ATT flow (`platform/consent.ts`), general/13+ defaults, EEA "Privacy & ad choices" re-entry surfaced in Settings.
- **Telemetry** — Firebase Analytics + Crashlytics (native-only, dynamic-imported behind `isNative()`), a canonical `events.ts` taxonomy wired to real gameplay (level start/complete/fail/quit, hint, ad impression, share, session, settings), plus an `ErrorBoundary` and global `error`/`unhandledrejection` net.
- **Env config** — `.env.example` + typed `config/env.ts` (Google test IDs in dev, real IDs from `.env` in prod).
- **Platform** — native bootstrap (status bar / portrait lock / splash / Android back), native share sheet, native haptics (gated by the sound toggle), keep-awake during play, local reminders (streak-saver on the activity streak), in-app review after a proud 3-star solve.
- **UI** — new `SettingsModal` (Sound / Reminders / Privacy options / version), Phaser visibility-pause, offline-bundled fonts (Fraunces + Geist via `@fontsource`, no CDN), PWA manifest + Apple meta.
- **CI/CD & docs** — `ci.yml` (typecheck+lint+test+build+e2e) gating; `deploy.yml` now runs the checks before deploying; `scripts/doctor.ts` + `scripts/patch-native.ts`; full `docs/` set.
- **Frozen levels** — `build:levels` removed from `npm run build` (deploys use the committed `public/levels.json` verbatim).

## What only you can do — ordered to launch

1. **AdMob account** → create the app + 3 ad units per platform (rewarded, interstitial, banner) → put the IDs in a local `.env` (copy `.env.example`). Dev already runs Google's test IDs.
2. **Firebase project** → register the Android app → download `google-services.json` → drop it in `native-config/android/`. Add the Crashlytics/google-services Gradle lines per `docs/native-checklist.md`.
3. **Art** → `assets/icon.png` (1024², no alpha) + `assets/splash.png` / `assets/splash-dark.png` (2732²) → `npm run gen:assets`. Also export PWA PNGs (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`).
4. **Privacy policy URL** (must mention the AdMob advertising ID) — required by both stores and AdMob.
5. **Build the native app**: `npm run cap:sync` (build → cap sync → patch:native) → `npm run doctor` (fix any ✗) → open in Android Studio. Machine note: CLI Gradle needs `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home`.
6. **Signing** — generate the upload keystore, back it up, wire `android/keystore.properties`.
7. **Play Console** — create the app; fill Data Safety (`docs/store/data-safety.md`) and the listing (`docs/store/checklist.md`); run the **20-tester / 14-day closed test** (new personal accounts gate); staged rollout from 10% (`docs/release-checklist.md` / `docs/launch-runbook.md`).
8. **AdMob ops** — `app-ads.txt` on your domain; link the AdMob app to the store listing after launch.

## Decisions baked in (change if you disagree)

- **Bottom banner shows app-wide during play.** Space is reserved via `--banner-height` (clamped ≤120px). This is the one piece untested on a real device — verify the reserved height looks right on hardware and tune the clamp / the AdMob `SizeChanged` units in `storage/ads.ts` if needed. To show the banner on menus only, gate `adProvider.showBanner()` per screen.
- **Interstitials** fire on advancing after a solve, gated by `adPolicy.ts`. Tune the cadence constants there.
- **No IAP in v1.** The ad layer is IAP-ready; a `remove_ads` purchase (RevenueCat) is a sensible fast-follow now that there's a persistent banner + interstitials.

## Fast-follow (post-launch)

- IAP `remove_ads` (RevenueCat) · Firebase Remote Config kill-switches / cadence tuning · deep links for shared results · Fastlane release automation (`docs/release-manual.md` covers the manual path until then).

## Notes

- `android/` is generated (gitignored) — regenerate anytime with `rm -rf android && npx cap add android && npm run patch:native`.
- Everything runs on web with dev stubs/noops, so `npm run dev` is a full preview minus real ads/telemetry.
