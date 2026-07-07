# Manual release (until Fastlane lands)

Automated native release is the target. Until then, release by hand. Android is the
launch platform; iOS steps are marked _(later)_.

```bash
# 0. Toolchain (CLI Gradle only — Android Studio uses its bundled JBR automatically)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# 1. Build web + sync native
npm run build                        # tsc --noEmit && vite build
npx cap sync
npm run patch:native                 # re-apply native tweaks (see native-checklist.md)

# 2a. Android
npx cap open android
#   Build → Generate Signed Bundle (.aab) with the UPLOAD keystore
#   Upload to Play Console (narnarigames@gmail.com) → closed testing → promote → staged rollout 10%

# 2b. iOS (later)
npx cap open ios
#   Xcode → Product → Archive → Distribute App → App Store Connect → Upload
#   Then TestFlight → submit for review. Enable phased release.
```

**Back up the Android upload keystore the day you create it.** Losing it is
near-catastrophic (requires a Google upload-key reset).

Note: `levels.json` is a frozen 210-level contract — `npm run build` does **not**
regenerate it. `npm run build:levels` is manual-only and must not run in the release path.
