import { useEffect, useMemo, useState } from 'react';
import {
  coordsForLevelId,
  maxStarsForTier,
  progressForLevel,
  tierForLevelId,
  tierStars,
} from '../../game/domain/levels';
import type { LevelProgressMap } from '../../game/domain/levels';
import { TOTAL_LEVELS, levelsInTier } from '../../game/domain/tiers';
import { Tier } from '../../game/domain/types';
import type { Stats } from '../../game/domain/stats';
import { FlameIcon, SpeakerOffIcon, SpeakerOnIcon } from './icons';

interface HomeScreenProps {
  readonly progress: LevelProgressMap;
  readonly stats: Stats;
  readonly muted: boolean;
  readonly onToggleMute: () => void;
  readonly onPickTier: (tier: Tier) => void;
  readonly onPickLevel: (levelId: number) => void;
  readonly onOpenStats: () => void;
}

function firstIncompleteLevelId(progress: LevelProgressMap): number {
  for (let id = 0; id < TOTAL_LEVELS; id++) {
    if (!progressForLevel(progress, id).completed) return id;
  }
  return TOTAL_LEVELS - 1;
}

function dailyLevelId(): number {
  const today = new Date();
  const key =
    today.getUTCFullYear() * 10000 +
    (today.getUTCMonth() + 1) * 100 +
    today.getUTCDate();
  const span = levelsInTier(Tier.Beginner) + levelsInTier(Tier.Intermediate);
  return key % span;
}

export function HomeScreen({
  progress,
  stats,
  muted,
  onToggleMute,
  onPickTier,
  onPickLevel,
  onOpenStats,
}: HomeScreenProps) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setEntering(false), 1400);
    return () => window.clearTimeout(t);
  }, []);

  const continueLevelId = useMemo(
    () => firstIncompleteLevelId(progress),
    [progress],
  );
  const continueTier = tierForLevelId(continueLevelId);
  const continueStars = progressForLevel(progress, continueLevelId).stars;
  const continueCoords = coordsForLevelId(continueLevelId);

  const todayDaily = useMemo(dailyLevelId, []);
  const dailyDone = progressForLevel(progress, todayDaily).completed;

  return (
    <main
      className="min-h-screen flex flex-col font-sans text-ink-900 select-none overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: 'var(--paper-50)',
        backgroundImage:
          'radial-gradient(rgba(120,100,60,0.05) 1px, transparent 1px), radial-gradient(rgba(195,154,62,0.05) 1px, transparent 1px)',
        backgroundSize: '3px 3px, 9px 9px',
        backgroundPosition: '0 0, 1px 2px',
      }}
    >
      <div className="relative w-full max-w-[390px] mx-auto flex flex-col flex-1">
        <TopBar muted={muted} onToggleMute={onToggleMute} onOpenStats={onOpenStats} />
        <HomeWordmark entering={entering} />
        <HomeStage
          entering={entering}
          continueLevelNumber={continueLevelId + 1}
          continueStars={continueStars}
          onPlay={() => onPickLevel(continueLevelId)}
        />
        <HomeDaily
          done={dailyDone}
          streak={stats.dayStreak}
          onPlay={() => onPickLevel(todayDaily)}
        />
        <HomeTierMap
          progress={progress}
          currentTier={continueTier}
          continueCoords={continueCoords}
          onPickTier={onPickTier}
        />
      </div>
    </main>
  );
}

function TopBar({
  muted,
  onToggleMute,
  onOpenStats,
}: {
  readonly muted: boolean;
  readonly onToggleMute: () => void;
  readonly onOpenStats: () => void;
}) {
  return (
    <div className="px-4 pt-5 flex items-center justify-between z-10">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        className="relative w-9 h-9 rounded-full bg-paper-50/70 backdrop-blur border border-rule-200 text-ink-700 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
      >
        <span aria-hidden="true" className="absolute -inset-2.5" />
        {muted ? (
          <SpeakerOffIcon className="w-[16px] h-[16px]" />
        ) : (
          <SpeakerOnIcon className="w-[16px] h-[16px]" />
        )}
      </button>
      <button
        type="button"
        onClick={onOpenStats}
        className="font-mono text-[10px] tracking-[0.08em] text-ink-500 border border-rule-200 bg-paper-50/60 rounded-full px-2.5 py-1 active:scale-95 transition-transform duration-nudge"
      >
        PARENTS · STATS
      </button>
    </div>
  );
}

