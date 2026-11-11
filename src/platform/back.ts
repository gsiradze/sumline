/* One place decides what "back" means. Screens and overlays register a handler
   while they are showing; the newest handler with the highest priority wins.
   With nothing registered (the home screen) the platform layer leaves the app. */

export const BACK_PRIORITY_SCREEN = 0;
export const BACK_PRIORITY_OVERLAY = 10;

interface Entry {
  readonly handler: () => void;
  readonly priority: number;
}

const entries: Entry[] = [];

export function pushBackHandler(handler: () => void, priority = BACK_PRIORITY_SCREEN): () => void {
  const entry: Entry = { handler, priority };
  entries.push(entry);
  return () => {
    const at = entries.indexOf(entry);
    if (at >= 0) entries.splice(at, 1);
  };
}

/** Runs the handler that owns "back" right now. Returns false when nothing does. */
export function handleBack(): boolean {
  let top: Entry | null = null;
  for (const entry of entries) {
    if (!top || entry.priority >= top.priority) top = entry;
  }
  if (!top) return false;
  top.handler();
  return true;
}
