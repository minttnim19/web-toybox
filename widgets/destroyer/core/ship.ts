// Ship movement, auto-fire timing and bullet flight. Pure math in viewport CSS pixels.
import type { TargetId } from './state';
import type { Rect } from './targeting';

export const SHIP_FOLLOW_RATE = 12; // higher = snappier follow
export const FIRE_INTERVAL = 0.13; // seconds between shots
export const FIRE_RANGE = 150; // px
export const BULLET_SPEED = 720; // px/s
export const BULLET_TTL = 0.5; // seconds a bullet survives once its target is gone
export const TRAIL_LENGTH = 3;

export interface Ship {
  x: number;
  y: number;
  /** Where the pointer wants the ship to be. */
  targetX: number;
  targetY: number;
  /** Seconds until the next shot is allowed. */
  fireTimer: number;
  /** Fire-rate multiplier (items can raise it). */
  fireRate: number;
}

export function createShip(x: number, y: number): Ship {
  return { x, y, targetX: x, targetY: y, fireTimer: 0, fireRate: 1 };
}

/** Ease the ship toward its target, frame-rate independent. */
export function steerShip(ship: Ship, dt: number): void {
  const k = 1 - Math.exp(-SHIP_FOLLOW_RATE * dt);
  ship.x += (ship.targetX - ship.x) * k;
  ship.y += (ship.targetY - ship.y) * k;
}

/** Advance the fire timer. Returns true when a shot should be fired now (if a target exists). */
export function readyToFire(ship: Ship, dt: number): boolean {
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
  targetId: TargetId;
  ttl: number;
  /** Previous positions as [x0, y0, x1, y1, ...], newest first. */
  trail: number[];
}

export function spawnBullet(ship: Ship, targetId: TargetId, rect: Rect): Bullet {
  const x = ship.x;
  const y = ship.y - 8;
  const dx = rect.x + rect.w / 2 - x;
  const dy = rect.y + rect.h / 2 - y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x,
    y,
    vx: (dx / len) * BULLET_SPEED,
    vy: (dy / len) * BULLET_SPEED,
    targetId,
    ttl: BULLET_TTL,
    trail: [],
  };
}

export type BulletStep =
  | { kind: 'flying' }
  | { kind: 'expired' }
  /** Hit point as a fraction of the target's size, so it can be shared by ID. */
  | { kind: 'hit'; fx: number; fy: number };

const inside = (x: number, y: number, r: Rect) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Move a bullet one step. While its target exists (rect != null) it homes toward the
 * target's center; otherwise it flies straight until it expires.
 */
export function stepBullet(b: Bullet, dt: number, rect: Rect | null): BulletStep {
  b.trail.unshift(b.x, b.y);
  if (b.trail.length > TRAIL_LENGTH * 2) b.trail.length = TRAIL_LENGTH * 2;

  if (rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const dx = cx - b.x;
    const dy = cy - b.y;
    const dist = Math.hypot(dx, dy);
    const travel = BULLET_SPEED * dt;
    if (dist <= travel) {
      b.x = cx;
      b.y = cy;
    } else {
      b.vx = (dx / dist) * BULLET_SPEED;
      b.vy = (dy / dist) * BULLET_SPEED;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    if (inside(b.x, b.y, rect)) {
      return {
        kind: 'hit',
        fx: rect.w > 0 ? (b.x - rect.x) / rect.w : 0.5,
        fy: rect.h > 0 ? (b.y - rect.y) / rect.h : 0.5,
      };
    }
    return { kind: 'flying' };
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.ttl -= dt;
  return b.ttl <= 0 ? { kind: 'expired' } : { kind: 'flying' };
}
