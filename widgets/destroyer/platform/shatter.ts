// Break an element into pixel blocks that fly out with gravity, using its real colors.
import type { StylableElement } from '../../../shared/dom';
import type { Particles } from '../render/particles';
import { SCALE } from '../render/renderer';
import { makeColorSampler } from './colors';

const MAX_BLOCKS = 320; // per element; the particle pool caps the total
const MAX_BLOCK_SIZE = 4 * SCALE; // px
const OFFSCREEN_MARGIN = 20; // px of the element outside the viewport that still breaks

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Spawn debris for the on-screen part of `el`. Call before the element is hidden. */
export function shatter(el: StylableElement, particles: Particles): void {
  const r = el.getBoundingClientRect();
  const x0 = Math.max(r.left, -OFFSCREEN_MARGIN);
  const y0 = Math.max(r.top, -OFFSCREEN_MARGIN);
  const x1 = Math.min(r.right, window.innerWidth + OFFSCREEN_MARGIN);
  const y1 = Math.min(r.bottom, window.innerHeight + OFFSCREEN_MARGIN);
  if (x1 <= x0 || y1 <= y0) return;

  // Block size grows with the visible area so a big element doesn't need thousands of blocks;
  // it stays a multiple of the canvas pixel so blocks land on the pixel grid.
  const visibleArea = (x1 - x0) * (y1 - y0);
  const block = Math.min(
    MAX_BLOCK_SIZE,
    SCALE * Math.max(1, Math.ceil(Math.sqrt(visibleArea / MAX_BLOCKS) / SCALE)),
  );
  const cols = Math.ceil((x1 - x0) / block);
  const rows = Math.ceil((y1 - y0) / block);
  const keep = Math.min(1, MAX_BLOCKS / (cols * rows));
  const sample = makeColorSampler(el);
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const halfW = Math.max(1, r.width / 2);
  const halfH = Math.max(1, r.height / 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() > keep) continue;
      const x = x0 + col * block + block / 2;
      const y = y0 + row * block + block / 2;
      // Fly outward from the element's center, with an upward kick.
      const dx = (x - cx) / halfW;
      const dy = (y - cy) / halfH;
      particles.spawn(
        x - block / 2,
        y - block / 2,
        dx * rand(80, 260) + rand(-60, 60),
        dy * rand(60, 200) - rand(120, 380),
        rand(0.9, 1.7),
        sample((x - r.left) / r.width, (y - r.top) / r.height),
        block / SCALE,
      );
    }
  }
}
