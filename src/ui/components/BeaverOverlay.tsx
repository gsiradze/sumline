import { useEffect, useRef, useState } from 'react';
import { CELL_COUNT, GRID_SIZE, GameOutcome } from '../../game/domain/types';
import { layout } from '../../game/rendering/tokens';
import type { ActiveGameState } from '../../game/domain/game-state';

interface BeaverOverlayProps {
  readonly state: ActiveGameState;
  readonly levelId: number;
}

type Pose = 'a' | 'b' | 'c';

const GRID_WIDTH =
  GRID_SIZE * layout.cellSize + (GRID_SIZE - 1) * layout.cellGap;
const ORIGIN_X = Math.round((layout.canvasWidth - GRID_WIDTH) / 2);

function poseFor(levelId: number, r: number, c: number): Pose {
  const h = Math.abs(levelId * 11 + r * 7 + c * 3) % 3;
  return (['a', 'b', 'c'] as const)[h]!;
}

export function BeaverOverlay({ state, levelId }: BeaverOverlayProps) {
  const prevLockedRef = useRef<readonly boolean[] | null>(null);
  const prevPuzzleRef = useRef(state.puzzle);

  const isNewPuzzle = prevPuzzleRef.current !== state.puzzle;
  const prev = isNewPuzzle ? null : prevLockedRef.current;

  const justLocked = new Set<number>();
  if (prev) {
    let regression = false;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (prev[i] && !state.lockedFilled[i]) {
        regression = true;
        break;
      }
    }
    if (!regression) {
      for (let i = 0; i < CELL_COUNT; i++) {
        if (state.lockedFilled[i] && !prev[i]) justLocked.add(i);
      }
    }
  }

  prevLockedRef.current = state.lockedFilled;
  prevPuzzleRef.current = state.puzzle;

  const isWon = state.outcome === GameOutcome.Won;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {Array.from({ length: CELL_COUNT }).map((_, i) => {
        if (!state.lockedFilled[i]) return null;
        const r = Math.floor(i / GRID_SIZE);
        const c = i % GRID_SIZE;
        const x = ORIGIN_X + c * (layout.cellSize + layout.cellGap);
        const y = layout.gridOriginY + r * (layout.cellSize + layout.cellGap);
        return (
          <g
            key={i}
            transform={`translate(${x} ${y}) scale(${layout.cellSize / 100})`}
          >
            <Beaver
              pose={poseFor(levelId, r, c)}
              settleIn={justLocked.has(i)}
              celebrateDelay={isWon ? (r * GRID_SIZE + c) * 40 : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}

interface BeaverProps {
  readonly pose: Pose;
  readonly settleIn: boolean;
  readonly celebrateDelay: number | undefined;
}

function Beaver({ pose, settleIn, celebrateDelay }: BeaverProps) {
  const [settling, setSettling] = useState(settleIn);
  useEffect(() => {
    if (!settleIn) return;
    const t = window.setTimeout(() => setSettling(false), 520);
    return () => window.clearTimeout(t);
  }, [settleIn]);

  const celebrating = celebrateDelay !== undefined;
  const rootClass = celebrating
    ? 'beaver-root beaver-celebrating'
    : settling
      ? 'beaver-root beaver-settled'
      : 'beaver-root beaver-static';
  const rootStyle =
    celebrating && celebrateDelay !== undefined
      ? { animationDelay: `${celebrateDelay}ms` }
      : undefined;

  return (
    <g className={rootClass} style={rootStyle}>
      <BeaverBody pose={pose} blink={!celebrating} />
      {celebrating && <ExclamationMark delay={celebrateDelay ?? 0} />}
    </g>
  );
}

const COLORS = {
  ink: '#2A2722',
  ink7: '#4A453C',
  body: '#E3C783',
  bodyShade: '#C39A3E',
  cheek: '#C46A47',
  paper: '#FDFBF6',
} as const;

function BeaverBody({ pose, blink }: { readonly pose: Pose; readonly blink: boolean }) {
  const headTilt = pose === 'b' ? -7 : pose === 'c' ? 4 : 0;
  const tailRot = pose === 'c' ? -10 : pose === 'b' ? 6 : 0;
  const eyeClass = blink ? 'beaver-eye' : undefined;

  return (
    <g>
      <g
        transform={`rotate(${tailRot} 60 62)`}
        style={{ transformBox: 'fill-box' }}
      >
        <path
          d="M58 58 Q82 54 86 64 Q82 76 58 72 Z"
          fill={COLORS.ink7}
          stroke={COLORS.ink}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
        <path
          d="M64 60 L84 64 M62 64 L85 68 M62 68 L83 71"
          stroke={COLORS.ink}
          strokeWidth={1}
          opacity={0.35}
          fill="none"
        />
      </g>

      <ellipse
        cx={50}
        cy={62}
        rx={26}
        ry={22}
        fill={COLORS.body}
        stroke={COLORS.ink}
        strokeWidth={2.7}
      />
      <path
        d="M34 64 Q50 76 66 64"
        stroke={COLORS.bodyShade}
        strokeWidth={1.6}
        fill="none"
        opacity={0.6}
      />
      <ellipse
        cx={38}
        cy={82}
        rx={5}
        ry={3}
        fill={COLORS.ink7}
        stroke={COLORS.ink}
        strokeWidth={2}
      />
      <ellipse
        cx={62}
        cy={82}
        rx={5}
        ry={3}
        fill={COLORS.ink7}
        stroke={COLORS.ink}
        strokeWidth={2}
      />

      <g transform={`rotate(${headTilt} 50 40)`}>
        <ellipse
          cx={50}
          cy={40}
          rx={20}
          ry={18}
          fill={COLORS.body}
          stroke={COLORS.ink}
          strokeWidth={2.7}
        />
        <circle
          cx={33}
          cy={27}
          r={4.2}
          fill={COLORS.bodyShade}
          stroke={COLORS.ink}
          strokeWidth={2.2}
        />
        <circle
          cx={67}
          cy={27}
          r={4.2}
          fill={COLORS.bodyShade}
          stroke={COLORS.ink}
          strokeWidth={2.2}
        />
        <circle cx={35} cy={46} r={3} fill={COLORS.cheek} opacity={0.55} />
        <circle cx={65} cy={46} r={3} fill={COLORS.cheek} opacity={0.55} />
        <ellipse
          cx={50}
          cy={46}
          rx={9}
          ry={7}
          fill={COLORS.paper}
          stroke={COLORS.ink}
          strokeWidth={2.2}
        />
        <ellipse cx={50} cy={42} rx={2.2} ry={1.6} fill={COLORS.ink} />
        <rect
          x={47}
          y={46}
          width={2.6}
          height={5}
          fill={COLORS.paper}
          stroke={COLORS.ink}
          strokeWidth={1.2}
        />
        <rect
          x={50.4}
          y={46}
          width={2.6}
          height={5}
          fill={COLORS.paper}
          stroke={COLORS.ink}
          strokeWidth={1.2}
        />
        <g className={eyeClass}>
          <circle cx={40} cy={36} r={2.4} fill={COLORS.ink} />
          <circle cx={40.8} cy={35.4} r={0.7} fill={COLORS.paper} />
        </g>
        <g className={eyeClass}>
          <circle cx={60} cy={36} r={2.4} fill={COLORS.ink} />
          <circle cx={60.8} cy={35.4} r={0.7} fill={COLORS.paper} />
        </g>
      </g>

      <Prop pose={pose} />
    </g>
  );
}

function Prop({ pose }: { readonly pose: Pose }) {
  if (pose === 'a') {
    return (
      <g>
        <g
          stroke={COLORS.ink}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M32 72 L68 72" />
          <path d="M40 72 L36 66" />
          <path d="M52 72 L56 66" />
          <path d="M60 72 L58 68" />
        </g>
        <circle cx={40} cy={65} r={2.2} fill={COLORS.bodyShade} />
        <circle cx={58} cy={65} r={1.8} fill={COLORS.bodyShade} />
      </g>
    );
  }
  if (pose === 'b') {
    return (
      <g transform="translate(67 28) rotate(40)">
        <rect
          x={-1.5}
          y={0}
          width={3}
          height={14}
          fill={COLORS.bodyShade}
          stroke={COLORS.ink}
          strokeWidth={1.4}
        />
        <path d="M-1.5 0 L0 -3 L1.5 0 Z" fill={COLORS.ink} />
        <rect x={-1.5} y={11} width={3} height={3} fill={COLORS.cheek} />
      </g>
    );
  }
  return (
    <g transform="translate(50 70) rotate(-8)">
      <rect
        x={-20}
        y={-4}
        width={40}
        height={8}
        rx={1.5}
        fill={COLORS.bodyShade}
        stroke={COLORS.ink}
        strokeWidth={2.2}
      />
      <path
        d="M-14 -4 L-14 4 M-4 -4 L-4 4 M6 -4 L6 4 M14 -4 L14 4"
        stroke={COLORS.ink}
        strokeWidth={1}
        opacity={0.35}
        fill="none"
      />
    </g>
  );
}

function ExclamationMark({ delay }: { readonly delay: number }) {
  return (
    <g className="beaver-excl" style={{ animationDelay: `${delay}ms` }}>
      <rect
        x={-1.6}
        y={-10}
        width={3.2}
        height={9}
        rx={1.2}
        fill={COLORS.bodyShade}
        stroke={COLORS.ink}
        strokeWidth={1.6}
      />
      <circle
        cx={0}
        cy={3}
        r={1.8}
        fill={COLORS.bodyShade}
        stroke={COLORS.ink}
        strokeWidth={1.6}
      />
    </g>
  );
}
