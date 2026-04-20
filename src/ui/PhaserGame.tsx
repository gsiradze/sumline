import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Game } from 'phaser';
import { startGame } from '../game/main';
import { EventBus } from '../game/EventBus';
import type { ActiveGameState } from '../game/domain/game-state';

interface PhaserGameProps {
  readonly state: ActiveGameState;
  readonly onCellTapped?: (index: number) => void;
  readonly inputDisabled?: boolean;
}

export function PhaserGame({ state, onCellTapped, inputDisabled }: PhaserGameProps) {
  const gameRef = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  useLayoutEffect(() => {
    if (gameRef.current !== null) return;
    if (!containerRef.current) return;
    containerRef.current.id = 'game-container';
    gameRef.current = startGame('game-container');
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      setSceneReady(false);
    };
  }, []);

  useEffect(() => {
    const handler = (name: string) => {
      if (name === 'Grid') setSceneReady(true);
    };
    EventBus.on('scene-ready', handler);
    return () => {
      EventBus.off('scene-ready', handler);
    };
  }, []);

  useEffect(() => {
    if (!sceneReady) return;
    EventBus.emit('state-updated', state);
  }, [sceneReady, state]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.input.enabled = !inputDisabled;
  }, [inputDisabled]);

  useEffect(() => {
    if (!onCellTapped) return;
    const handler = (index: number) => onCellTapped(index);
    EventBus.on('cell-tapped', handler);
    return () => {
      EventBus.off('cell-tapped', handler);
    };
  }, [onCellTapped]);

  return <div ref={containerRef} className="w-full h-full touch-none select-none" />;
}
