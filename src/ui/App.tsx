import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { LevelGameView } from './components/LevelGameView';
import { TierView } from './components/TierView';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { Splash } from './components/Splash';
import {
  getHapticsEnabled,
  getMusicEnabled,
  getMuted,
  getNotificationsEnabled,
  getRulesShown,
  loadProgress,
  purgeLegacyKeys,
  resetGameData,
  setRulesShown,
  setHapticsEnabled as persistHaptics,
  setMusicEnabled as persistMusic,
  setMuted as persistMuted,
} from '../storage/persistence';
import { levelIdFromSearch } from '../platform/deepLink';
import { scheduleReminders } from '../platform/notifications';
import { music } from '../game/audio/music';
import { sound } from '../game/audio/soundManager';
import { setHapticsEnabled } from '../game/audio/haptics';
import { adResult, settingChanged, tutorialComplete } from '../telemetry/events';
import { adProvider } from '../storage/ads';
import { canShowInterstitial, noteAdShown, noteLevelComplete } from '../storage/adSession';
import { bakedLevel } from '../storage/levelsManifest';
import { isLevelAccessible, tierForLevelId } from '../game/domain/levels';
import { TUTORIAL_LEVEL_ID } from '../game/domain/tutorial';
import type { Tier } from '../game/domain/types';
import { Theme } from '../platform/theme';
import { useProgress } from './hooks/useProgress';
import { useStats } from './hooks/useStats';
import { useTheme } from './hooks/useTheme';
import { registerNav } from '../testHook';

const MAX_BANNER_RESERVE_PX = 120;
// Clear space kept between the banner and the nearest control.
const BANNER_GAP_PX = 16;

type View =
  | { readonly kind: 'home' }
  | { readonly kind: 'tier'; readonly tier: Tier }
  | {
      readonly kind: 'level';
      readonly levelId: number;
      /** Where a new player was headed when the tutorial took them to level 1 first. */
      readonly then?: number;
    };

const SPLASH_KEY = 'sumline.splash.shown';

function shouldShowSplash(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return true;
    if (sessionStorage.getItem(SPLASH_KEY)) return false;
    sessionStorage.setItem(SPLASH_KEY, '1');
    return true;
  } catch {
    return true;
  }
}

/** Whether this player has had the tutorial, or has plainly learned the game without it. */
async function readTutorialDone(): Promise<boolean> {
  if (await getRulesShown()) return true;
  const progress = await loadProgress();
  if (!Object.values(progress).some(record => record.completed)) return false;
  // Levels solved before this tutorial existed: there is nothing left to teach.
  void setRulesShown(true);
  return true;
}

function viewKey(view: View): string {
  if (view.kind === 'level') return `level:${view.levelId}`;
  if (view.kind === 'tier') return `tier:${view.tier}`;
  return 'home';
}

// Recording stage for short-form video (see src/dev/CaptureStage.tsx). The
// DEV constant is false in production builds, so the import and the component
// are dropped from them entirely.
const CaptureStage = import.meta.env.DEV
  ? lazy(() => import('../dev/CaptureStage').then(m => ({ default: m.CaptureStage })))
  : null;
const captureRequested =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('capture');

export default function App() {
  if (CaptureStage && captureRequested) {
    return (
      <Suspense fallback={null}>
        <CaptureStage />
      </Suspense>
    );
  }
  return <Game />;
}

