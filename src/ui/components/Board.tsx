import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { canToggle } from '../../game/domain/game-state';
import type { ActiveGameState } from '../../game/domain/game-state';
import { beginStroke, extendStroke, toolForStroke } from '../../game/domain/stroke';
import type { StrokeKind, StrokeTool } from '../../game/domain/stroke';
import { CELL_COUNT, Feedback, GameOutcome } from '../../game/domain/types';
import {
  CELL_PITCH,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  cellAtPoint,
  cellOrigin,
  cellsAlong,
  layout,
  motion,
} from './boardLayout';
import type { BoardPoint } from './boardLayout';

/** Cells and clue numbers picked out for the player (tutorial steps, a fresh hint). */
export interface BoardSpotlight {
  readonly cells: readonly number[];
  readonly rows?: readonly number[];
  readonly cols?: readonly number[];
}

interface BoardProps {
  readonly state: ActiveGameState;
  /** What a tap or drag does. Holding a cell always pencils a note. */
  readonly tool: StrokeTool;
  readonly onMark: (index: number) => void;
  readonly onNote: (index: number) => void;
  readonly inputDisabled?: boolean;
  /** False while a saved attempt is still loading: its history is drawn, not replayed. */
  readonly animate?: boolean;
  readonly spotlight?: BoardSpotlight | null;
}

type CellLook =
  | 'empty'
  | 'note'
  | 'marked'
  | 'marked-wrong'
  | 'locked-filled'
  | 'locked-empty'
  | 'locked-wrong';

interface Stroke {
  readonly pointerId: number;
  readonly startCell: number;
  readonly start: BoardPoint;
  last: BoardPoint;
  /** Null until the stroke has acted on its first cell. */
  kind: StrokeKind | null;
  /** The first cell refused the action (every mark already placed): nothing more happens. */
  dead: boolean;
  /** True once the finger is painting; the release is then not a tap. */
  painting: boolean;
  /** The board as it will be once the changes sent so far have landed. */
  predicted: ActiveGameState;
  readonly visited: Set<number>;
  holdTimer: number | null;
}

// A finger that strays into the next cell by less than this still taps the cell
// it landed on. Past it, and over another cell, the touch becomes a drag.
const DRAG_START = CELL_PITCH * 0.4;
const SHIMMER_STEP_MS = 22;
// Fraunces digits hang below the line; lifted so they look centred on their row.
const CLUE_LIFT = 1.5;
const CLUE_FONT: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontWeight: 500,
  fontSize: layout.clueFontSize,
};

function wrongMarksIn(state: ActiveGameState, from: number): Set<number> {
  const wrong = new Set<number>();
  for (let g = from; g < state.guesses.length; g++) {
    const guess = state.guesses[g];
    const feedback = state.feedbacks[g];
    if (!guess || !feedback) continue;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (guess[i] === 1 && feedback[i] === Feedback.Red) wrong.add(i);
    }
  }
  return wrong;
}

