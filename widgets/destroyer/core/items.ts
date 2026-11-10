// Item definitions. To add an item: add its kind to ItemKind and a definition to ITEMS,
// then its text in ui/strings.ts and its sprite in render/sprites.ts. Phase 2 items that
// affect other players can add new effect helpers to ItemContext without changing these.
import type { PlayerId, TargetId } from './state';

export type ItemKind = 'bomb' | 'rapid' | 'laser' | 'magnet';
export type BuffKind = 'rapid' | 'magnet';

export const MAX_INVENTORY = 3;
export const ITEM_LIFETIME = 14; // seconds an item stays on the page
export const ITEM_BLINK_TIME = 3; // blinks during its last seconds

export const BOMB_RADIUS = 170; // px around the ship
export const BOMB_DAMAGE = 8;
export const LASER_THICKNESS = 18; // px width of each beam
export const LASER_DAMAGE = 5;
export const RAPID_DURATION = 8; // s
export const RAPID_FIRE_RATE = 3; // x fire rate
export const MAGNET_DURATION = 8; // s
export const MAGNET_RADIUS = 280; // px

/** Which targets the game should collect (on its own screen) when the item is used. */
export type ItemTargeting =
  | { shape: 'none' }
  /** Every target within `radius` px of the ship. */
  | { shape: 'circle'; radius: number }
  /** Every target crossed by a horizontal and a vertical beam through the ship. */
  | { shape: 'cross'; thickness: number };

/** What an item may do to the game, provided by the authority. */
export interface ItemContext {
  playerId: PlayerId;
  /** Targets the game collected for this item's targeting shape. */
  targetIds: readonly TargetId[];
  /** Damage targets; inner targets are processed first so a blast can peel layers. */
  damage(targetIds: readonly TargetId[], amount: number): void;
  addBuff(kind: BuffKind, duration: number): void;
}

export interface ItemDef {
  kind: ItemKind;
  targeting: ItemTargeting;
  /** Relative chance of this kind when an item drops. */
  weight: number;
  use(ctx: ItemContext): void;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  bomb: {
    kind: 'bomb',
    targeting: { shape: 'circle', radius: BOMB_RADIUS },
    weight: 3,
    use: (ctx) => ctx.damage(ctx.targetIds, BOMB_DAMAGE),
  },
  rapid: {
    kind: 'rapid',
    targeting: { shape: 'none' },
    weight: 3,
    use: (ctx) => ctx.addBuff('rapid', RAPID_DURATION),
  },
  laser: {
    kind: 'laser',
    targeting: { shape: 'cross', thickness: LASER_THICKNESS },
    weight: 2,
    use: (ctx) => ctx.damage(ctx.targetIds, LASER_DAMAGE),
  },
  magnet: {
    kind: 'magnet',
    targeting: { shape: 'none' },
    weight: 2,
    use: (ctx) => ctx.addBuff('magnet', MAGNET_DURATION),
  },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];

/** Chance (0..1) that destroying a target drops an item; bigger targets drop more often. */
export function dropChance(maxHp: number): number {
  return Math.min(0.6, 0.08 + maxHp * 0.018);
}

/** Roll for a drop. `rng` returns numbers in [0, 1). */
export function rollDrop(maxHp: number, rng: () => number): ItemKind | null {
  if (rng() >= dropChance(maxHp)) return null;
  const total = ITEM_KINDS.reduce((sum, k) => sum + ITEMS[k].weight, 0);
  let pick = rng() * total;
  for (const kind of ITEM_KINDS) {
    pick -= ITEMS[kind].weight;
    if (pick < 0) return kind;
  }
  return ITEM_KINDS[ITEM_KINDS.length - 1]!;
}
