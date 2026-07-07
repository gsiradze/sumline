# Native checklist

`ios/` and `android/` are gitignored and regenerated per machine. After
`npx cap add android` (and `npx cap add ios` _(later)_), run `npm run patch:native`
— it applies everything below that can be automated. The rest is manual, once per
native regeneration.

## Machine build note
- Android Studio ships **JBR 21**; that JDK builds Sumline.
- For CLI Gradle, export:
  `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- Native projects (`ios/`, `android/`) are gitignored and regenerated via
  `npx cap add`; re-apply all tweaks below with `npm run patch:native`.

## Automated by `scripts/patch-native.ts`

- Android `AndroidManifest.xml`: AdMob `APPLICATION_ID` meta-data, `POST_NOTIFICATIONS`
- iOS _(later)_ `Info.plist`: `NSUserTrackingUsageDescription`, `GADApplicationIdentifier`,
  `ITSAppUsesNonExemptEncryption=false`
- Copies `native-config/{android,ios}/…` Firebase config into the native projects

## Manual (Firebase / Gradle — not safely automatable)

### Android — `android/build.gradle` + `android/app/build.gradle`
- Project `build.gradle`: `classpath 'com.google.gms:google-services:4.4.2'` and
  `classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.2'`
- App `build.gradle`: apply `com.google.gms.google-services` and
  `com.google.firebase.crashlytics`

### iOS _(later)_ — Xcode
- Add `GoogleService-Info.plist` to the App target (copied in by patch-native, but
  must be referenced in the Xcode project — drag it in once)
- Add a Crashlytics dSYM upload build phase (`${PODS_ROOT}/FirebaseCrashlytics/upload-symbols`)
- Add the App Tracking Transparency + AppTrackingTransparency framework (Pods handle this)

### iOS _(later)_
- `PrivacyInfo.xcprivacy` — declare collected data types (SDKs ship their own manifests)
