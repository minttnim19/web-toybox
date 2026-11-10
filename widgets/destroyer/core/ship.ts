// Ship movement, heading, auto-fire timing and bullet flight. Pure math in viewport CSS pixels.
// Angles are in radians: 0 = right, -π/2 = up (screen y grows downward).
import type { TargetId } from './state';
import { distanceToRect, type Candidate, type Point, type Rect } from './targeting';

const SHIP_FOLLOW_RATE = 12; // higher = snappier follow
export const TURN_SPEED = 14; // max rad/s the nose can turn
const MOVE_FACE_SPEED = 60; // px/s; moving faster than this faces the travel direction
export const NOSE_OFFSET = 15; // px from ship center to the nose, where bullets leave
export const FIRE_INTERVAL = 0.13; // seconds between shots
export const FIRE_RANGE = 150; // px
const BULLET_SPEED = 720; // px/s
export const BULLET_MAX_DISTANCE = FIRE_RANGE + 80; // px a bullet flies before fading out
const TRAIL_LENGTH = 3;
const BULLET_SUBSTEP = 4; // px; small steps so bullets can't skip over thin targets
const UP = -Math.PI / 2;

export interface Ship {
  x: number;
  y: number;
  /** Where the pointer wants the ship to be. */
  targetX: number;
  targetY: number;
  /** Velocity in px/s, from the last steer step. */
  vx: number;
  vy: number;
  /** Direction the nose points. */
  angle: number;
  /** Seconds until the next shot is allowed. */
  fireTimer: number;
  /** Fire-rate multiplier (items can raise it). */
  fireRate: number;
}

export function createShip(x: number, y: number): Ship {
  return { x, y, targetX: x, targetY: y, vx: 0, vy: 0, angle: UP, fireTimer: 0, fireRate: 1 };
}

/** Ease the ship toward its target, frame-rate independent. */
export function steerShip(ship: Ship, dt: number): void {
  const k = 1 - Math.exp(-SHIP_FOLLOW_RATE * dt);
  const dx = (ship.targetX - ship.x) * k;
  const dy = (ship.targetY - ship.y) * k;
  ship.x += dx;
  ship.y += dy;
  ship.vx = dt > 0 ? dx / dt : 0;
  ship.vy = dt > 0 ? dy / dt : 0;
}

/** Signed shortest rotation from angle `a` to angle `b`, in (-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** The point the ship aims at: the closest part of the target, nudged slightly inside it. */
function aimPoint(ship: Ship, rect: Rect): Point {
  if (distanceToRect(ship.x, ship.y, rect) === 0) {
    // Already on top of it: aim at its middle so the nose points into the target.
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  const inset = Math.min(6, rect.w / 2, rect.h / 2);
  return {
    x: Math.min(rect.x + rect.w - inset, Math.max(rect.x + inset, ship.x)),
    y: Math.min(rect.y + rect.h - inset, Math.max(rect.y + inset, ship.y)),
  };
}

/**
 * Where the nose should point: at the target when there is one, otherwise along the
 * direction of travel. Null means "keep the current heading".
 */
export function desiredHeading(ship: Ship, target: Rect | null): number | null {
  if (target) {
    const p = aimPoint(ship, target);
    const dx = p.x - ship.x;
    const dy = p.y - ship.y;
    return Math.hypot(dx, dy) < 1 ? null : Math.atan2(dy, dx);
  }
  return Math.hypot(ship.vx, ship.vy) > MOVE_FACE_SPEED ? Math.atan2(ship.vy, ship.vx) : null;
}

/** Rotate the nose toward `heading` at no more than TURN_SPEED. */
export function turnShip(ship: Ship, heading: number | null, dt: number): void {
  if (heading === null) return;
  const diff = angleDiff(ship.angle, heading);
  const max = TURN_SPEED * dt;
  ship.angle += Math.max(-max, Math.min(max, diff));
  ship.angle = Math.atan2(Math.sin(ship.angle), Math.cos(ship.angle)); // keep in (-π, π]
}

/** True when a bullet fired straight from the nose would hit the target. */
export function isAimedAt(ship: Ship, rect: Rect): boolean {
  if (distanceToRect(ship.x, ship.y, rect) === 0) return true;
  const p = aimPoint(ship, rect);
  const dist = Math.hypot(p.x - ship.x, p.y - ship.y);
  const halfSize = Math.min(rect.w, rect.h) / 2;
  const tolerance = Math.max(0.05, Math.atan2(halfSize, dist));
  return Math.abs(angleDiff(ship.angle, Math.atan2(p.y - ship.y, p.x - ship.x))) <= tolerance;
}

/** Advance the fire timer. Returns true when a shot is allowed now. */
export function tickFireTimer(ship: Ship, dt: number): boolean {
  ship.fireTimer = Math.max(0, ship.fireTimer - dt);
  return ship.fireTimer === 0;
}

export function resetFireTimer(ship: Ship): void {
  ship.fireTimer = FIRE_INTERVAL / ship.fireRate;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Distance flown so far, px. */
  traveled: number;
  /** Previous positions as [x0, y0, x1, y1, ...], newest first. */
  trail: number[];
}

/** A bullet leaving the nose, flying straight along the ship's heading. */
export function spawnBullet(ship: Ship): Bullet {
  const cos = Math.cos(ship.angle);
  const sin = Math.sin(ship.angle);
  return {
    x: ship.x + cos * NOSE_OFFSET,
    y: ship.y + sin * NOSE_OFFSET,
    vx: cos * BULLET_SPEED,
    vy: sin * BULLET_SPEED,
    traveled: 0,
    trail: [],
  };
}

export type BulletStep =
  | { kind: 'flying' }
  | { kind: 'expired' }
  /** Hit point as a fraction of the target's size, so it can be shared by ID. */
  | { kind: 'hit'; targetId: TargetId; fx: number; fy: number };

/** The smallest candidate containing the point (the topmost thing in nested layouts). */
function targetAt(x: number, y: number, candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const c of candidates) {
    const r = c.rect;
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
    if (!best || r.w * r.h < best.rect.w * best.rect.h) best = c;
  }
  return best;
}

/**
 * Move a bullet one step in a straight line. It hits the first hittable target it
 * touches, or expires after BULLET_MAX_DISTANCE.
 */
export function stepBullet(b: Bullet, dt: number, candidates: readonly Candidate[]): BulletStep {
  b.trail.unshift(b.x, b.y);
  if (b.trail.length > TRAIL_LENGTH * 2) b.trail.length = TRAIL_LENGTH * 2;

  const distance = BULLET_SPEED * dt;
  const steps = Math.max(1, Math.ceil(distance / BULLET_SUBSTEP));
  for (let i = 0; i < steps; i++) {
    b.x += (b.vx * dt) / steps;
    b.y += (b.vy * dt) / steps;
    const hit = targetAt(b.x, b.y, candidates);
    if (hit) {
      const r = hit.rect;
      return {
        kind: 'hit',
        targetId: hit.id,
        fx: r.w > 0 ? (b.x - r.x) / r.w : 0.5,
        fy: r.h > 0 ? (b.y - r.y) / r.h : 0.5,
      };
    }
  }
  b.traveled += distance;
  return b.traveled >= BULLET_MAX_DISTANCE ? { kind: 'expired' } : { kind: 'flying' };
}
