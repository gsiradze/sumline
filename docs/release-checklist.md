# Release checklist & rollback

Sumline ships **Android-first** to Google Play (account `narnarigames@gmail.com`,
bundle `com.narnarigames.sumline`). iOS is code-ready but deferred — the iOS steps
below are marked _(later)_.

## Before submitting
1. [ ] CI green (typecheck, lint, unit, level check, build, e2e)
2. [ ] `npm run cap:sync:release` finishes with "all release checks passed"
3. [ ] The on-device checklist in `RELEASE_REVIEW.md` (section 11) is done on a real phone
4. [ ] Firebase Crashlytics clean on the internal/closed-testing build for 48h
5. [ ] Android upload keystore backed up (see release-manual.md)
6. [ ] `sourcemaps/<version>/` from the uploaded build archived somewhere safe

## Rollout
- **Android:** staged 10% → 50% → 100%, gate each step on crash-free-users ≥ 99.5%
  and ANR ≤ 0.47%.
- **iOS _(later)_:** phased release (7-day automatic) — also the main rollback lever.

## Rollback levers (in order)
1. Halt the staged rollout (Android) — instant, no review
2. Pull the offending AdMob unit / lower ad cadence in the AdMob console
3. Hotfix build — bump version, rebuild, resubmit. On iOS _(later)_ request expedited
   review and cite the crash rate.
