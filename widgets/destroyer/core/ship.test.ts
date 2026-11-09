import { describe, expect, it } from 'vitest';
import {
  BULLET_TTL,
  FIRE_INTERVAL,
  createShip,
  readyToFire,
  resetFireTimer,
  spawnBullet,
  steerShip,
  stepBullet,
} from './ship';
import { distanceToRect, pickNearest } from './targeting';

describe('steerShip', () => {
  it('eases toward the target without snapping', () => {
    const ship = createShip(0, 0);
    ship.targetX = 100;
    steerShip(ship, 1 / 60);
    expect(ship.x).toBeGreaterThan(0);
    expect(ship.x).toBeLessThan(100);
    for (let i = 0; i < 120; i++) steerShip(ship, 1 / 60);
    expect(ship.x).toBeCloseTo(100, 1);
  });
});

describe('fire timer', () => {
  it('fires every FIRE_INTERVAL, faster with a higher fire rate', () => {
    const ship = createShip(0, 0);
    expect(readyToFire(ship, 0)).toBe(true);
    resetFireTimer(ship);
    expect(readyToFire(ship, FIRE_INTERVAL / 2)).toBe(false);
    expect(readyToFire(ship, FIRE_INTERVAL / 2)).toBe(true);
    ship.fireRate = 3;
    resetFireTimer(ship);
    expect(readyToFire(ship, FIRE_INTERVAL / 3 + 1e-6)).toBe(true);
  });
});

describe('bullets', () => {
  const rect = { x: 100, y: -10, w: 20, h: 20 };

  it('home in on the target and report the hit point as fractions', () => {
    const b = spawnBullet(createShip(0, 8), 7, rect);
    let step = stepBullet(b, 1 / 60, rect);
    for (let i = 0; i < 60 && step.kind === 'flying'; i++) step = stepBullet(b, 1 / 60, rect);
    expect(step.kind).toBe('hit');
    if (step.kind === 'hit') {
      expect(step.fx).toBeGreaterThanOrEqual(0);
      expect(step.fx).toBeLessThanOrEqual(1);
    }
  });

  it('expire when their target is gone', () => {
    const b = spawnBullet(createShip(0, 0), 7, rect);
    expect(stepBullet(b, BULLET_TTL / 2, null).kind).toBe('flying');
    expect(stepBullet(b, BULLET_TTL, null).kind).toBe('expired');
  });

  it('keep a short trail', () => {
    const b = spawnBullet(createShip(0, 0), 7, { x: 1000, y: 0, w: 10, h: 10 });
    for (let i = 0; i < 10; i++) stepBullet(b, 1 / 60, { x: 1000, y: 0, w: 10, h: 10 });
    expect(b.trail.length).toBe(6);
  });
});

describe('targeting', () => {
  it('measures distance to the closest edge', () => {
    const r = { x: 10, y: 10, w: 10, h: 10 };
    expect(distanceToRect(15, 15, r)).toBe(0);
    expect(distanceToRect(0, 15, r)).toBe(10);
    expect(distanceToRect(23, 24, r)).toBe(5);
  });

  it('picks the nearest candidate in range, smallest on ties', () => {
    const near = { id: 1, rect: { x: 50, y: 0, w: 10, h: 10 } };
    const far = { id: 2, rect: { x: 120, y: 0, w: 10, h: 10 } };
    expect(pickNearest(0, 0, [far, near], 150)?.id).toBe(1);
    expect(pickNearest(0, 0, [far], 100)).toBeNull();
    const big = { id: 3, rect: { x: -50, y: -50, w: 100, h: 100 } };
    const small = { id: 4, rect: { x: -5, y: -5, w: 10, h: 10 } };
    expect(pickNearest(0, 0, [big, small], 150)?.id).toBe(4);
  });
});
