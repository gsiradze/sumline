# native-config

Per-game native config files that must survive `npx cap add` (which regenerates
the gitignored `ios/` and `android/` folders). `scripts/patch-native.ts` copies
these into the native projects after `cap add` / `cap sync`.

Place here (committed — Firebase config is not secret, but treat with care):

- `ios/GoogleService-Info.plist` → copied to `ios/App/App/`
- `android/google-services.json` → copied to `android/app/`

Download both from the Firebase console (one iOS app + one Android app for
Sumline, matching the bundle id `com.narnarigames.sumline`).
