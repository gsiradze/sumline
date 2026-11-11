import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { LevelGameView } from './components/LevelGameView';
import { TierView } from './components/TierView';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { GetAppModal } from './components/GetAppModal';
import { Splash } from './components/Splash';
import { demoLevelLimit } from '../config/demo';
import {
  getHapticsEnabled,
  getMuted,
  getNotificationsEnabled,
  purgeLegacyKeys,
  setHapticsEnabled as persistHaptics,
  setMuted as persistMuted,
} from '../storage/persistence';
import { levelIdFromSearch } from '../platform/deepLink';
import { scheduleReminders } from '../platform/notifications';
import { sound } from '../game/audio/soundManager';
import { setHapticsEnabled } from '../game/audio/haptics';
import { adResult, settingChanged } from '../telemetry/events';
import { adProvider } from '../storage/ads';
import { canShowInterstitial, noteAdShown, noteLevelComplete } from '../storage/adSession';
import { bakedLevel } from '../storage/levelsManifest';
import { isLevelAccessible, tierForLevelId } from '../game/domain/levels';
import type { Tier } from '../game/domain/types';
import { useProgress } from './hooks/useProgress';
import { useStats } from './hooks/useStats';
import { registerNav } from '../testHook';

const MAX_BANNER_RESERVE_PX = 120;
// Clear space kept between the banner and the nearest control.
const BANNER_GAP_PX = 16;

type View =
  | { readonly kind: 'home' }
  | { readonly kind: 'tier'; readonly tier: Tier }
  | { readonly kind: 'level'; readonly levelId: number };

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
  const [getAppOpen, setGetAppOpen] = useState(false);
  const [splashing, setSplashing] = useState(shouldShowSplash);
  const { progress, recordLevelWin } = useProgress();
  const { stats, hydrated: statsHydrated, onWin: onStatsWin, onLoss: onStatsLoss } = useStats();
  const [muted, setMutedState] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const hapticsRef = useRef(hapticsOn);
  hapticsRef.current = hapticsOn;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    void purgeLegacyKeys();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getMuted(), getHapticsEnabled()]).then(([m, h]) => {
      if (cancelled) return;
      setMutedState(m);
      setHapticsOn(h);
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
  }, [muted, hapticsOn, prefsHydrated]);

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

  const handlePickTier = useCallback((tier: Tier) => {
    setView({ kind: 'tier', tier });
  }, []);

  /** Opens a level unless the web demo ends before it. Returns whether it opened. */
  const openLevel = useCallback((levelId: number): boolean => {
    const limit = demoLevelLimit();
    if (limit !== null && levelId >= limit) {
      setGetAppOpen(true);
      return false;
    }
    setView({ kind: 'level', levelId });
    return true;
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
      const limit = demoLevelLimit();
      if (limit !== null && nextLevelId >= limit) {
        setGetAppOpen(true);
        return false;
      }
      if (!isLevelAccessible(progressRef.current, nextLevelId)) {
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

  const handleBackToTier = useCallback(() => {
    setView(v => {
      if (v.kind === 'level') {
        return { kind: 'tier', tier: tierForLevelId(v.levelId) };
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
        onPickTier={handlePickTier}
        onPickLevel={handlePickLevel}
        onOpenStats={() => setStatsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
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
        key={view.levelId}
        level={bakedLevel(view.levelId)}
        progress={progress}
        onRecordWin={recordLevelWin}
        onRecordStatsWin={onStatsWin}
        onRecordStatsLoss={onStatsLoss}
        onBack={handleBackToTier}
        onGotoLevel={handleAdvanceLevel}
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
          hapticsOn={hapticsOn}
          onToggleHaptics={handleToggleHaptics}
          stats={stats}
          onDismiss={() => setSettingsOpen(false)}
        />
      )}
      {getAppOpen && (
        <GetAppModal demoLevels={demoLevelLimit() ?? 0} onDismiss={() => setGetAppOpen(false)} />
      )}
      {splashing && <Splash onDone={() => setSplashing(false)} />}
    </>
  );
}
