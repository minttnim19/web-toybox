// Draws the game onto a transparent, click-through, full-screen canvas at 1/3 resolution,
// scaled up with image-rendering: pixelated.
import { drawSprite, rotateSprite, spriteSize, type PixelSprite } from '../../../shared/sprite';
import type { ItemKind } from '../core/items';
import type { Bullet, Ship } from '../core/ship';
import type { TargetId } from '../core/state';
import type { Rect } from '../core/targeting';
import type { Particles } from './particles';
import { PALETTE, itemSprite, shipFrame } from './sprites';

export const SCALE = 3;
const MAX_CRACKS_PER_TARGET = 14;
const RANGE_DOTS = 24;
const SHIP_DIRECTIONS = 16;
const TEXT_LIFE = 0.9; // s a floating score stays
const TEXT_RISE = 34; // px it rises
const SHOCKWAVE_TIME = 0.35;
const LASER_TIME = 0.35;
export const PIXEL_FONT_CSS = '"Press Start 2P", ui-monospace, monospace';

interface Crack {
  fx: number;
  fy: number;
  /** Pixel offsets from the crack center as [dx0, dy0, dx1, dy1, ...]. */
  pixels: number[];
}

/** A few jagged arms radiating from the impact point. */
function makeCrack(fx: number, fy: number): Crack {
  const pixels = [0, 0];
  const arms = 3 + Math.floor(Math.random() * 2);
  for (let a = 0; a < arms; a++) {
    let angle = (a / arms) * Math.PI * 2 + Math.random() * 0.8;
    let x = 0;
    let y = 0;
    const length = 3 + Math.floor(Math.random() * 5);
    for (let s = 0; s < length; s++) {
      angle += (Math.random() - 0.5) * 0.9;
      x += Math.round(Math.cos(angle));
      y += Math.round(Math.sin(angle));
      pixels.push(x, y);
    }
  }
  return { fx, fy, pixels };
}

/** An item box to draw at a viewport position (CSS px). */
export interface ItemView {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  /** Blink because it is about to disappear. */
  blinking: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  age: number;
}

interface Burst {
  kind: 'shockwave' | 'laser';
  x: number;
  y: number;
  radius: number;
  age: number;
}

export interface Frame {
  time: number;
  /** Seconds since the previous frame. */
  dt: number;
  items: readonly ItemView[];
  ship: Ship | null;
  bullets: readonly Bullet[];
  particles: Particles;
  /** Current on-screen rect of a target, or null if it isn't alive/visible. */
  rectOf(id: TargetId): Rect | null;
  /** Fire range in px, shown as rotating dots around the ship. */
  range: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private readonly cracks = new Map<TargetId, Crack[]>();
  private texts: FloatingText[] = [];
  private bursts: Burst[] = [];

