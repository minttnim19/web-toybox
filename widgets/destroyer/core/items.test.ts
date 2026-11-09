import { describe, expect, it } from 'vitest';
import { LocalAuthority, type AuthorityEvent } from './authority';
import {
  BOMB_DAMAGE,
  ITEMS,
  ITEM_KINDS,
  ITEM_LIFETIME,
  LASER_DAMAGE,
  MAGNET_DURATION,
  MAX_INVENTORY,
  RAPID_DURATION,
  dropChance,
  rollDrop,
  type ItemKind,
} from './items';
import { LOCAL_PLAYER, type TargetSpec } from './state';

const spec = (id: number, parentId: number | null, area = 400 * 400): TargetSpec => ({
  id,
  parentId,
  area,
  isContainer: false,
});

/** Random source that replays the given values, then repeats the last one. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
};

function setup(targets: TargetSpec[], rng = () => 0.999) {
  const auth = new LocalAuthority(rng);
  auth.start(targets, { duration: 120 });
  const events: AuthorityEvent[] = [];
  auth.subscribe((e) => events.push(e));
  const player = () => auth.state.players[LOCAL_PLAYER]!;
  const give = (...kinds: ItemKind[]) => player().inventory.push(...kinds);
  return { auth, events, player, give };
}

describe('item drops', () => {
  it('are more likely from bigger targets, capped at 60%', () => {
    expect(dropChance(1)).toBeLessThan(dropChance(10));
    expect(dropChance(30)).toBeLessThanOrEqual(0.6);
  });

  it('roll a kind by weight when the chance hits', () => {
    expect(rollDrop(1, () => 0.99)).toBeNull();
    expect(rollDrop(30, sequence(0, 0))).toBe(ITEM_KINDS[0]);
    expect(rollDrop(30, sequence(0, 0.9999))).toBe(ITEM_KINDS[ITEM_KINDS.length - 1]);
  });

  it('appear where the target broke and expire after their lifetime', () => {
    const { auth, events } = setup([spec(0, null, 1), spec(1, null)], sequence(0, 0));
    auth.requestHit({ targetId: 0, damage: 5, playerId: LOCAL_PLAYER, at: { fx: 0.2, fy: 0.7 } });
    const drop = events.find((e) => e.type === 'itemDrop');
    expect(drop).toMatchObject({ item: { id: 0, targetId: 0, fx: 0.2, fy: 0.7 } });
    expect(auth.state.items).toHaveLength(1);
    auth.tick(ITEM_LIFETIME - 0.1);
    expect(auth.state.items).toHaveLength(1);
    auth.tick(0.2);
    expect(auth.state.items).toHaveLength(0);
    expect(events.at(-1)).toEqual({ type: 'itemExpire', itemId: 0 });
  });
});

describe('pickup', () => {
  it('moves the item into the inventory, up to the maximum', () => {
    const { auth, player } = setup([spec(0, null)]);
    const state = auth.state;
    for (let i = 0; i < MAX_INVENTORY + 1; i++) {
      state.items.push({ id: i, kind: 'bomb', targetId: 0, fx: 0, fy: 0, expiresAt: 99 });
      auth.requestPickup({ itemId: i, playerId: LOCAL_PLAYER });
    }
    expect(player().inventory).toHaveLength(MAX_INVENTORY);
    expect(state.items.map((i) => i.id)).toEqual([MAX_INVENTORY]); // the extra one stays
  });

  it('ignores unknown items', () => {
    const { auth, events } = setup([spec(0, null)]);
    auth.requestPickup({ itemId: 42, playerId: LOCAL_PLAYER });
    expect(events).toHaveLength(0);
  });
});

describe('using items', () => {
  it('bomb deals heavy damage to the given targets and uses up the slot', () => {
    const { auth, player, give, events } = setup([spec(0, null), spec(1, null), spec(2, null)]);
    give('bomb', 'rapid');
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 0, targetIds: [0, 2] });
    const t = auth.state.targets;
    expect(t[0]!.maxHp - t[0]!.hp).toBe(BOMB_DAMAGE);
    expect(t[1]!.hp).toBe(t[1]!.maxHp);
    expect(t[2]!.maxHp - t[2]!.hp).toBe(BOMB_DAMAGE);
    expect(player().inventory).toEqual(['rapid']);
    expect(events[0]).toEqual({ type: 'itemUse', kind: 'bomb', playerId: LOCAL_PLAYER });
  });

  it('damages inner targets first, so a blast can peel a container too', () => {
    const tiny = 1; // 1 HP each
    const { auth, give } = setup([
      { id: 0, parentId: null, area: tiny, isContainer: true },
      spec(1, 0, tiny),
    ]);
    give('laser');
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 0, targetIds: [0, 1] });
    expect(auth.state.targets.every((t) => t.destroyed)).toBe(true);
    expect(LASER_DAMAGE).toBeGreaterThan(0);
  });

  it('rapid and magnet add timed buffs that expire', () => {
    const { auth, player, give } = setup([spec(0, null)]);
    give('rapid', 'magnet');
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 0, targetIds: [] });
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 0, targetIds: [] });
    expect(player().buffs).toEqual([
      { kind: 'rapid', remaining: RAPID_DURATION },
      { kind: 'magnet', remaining: MAGNET_DURATION },
    ]);
    auth.tick(RAPID_DURATION + 0.01);
    expect(player().buffs).toEqual([]);
  });

  it('refreshes a buff instead of stacking it', () => {
    const { auth, player, give } = setup([spec(0, null)]);
    give('rapid', 'rapid');
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 0, targetIds: [] });
    auth.tick(5);
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 0, targetIds: [] });
    expect(player().buffs).toEqual([{ kind: 'rapid', remaining: RAPID_DURATION }]);
  });

  it('does nothing for an empty slot', () => {
    const { auth, events } = setup([spec(0, null)]);
    auth.requestUseItem({ playerId: LOCAL_PLAYER, slot: 2, targetIds: [0] });
    expect(events).toHaveLength(0);
  });

  it('every item has a Thai name and description', () => {
    for (const kind of ITEM_KINDS) {
      expect(ITEMS[kind].name).toMatch(/[฀-๿]/);
      expect(ITEMS[kind].description).toMatch(/[฀-๿]/);
    }
  });
});
