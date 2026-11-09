// Pixel sprites stored as character arrays + a color map, pre-rendered to small canvases.

export interface PixelSprite {
  /** One string per row; each character is a key into `palette`. Space or '.' is transparent. */
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
}

const cache = new WeakMap<PixelSprite, HTMLCanvasElement>();

export function spriteSize(sprite: PixelSprite): { w: number; h: number } {
  return { w: Math.max(...sprite.rows.map((r) => r.length)), h: sprite.rows.length };
}

/** Render a sprite once (1 canvas pixel per character) and cache the result. */
export function spriteCanvas(sprite: PixelSprite): HTMLCanvasElement {
  let canvas = cache.get(sprite);
  if (canvas) return canvas;
  const { w, h } = spriteSize(sprite);
  canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    sprite.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = sprite.palette[row[x]!];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  cache.set(sprite, canvas);
  return canvas;
}

/** Draw a sprite with its top-left corner at (x, y), snapped to whole pixels. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  x: number,
  y: number,
): void {
  ctx.drawImage(spriteCanvas(sprite), Math.round(x), Math.round(y));
}

/** Scale2x (EPX): doubles a pixel grid while keeping diagonal edges smooth. */
function scale2x(grid: string[][]): string[][] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const at = (x: number, y: number) => grid[y]?.[x] ?? ' ';
  const out: string[][] = Array.from({ length: h * 2 }, () => new Array<string>(w * 2).fill(' '));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      out[2 * y]![2 * x] = c === a && c !== d && a !== b ? c : p;
      out[2 * y]![2 * x + 1] = a === b && a !== c && b !== d ? b : p;
      out[2 * y + 1]![2 * x] = d === c && d !== b && c !== a ? c : p;
      out[2 * y + 1]![2 * x + 1] = b === d && b !== a && d !== c ? b : p;
    }
  }
  return out;
}

/**
 * Rotate a sprite by `angle` radians (clockwise on screen) around its center, RotSprite
 * style: upscale 8x with Scale2x, rotate with nearest-neighbour sampling, then sample back
 * down. Outlines stay connected and the result is still crisp pixel art. Use a square
 * sprite with odd sides for pixel-exact quarter turns.
 */
export function rotateSprite(sprite: PixelSprite, angle: number): PixelSprite {
  const { w, h } = spriteSize(sprite);
  const UPSCALE = 8;
  let grid = sprite.rows.map((row) => Array.from(row.padEnd(w)));
  for (let k = 1; k < UPSCALE; k *= 2) grid = scale2x(grid);

  // Big enough for any rotation, with the same odd/even parity as the source on each
  // axis so unrotated pixel centers line up exactly (no half-pixel drift).
  const diagonal = Math.ceil(Math.hypot(w, h));
  const outW = diagonal + ((diagonal - w) & 1);
  const outH = diagonal + ((diagonal - h) & 1);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rows: string[] = [];
  for (let oy = 0; oy < outH; oy++) {
    let row = '';
    for (let ox = 0; ox < outW; ox++) {
      const cx = ox + 0.5 - outW / 2;
      const cy = oy + 0.5 - outH / 2;
      const sx = Math.floor((cx * cos + cy * sin + w / 2) * UPSCALE);
      const sy = Math.floor((-cx * sin + cy * cos + h / 2) * UPSCALE);
      row += grid[sy]?.[sx] ?? ' ';
    }
    rows.push(row);
  }
  return { rows, palette: sprite.palette };
}
