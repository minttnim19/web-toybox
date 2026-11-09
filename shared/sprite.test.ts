import { describe, expect, it } from 'vitest';
import { rotateSprite } from './sprite';

// Square with odd sides, so quarter turns land exactly on whole pixels.
const arrow = { rows: ['  X  ', ' XXX ', '  X  ', '  X  ', '  X  '], palette: { X: '#000' } };
const trim = (rows: readonly string[]) => rows.map((r) => r.trimEnd()).filter((r) => r.trim());

describe('rotateSprite', () => {
  it('keeps the sprite unchanged at 0 rad (apart from padding)', () => {
    expect(trim(rotateSprite(arrow, 0).rows).map((r) => r.trim())).toEqual([
      'X',
      'XXX',
      'X',
      'X',
      'X',
    ]);
  });

  it('turns a quarter turn clockwise for +π/2', () => {
    const rows = trim(rotateSprite(arrow, Math.PI / 2).rows);
    // The arrow head (wide part) now points right.
    expect(rows.map((r) => r.trim())).toEqual(['X', 'XXXXX', 'X']);
    expect(rows[1]!.trimEnd().endsWith('XXXXX')).toBe(true);
  });

  it('makes room for any rotation', () => {
    const { rows } = rotateSprite(arrow, 0.7);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows[0]!.length).toBeGreaterThanOrEqual(8);
  });
});
