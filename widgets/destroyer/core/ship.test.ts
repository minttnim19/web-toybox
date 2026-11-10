import { describe, expect, it } from 'vitest';
import {
  BULLET_MAX_DISTANCE,
  FIRE_INTERVAL,
  NOSE_OFFSET,
  angleDiff,
  createShip,
  desiredHeading,
  isAimedAt,
  tickFireTimer,
  resetFireTimer,
  spawnBullet,
  steerShip,
  stepBullet,
  turnShip,
} from './ship';

const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

describe('steerShip', () => {
  it('eases toward the target without snapping and tracks velocity', () => {
    const ship = createShip(0, 0);
    ship.targetX = 100;
    steerShip(ship, 1 / 60);
    expect(ship.x).toBeGreaterThan(0);
    expect(ship.x).toBeLessThan(100);
    expect(ship.vx).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) steerShip(ship, 1 / 60);
    expect(ship.x).toBeCloseTo(100, 1);
  });
});

describe('heading', () => {
  it('starts pointing up', () => {
    expect(createShip(0, 0).angle).toBeCloseTo(UP);
  });

  it('computes the shortest signed rotation', () => {
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleDiff(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2);
  });

  it('faces the direction of travel when there is no target', () => {
    const ship = createShip(0, 0);
    ship.vy = 300; // moving down
    expect(desiredHeading(ship, null)).toBeCloseTo(DOWN);
    ship.vy = 10; // barely moving: keep current heading
    expect(desiredHeading(ship, null)).toBeNull();
  });

  it('faces the target when there is one, even while moving away', () => {
    const ship = createShip(0, 0);
    ship.vy = 300;
    expect(desiredHeading(ship, { x: -5, y: -100, w: 10, h: 10 })).toBeCloseTo(UP);
  });

  it('turns gradually, no faster than TURN_SPEED', () => {
    const ship = createShip(0, 0);
    turnShip(ship, DOWN, 1 / 60);
    expect(Math.abs(angleDiff(ship.angle, UP))).toBeGreaterThan(0);
    expect(Math.abs(angleDiff(ship.angle, DOWN))).toBeGreaterThan(1);
    for (let i = 0; i < 60; i++) turnShip(ship, DOWN, 1 / 60);
    expect(ship.angle).toBeCloseTo(DOWN);
  });

  it('only counts as aimed once the nose lines up with the target', () => {
    const ship = createShip(0, 0); // pointing up
    const above = { x: -5, y: -100, w: 10, h: 10 };
    const right = { x: 100, y: -5, w: 10, h: 10 };
    expect(isAimedAt(ship, above)).toBe(true);
    expect(isAimedAt(ship, right)).toBe(false);
    expect(isAimedAt(ship, { x: -50, y: -50, w: 100, h: 100 })).toBe(true); // on top of it
  });
});

describe('fire timer', () => {
  it('fires every FIRE_INTERVAL, faster with a higher fire rate', () => {
    const ship = createShip(0, 0);
    expect(tickFireTimer(ship, 0)).toBe(true);
    resetFireTimer(ship);
    expect(tickFireTimer(ship, FIRE_INTERVAL / 2)).toBe(false);
    expect(tickFireTimer(ship, FIRE_INTERVAL / 2)).toBe(true);
    ship.fireRate = 3;
    resetFireTimer(ship);
    expect(tickFireTimer(ship, FIRE_INTERVAL / 3 + 1e-6)).toBe(true);
  });
});

describe('bullets', () => {
  it('leave from the nose along the heading', () => {
    const ship = createShip(50, 50);
    ship.angle = 0; // pointing right
    const b = spawnBullet(ship);
    expect(b.x).toBeCloseTo(50 + NOSE_OFFSET);
    expect(b.y).toBeCloseTo(50);
    expect(b.vy).toBeCloseTo(0);
  });

  it('fly in a straight line and hit the first target in the way', () => {
    const ship = createShip(0, 0);
    ship.angle = 0;
    const b = spawnBullet(ship);
    const near = { id: 1, rect: { x: 60, y: -5, w: 10, h: 10 } };
    const far = { id: 2, rect: { x: 120, y: -5, w: 10, h: 10 } };
    const off = { id: 3, rect: { x: 30, y: 20, w: 10, h: 10 } }; // below the path
    let step = stepBullet(b, 1 / 60, [far, off, near]);
    for (let i = 0; i < 60 && step.kind === 'flying'; i++)
      step = stepBullet(b, 1 / 60, [far, off, near]);
    expect(step).toMatchObject({ kind: 'hit', targetId: 1 });
    expect(b.y).toBeCloseTo(0);
    if (step.kind === 'hit') expect(step.fx).toBeLessThan(0.5); // entered from the left edge
  });

  it('do not skip thin targets at high speed', () => {
    const ship = createShip(0, 0);
    ship.angle = 0;
    const b = spawnBullet(ship);
    const thin = { id: 9, rect: { x: 40, y: -10, w: 6, h: 20 } };
    expect(stepBullet(b, 0.05, [thin])).toMatchObject({ kind: 'hit', targetId: 9 });
  });

  it('expire after BULLET_MAX_DISTANCE and keep a short trail', () => {
    const b = spawnBullet(createShip(0, 0));
    let step = stepBullet(b, 1 / 60, []);
    expect(b.trail).toHaveLength(2);
    for (let i = 0; i < 100 && step.kind === 'flying'; i++) step = stepBullet(b, 1 / 60, []);
    expect(step.kind).toBe('expired');
    expect(b.traveled).toBeGreaterThanOrEqual(BULLET_MAX_DISTANCE);
    expect(b.trail).toHaveLength(6);
  });
});
