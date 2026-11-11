export interface ParsedFrame {
  readonly functionName: string;
  readonly fileName: string;
  readonly lineNumber: number;
}

const MAX_FRAMES = 30;

// "    at fn (https://localhost/assets/index-abc.js:1:2345)" or "    at https://…:1:2345"
const V8_FRAME = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/;

/**
 * Turns a JS stack into frames a crash reporter can group on. The bundle is
 * minified onto a few very long lines and the reporter's frames carry no
 * column, so for line 1 the column is reported as the line number. Decode it
 * with the source map that `npm run build` stashes under `sourcemaps/<version>/`.
 */
export function parseStack(stack: string | undefined): ParsedFrame[] {
  if (!stack) return [];
  const frames: ParsedFrame[] = [];
  for (const line of stack.split('\n')) {
    const m = V8_FRAME.exec(line);
    if (!m) continue;
    const fileName = (m[2] ?? '').split('/').pop() ?? '';
    const lineNumber = Number(m[3]);
    const column = Number(m[4]);
    frames.push({
      functionName: m[1] ?? '(anonymous)',
      fileName,
      lineNumber: lineNumber === 1 ? column : lineNumber,
    });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames;
}
