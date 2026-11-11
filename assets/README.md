# assets

Source art for app icons and splash screens. Generated into the native projects
by `npx capacitor-assets generate`.

Add:

- `icon.png` — 1024×1024, no alpha, no rounded corners
- `splash.png` — 2732×2732, logo in the middle 50%
- `splash-dark.png` — optional dark variant

`npm run doctor` warns until `icon.png` exists.

## audio

`audio/music.wav` is the master of the background music loop. It is not shipped:
the game plays `public/audio/music.m4a`, which is encoded from it. To change the
music, replace both files and update `MUSIC_TRACK` in `src/game/audio/music.ts`
(`afinfo public/audio/music.m4a` prints the "valid frames" and "priming" it needs).
`npm run test` fails if the master and those numbers disagree.