export function Board({
  state,
  tool,
  onMark,
  onNote,
  inputDisabled = false,
  animate = true,
  spotlight = null,
}: BoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const [nudges, setNudges] = useState<Readonly<Record<number, number>>>({});
  const [flash, setFlash] = useState<ReadonlySet<number> | null>(null);
  const [shimmer, setShimmer] = useState(false);

  // Pointer handlers read the latest props through this, so they never go stale mid-stroke.
  const live = useRef({ state, tool, onMark, onNote, inputDisabled });
  live.current = { state, tool, onMark, onNote, inputDisabled };

  const endStroke = useCallback((): void => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    if (stroke.holdTimer !== null) window.clearTimeout(stroke.holdTimer);
    stroke.holdTimer = null;
    strokeRef.current = null;
  }, []);

  // A guess, a hint, a new level or a blocking overlay ends any touch in progress.
  useEffect(endStroke, [
    endStroke,
    state.puzzle,
    state.guesses.length,
    state.hintsUsed,
    state.outcome,
    inputDisabled,
  ]);
  useEffect(() => endStroke, [endStroke]);

  // Only a guess made while this board is on screen is animated. A restored
  // attempt arrives with its whole history at once and is simply drawn.
  const seen = useRef<{ state: ActiveGameState; animate: boolean } | null>(null);
  useLayoutEffect(() => {
    const prev = seen.current;
    seen.current = { state, animate };
    const sameGame = !!prev && prev.state.puzzle === state.puzzle;
    if (sameGame && prev.state.guesses.length === state.guesses.length) return;
    setNudges({});
    setFlash(null);
    setShimmer(false);
    if (!sameGame || !animate || !prev.animate) return;
    if (state.guesses.length !== prev.state.guesses.length + 1) return;
    if (state.outcome === GameOutcome.Won) {
      setShimmer(true);
      return;
    }
    const wrong = wrongMarksIn(state, state.guesses.length - 1);
    if (wrong.size > 0) setFlash(wrong);
  }, [state, animate]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), motion.wrongFlashMs);
    return () => window.clearTimeout(t);
  }, [flash]);

  const toBoard = (e: {
    readonly clientX: number;
    readonly clientY: number;
  }): BoardPoint | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const scale = Math.min(rect.width / layout.width, rect.height / layout.height);
    return {
      x: (e.clientX - rect.left - (rect.width - layout.width * scale) / 2) / scale,
      y: (e.clientY - rect.top - (rect.height - layout.height * scale) / 2) / scale,
    };
  };

  const send = (cell: number, kind: StrokeKind): void => {
    if (toolForStroke(kind) === 'mark') live.current.onMark(cell);
    else live.current.onNote(cell);
    setNudges(n => ({ ...n, [cell]: (n[cell] ?? 0) + 1 }));
  };

  const begin = (stroke: Stroke, withTool: StrokeTool): void => {
    stroke.visited.add(stroke.startCell);
    const begun = beginStroke(stroke.predicted, stroke.startCell, withTool);
    if (!begun) {
      stroke.dead = true;
      return;
    }
    stroke.kind = begun.kind;
    stroke.predicted = begun.state;
    send(stroke.startCell, begun.kind);
  };

  const extend = (stroke: Stroke, cell: number): void => {
    if (stroke.dead || stroke.kind === null || stroke.visited.has(cell)) return;
    stroke.visited.add(cell);
    const next = extendStroke(stroke.predicted, cell, stroke.kind);
    if (next === stroke.predicted) return;
    stroke.predicted = next;
    send(cell, stroke.kind);
  };

  const stopHold = (stroke: Stroke): void => {
    if (stroke.holdTimer === null) return;
    window.clearTimeout(stroke.holdTimer);
    stroke.holdTimer = null;
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const { state: now, inputDisabled: blocked } = live.current;
    if (blocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (strokeRef.current) {
      // A second finger is ignored; a new first finger means the old touch is gone.
      if (!e.isPrimary) return;
      endStroke();
    }
    const point = toBoard(e);
    const cell = point ? cellAtPoint(point) : null;
    if (!point || cell === null || !canToggle(now, cell)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; the stroke simply ends with its release.
    }
    const stroke: Stroke = {
      pointerId: e.pointerId,
      startCell: cell,
      start: point,
      last: point,
      kind: null,
      dead: false,
      painting: false,
      predicted: now,
      visited: new Set(),
      holdTimer: null,
    };
    // Holding still pencils a "ruled out" note; dragging on from there pencils more.
    stroke.holdTimer = window.setTimeout(() => {
      stroke.holdTimer = null;
      if (strokeRef.current !== stroke || stroke.painting) return;
      stroke.painting = true;
      begin(stroke, 'note');
    }, motion.longPressMs);
    strokeRef.current = stroke;
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const stroke = strokeRef.current;
    if (!stroke || e.pointerId !== stroke.pointerId) return;
    const native = e.nativeEvent;
    const coalesced =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    for (const sample of coalesced.length > 0 ? coalesced : [native]) {
      const point = toBoard(sample);
      if (!point) continue;
      if (!stroke.painting) {
        const cell = cellAtPoint(point);
        if (cell !== stroke.startCell) stopHold(stroke);
        const moved = Math.hypot(point.x - stroke.start.x, point.y - stroke.start.y);
        if (cell === null || cell === stroke.startCell || moved < DRAG_START) {
          stroke.last = point;
          continue;
        }
        stroke.painting = true;
        begin(stroke, live.current.tool);
      }
      for (const cell of cellsAlong(stroke.last, point)) extend(stroke, cell);
      stroke.last = point;
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const stroke = strokeRef.current;
    if (!stroke || e.pointerId !== stroke.pointerId) return;
    endStroke();
    if (stroke.painting) return;
    // A tap. Letting go well off the cell it started on cancels it.
    const point = toBoard(e);
    const moved = point ? Math.hypot(point.x - stroke.start.x, point.y - stroke.start.y) : 0;
    const cell = point ? cellAtPoint(point) : stroke.startCell;
    if (cell === stroke.startCell || moved < DRAG_START) begin(stroke, live.current.tool);
  };

  const handlePointerCancel = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (strokeRef.current?.pointerId === e.pointerId) endStroke();
  };

  const handleLostCapture = (e: ReactPointerEvent<SVGSVGElement>): void => {
    // The same event also bubbles up from a cell when the board takes a touch
    // over from it; only the board itself losing the touch ends the stroke.
    if (e.target === e.currentTarget) handlePointerCancel(e);
  };

  const wrongEver = useMemo(() => wrongMarksIn(state, 0), [state]);
  const playable = state.outcome === GameOutcome.InProgress && !inputDisabled;
  const lit = useMemo(() => new Set(spotlight?.cells ?? []), [spotlight]);

  const lookFor = (i: number): CellLook => {
    if (flash?.has(i)) return 'marked-wrong';
    if (state.lockedFilled[i]) return 'locked-filled';
    if (state.lockedEmpty[i]) return wrongEver.has(i) ? 'locked-wrong' : 'locked-empty';
    if (state.currentMarks[i] === 1) return 'marked';
    if (state.emptyNotes[i]) return 'note';
    return 'empty';
  };

  return (
    <svg
      ref={svgRef}
      data-board=""
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="block w-full h-full overflow-visible touch-none select-none"
      role="img"
      aria-label="Puzzle board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostCapture}
      onContextMenu={e => e.preventDefault()}
    >
      {state.puzzle.colSums.map((sum, c) => (
        <Clue
          key={`c${c}`}
          x={GRID_ORIGIN_X + c * CELL_PITCH + layout.cellSize / 2}
          y={GRID_ORIGIN_Y - layout.clueGutter}
          value={sum}
          lit={spotlight?.cols?.includes(c) ?? false}
        />
      ))}
      {state.puzzle.rowSums.map((sum, r) => (
        <Clue
          key={`r${r}`}
          x={GRID_ORIGIN_X - layout.clueGutter}
          y={GRID_ORIGIN_Y + r * CELL_PITCH + layout.cellSize / 2}
          value={sum}
          lit={spotlight?.rows?.includes(r) ?? false}
        />
      ))}
      {Array.from({ length: CELL_COUNT }, (_, i) => {
        const { x, y } = cellOrigin(i);
        const look = lookFor(i);
        const open = playable && canToggle(state, i);
        const motionClass = shimmer
          ? 'cell-anim cell-shimmer'
          : look === 'marked-wrong'
            ? 'cell-anim cell-flash'
            : nudges[i]
              ? 'cell-anim cell-nudge'
              : 'cell-anim';
        return (
          <g
            key={i}
            transform={`translate(${x} ${y})`}
            data-cell={i}
            data-look={look}
            className={open ? 'cursor-pointer' : undefined}
          >
            <g
              key={shimmer ? 'won' : `${look === 'marked-wrong'}-${nudges[i] ?? 0}`}
              className={motionClass}
              style={shimmer ? { animationDelay: `${i * SHIMMER_STEP_MS}ms` } : undefined}
            >
              <CellFace look={look} />
            </g>
            {lit.has(i) && (
              <rect
                x={-2.5}
                y={-2.5}
                width={layout.cellSize + 5}
                height={layout.cellSize + 5}
                rx={layout.cellRadius + 2.5}
                className="board-ring fill-none stroke-ochre-500"
                strokeWidth={3}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Clue({
  x,
  y,
  value,
  lit,
}: {
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly lit: boolean;
}) {
  return (
    <>
      {lit && (
        <circle
          cx={x}
          cy={y}
          r={16}
          className="board-ring fill-ochre-100 stroke-ochre-500"
          strokeWidth={1.5}
        />
      )}
      <text
        x={x}
        y={y - CLUE_LIFT}
        textAnchor="middle"
        dominantBaseline="central"
        className={lit ? 'fill-ochre-700' : 'fill-ink-700'}
        style={CLUE_FONT}
      >
        {value}
      </text>
    </>
  );
}

const SIZE = layout.cellSize;
const RADIUS = layout.cellRadius;
const MID = SIZE / 2;

function Tile({
  className,
  strokeWidth = 1,
}: {
  readonly className: string;
  readonly strokeWidth?: number;
}) {
  return (
    <rect
      x={0.5}
      y={0.5}
      width={SIZE - 1}
      height={SIZE - 1}
      rx={RADIUS}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}

function Dash({
  half,
  className,
  strokeWidth,
  opacity,
}: {
  readonly half: number;
  readonly className: string;
  readonly strokeWidth: number;
  readonly opacity: number;
}) {
  return (
    <line
      x1={MID - half}
      y1={MID}
      x2={MID + half}
      y2={MID}
      className={className}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
    />
  );
}

function Cross({
  arm,
  className,
  strokeWidth,
  opacity,
}: {
  readonly arm: number;
  readonly className: string;
  readonly strokeWidth: number;
  readonly opacity: number;
}) {
  return (
    <path
      d={`M${MID - arm} ${MID - arm}L${MID + arm} ${MID + arm}M${MID + arm} ${MID - arm}L${MID - arm} ${MID + arm}`}
      className={`fill-none ${className}`}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
    />
  );
}

function CellFace({ look }: { readonly look: CellLook }) {
  switch (look) {
    case 'empty':
      return <Tile className="fill-paper-50 stroke-rule-200" />;
    case 'note':
      // The player's own pencil mark: same paper as an open cell, with a plain
      // ink dash. Locked-empty cells are tinted, so the two never look alike.
      return (
        <>
          <Tile className="fill-paper-50 stroke-rule-300" />
          <Dash half={9} className="stroke-ink-400" strokeWidth={3} opacity={0.9} />
        </>
      );
    case 'marked':
      return (
        <>
          <rect width={SIZE} height={SIZE} rx={RADIUS} className="fill-fill-800" />
          <rect
            x={RADIUS}
            width={SIZE - RADIUS * 2}
            height={3}
            className="fill-fill-900"
            fillOpacity={0.45}
          />
          <rect
            x={RADIUS}
            y={SIZE - 3}
            width={SIZE - RADIUS * 2}
            height={3}
            fill="#fff"
            fillOpacity={0.04}
          />
        </>
      );
    case 'marked-wrong':
      return (
        <>
          <Tile className="fill-clay-500 stroke-clay-700" strokeWidth={1.5} />
          <Cross arm={SIZE * 0.22} className="stroke-paper-50" strokeWidth={2.75} opacity={0.95} />
        </>
      );
    case 'locked-filled':
      return (
        <>
          <Tile className="fill-sage-500 stroke-sage-600" />
          <circle cx={SIZE - 12} cy={12} r={5} className="fill-sage-700" fillOpacity={0.55} />
        </>
      );
    case 'locked-wrong':
      return (
        <>
          <Tile className="fill-clay-100 stroke-clay-300" />
          <Cross arm={SIZE * 0.2} className="stroke-clay-700" strokeWidth={2.25} opacity={0.75} />
        </>
      );
    case 'locked-empty':
      return (
        <>
          <Tile className="fill-sage-100 stroke-sage-300" />
          <Dash half={8} className="stroke-sage-600" strokeWidth={2.5} opacity={0.55} />
        </>
      );
  }
}
