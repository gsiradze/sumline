import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ActiveGameState } from '../../game/domain/game-state';
import { TourAction, tourTargets } from '../../game/domain/tutorial';
import type { TourStep } from '../../game/domain/tutorial';
import { GRID_SIZE } from '../../game/domain/types';
import { CELL_PITCH, GRID_ORIGIN_X, GRID_ORIGIN_Y, cellOrigin, layout } from './boardLayout';

interface TutorialTourProps {
  /** Null while the board shows the result of a guess: nothing is lit, nothing takes a touch. */
  readonly step: TourStep | null;
  readonly state: ActiveGameState;
  readonly settled: boolean;
  /** Touches the step has turned away so far; each one jolts the caption. */
  readonly nudges: number;
  readonly onNudge: () => void;
  readonly onButton: () => void;
  readonly onSkip: () => void;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where the caption sits relative to what it points at. */
type Side = 'above' | 'below' | 'left' | 'right' | 'between';

interface CaptionPlace {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly side: Side;
  /** Where along the caption's edge its pointer goes. */
  readonly tail: number;
}

interface Scene {
  readonly width: number;
  readonly height: number;
  readonly holes: readonly Box[];
  readonly hand: Point | null;
  readonly caption: CaptionPlace;
}

// In board units (see boardLayout): how far the light reaches around a lit line.
const LINE_PAD = 5;
const CLUE_REACH = 18;
// In CSS px.
const BUTTON_PAD = 6;
const HOLE_RADIUS = 12;
const CAPTION_GAP = 12;
const SCREEN_EDGE = 12;
const CAPTION_MAX_WIDTH = 320;
// Beside a lit column the caption needs at least this much width to stay readable.
const CAPTION_MIN_SIDE_WIDTH = 168;
const TAIL_INSET = 22;
// How far the hand hangs below the edge of what it points at, at its lowest.
const HAND_REACH = 40;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high));

const centreOf = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

function union(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map(b => b.x + b.w)) - x,
    h: Math.max(...boxes.map(b => b.y + b.h)) - y,
  };
}

/** Maps board units to the screen, the way the board's own viewBox does. */
function boardToScreen(): ((box: Box) => Box) | null {
  const rect = document.querySelector('svg[data-board]')?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  const scale = Math.min(rect.width / layout.width, rect.height / layout.height);
  const left = rect.left + (rect.width - layout.width * scale) / 2;
  const top = rect.top + (rect.height - layout.height * scale) / 2;
  return box => ({
    x: left + box.x * scale,
    y: top + box.y * scale,
    w: box.w * scale,
    h: box.h * scale,
  });
}

/** A whole row or column with its clue number, in board units. */
function lineBox(id: number): Box {
  const index = id % GRID_SIZE;
  const across = LINE_PAD * 2 + layout.cellSize;
  const reach = layout.clueGutter + CLUE_REACH;
  const along = reach + GRID_SIZE * CELL_PITCH - layout.cellGap + LINE_PAD;
  return id < GRID_SIZE
    ? {
        x: GRID_ORIGIN_X - reach,
        y: GRID_ORIGIN_Y + index * CELL_PITCH - LINE_PAD,
        w: along,
        h: across,
      }
    : {
        x: GRID_ORIGIN_X + index * CELL_PITCH - LINE_PAD,
        y: GRID_ORIGIN_Y - reach,
        w: across,
        h: along,
      };
}

function elementBox(selector: string): Box | null {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return {
    x: rect.left - BUTTON_PAD,
    y: rect.top - BUTTON_PAD,
    w: rect.width + BUTTON_PAD * 2,
    h: rect.height + BUTTON_PAD * 2,
  };
}

