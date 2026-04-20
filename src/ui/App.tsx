import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { TierView } from './components/TierView';
import { StatsModal } from './components/StatsModal';
import { SpeakerOffIcon, SpeakerOnIcon } from './components/icons';
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

export default function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [statsOpen, setStatsOpen] = useState(false);
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

  const muteButton = (
    <button
      type="button"
      onClick={handleToggleMute}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      className="fixed top-3 right-3 z-40 w-9 h-9 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
    >
      {muted ? (
        <SpeakerOffIcon className="w-4 h-4" />
      ) : (
        <SpeakerOnIcon className="w-4 h-4" />
      )}
    </button>
  );

  const statsOverlay = statsOpen ? (
    <StatsModal
      stats={stats}
      progress={progress}
      onDismiss={() => setStatsOpen(false)}
    />
  ) : null;

  if (view.kind === 'home') {
    return (
      <>
        {muteButton}
        <HomeScreen
          progress={progress}
          stats={stats}
          onPickTier={handlePickTier}
          onOpenStats={() => setStatsOpen(true)}
        />
        {statsOverlay}
      </>
    );
  }

  if (view.kind === 'tier') {
    return (
      <>
        {muteButton}
        <TierView
          tier={view.tier}
          progress={progress}
          onBack={handleBackToHome}
          onPickLevel={handlePickLevel}
        />
        {statsOverlay}
      </>
    );
  }

  const level = bakedLevel(view.levelId);
  return (
    <>
      {muteButton}
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