function Game() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashing, setSplashing] = useState(shouldShowSplash);
  // Counts replays of the tutorial, so level 1 starts afresh for each one.
  const [tourRuns, setTourRuns] = useState(0);
  // Whether this player has been through the tutorial (or skipped it). Null
  // for the first moments, while that is being read.
  const [tutorialDone, setTutorialDone] = useState<boolean | null>(null);
  const tutorialDoneRef = useRef(tutorialDone);
  tutorialDoneRef.current = tutorialDone;
  const viewRef = useRef(view);
  viewRef.current = view;
  const { progress, recordLevelWin, reset: resetProgress } = useProgress();
  const {
    stats,
    hydrated: statsHydrated,
    onWin: onStatsWin,
    onLoss: onStatsLoss,
    reset: resetStats,
  } = useStats();
  const { theme, toggleTheme } = useTheme();
  const [muted, setMutedState] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const hapticsRef = useRef(hapticsOn);
  hapticsRef.current = hapticsOn;
  const musicRef = useRef(musicOn);
  musicRef.current = musicOn;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    void purgeLegacyKeys();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readTutorialDone().then(done => {
      // Not if the answer has changed meanwhile (the tutorial ended, or was asked for again).
      if (!cancelled && tutorialDoneRef.current === null) setTutorialDone(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getMuted(), getHapticsEnabled(), getMusicEnabled()]).then(([m, h, mu]) => {
      if (cancelled) return;
      setMutedState(m);
      setHapticsOn(h);
      setMusicOn(mu);
      setPrefsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    sound.setMuted(muted);
    setHapticsEnabled(hapticsOn);
    // "Sound" off silences everything; "Music" only chooses whether there is a tune.
    music.setMuted(muted);
    music.setEnabled(musicOn);
  }, [muted, hapticsOn, musicOn, prefsHydrated]);

  // Audio may only begin from a touch or key press. Every one of them offers to
  // start (or restart) it; once it is running this does nothing.
  useEffect(() => {
    const kick = (): void => music.start();
    window.addEventListener('pointerup', kick);
    window.addEventListener('keydown', kick);
    return () => {
      window.removeEventListener('pointerup', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement.style;
    const unsubscribe = adProvider.onBannerHeight(px => {
      const reserve = Math.max(0, Math.min(px, MAX_BANNER_RESERVE_PX));
      root.setProperty('--banner-height', `${reserve}px`);
      root.setProperty('--banner-gap', reserve > 0 ? `${BANNER_GAP_PX}px` : '0px');
    });
    return () => {
      unsubscribe();
      root.setProperty('--banner-height', '0px');
      root.setProperty('--banner-gap', '0px');
    };
  }, []);

  useEffect(() => {
    if (!statsHydrated) return;
    void (async () => {
      if (await getNotificationsEnabled()) await scheduleReminders(stats, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsHydrated]);

  // Every screen starts at its top; scroll position must not leak between them.
  const currentViewKey = viewKey(view);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [currentViewKey]);

  const handleToggleMute = useCallback(() => {
    const next = !mutedRef.current;
    setMutedState(next);
    void persistMuted(next);
    settingChanged('muted', next);
  }, []);

  const handleToggleHaptics = useCallback(() => {
    const next = !hapticsRef.current;
    setHapticsOn(next);
    void persistHaptics(next);
    settingChanged('haptics', next);
  }, []);

  const handleToggleMusic = useCallback(() => {
    const next = !musicRef.current;
    setMusicOn(next);
    void persistMusic(next);
    settingChanged('music', next);
  }, []);

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);

  const handlePickTier = useCallback((tier: Tier) => {
    setView({ kind: 'tier', tier });
  }, []);

  /**
   * Opens a level. A new player is taken
   * through the tutorial on level 1 first, whichever level they asked for and
   * however they asked (the level list, a shared link): there is one tutorial.
   */
  const openLevel = useCallback((levelId: number): void => {
    if (tutorialDoneRef.current === null) {
      void readTutorialDone().then(done => {
        if (tutorialDoneRef.current === null) {
          tutorialDoneRef.current = done;
          setTutorialDone(done);
        }
        openLevel(levelId);
      });
      return;
    }
    if (tutorialDoneRef.current || levelId === TUTORIAL_LEVEL_ID) {
      setView({ kind: 'level', levelId });
    } else {
      setView({ kind: 'level', levelId: TUTORIAL_LEVEL_ID, then: levelId });
    }
  }, []);

  const handlePickLevel = useCallback(
    (levelId: number) => {
      openLevel(levelId);
    },
    [openLevel],
  );

  // A shared link (`?level=37`) opens straight on its level. The address is
  // then cleaned, so a reload or the back button behaves as usual.
  useEffect(() => {
    const levelId = levelIdFromSearch(window.location.search);
    if (levelId === null) return;
    window.history.replaceState(null, '', window.location.pathname);
    openLevel(levelId);
  }, [openLevel]);

  // Called only from an explicit tap on "Next". An interstitial may show here,
  // and nowhere else: never from a timer, never while the app is in the background.
  const handleAdvanceLevel = useCallback(
    async (nextLevelId: number, opts?: { readonly skipAd?: boolean }): Promise<boolean> => {
      // The level a new player was headed for when the tutorial came first was
      // already theirs to open (a shared link opens any level).
      const current = viewRef.current;
      const resuming = current.kind === 'level' && current.then === nextLevelId;
      if (!resuming && !isLevelAccessible(progressRef.current, nextLevelId)) {
        setView({ kind: 'tier', tier: tierForLevelId(Math.max(0, nextLevelId - 1)) });
        return true;
      }
      noteLevelComplete();
      if (!opts?.skipAd && canShowInterstitial(Date.now())) {
        const outcome = await adProvider.showInterstitial('level_complete');
        adResult('level_complete', outcome, 'interstitial');
        if (outcome === 'granted') noteAdShown(Date.now());
      }
      setView({ kind: 'level', levelId: nextLevelId });
      return true;
    },
    [],
  );

  const handleBackToHome = useCallback(() => {
    setView({ kind: 'home' });
  }, []);

  const handleTutorialEnd = useCallback((skipped: boolean) => {
    tutorialDoneRef.current = true;
    setTutorialDone(true);
    void setRulesShown(true);
    tutorialComplete(skipped);
    // The banner stays off until a new player has finished the tutorial.
    void adProvider.showBanner();
    // Skipped on the way to another level: that level is where they wanted to be.
    // (After a win the level's own "Next" leads there.)
    if (!skipped) return;
    setView(v =>
      v.kind === 'level' && v.then !== undefined ? { kind: 'level', levelId: v.then } : v,
    );
  }, []);

  // Level 1 runs the tour for anyone who has not been through it, so forgetting
  // that they have is all a replay takes.
  const handleReplayTutorial = useCallback(() => {
    tutorialDoneRef.current = false;
    setTutorialDone(false);
    void setRulesShown(false);
    setSettingsOpen(false);
    setTourRuns(n => n + 1);
    setView({ kind: 'level', levelId: TUTORIAL_LEVEL_ID });
  }, []);

  // Starts the game from scratch: stars, stats, half-played levels and the
  // tutorial. Sound, theme and the other settings are the player's and stay.
  const handleResetProgress = useCallback(() => {
    // The level on screen saves its attempt as it closes: close it first, so
    // that save is erased with the rest.
    flushSync(() => {
      setSettingsOpen(false);
      setView({ kind: 'home' });
    });
    tutorialDoneRef.current = false;
    setTutorialDone(false);
    resetProgress();
    resetStats();
    void resetGameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetProgress]);

  const handleBackToTier = useCallback(() => {
    setView(v => {
      if (v.kind === 'level') {
        // From the tutorial, back to the list of the level that was picked.
        return { kind: 'tier', tier: tierForLevelId(v.then ?? v.levelId) };
      }
      return { kind: 'home' };
    });
  }, []);

  useEffect(
    () => registerNav({ openLevel: handlePickLevel, backToHome: handleBackToHome }),
    [handlePickLevel, handleBackToHome],
  );

  let screen: ReactNode;
  if (view.kind === 'home') {
    screen = (
      <HomeScreen
        progress={progress}
        muted={muted}
        onToggleMute={handleToggleMute}
        darkTheme={theme === Theme.Dark}
        onToggleTheme={toggleTheme}
        onPickTier={handlePickTier}
        onPickLevel={handlePickLevel}
        onOpenStats={() => setStatsOpen(true)}
        onOpenSettings={handleOpenSettings}
      />
    );
  } else if (view.kind === 'tier') {
    screen = (
      <TierView
        tier={view.tier}
        progress={progress}
        onBack={handleBackToHome}
        onPickLevel={handlePickLevel}
      />
    );
  } else {
    screen = (
      <LevelGameView
        key={`${view.levelId}:${tourRuns}`}
        level={bakedLevel(view.levelId)}
        progress={progress}
        onRecordWin={recordLevelWin}
        onRecordStatsWin={onStatsWin}
        onRecordStatsLoss={onStatsLoss}
        onBack={handleBackToTier}
        onGotoLevel={handleAdvanceLevel}
        onOpenSettings={handleOpenSettings}
        runTutorial={view.levelId === TUTORIAL_LEVEL_ID && tutorialDone === false}
        onTutorialEnd={handleTutorialEnd}
        onReplayTutorial={handleReplayTutorial}
        resumeLevelId={view.then ?? null}
      />
    );
  }

  return (
    <>
      {screen}
      {statsOpen && (
        <StatsModal stats={stats} progress={progress} onDismiss={() => setStatsOpen(false)} />
      )}
      {settingsOpen && (
        <SettingsModal
          muted={muted}
          onToggleMute={handleToggleMute}
          musicOn={musicOn}
          onToggleMusic={handleToggleMusic}
          hapticsOn={hapticsOn}
          onToggleHaptics={handleToggleHaptics}
          darkTheme={theme === Theme.Dark}
          onToggleTheme={toggleTheme}
          stats={stats}
          onReplayTutorial={handleReplayTutorial}
          onResetProgress={handleResetProgress}
          onDismiss={() => setSettingsOpen(false)}
        />
      )}
      {splashing && <Splash onDone={() => setSplashing(false)} />}
    </>
  );
}
