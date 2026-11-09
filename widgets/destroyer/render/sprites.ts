// Pixel sprites as character arrays + color maps.
import type { PixelSprite } from '../../../shared/sprite';

/** Retro palette used across the widget. */
export const PALETTE = {
  navy: '#1a1c2c',
  cyan: '#2de2e6',
  pink: '#ff3864',
  yellow: '#ffd319',
  purple: '#b967ff',
  green: '#38b764',
  white: '#f4f4f4',
  orange: '#ef7d57',
  slate: '#566c86',
} as const;

/** Player ship, pointing up. The dark outline keeps it visible on light pages. */
export const SHIP: PixelSprite = {
  rows: [
    '      O      ',
    '     OCO     ',
    '     OCO     ',
    '    OCWCO    ',
    '    OCPCO    ',
    '   OCCPCCO   ',
    '  OOCCCCCOO  ',
    ' OPOCCCCCOPO ',
    'OPPOCCCCCOPPO',
    'OPPOOCCCOOPPO',
    'OOO  OOO  OOO',
  ],
  palette: {
    O: PALETTE.navy,
    C: PALETTE.cyan,
    W: PALETTE.white,
    P: PALETTE.pink,
  },
};

/**
 * Ship plus thruster flame (3 flicker lengths), padded so the ship body sits exactly in
 * the middle: rotating the frame then turns the ship around its own center.
 */
const shipFrames: PixelSprite[] = [];
export function shipFrame(flicker: number): PixelSprite {
  const cached = shipFrames[flicker];
  if (cached) return cached;
  const width = 21;
  const pad = (row: string) => row.padStart(4 + row.length).padEnd(width);
  const flame = 2 + flicker;
  const rows = [...Array<string>(5).fill(' '.repeat(width)), ...SHIP.rows.map(pad)];
  for (let i = 0; i <= flame; i++) {
    const core = i < flame - 1 + (flicker === 1 ? 1 : 0) ? 'Y' : 'F';
    const mid = i < flame ? `F${core}F` : 'OOO';
    rows.push(pad(`    O${mid}O    `));
  }
  while (rows.length < width) rows.push(' '.repeat(width));
  const frame: PixelSprite = {
    rows,
    palette: { ...SHIP.palette, F: PALETTE.pink, Y: PALETTE.yellow },
  };
  shipFrames[flicker] = frame;
  return frame;
}
