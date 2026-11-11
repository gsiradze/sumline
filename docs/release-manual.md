# Manual release (until Fastlane lands)

Android is the launch platform; iOS steps are marked _(later)_.

```bash
# 0. Toolchain (CLI Gradle only — Android Studio uses its bundled JDK automatically)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# 1. One-time: android/keystore.properties (copy keystore.properties.example),
#    real values in .env, google-services.json in native-config/android/

# 2. Bump the version
#    package.json "version", then:
npm run version:apply                # versionName ← package.json
#    and raise versionCode in android/app/build.gradle by hand

# 3. Release build of the web layer + native sync + preflight
npm run cap:sync:release             # live ads; stops if anything is missing

# 4a. Android
npx cap open android
#   Build → Generate Signed Bundle (.aab), release variant
#   Upload to Play Console (narnarigames@gmail.com) → closed testing → promote → staged rollout 10%

# 4b. iOS (later)
npx cap open ios
#   Xcode → Product → Archive → Distribute App → App Store Connect → Upload
```

For day-to-day device testing use `npm run cap:sync` instead: it builds with
Google's test ads. Never tap live ads on your own devices; also register your
phones as test devices in the AdMob console.

**Back up the Android upload keystore the day you create it.** Losing it is
near-catastrophic (requires a Google upload-key reset).

**Keep `sourcemaps/<version>/`** from the build you upload (it is gitignored).
Crash reports from the app contain positions in the minified bundle; those maps
are the only way to turn them back into source lines.

Note: `levels.json` is a frozen 210-level contract — `npm run build` does **not**
regenerate it. `npm run build:levels` is manual-only and must not run in the release path.
