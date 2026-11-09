import { describe, expect, it } from 'vitest';
import { distanceToRect, pickNearest, targetsInShape } from './targeting';

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

describe('targetsInShape', () => {
  const view = { w: 1000, h: 800 };
  const at = (id: number, x: number, y: number, w = 20, h = 20) => ({ id, rect: { x, y, w, h } });
  const targets = [
    at(1, 110, 90), // touching the ship at (100, 100)
    at(2, 400, 95), // same row, far right
    at(3, 95, 600), // same column, far below
    at(4, 300, 300), // diagonal: neither row nor column
    at(5, 2000, 95), // same row but off screen
  ];

  it('covers targets within the radius for a circle', () => {
    expect(targetsInShape({ shape: 'circle', radius: 170 }, 100, 100, targets, view)).toEqual([1]);
    expect(targetsInShape({ shape: 'circle', radius: 300 }, 100, 100, targets, view)).toEqual([
      1, 2, 4,
    ]);
  });

  it('covers the row and column through the ship for a cross, on screen only', () => {
    expect(targetsInShape({ shape: 'cross', thickness: 18 }, 100, 100, targets, view)).toEqual([
      1, 2, 3,
    ]);
  });

  it('covers nothing for items without an area', () => {
    expect(targetsInShape({ shape: 'none' }, 100, 100, targets, view)).toEqual([]);
  });
});