/** What stays lit. No two of these ever overlap: lit lines are all rows or a single column. */
function litBoxes(step: TourStep): Box[] {
  if (step.action === TourAction.Submit) {
    // The button first. The guess counter is lit with it where both fit on the
    // screen at once; on a short phone the page has scrolled the counter away.
    const onScreen = (box: Box): boolean => box.y >= 0 && box.y + box.h <= window.innerHeight;
    return ['[data-tour="submit"]', '[data-tour="guesses"]']
      .map(elementBox)
      .filter((box, k): box is Box => box !== null && (k === 0 || onScreen(box)));
  }
  const toScreen = boardToScreen();
  if (!toScreen) return [];
  if (step.lines.length > 0) return step.lines.map(id => toScreen(lineBox(id)));
  return [toScreen({ x: 0, y: 0, w: layout.width, h: layout.height })];
}

/** A guess is the player's to make: nothing points at one cell over another. */
const hasHand = (step: TourStep): boolean =>
  step.action === TourAction.Submit || (step.action === TourAction.Mark && step.lines.length === 1);

function handPoint(step: TourStep, state: ActiveGameState, holes: readonly Box[]): Point | null {
  if (!hasHand(step)) return null;
  if (step.action === TourAction.Submit) return holes[0] ? centreOf(holes[0]) : null;
  const next = tourTargets(step, state)[0];
  const toScreen = boardToScreen();
  if (next === undefined || !toScreen) return null;
  const origin = cellOrigin(next);
  return centreOf(toScreen({ ...origin, w: layout.cellSize, h: layout.cellSize }));
}

/**
 * Puts the caption next to what it is about: beside a lit column, between two
 * lit rows, otherwise above or below. The hand hangs below what it points at,
 * so with a hand the caption goes above; without one, on the side nearer the
 * middle of the board.
 */
function placeCaption(
  el: HTMLElement,
  step: TourStep,
  holes: readonly Box[],
  width: number,
  height: number,
): CaptionPlace {
  const anchor = step.action === TourAction.Submit ? holes[0]! : union(holes);
  const fullWidth = Math.min(CAPTION_MAX_WIDTH, width - SCREEN_EDGE * 2);
  const heightAt = (w: number): number => {
    el.style.width = `${w}px`;
    return el.offsetHeight;
  };
  const centre = centreOf(anchor);

  if (anchor.h > anchor.w * 1.3) {
    const roomRight = width - (anchor.x + anchor.w) - CAPTION_GAP - SCREEN_EDGE;
    const roomLeft = anchor.x - CAPTION_GAP - SCREEN_EDGE;
    const room = Math.max(roomLeft, roomRight);
    if (room >= CAPTION_MIN_SIDE_WIDTH) {
      const w = Math.min(fullWidth, room);
      const h = heightAt(w);
      const top = clamp(centre.y - h / 2, SCREEN_EDGE, height - SCREEN_EDGE - h);
      const onRight = roomRight >= roomLeft;
      return {
        left: onRight ? anchor.x + anchor.w + CAPTION_GAP : anchor.x - CAPTION_GAP - w,
        top,
        width: w,
        side: onRight ? 'right' : 'left',
        tail: clamp(centre.y - top, TAIL_INSET, h - TAIL_INSET),
      };
    }
  }

  const h = heightAt(fullWidth);
  const left = clamp(centre.x - fullWidth / 2, SCREEN_EDGE, width - SCREEN_EDGE - fullWidth);
  const tail = clamp(centre.x - left, TAIL_INSET, fullWidth - TAIL_INSET);

  if (holes.length === 2 && step.action === TourAction.Mark) {
    const [upper, lower] = [...holes].sort((a, b) => a.y - b.y) as [Box, Box];
    const gap = lower.y - (upper.y + upper.h);
    if (gap >= h + CAPTION_GAP) {
      return {
        left,
        top: upper.y + upper.h + (gap - h) / 2,
        width: fullWidth,
        side: 'between',
        tail,
      };
    }
  }

  const clearance = CAPTION_GAP + (hasHand(step) ? HAND_REACH : 0);
  const fitsBelow = height - (anchor.y + anchor.h) - clearance - SCREEN_EDGE >= h;
  const fitsAbove = anchor.y - CAPTION_GAP - SCREEN_EDGE >= h;
  const board = document.querySelector('svg[data-board]')?.getBoundingClientRect();
  const wantsBelow =
    !hasHand(step) && board !== undefined && centre.y < board.top + board.height / 2;
  const below = wantsBelow ? fitsBelow || !fitsAbove : !fitsAbove;
  return {
    left,
    top: below
      ? Math.min(anchor.y + anchor.h + clearance, height - SCREEN_EDGE - h)
      : Math.max(anchor.y - CAPTION_GAP - h, SCREEN_EDGE),
    width: fullWidth,
    side: below ? 'below' : 'above',
    tail,
  };
}

