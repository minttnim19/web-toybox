// Target selection geometry. Rects are plain data handed in by the platform layer.
import type { TargetId } from './state';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Candidate {
  id: TargetId;
  rect: Rect;
}

/** Distance from a point to the closest point of a rect (0 when inside). */
export function distanceToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Pick the nearest candidate within range. When several are equally near
 * (e.g. the ship sits on top of overlapping elements), prefer the smallest.
 */
export function pickNearest(
  px: number,
  py: number,
  candidates: readonly Candidate[],
  range: number,
): Candidate | null {
  let best: Candidate | null = null;
  let bestDist = Infinity;
  let bestArea = Infinity;
  for (const c of candidates) {
    const d = distanceToRect(px, py, c.rect);
    if (d > range) continue;
    const area = c.rect.w * c.rect.h;
    if (d < bestDist - 0.5 || (Math.abs(d - bestDist) <= 0.5 && area < bestArea)) {
      best = c;
      bestDist = d;
      bestArea = area;
    }
  }
  return best;
}
