# Native checklist

`android/` is committed. Signing config, version codes and the Firebase Gradle
wiring live in it, so they survive between builds and machines. `ios/` does not
exist yet (iOS is deferred); commit it too when it is created.

## Machine setup

Nothing below works without a JDK and the Android SDK. Install Android Studio
(it bundles a JDK), open `android/` once so it downloads the SDK, then for
command-line Gradle point `JAVA_HOME` at Android Studio's bundled JDK, e.g.:

`export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

## What the scripts do

- `npm run cap:sync` — web build with **test ads**, `cap sync`, `patch:native`.
- `npm run cap:sync:release` — level check, web build with **live ads**,
  `cap sync`, `patch:native`, then `doctor --release`, which fails on anything
  that must not reach the store.
- `npm run patch:native` (safe to re-run; it replaces values, never duplicates):
  - `AndroidManifest.xml`: AdMob `APPLICATION_ID` (from `.env`, or Google's
    sample ID when `.env` has none, so a test build does not crash at launch),
    `POST_NOTIFICATIONS`
  - copies `native-config/android/google-services.json` → `android/app/`
  - iOS _(later)_: `NSUserTrackingUsageDescription`, `GADApplicationIdentifier`,
    `ITSAppUsesNonExemptEncryption=false`, `GoogleService-Info.plist`

## Already wired in `android/` (verify on the first build)

These were written without a local toolchain and have **not been built yet**:

- `android/build.gradle`: `com.google.firebase:firebase-crashlytics-gradle:3.0.2`
  on the classpath (bump it if Gradle/AGP asks for a newer one).
- `android/app/build.gradle`:
  - applies `com.google.gms.google-services` **and**
    `com.google.firebase.crashlytics` when `app/google-services.json` exists.
    With Firebase configured but the Crashlytics plugin missing, the Crashlytics
    SDK fails at startup, which is why both are applied together.
  - `signingConfigs.release` reads `android/keystore.properties`
    (see `android/keystore.properties.example`). Without that file a release
    build is simply unsigned.
- `android/.gitignore` keeps `keystore.properties`, `*.jks`, `*.keystore`,
  build output and the copied web assets out of git.

## Still manual

- `versionCode` in `android/app/build.gradle` must increase for every upload.
  `npm run version:apply` syncs `versionName` from `package.json`.
- Icon and splash: add `assets/icon.png` + `assets/splash.png`, run
  `npm run gen:assets`. Add a monochrome notification icon and set
  `plugins.LocalNotifications.smallIcon` in `capacitor.config.ts`.

### iOS _(later)_ — Xcode
- Add `GoogleService-Info.plist` to the App target (copied in by patch-native, but
  must be referenced in the Xcode project — drag it in once)
- Add a Crashlytics dSYM upload build phase (`${PODS_ROOT}/FirebaseCrashlytics/upload-symbols`)
- `PrivacyInfo.xcprivacy` — declare collected data types (SDKs ship their own manifests)
