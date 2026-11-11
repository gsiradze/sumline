import { music } from './game/audio/music';
import type { MusicState } from './game/audio/music';
import { sound } from './game/audio/soundManager';
import type { ActiveGameState } from './game/domain/game-state';

interface NavAPI {
  readonly openLevel: (id: number) => void;
  readonly backToHome: () => void;
}

interface GameAPI {
  readonly tapCell: (index: number) => void;
  readonly noteCell: (index: number) => void;
  readonly submit: () => void;
  readonly restart: () => void;
  readonly getState: () => ActiveGameState | null;
}

interface GridTestAPI {
  readonly openLevel: (id: number) => void;
  readonly backToHome: () => void;
  readonly tapCell: (index: number) => void;
  readonly noteCell: (index: number) => void;
  readonly submit: () => void;
  readonly restart: () => void;
  readonly getState: () => ActiveGameState | null;
  /** The music player, and whether the audio engine is running or held silent. */
  readonly audio: () => MusicState & { readonly engine: AudioContextState | 'none' };
}

declare global {
  interface Window {
    __gridTest?: GridTestAPI;
  }
}

let nav: NavAPI | null = null;
let game: GameAPI | null = null;

function publish(): void {
  if (!import.meta.env.DEV) return;
  window.__gridTest = {
    openLevel: id => nav?.openLevel(id),
    backToHome: () => nav?.backToHome(),
    tapCell: i => game?.tapCell(i),
    noteCell: i => game?.noteCell(i),
    submit: () => game?.submit(),
    restart: () => game?.restart(),
    getState: () => game?.getState() ?? null,
    audio: () => ({ ...music.state(), engine: sound.engineState() }),
  };
}

export function registerNav(api: NavAPI): () => void {
  if (!import.meta.env.DEV) return () => {};
  nav = api;
  publish();
  return () => {
    if (nav === api) nav = null;
    publish();
  };
}

export function registerGame(api: GameAPI): () => void {
  if (!import.meta.env.DEV) return () => {};
  game = api;
  publish();
  return () => {
    if (game === api) game = null;
    publish();
  };
}