  constructor(parent: ShadowRoot) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    parent.append(this.canvas);
    this.resize();
  }

  resize(): void {
    this.width = Math.ceil(window.innerWidth / SCALE);
    this.height = Math.ceil(window.innerHeight / SCALE);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = `${this.width * SCALE}px`;
    this.canvas.style.height = `${this.height * SCALE}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  setVisible(visible: boolean): void {
    this.canvas.style.display = visible ? 'block' : 'none';
  }

  /** Follow the page's screen shake so cracks stay on their elements. */
  setOffset(x: number, y: number): void {
    this.canvas.style.translate = x || y ? `${x}px ${y}px` : '';
  }

  addCrack(id: TargetId, fx: number, fy: number): void {
    let list = this.cracks.get(id);
    if (!list) this.cracks.set(id, (list = []));
    list.push(makeCrack(fx, fy));
    if (list.length > MAX_CRACKS_PER_TARGET) list.shift();
  }

  clearCracks(id: TargetId): void {
    this.cracks.delete(id);
  }

  /** Rising pixel text, e.g. "+120" where something broke. Size is in canvas pixels. */
  addText(x: number, y: number, text: string, color: string = PALETTE.yellow, size = 8): void {
    this.texts.push({ x, y, text, color, size, age: 0 });
    if (this.texts.length > 40) this.texts.shift();
  }

  addShockwave(x: number, y: number, radius: number): void {
    this.bursts.push({ kind: 'shockwave', x, y, radius, age: 0 });
  }

  addLaser(x: number, y: number, thickness: number): void {
    this.bursts.push({ kind: 'laser', x, y, radius: thickness, age: 0 });
  }

  /** Keep page-attached effects in place while the page scrolls. */
  shift(dx: number, dy: number): void {
    for (const t of this.texts) {
      t.x += dx;
      t.y += dy;
    }
  }

  reset(): void {
    this.cracks.clear();
    this.texts = [];
    this.bursts = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  draw(frame: Frame): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawCracks(frame);
    frame.particles.draw(ctx, SCALE, this.width, this.height);
    this.drawItems(frame.items, frame.time);
    this.drawBursts(frame.dt);
    this.drawBullets(frame.bullets);
    if (frame.ship) {
      this.drawRange(frame.ship, frame.range, frame.time);
      this.drawShip(frame.ship, frame.time);
    }
    this.drawTexts(frame.dt);
  }

  private drawItems(items: readonly ItemView[], time: number): void {
    for (const item of items) {
      if (item.blinking && Math.floor(time * 8) % 2 === 0) continue;
      const sprite = itemSprite(item.kind);
      const { w, h } = spriteSize(sprite);
      const bob = Math.round(Math.sin(time * 4 + item.id) * 1.5);
      drawSprite(this.ctx, sprite, item.x / SCALE - w / 2, item.y / SCALE - h / 2 + bob);
    }
  }

  private drawTexts(dt: number): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.texts = this.texts.filter((t) => (t.age += dt) < TEXT_LIFE);
    for (const t of this.texts) {
      const progress = t.age / TEXT_LIFE;
      const x = Math.round(t.x / SCALE);
      const y = Math.round((t.y - progress * TEXT_RISE) / SCALE);
      ctx.font = `${t.size}px ${PIXEL_FONT_CSS}`;
      ctx.globalAlpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
      ctx.fillStyle = PALETTE.navy; // hard outline so it reads on any page
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [1, 1],
      ] as const)
        ctx.fillText(t.text, x + ox, y + oy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawBursts(dt: number): void {
    const ctx = this.ctx;
    this.bursts = this.bursts.filter(
      (b) => (b.age += dt) < (b.kind === 'shockwave' ? SHOCKWAVE_TIME : LASER_TIME),
    );
    for (const b of this.bursts) {
      const cx = Math.round(b.x / SCALE);
      const cy = Math.round(b.y / SCALE);
      if (b.kind === 'shockwave') {
        const p = b.age / SHOCKWAVE_TIME;
        const r = (b.radius / SCALE) * (0.15 + 0.85 * Math.sqrt(p));
        ctx.globalAlpha = 1 - p;
        if (p < 0.25) {
          ctx.fillStyle = PALETTE.white;
          ctx.fillRect(cx - r * 0.5, cy - r * 0.5, r, r);
        }
        const dots = Math.max(16, Math.round(r * 6));
        for (let i = 0; i < dots; i++) {
          const a = (i / dots) * Math.PI * 2;
          ctx.fillStyle = i % 3 === 0 ? PALETTE.white : PALETTE.yellow;
          ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2);
          ctx.fillStyle = PALETTE.orange;
          ctx.fillRect(
            Math.round(cx + Math.cos(a) * (r - 3)),
            Math.round(cy + Math.sin(a) * (r - 3)),
            1,
            1,
          );
        }
      } else {
        const p = b.age / LASER_TIME;
        const half = Math.max(1, Math.round((b.radius / SCALE / 2) * (1 - p * 0.6)));
        const jitter = Math.round(Math.random() * 2 - 1);
        ctx.globalAlpha = 1 - p * p;
        ctx.fillStyle = PALETTE.cyan;
        ctx.fillRect(0, cy - half + jitter, this.width, half * 2);
        ctx.fillRect(cx - half + jitter, 0, half * 2, this.height);
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(0, cy - 1, this.width, 2);
        ctx.fillRect(cx - 1, 0, 2, this.height);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCracks(frame: Frame): void {
    const ctx = this.ctx;
    for (const [id, list] of this.cracks) {
      const r = frame.rectOf(id);
      if (!r) continue;
      const x0 = Math.floor(r.x / SCALE);
      const y0 = Math.floor(r.y / SCALE);
      const x1 = Math.floor((r.x + r.w) / SCALE);
      const y1 = Math.floor((r.y + r.h) / SCALE);
      if (x1 < 0 || y1 < 0 || x0 > this.width || y0 > this.height) continue;
      for (const crack of list) {
        const cx = Math.floor((r.x + crack.fx * r.w) / SCALE);
        const cy = Math.floor((r.y + crack.fy * r.h) / SCALE);
        for (let pass = 0; pass < 2; pass++) {
          // Light offset pass first, so cracks read on dark elements too.
          ctx.fillStyle = pass === 0 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(26, 28, 44, 0.85)';
          const o = pass === 0 ? 1 : 0;
          for (let i = 0; i < crack.pixels.length; i += 2) {
            const px = cx + crack.pixels[i]! + o;
            const py = cy + crack.pixels[i + 1]! + o;
            if (px >= x0 && px < x1 && py >= y0 && py < y1) ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  private drawBullets(bullets: readonly Bullet[]): void {
    const ctx = this.ctx;
    for (const b of bullets) {
      for (let i = 0; i < b.trail.length; i += 2) {
        ctx.globalAlpha = 0.6 - i * 0.08;
        ctx.fillStyle = PALETTE.orange;
        ctx.fillRect(Math.floor(b.trail[i]! / SCALE), Math.floor(b.trail[i + 1]! / SCALE), 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.yellow;
      ctx.fillRect(Math.floor(b.x / SCALE), Math.floor(b.y / SCALE), 1, 1);
    }
  }

  private drawRange(ship: Ship, range: number, time: number): void {
    const ctx = this.ctx;
    const cx = ship.x / SCALE;
    const cy = ship.y / SCALE;
    const r = range / SCALE;
    ctx.fillStyle = PALETTE.cyan;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < RANGE_DOTS; i++) {
      const a = (i / RANGE_DOTS) * Math.PI * 2 + time * 0.6;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** 16 headings x 3 thruster flicker frames, rendered on first use. */
  private readonly shipSprites = new Map<number, PixelSprite>();

  private drawShip(ship: Ship, time: number): void {
    // The sprite points up; quantize the heading to 16 directions so rotation stays crisp.
    const turn = (ship.angle + Math.PI / 2) / (Math.PI * 2);
    const dir =
      ((Math.round(turn * SHIP_DIRECTIONS) % SHIP_DIRECTIONS) + SHIP_DIRECTIONS) % SHIP_DIRECTIONS;
    const flicker = Math.floor(time * 30) % 3;
    const key = dir * 3 + flicker;
    let sprite = this.shipSprites.get(key);
    if (!sprite) {
      sprite = rotateSprite(shipFrame(flicker), (dir / SHIP_DIRECTIONS) * Math.PI * 2);
      this.shipSprites.set(key, sprite);
    }
    const { w, h } = spriteSize(sprite);
    drawSprite(this.ctx, sprite, ship.x / SCALE - w / 2, ship.y / SCALE - h / 2);
  }
}
