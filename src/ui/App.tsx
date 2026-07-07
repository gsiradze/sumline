import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { TierView } from './components/TierView';
import { StatsModal } from './components/StatsModal';
import { SettingsModal } from './components/SettingsModal';
import { Splash } from './components/Splash';
import {
  getMuted,
  getNotificationsEnabled,
  purgeLegacyKeys,
  setMuted as persistMuted,
} from '../storage/persistence';
import { scheduleReminders } from '../platform/notifications';
import { sound } from '../game/audio/soundManager';
import { setHapticsEnabled } from '../game/audio/haptics';
import { adImpression, settingChanged } from '../telemetry/events';
import { adProvider } from '../storage/ads';
import { canShowInterstitial, noteAdShown, noteLevelComplete } from '../storage/adSession';
import { bakedLevel } from '../storage/levelsManifest';
import { tierForLevelId } from '../game/domain/levels';
import type { Tier } from '../game/domain/types';
import { useProgress } from './hooks/useProgress';
import { useStats } from './hooks/useStats';
import { registerNav } from '../testHook';

const MAX_BANNER_RESERVE_PX = 120;

const LevelGameView = lazy(() =>
  import('./components/LevelGameView').then(m => ({ default: m.LevelGameView })),
);

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

export default function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [statsOpen, setStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splashing, setSplashing] = useState(shouldShowSplash);
  const { progress, recordLevelWin } = useProgress();
  const { stats, hydrated: statsHydrated, onWin: onStatsWin, onLoss: onStatsLoss } = useStats();
  const [muted, setMutedState] = useState(false);
  const [mutedHydrated, setMutedHydrated] = useState(false);

  useEffect(() => {
    void purgeLegacyKeys();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getMuted().then(m => {
      if (cancelled) return;
      setMutedState(m);
      setMutedHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mutedHydrated) return;
    sound.setMuted(muted);
    setHapticsEnabled(!muted);
  }, [muted, mutedHydrated]);

  useEffect(() => {
    const unsubscribe = adProvider.onBannerHeight(px => {
      const reserve = Math.max(0, Math.min(px, MAX_BANNER_RESERVE_PX));
      document.documentElement.style.setProperty('--banner-height', `${reserve}px`);
    });
    return () => {
      unsubscribe();
      document.documentElement.style.setProperty('--banner-height', '0px');
    };
  }, []);

  useEffect(() => {
    if (!statsHydrated) return;
    void (async () => {
      if (await getNotificationsEnabled()) await scheduleReminders(stats, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsHydrated]);

  const handleToggleMute = useCallback(() => {
    setMutedState(prev => {
      const next = !prev;
      void persistMuted(next);
      settingChanged('muted', next);
      return next;
    });
  }, []);

  const handlePickTier = useCallback((tier: Tier) => {
    setView({ kind: 'tier', tier });
  }, []);

  const handlePickLevel = useCallback((levelId: number) => {
    setView({ kind: 'level', levelId });
  }, []);

  const handleAdvanceLevel = useCallback((nextLevelId: number) => {
    void (async () => {
      noteLevelComplete();
      if (canShowInterstitial(Date.now())) {
        const outcome = await adProvider.showInterstitial('level_complete');
        adImpression('level_complete', outcome, 'interstitial');
        if (outcome === 'granted') noteAdShown(Date.now());
      }
      setView({ kind: 'level', levelId: nextLevelId });
    })();
  }, []);

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

  const statsOverlay = statsOpen ? (
    <StatsModal
      stats={stats}
      progress={progress}
      onDismiss={() => setStatsOpen(false)}
    />
  ) : null;

  const settingsOverlay = settingsOpen ? (
    <SettingsModal
      muted={muted}
      onToggleMute={handleToggleMute}
      stats={stats}
      onDismiss={() => setSettingsOpen(false)}
    />
  ) : null;

  const splashOverlay = splashing ? <Splash onDone={() => setSplashing(false)} /> : null;

  if (view.kind === 'home') {
    return (
      <>
        <HomeScreen
          progress={progress}
          stats={stats}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPickTier={handlePickTier}
          onPickLevel={handlePickLevel}
          onOpenStats={() => setStatsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {statsOverlay}
        {settingsOverlay}
        {splashOverlay}
      </>
    );
  }

  if (view.kind === 'tier') {
    return (
      <>
        <TierView
          tier={view.tier}
          progress={progress}
          onBack={handleBackToHome}
          onPickLevel={handlePickLevel}
        />
        {statsOverlay}
        {splashOverlay}
      </>
    );
  }

  const level = bakedLevel(view.levelId);
  return (
    <>
      <Suspense fallback={<LevelGameFallback />}>
        <LevelGameView
          key={view.levelId}
          level={level}
          progress={progress}
          onRecordWin={recordLevelWin}
          onRecordStatsWin={onStatsWin}
          onRecordStatsLoss={onStatsLoss}
          onBack={handleBackToTier}
          onGotoLevel={handleAdvanceLevel}
        />
      </Suspense>
      {statsOverlay}
    </>
  );
}

function LevelGameFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-paper-100 text-ink-500">
      <span className="font-mono text-[11px] tracking-[0.14em] uppercase">Loading…</span>
    </main>
  );
}
