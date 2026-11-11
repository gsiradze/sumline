import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BeaverOverlay } from '../ui/components/BeaverOverlay';
import { Board } from '../ui/components/Board';
import { layout } from '../ui/components/boardLayout';
import { Wordmark } from '../ui/components/Wordmark';
import { StarIcon } from '../ui/components/icons';
import { useAudioFx } from '../ui/hooks/useAudioFx';
import { freshGame } from '../ui/hooks/useGameState';
import { sound } from '../game/audio/soundManager';
import { isCellLocked, submitGuess, toggleMark } from '../game/domain/game-state';
import type { ActiveGameState } from '../game/domain/game-state';
import { mulberry32 } from '../game/domain/rng';
import { starsForWin } from '../game/domain/stars';
import { TOTAL_LEVELS } from '../game/domain/tiers';
import { CELL_COUNT, GameOutcome } from '../game/domain/types';
import { bakedLevel } from '../storage/levelsManifest';

/* Recording stage for short-form video. Dev builds only (see App.tsx): it is
   never part of a production bundle.

   http://localhost:8080/?capture=1&level=12&autoplay=1&speed=1&label=1

   level     1-based level number (default 1)
   autoplay  1 = play a scripted two-guess solve on load
   speed     playback speed multiplier for autoplay (default 1)
   label     0 = hide the wordmark and level caption

   Keys: Enter/Space submit · R restart · ←/→ previous/next level · A autoplay
   Nothing is saved and no ads or analytics run here. */

const WRONG_MARKS_IN_FIRST_GUESS = 3;
const noNotes = (): void => {};

function readParams(): { level: number; autoplay: boolean; speed: number; label: boolean } {
  const q = new URLSearchParams(window.location.search);
  const level = Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(Number(q.get('level') ?? '1')) || 1));
  const speed = Math.min(4, Math.max(0.25, Number(q.get('speed') ?? '1') || 1));
  return { level, autoplay: q.get('autoplay') === '1', speed, label: q.get('label') !== '0' };
}

/** A believable first guess: the answer with a few marks moved to empty cells. */
function firstGuessFor(start: ActiveGameState): number[] {
  const rng = mulberry32((start.puzzle.seed ^ 0x51ed270b) >>> 0);
  const filled: number[] = [];
  const empty: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (isCellLocked(start, i)) continue;
    if (start.puzzle.solution[i] === 1) filled.push(i);
    else empty.push(i);
  }
  const pick = (from: number[]): number => from.splice(Math.floor(rng() * from.length), 1)[0]!;
  const swaps = Math.min(WRONG_MARKS_IN_FIRST_GUESS, filled.length - 1, empty.length);
  const guess = [...filled];
  for (let i = 0; i < swaps; i++) {
    const dropped = pick(filled);
    guess.splice(guess.indexOf(dropped), 1, pick(empty));
  }
  return guess.sort((a, b) => a - b);
}

export function CaptureStage() {
  const params = useMemo(readParams, []);
  const [levelNumber, setLevelNumber] = useState(params.level);
  const level = useMemo(() => bakedLevel(levelNumber - 1), [levelNumber]);
  const [state, setState] = useState<ActiveGameState>(() => freshGame(level));
  const [playing, setPlaying] = useState(params.autoplay);
  const stateRef = useRef(state);
  stateRef.current = state;
  useAudioFx(state, true);

  useEffect(() => {
    setState(freshGame(level));
  }, [level]);

  const mark = useCallback((index: number) => {
    sound.unlock();
    const next = toggleMark(stateRef.current, index);
    if (next === stateRef.current) return;
    if (next.currentMarks[index] === 1) sound.playToggleOn();
    else sound.playToggleOff();
    stateRef.current = next;
    setState(next);
  }, []);

  const submit = useCallback(() => {
    const next = submitGuess(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  // Scripted solve: a first guess with a few wrong marks, then the answer.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number): Promise<void> =>
      new Promise(resolve => {
        timers.push(window.setTimeout(resolve, ms / params.speed));
      });
    void (async () => {
      const start = freshGame(level);
      stateRef.current = start;
      setState(start);
      await wait(900);
      for (const i of firstGuessFor(start)) {
        if (cancelled) return;
        mark(i);
        await wait(130);
      }
      await wait(600);
      if (cancelled) return;
      submit();
      await wait(1500);
      for (let i = 0; i < CELL_COUNT; i++) {
        if (cancelled) return;
        const s = stateRef.current;
        if (s.puzzle.solution[i] !== 1 || s.currentMarks[i] === 1 || isCellLocked(s, i)) continue;
        mark(i);
        await wait(160);
      }
      await wait(600);
      if (cancelled) return;
      submit();
      setPlaying(false);
    })();
    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [playing, level, mark, submit, params.speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        submit();
      } else if (e.key === 'r' || e.key === 'R') {
        setPlaying(false);
        setState(freshGame(level));
      } else if (e.key === 'ArrowRight') {
        setPlaying(false);
        setLevelNumber(n => Math.min(TOTAL_LEVELS, n + 1));
      } else if (e.key === 'ArrowLeft') {
        setPlaying(false);
        setLevelNumber(n => Math.max(1, n - 1));
      } else if (e.key === 'a' || e.key === 'A') {
        setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [level, submit]);

  const won = state.outcome === GameOutcome.Won;
  const stars = won ? starsForWin(level.tier, state.guesses.length) : 0;

  return (
    <main className="min-h-screen bg-paper-100 flex items-center justify-center">
      {/* 9:16 frame: crop the recording to this box. */}
      <div
        className="relative flex flex-col items-center justify-center gap-6 px-[4%]"
        style={{
          width: 'min(100vw, calc(100vh * 9 / 16))',
          height: 'min(100vh, calc(100vw * 16 / 9))',
        }}
      >
        {params.label && (
          <div className="text-center">
            <Wordmark size={34} bold />
            <div className="mt-1 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-500">
              Level {levelNumber}
            </div>
          </div>
        )}
        <div
          className="relative w-full"
          style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
        >
          <Board state={state} tool="mark" onMark={mark} onNote={noNotes} />
          <BeaverOverlay state={state} levelId={level.id} />
        </div>
        <div className="h-[72px] text-center" aria-live="polite">
          {won && (
            <>
              <div className="inline-flex gap-1">
                {[0, 1, 2].map(i => (
                  <StarIcon
                    key={i}
                    className={`w-7 h-7 ${i < stars ? 'text-ochre-500' : 'text-ochre-500/25'}`}
                    filled={i < stars}
                  />
                ))}
              </div>
              <div className="font-serif text-[26px] font-semibold tracking-[-0.01em] text-ink-900">
                Solved in {state.guesses.length}.
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
