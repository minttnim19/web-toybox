// Pixel sprites as character arrays + color maps.
import type { PixelSprite } from '../../../shared/sprite';
import type { ItemKind } from '../core/items';

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
} as const;

/** Player ship, pointing up. The dark outline keeps it visible on light pages. */
const SHIP: PixelSprite = {
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
  const rows = [...new Array<string>(5).fill(' '.repeat(width)), ...SHIP.rows.map(pad)];
  // The flame's yellow core reaches one pixel further on the middle flicker frame.
  const coreLength = flicker === 1 ? flame : flame - 1;
  for (let i = 0; i <= flame; i++) {
    const core = i < coreLength ? 'Y' : 'F';
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

/** 8x8 item icons; drawn inside a 12x12 box (see itemSprite). */
const ITEM_ICONS: Record<
  ItemKind,
  { icon: string[]; fill: string; colors: Record<string, string> }
> = {
  bomb: {
    fill: PALETTE.pink,
    colors: { O: PALETTE.navy, W: PALETTE.white, Y: PALETTE.yellow },
    icon: [
      '     Y Y',
      '    O Y ',
      '   OOO  ',
      '  OOOOO ',
      ' OWOOOOO',
      ' OWOOOOO',
      ' OOOOOOO',
      '  OOOOO ',
    ],
  },
  rapid: {
    fill: PALETTE.purple,
    colors: { Y: PALETTE.yellow, O: PALETTE.navy },
    icon: [
      '    YYYO',
      '   YYYO ',
      '  YYYO  ',
      ' YYYYYYO',
      ' OOOYYYO',
      '   YYYO ',
      '  YYO   ',
      '  YO    ',
    ],
  },
  laser: {
    fill: PALETTE.navy,
    colors: { C: PALETTE.cyan, W: PALETTE.white },
    icon: [
      '   CC   ',
      '   CC   ',
      '   CC   ',
      'CCCWWCCC',
      'CCCWWCCC',
      '   CC   ',
      '   CC   ',
      '   CC   ',
    ],
  },
  magnet: {
    fill: PALETTE.yellow,
    colors: { P: PALETTE.pink, W: PALETTE.white, O: PALETTE.navy },
    icon: [
      'WW    WW',
      'WW    WW',
      'PP    PP',
      'PP    PP',
      'PPP  PPP',
      'OPPPPPPO',
      ' OPPPPO ',
      '  OOOO  ',
    ],
  },
};

const itemSprites = new Map<ItemKind, PixelSprite>();

/** A 12x12 pixel box with the item's icon. */
export function itemSprite(kind: ItemKind): PixelSprite {
  let sprite = itemSprites.get(kind);
  if (sprite) return sprite;
  const { icon, fill, colors } = ITEM_ICONS[kind];
  const rows = ['#'.repeat(12), '#' + 'F'.repeat(10) + '#'];
  for (const line of icon) rows.push('#F' + line.replaceAll(' ', 'F') + 'F#');
  rows.push('#' + 'F'.repeat(10) + '#', '#'.repeat(12));
  sprite = { rows, palette: { '#': PALETTE.navy, F: fill, ...colors } };
  itemSprites.set(kind, sprite);
  return sprite;
}
