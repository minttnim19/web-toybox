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
