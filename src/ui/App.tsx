import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { TierView } from './components/TierView';
import { StatsModal } from './components/StatsModal';
import { Splash } from './components/Splash';
import {
  getMuted,
  purgeLegacyKeys,
  setMuted as persistMuted,
} from '../storage/persistence';
import { sound } from '../game/audio/soundManager';
import { bakedLevel } from '../storage/levelsManifest';
import { tierForLevelId } from '../game/domain/levels';
import type { Tier } from '../game/domain/types';
import { useProgress } from './hooks/useProgress';
import { useStats } from './hooks/useStats';
import { registerNav } from '../testHook';

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
  const [splashing, setSplashing] = useState(shouldShowSplash);
  const { progress, recordLevelWin } = useProgress();
  const { stats, onWin: onStatsWin, onLoss: onStatsLoss } = useStats();
  const [muted, setMutedState] = useState(() => getMuted());

  useEffect(() => {
    purgeLegacyKeys();
  }, []);

  useEffect(() => {
    sound.setMuted(muted);
  }, [muted]);

  const handleToggleMute = useCallback(() => {
    setMutedState(prev => {
      const next = !prev;
      persistMuted(next);
      return next;
    });
  }, []);

  const handlePickTier = useCallback((tier: Tier) => {
    setView({ kind: 'tier', tier });
  }, []);

  const handlePickLevel = useCallback((levelId: number) => {
    setView({ kind: 'level', levelId });
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
        />
        {statsOverlay}
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
          onGotoLevel={handlePickLevel}
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