/**
 * The whole screen with the lit boxes cut out of it. Each cut-out runs the other
 * way round from the outer edge, so it is a hole whichever fill rule applies.
 * The cut-outs let touches through; the rest of the veil takes them.
 */
function veilPath({ width, height, holes }: Scene): string {
  let d = `M0 0H${width}V${height}H0Z`;
  for (const b of holes) {
    const r = Math.min(HOLE_RADIUS, b.w / 2, b.h / 2);
    const right = b.x + b.w;
    const bottom = b.y + b.h;
    d +=
      `M${b.x + r} ${b.y}A${r} ${r} 0 0 0 ${b.x} ${b.y + r}V${bottom - r}` +
      `A${r} ${r} 0 0 0 ${b.x + r} ${bottom}H${right - r}` +
      `A${r} ${r} 0 0 0 ${right} ${bottom - r}V${b.y + r}` +
      `A${r} ${r} 0 0 0 ${right - r} ${b.y}Z`;
  }
  return d;
}

function tailStyle({ side, tail }: CaptionPlace): CSSProperties | null {
  switch (side) {
    case 'below':
      return { top: -7, left: tail - 7, borderTopWidth: 1, borderLeftWidth: 1 };
    case 'above':
      return { bottom: -7, left: tail - 7, borderBottomWidth: 1, borderRightWidth: 1 };
    case 'right':
      return { left: -7, top: tail - 7, borderBottomWidth: 1, borderLeftWidth: 1 };
    case 'left':
      return { right: -7, top: tail - 7, borderTopWidth: 1, borderRightWidth: 1 };
    case 'between':
      return null;
  }
}

/**
 * The guided first solve as the player sees it: a dark veil over everything
 * but what the current step is about, a short caption beside that, and a hand
 * showing where to tap. The veil answers a tap (the caption jolts) rather than
 * swallowing it, so the screen never feels dead.
 */