function HomeWordmark({ entering }: { readonly entering: boolean }) {
  return (
    <div
      className="text-center mt-10"
      style={{
        animation: entering
          ? 'homeWmWobble 700ms 300ms cubic-bezier(.2,.7,.2,1) both'
          : undefined,
      }}
    >
      <div
        className="inline-flex items-baseline font-serif font-extrabold text-[54px] leading-none tracking-[-0.025em] text-ink-900"
        style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
      >
        <span>Suml</span>
        <span className="relative inline-block" style={{ width: '0.34em' }}>
          <span
            className="absolute bottom-0 rounded-[1px] bg-ink-900"
            style={{
              width: '0.12em',
              height: '0.64em',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
          <span
            className="absolute"
            style={{
              top: '-0.08em',
              left: '50%',
              transform: 'translateX(-50%) rotate(-6deg)',
              width: '0.38em',
              height: '0.38em',
              background: 'var(--ink-fill-800)',
              borderRadius: '3px',
              boxShadow:
                'inset 0 2px 2px rgba(20,24,40,.45), 0 1px 0 rgba(0,0,0,.1)',
            }}
          />
        </span>
        <span>ne</span>
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-[0.24em] uppercase text-ochre-700">
        Daily puzzles
      </div>
    </div>
  );
}

function HomeStage({
  entering,
  continueLevelNumber,
  continueStars,
  onPlay,
}: {
  readonly entering: boolean;
  readonly continueLevelNumber: number;
  readonly continueStars: number;
  readonly onPlay: () => void;
}) {
  const starSymbols =
    '★'.repeat(continueStars) + '☆'.repeat(Math.max(0, 3 - continueStars));
  return (
    <div className="relative flex items-center justify-center mt-2" style={{ height: 330 }}>
      <div className="relative" style={{ width: 330, height: 330 }}>
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            animation: entering
              ? 'homeSunSpin 60s linear infinite'
              : 'homeSunSpin 120s linear infinite',
          }}
          aria-hidden="true"
        >
          <Sunburst />
        </div>

        <BeaverHero entering={entering} />

        <button
          type="button"
          onClick={onPlay}
          className="absolute left-1/2 text-paper-50 font-serif font-bold active:translate-y-[2px] transition-transform duration-nudge"
          style={{
            top: 180,
            width: 214,
            height: 96,
            borderRadius: 28,
            fontSize: 40,
            letterSpacing: '0.04em',
            fontVariationSettings: '"SOFT" 60, "WONK" 1',
            color: '#fff',
            background:
              'linear-gradient(180deg, var(--ochre-500) 0%, var(--ochre-500) 60%, var(--ochre-600) 100%)',
            boxShadow:
              '0 8px 0 var(--ochre-700), 0 14px 24px rgba(139,107,30,0.38), inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.08)',
            zIndex: 3,
            animation: entering
              ? 'homePlayPulse 2.6s 1000ms ease-in-out infinite'
              : 'homePlayPulse 2.6s ease-in-out infinite',
            transform: 'translateX(-50%)',
          }}
        >
          <span style={{ textShadow: '0 2px 0 rgba(139,107,30,0.45)' }}>PLAY</span>
        </button>
        <div
          className="absolute left-1/2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-500 whitespace-nowrap"
          style={{ top: 288, transform: 'translateX(-50%)' }}
        >
          LEVEL {continueLevelNumber} ·{' '}
          <span className="text-ochre-600">{starSymbols}</span>
        </div>
      </div>
    </div>
  );
}

