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