export function TutorialTour({
  step,
  state,
  settled,
  nudges,
  onNudge,
  onButton,
  onSkip,
}: TutorialTourProps) {
  const captionRef = useRef<HTMLDivElement | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const live = useRef({ step, state, settled });
  live.current = { step, state, settled };

  const arrange = useCallback((): void => {
    const { step: now, state: board, settled: done } = live.current;
    const el = captionRef.current;
    const holes = now ? litBoxes(now) : [];
    if (!now || !el || holes.length === 0) {
      setScene(null);
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    setScene({
      width,
      height,
      holes,
      hand: done ? null : handPoint(now, board, holes),
      caption: placeCaption(el, now, holes, width, height),
    });
  }, []);

  // The hand moves on to the next cell as each one is marked.
  const nextCell = step ? tourTargets(step, state)[0] : undefined;
  useLayoutEffect(arrange, [arrange, step, settled, nextCell]);

  useEffect(() => {
    window.addEventListener('resize', arrange);
    window.addEventListener('scroll', arrange, true);
    const board = document.querySelector('svg[data-board]');
    const observer =
      board && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(arrange) : null;
    if (board) observer?.observe(board);
    return () => {
      window.removeEventListener('resize', arrange);
      window.removeEventListener('scroll', arrange, true);
      observer?.disconnect();
    };
  }, [arrange]);

  // On a short screen what a step lights can be off the bottom: bring it up.
  useEffect(() => {
    if (!step) return;
    const holes = litBoxes(step);
    const lit = step.action === TourAction.Submit ? holes[0] : holes.length > 0 && union(holes);
    if (!lit) return;
    // Whole pixels: a scroll position is rounded, and must not fall short. Under
    // a button the hand needs room too, or the edge of the screen cuts it off.
    const reach = step.action === TourAction.Submit ? HAND_REACH : 0;
    const over = lit.y + lit.h + reach - window.innerHeight;
    if (over > 0) window.scrollBy(0, Math.ceil(over));
    else if (lit.y < 0) window.scrollBy(0, Math.floor(lit.y));
  }, [step]);

  if (!step) {
    return <div data-tour-veil="" aria-hidden="true" className="fixed inset-0 z-30" />;
  }

  const clip = scene ? `path("${veilPath(scene)}")` : undefined;
  const tail = scene ? tailStyle(scene.caption) : null;

  return (
    <>
      <div
        data-tour-veil=""
        aria-hidden="true"
        className="tour-veil fixed inset-0 z-30"
        style={{ clipPath: clip, WebkitClipPath: clip }}
        onPointerDown={onNudge}
      />
      {scene?.holes.map((box, k) => (
        <div
          key={k}
          data-tour-hole=""
          aria-hidden="true"
          className={`tour-hole fixed z-30 pointer-events-none rounded-[12px] ${
            settled ? 'tour-hole-done' : ''
          }`}
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      ))}

      <button
        type="button"
        onClick={onSkip}
        aria-label="Skip tutorial"
        // Exactly over the two header buttons it stands in for (see LevelGameView).
        className="fixed z-[32] left-4 max-[359px]:left-3 w-24 max-[359px]:w-[86px] h-11 max-[359px]:h-10 rounded-[10px] border border-[rgba(255,250,240,0.45)] bg-[#221d18] font-sans text-[14px] font-semibold text-[rgba(255,250,240,0.95)] active:scale-95 transition-transform duration-nudge"
        style={{ top: 'calc(var(--safe-top) + 12px)' }}
      >
        Skip
      </button>

      <div
        key={step.text}
        ref={captionRef}
        data-tour-caption=""
        data-tour-step={step.kind}
        data-nudges={nudges}
        role="status"
        aria-live="polite"
        className="fixed z-[32]"
        style={
          scene
            ? { left: scene.caption.left, top: scene.caption.top, width: scene.caption.width }
            : { left: 0, top: 0, visibility: 'hidden' }
        }
      >
        <div key={nudges} className={nudges > 0 ? 'tour-nudge' : 'tour-caption'}>
          <div className="relative rounded-[16px] border border-rule-200 bg-paper-50 px-4 py-3 shadow-sh-3">
            {tail && (
              <span
                aria-hidden="true"
                className="absolute w-3.5 h-3.5 rotate-45 border-0 border-solid border-rule-200 bg-paper-50"
                style={tail}
              />
            )}
            <p className="relative font-sans text-[17px] leading-[1.3] font-semibold text-ink-900">
              {step.text}
            </p>
            {step.button && (
              <div className="relative mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={onButton}
                  className="h-11 px-5 rounded-full bg-fill-800 text-paper-50 font-sans text-[15px] font-semibold active:scale-[0.97] transition-transform duration-nudge"
                >
                  {step.button}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {scene?.hand && <Hand at={scene.hand} />}
    </>
  );
}

// Drawn as an object, like the mascot: the same glove in both themes.
function Hand({ at }: { readonly at: Point }) {
  return (
    <div
      data-tour-hand=""
      aria-hidden="true"
      className="fixed z-[33] pointer-events-none"
      style={{ left: at.x, top: at.y }}
    >
      <span
        className="tour-ripple absolute rounded-full border-2 border-solid border-ochre-500"
        style={{ left: -17, top: -17, width: 34, height: 34 }}
      />
      <svg
        className="tour-hand absolute"
        style={{ left: -19, top: -2 }}
        width="46"
        height="54"
        viewBox="0 0 48 56"
      >
        <path
          d="M15 31V9a5 5 0 0 1 10 0v14a4.5 4.5 0 0 1 9 0v2a4 4 0 0 1 8 0v13c0 9-6.5 15-15 15h-3c-5 0-8.5-2.5-11.5-7.5L6 35a4 4 0 0 1 6.6-4.4Z"
          fill="#fffaf0"
          stroke="#2a2722"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
