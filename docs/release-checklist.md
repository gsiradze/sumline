# Release checklist & rollback

Sumline ships **Android-first** to Google Play (account `narnarigames@gmail.com`,
bundle `com.narnarigames.sumline`). iOS is code-ready but deferred — the iOS steps
below are marked _(later)_.

## Before submitting
1. [ ] CI green (typecheck, lint, unit, build)
2. [ ] Firebase Crashlytics clean on the internal/closed-testing build for 48h
3. [ ] AdMob unit IDs in `.env` are real (not test IDs) — `usingAdMobTestIds()` false in prod
4. [ ] Android upload keystore backed up (see release-manual.md)

## Rollout
- **Android:** staged 10% → 50% → 100%, gate each step on crash-free-users ≥ 99.5%
  and ANR ≤ 0.47%.
- **iOS _(later)_:** phased release (7-day automatic) — also the main rollback lever.

## Rollback levers (in order)
1. Halt the staged rollout (Android) — instant, no review
2. Pull the offending AdMob unit / lower ad cadence in the AdMob console
3. Hotfix build — bump version, rebuild, resubmit. On iOS _(later)_ request expedited
   review and cite the crash rate.