function Sunburst() {
  const rays = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x1 = 150 + Math.cos(a) * 70;
    const y1 = 150 + Math.sin(a) * 70;
    const x2 = 150 + Math.cos(a) * 145;
    const y2 = 150 + Math.sin(a) * 145;
    const x3 = 150 + Math.cos(a + 0.03) * 140;
    const y3 = 150 + Math.sin(a + 0.03) * 140;
    rays.push(
      <path
        key={i}
        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} Z`}
        fill="#F3E5BE"
        opacity={0.55}
      />,
    );
  }
  return (
    <svg viewBox="0 0 300 300" width={330} height={330}>
      {rays}
      <circle cx={150} cy={150} r={118} fill="#F3E5BE" opacity={0.4} />
    </svg>
  );
}

function BeaverHero({ entering }: { readonly entering: boolean }) {
  const ink = '#2A2722';
  const ink7 = '#4A453C';
  const body = '#E3C783';
  const bodyShade = '#C39A3E';
  const cheek = '#D06A40';
  const paper = '#FDFBF6';
  return (
    <svg
      viewBox="0 0 300 300"
      className="absolute"
      style={{
        left: '50%',
        top: 12,
        width: 290,
        height: 290,
        transform: 'translateX(-50%)',
        zIndex: 2,
        overflow: 'visible',
        animation: entering
          ? 'homeBeaverHop 900ms cubic-bezier(.2,.9,.3,1.15) both, homeBeaverBob 3s 900ms ease-in-out infinite'
          : 'homeBeaverBob 3s ease-in-out infinite',
      }}
      aria-hidden="true"
    >
      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: '90px 200px',
          animation: entering
            ? 'homeBvrTail 2.4s 1200ms ease-in-out infinite'
            : 'homeBvrTail 2.4s ease-in-out infinite',
        }}
      >
        <path
          d="M90 190 Q40 180 35 210 Q40 245 90 230 Z"
          fill={ink7}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d="M60 195 L80 200 M55 205 L82 210 M55 215 L80 220 M62 225 L82 224"
          stroke={ink}
          strokeWidth={1.2}
          opacity={0.35}
          fill="none"
        />
      </g>

      <ellipse cx={150} cy={200} rx={70} ry={60} fill={body} stroke={ink} strokeWidth={3.5} />
      <path
        d="M98 210 Q150 245 202 210"
        stroke={bodyShade}
        strokeWidth={2.4}
        fill="none"
        opacity={0.55}
      />
      <ellipse cx={118} cy={258} rx={14} ry={7} fill={ink7} stroke={ink} strokeWidth={2.6} />
      <ellipse cx={182} cy={258} rx={14} ry={7} fill={ink7} stroke={ink} strokeWidth={2.6} />

      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: '90% 90%',
          animation: entering
            ? 'homeBvrArm 4s 1600ms ease-in-out infinite'
            : 'homeBvrArm 4s ease-in-out infinite',
        }}
      >
        <path
          d="M205 170 Q235 150 240 120 Q243 102 232 96 Q220 95 218 115 Q216 140 198 165 Z"
          fill={body}
          stroke={ink}
          strokeWidth={3}
        />
        <circle cx={236} cy={105} r={11} fill={bodyShade} stroke={ink} strokeWidth={3} />
        <path
          d="M240 98 L246 92 M244 105 L252 104 M240 112 L246 118"
          stroke={ink}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>

      <path
        d="M98 165 Q75 175 72 195 Q70 215 88 220 Q104 218 106 200 Z"
        fill={body}
        stroke={ink}
        strokeWidth={3}
      />

      <g transform="translate(150 112)">
        <ellipse cx={0} cy={0} rx={56} ry={50} fill={body} stroke={ink} strokeWidth={3.5} />
        <circle cx={-42} cy={-38} r={11} fill={bodyShade} stroke={ink} strokeWidth={3} />
        <circle cx={42} cy={-38} r={11} fill={bodyShade} stroke={ink} strokeWidth={3} />
        <circle cx={-42} cy={-38} r={5} fill={ink} opacity={0.4} />
        <circle cx={42} cy={-38} r={5} fill={ink} opacity={0.4} />
        <ellipse cx={-34} cy={16} rx={10} ry={7} fill={cheek} opacity={0.55} />
        <ellipse cx={34} cy={16} rx={10} ry={7} fill={cheek} opacity={0.55} />
        <ellipse cx={0} cy={12} rx={26} ry={20} fill={paper} stroke={ink} strokeWidth={3} />
        <ellipse cx={0} cy={-2} rx={6} ry={4.5} fill={ink} />
        <path d="M0 3 L0 10" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        <path
          d="M-10 16 Q0 22 10 16"
          stroke={ink}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
        <rect x={-7} y={20} width={6.5} height={12} rx={1} fill={paper} stroke={ink} strokeWidth={1.8} />
        <rect x={0.5} y={20} width={6.5} height={12} rx={1} fill={paper} stroke={ink} strokeWidth={1.8} />
        <g className="beaver-eye">
          <circle cx={-22} cy={-10} r={6} fill={ink} />
          <circle cx={-20} cy={-12} r={2} fill={paper} />
        </g>
        <g className="beaver-eye">
          <circle cx={22} cy={-10} r={6} fill={ink} />
          <circle cx={24} cy={-12} r={2} fill={paper} />
        </g>
        <path
          d="M-32 -22 Q-22 -27 -12 -23"
          stroke={ink}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M12 -23 Q22 -27 32 -22"
          stroke={ink}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function HomeDaily({
  done,
  streak,
  onPlay,
}: {
  readonly done: boolean;
  readonly streak: number;
  readonly onPlay: () => void;
}) {
  return (
    <div className="px-5 mt-4">
      <button
        type="button"
        onClick={onPlay}
        className="relative w-full flex items-center justify-between pl-16 pr-4 py-3.5 rounded-[14px] border-[1.5px] active:scale-[0.99] transition-transform duration-nudge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-500/60"
        style={{
          background: done ? 'var(--paper-100)' : 'var(--paper-200)',
          borderColor: 'var(--rule-300)',
          minHeight: 72,
          opacity: done ? 0.75 : 1,
          boxShadow:
            '0 2px 0 rgba(0,0,0,0.04), 0 6px 14px rgba(60,42,20,0.08)',
          animation: 'homeDailyFloat 4s ease-in-out infinite',
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 rounded-l-[12px]"
          style={{
            width: 56,
            background: done
              ? 'linear-gradient(135deg, var(--paper-200) 50%, var(--paper-100) 50%)'
              : 'linear-gradient(135deg, var(--paper-300) 50%, var(--paper-200) 50%)',
            borderRight: '1.5px dashed var(--rule-300)',
          }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 left-3 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: done ? 'var(--sage-500)' : 'var(--clay-500)',
            boxShadow:
              'inset 0 -2px 0 rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.15)',
            color: '#fff',
          }}
        >
          {done ? <CheckIcon className="w-4 h-4" /> : <EnvelopeIcon className="w-4 h-4" />}
        </span>
        <span className="text-left">
          <span className="block font-serif text-[16px] font-semibold text-ink-900">
            {done ? "Today's puzzle" : 'A puzzle for today!'}
            {done && <span className="text-sage-700"> ✓</span>}
          </span>
          <span className="block font-sans text-[12px] text-ink-700 mt-px">
            {done ? 'Come back tomorrow' : 'Tap to unwrap · ends at midnight'}
          </span>
        </span>
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-ochre-700 shrink-0"
            style={{
              background: 'var(--ochre-100)',
              border: '1px solid var(--ochre-500)',
              padding: '3px 8px',
              borderRadius: 99,
            }}
          >
            <FlameIcon className="w-2.5 h-2.5" />
            {streak}
          </span>
        )}
      </button>
    </div>
  );
}

function CheckIcon({ className }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EnvelopeIcon({ className }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x={5}
        y={6}
        width={14}
        height={13}
        rx={1.5}
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9l7 5 7-5"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type TierMotif = 'pond' | 'stream' | 'river' | 'waterfall' | 'lake';

interface TierStop {
  readonly tier: Tier;
  readonly name: string;
  readonly motif: TierMotif;
  readonly xPct: number;
  readonly y: number;
}

const TIER_STOPS: readonly TierStop[] = [
  { tier: Tier.Beginner, name: 'Pond', motif: 'pond', xPct: 12.8, y: 30 },
  { tier: Tier.Intermediate, name: 'Stream', motif: 'stream', xPct: 35.9, y: 80 },
  { tier: Tier.Advanced, name: 'River', motif: 'river', xPct: 58.9, y: 30 },
  { tier: Tier.Expert, name: 'Waterfall', motif: 'waterfall', xPct: 78.2, y: 85 },
  { tier: Tier.Master, name: 'Lake', motif: 'lake', xPct: 95.0, y: 30 },
];

function HomeTierMap({
  progress,
  currentTier,
  continueCoords,
  onPickTier,
}: {
  readonly progress: LevelProgressMap;
  readonly currentTier: Tier;
  readonly continueCoords: { readonly batchIndexInTier: number; readonly indexInBatch: number };
  readonly onPickTier: (tier: Tier) => void;
}) {
  void continueCoords;
  const pathD = useMemo(() => {
    const p = TIER_STOPS.map(s => ({ x: (s.xPct / 100) * 390, y: s.y + 28 }));
    return `M${p[0]!.x} ${p[0]!.y} Q ${(p[0]!.x + p[1]!.x) / 2} ${p[0]!.y + 22} ${p[1]!.x} ${p[1]!.y} Q ${(p[1]!.x + p[2]!.x) / 2} ${p[1]!.y + 22} ${p[2]!.x} ${p[2]!.y} Q ${(p[2]!.x + p[3]!.x) / 2} ${p[2]!.y + 22} ${p[3]!.x} ${p[3]!.y} Q ${(p[3]!.x + p[4]!.x) / 2} ${p[3]!.y + 22} ${p[4]!.x} ${p[4]!.y}`;
  }, []);

  return (
    <div className="relative flex-1 mt-4 pb-8" style={{ minHeight: 180 }}>
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 390 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={pathD}
          stroke="var(--rule-300)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="5 7"
          fill="none"
        />
      </svg>
      {TIER_STOPS.map(stop => {
        const earned = tierStars(progress, stop.tier);
        const max = maxStarsForTier(stop.tier);
        const isCurrent = stop.tier === currentTier;
        const untouched = earned === 0 && !isCurrent;
        const state: TierVisualState = isCurrent
          ? 'current'
          : untouched
            ? 'locked'
            : 'unlocked';
        return (
          <TierStopPin
            key={stop.tier}
            stop={stop}
            state={state}
            earned={earned}
            max={max}
            onPick={() => onPickTier(stop.tier)}
          />
        );
      })}
    </div>
  );
}

type TierVisualState = 'current' | 'unlocked' | 'locked';

function TierStopPin({
  stop,
  state,
  earned,
  max,
  onPick,
}: {
  readonly stop: TierStop;
  readonly state: TierVisualState;
  readonly earned: number;
  readonly max: number;
  readonly onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="absolute flex flex-col items-center active:scale-95 transition-transform duration-nudge focus-visible:outline-none"
      style={{
        left: `calc(${stop.xPct}% - 28px)`,
        top: stop.y,
        width: 56,
      }}
      aria-label={`${stop.name} tier, ${earned} of ${max} stars`}
    >
      <span aria-hidden="true" className="absolute -inset-2" />
      <span
        className="flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background:
            state === 'current'
              ? 'var(--ochre-500)'
              : state === 'unlocked'
                ? 'var(--sage-500)'
                : 'var(--paper-200)',
          border: '2px solid var(--ink-900)',
          boxShadow:
            '0 4px 0 var(--ink-900), 0 6px 10px rgba(0,0,0,0.12)',
          animation:
            state === 'current' ? 'homeTierPulse 2.2s ease-in-out infinite' : undefined,
        }}
      >
        {state === 'locked' ? <LockedDoor /> : <TierMotifIcon motif={stop.motif} />}
      </span>
      <div
        className="mt-1.5 text-center font-serif font-semibold text-[13px] leading-none"
        style={{
          color: state === 'locked' ? 'var(--ink-500)' : 'var(--ink-900)',
        }}
      >
        {stop.name}
      </div>
      <div
        className="mt-1 font-mono text-[10px]"
        style={{
          color:
            state === 'locked'
              ? 'var(--ink-500)'
              : 'var(--ochre-700)',
        }}
      >
        {state === 'locked' ? 'locked' : `★ ${earned}/${max}`}
      </div>
    </button>
  );
}

function TierMotifIcon({ motif }: { readonly motif: TierMotif }) {
  const size = 32;
  switch (motif) {
    case 'pond':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
          <ellipse
            cx={16}
            cy={20}
            rx={12}
            ry={5}
            fill="#4E6B4A"
            stroke="#2A2722"
            strokeWidth={2}
          />
          <path
            d="M10 18 Q16 15 22 18"
            stroke="#FDFBF6"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            opacity={0.8}
          />
          <path d="M22 10 Q24 12 22 14 Q20 12 22 10Z" fill="#4E6B4A" />
        </svg>
      );
    case 'stream':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
          <path
            d="M4 10 Q12 14 16 10 Q20 6 28 10 M4 18 Q12 22 16 18 Q20 14 28 18 M4 26 Q12 30 16 26 Q20 22 28 26"
            stroke="#FDFBF6"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'river':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
          <path
            d="M6 6 Q10 14 8 20 Q6 26 10 28 M14 4 Q18 12 16 18 Q14 26 18 28 M22 6 Q26 14 24 20 Q22 26 26 28"
            stroke="#FDFBF6"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'waterfall':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
          <path
            d="M6 6 L6 20 Q6 24 10 24 L22 24 Q26 24 26 20 L26 6"
            stroke="#FDFBF6"
            strokeWidth={1.8}
            fill="none"
          />
          <path
            d="M10 8 L10 22 M14 8 L14 22 M18 8 L18 22 M22 8 L22 22"
            stroke="#FDFBF6"
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.7}
          />
          <circle cx={10} cy={26} r={1.2} fill="#FDFBF6" />
          <circle cx={18} cy={27} r={1.2} fill="#FDFBF6" />
          <circle cx={22} cy={26} r={1.2} fill="#FDFBF6" />
        </svg>
      );
    case 'lake':
      return (
        <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
          <ellipse
            cx={16}
            cy={17}
            rx={13}
            ry={9}
            fill="#4E6B4A"
            stroke="#2A2722"
            strokeWidth={2}
          />
          <path
            d="M5 14 Q16 8 27 14"
            stroke="#FDFBF6"
            strokeWidth={1.4}
            fill="none"
            opacity={0.6}
          />
        </svg>
      );
  }
}

function LockedDoor() {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} fill="none" aria-hidden="true">
      <rect
        x={9}
        y={8}
        width={14}
        height={18}
        rx={1.5}
        fill="#D4A748"
        stroke="#2A2722"
        strokeWidth={2}
      />
      <path
        d="M11 12 L21 12 M11 16 L21 16 M11 20 L21 20"
        stroke="#8B6B1E"
        strokeWidth={1}
        opacity={0.6}
      />
      <circle cx={19} cy={17} r={1.3} fill="#2A2722" />
    </svg>
  );
}
