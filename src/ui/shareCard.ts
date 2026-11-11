import { GRID_SIZE } from '../game/domain/types';

export interface ShareCardData {
  /** The number the player sees (1-based). */
  readonly levelNumber: number;
  readonly tierLabel: string;
  readonly rowSums: readonly number[];
  readonly colSums: readonly number[];
  readonly stars: 0 | 1 | 2 | 3;
  readonly guesses: number;
  /** Last line of the card: where to play it. */
  readonly footer: string;
}

// The card shows the puzzle unsolved, with its clues, so sharing a result never
// spoils the level for whoever opens it.
const W = 1080;
const H = 1350;
const CELL = 96;
const GAP = 12;
const GRID_SPAN = GRID_SIZE * CELL + (GRID_SIZE - 1) * GAP;
const CLUE_GUTTER = 62;
const GRID_LEFT = Math.round((W - GRID_SPAN) / 2 + CLUE_GUTTER / 2);
const GRID_TOP = 526;
const FONT_WAIT_MS = 1500;

// Fixed light palette: a shared image should look the same from every phone.
const PAPER = '#faf6f0';
const CELL_FILL = '#fdfbf6';
const RULE = '#e2d8c3';
const INK = '#2a2722';
const INK_SOFT = '#4a453c';
const INK_FAINT = '#726b5e';
const NAVY = '#263348';
const OCHRE = '#c39a3e';

const STAR_PATH = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7L12 16.8l-5.2 2.7 1-5.7L3.5 9.7l5.9-.9z';
const SANS = 'Geist, ui-sans-serif, system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, monospace';
const SERIF = 'Fraunces, Georgia, serif';

async function fontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const wanted = [`600 80px Geist`, `500 28px "Geist Mono"`, `500 44px Fraunces`];
  await Promise.race([
    Promise.all(wanted.map(f => document.fonts.load(f))).catch(() => undefined),
    new Promise(resolve => window.setTimeout(resolve, FONT_WAIT_MS)),
  ]);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// "Sumline" with the square-dotted i of the in-app wordmark.
function drawWordmark(ctx: CanvasRenderingContext2D, centreX: number, baseline: number): void {
  const size = 76;
  ctx.font = `600 ${size}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  const before = 'Suml';
  const after = 'ne';
  const stemBox = size * 0.4;
  const beforeWidth = ctx.measureText(before).width;
  const total = beforeWidth + stemBox + ctx.measureText(after).width;
  const left = centreX - total / 2;
  ctx.fillText(before, left, baseline);
  ctx.fillText(after, left + beforeWidth + stemBox, baseline);

  const middle = left + beforeWidth + stemBox / 2;
  const dot = size * 0.3;
  const dotTop = baseline - size * 0.9;
  ctx.fillStyle = NAVY;
  roundedRect(ctx, middle - dot / 2, dotTop, dot, dot, 4);
  ctx.fill();
  const stem = size * 0.1;
  const stemTop = dotTop + size * 0.4;
  ctx.fillStyle = INK;
  ctx.fillRect(middle - stem / 2, stemTop, stem, baseline - stemTop);
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  earned: number,
): void {
  const size = 64;
  const gap = 14;
  const total = size * 3 + gap * 2;
  const path = new Path2D(STAR_PATH);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(centreX - total / 2 + i * (size + gap), centreY - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OCHRE;
    ctx.fillStyle = OCHRE;
    if (i < earned) {
      ctx.fill(path);
      ctx.stroke(path);
    } else {
      ctx.globalAlpha = 0.3;
      ctx.stroke(path);
    }
    ctx.restore();
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, data: ShareCardData): void {
  ctx.font = `500 44px ${SERIF}`;
  ctx.fillStyle = INK_SOFT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k < GRID_SIZE; k++) {
    const along = k * (CELL + GAP) + CELL / 2;
    ctx.fillText(String(data.colSums[k] ?? ''), GRID_LEFT + along, GRID_TOP - CLUE_GUTTER + 12);
    ctx.fillText(String(data.rowSums[k] ?? ''), GRID_LEFT - CLUE_GUTTER + 12, GRID_TOP + along);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = RULE;
  ctx.fillStyle = CELL_FILL;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      roundedRect(ctx, GRID_LEFT + c * (CELL + GAP), GRID_TOP + r * (CELL + GAP), CELL, CELL, 10);
      ctx.fill();
      ctx.stroke();
    }
  }
}

/** A 1080×1350 PNG of the result, or null where a canvas is not available. */
export async function renderShareCard(data: ShareCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 3;
  roundedRect(ctx, 30, 30, W - 60, H - 60, 44);
  ctx.stroke();

  drawWordmark(ctx, W / 2, 144);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK_FAINT;
  ctx.font = `500 28px ${MONO}`;
  ctx.fillText(`LEVEL ${data.levelNumber}  ·  ${data.tierLabel.toUpperCase()}`, W / 2, 204);

  drawStars(ctx, W / 2, 278, data.stars);

  ctx.fillStyle = INK;
  ctx.font = `600 80px ${SANS}`;
  ctx.fillText(`Solved in ${data.guesses}`, W / 2, 404);

  drawBoard(ctx, data);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 36px ${SANS}`;
  ctx.fillText('Can you solve it?', W / 2, 1234);
  ctx.fillStyle = INK_FAINT;
  ctx.font = `500 28px ${MONO}`;
  ctx.fillText(data.footer, W / 2, 1286);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}
