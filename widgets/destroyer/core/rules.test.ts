import { describe, expect, it } from 'vitest';
import { LocalAuthority, type AuthorityEvent } from './authority';
import { applyDamage, createGameState, destroyedRatio, hpForTarget, isHittable } from './rules';
import type { TargetSpec } from './state';

const spec = (
  id: number,
  parentId: number | null,
  area = 10_000,
  isContainer = false,
): TargetSpec => ({
  id,
  parentId,
  area,
  isContainer,
});

// 0 = container, 1 and 2 inside it, 3 standalone
const page = (): TargetSpec[] => [
  spec(0, null, 400_000, true),
  spec(1, 0),
  spec(2, 0),
  spec(3, null),
];

describe('hpForTarget', () => {
  it('scales with sqrt(area) / 22', () => {
    expect(hpForTarget(110 * 110, false)).toBe(5);
    expect(hpForTarget(220 * 220, false)).toBe(10);
  });

  it('clamps to 1..30', () => {
    expect(hpForTarget(0, false)).toBe(1);
    expect(hpForTarget(6 * 6, false)).toBe(1);
    expect(hpForTarget(5000 * 5000, false)).toBe(30);
  });

  it('gives containers reduced HP', () => {
    expect(hpForTarget(220 * 220, true)).toBe(5);
    expect(hpForTarget(10 * 10, true)).toBe(1);
  });
});

describe('createGameState', () => {
  it('counts direct children', () => {
    const s = createGameState(page());
    expect(s.targets[0]!.aliveChildren).toBe(2);
    expect(s.targets[3]!.aliveChildren).toBe(0);
  });

  it('rejects IDs that are not in DOM order', () => {
    expect(() => createGameState([spec(1, null)])).toThrow();
    expect(() => createGameState([spec(0, 1), spec(1, null)])).toThrow();
  });
});

describe('applyDamage', () => {
  it('reduces HP and destroys at 0', () => {
    const s = createGameState([spec(0, null, 110 * 110)]); // 5 HP
    expect(applyDamage(s, 0, 2)).toEqual({ applied: 2, hp: 3, destroyed: false });
    expect(applyDamage(s, 0, 10)).toEqual({ applied: 3, hp: 0, destroyed: true });
    expect(s.destroyedCount).toBe(1);
  });

  it('ignores destroyed targets, unknown IDs and non-positive damage', () => {
    const s = createGameState([spec(0, null, 1)]);
    applyDamage(s, 0, 1);
    expect(applyDamage(s, 0, 1)).toBeNull();
    expect(applyDamage(s, 99, 1)).toBeNull();
    expect(applyDamage(createGameState([spec(0, null)]), 0, 0)).toBeNull();
  });

  it('only lets a container be hit once everything inside is destroyed', () => {
    const s = createGameState(page());
    expect(isHittable(s, 0)).toBe(false);
    expect(applyDamage(s, 0, 1)).toBeNull();
    applyDamage(s, 1, 100);
    expect(isHittable(s, 0)).toBe(false);
    applyDamage(s, 2, 100);
    expect(isHittable(s, 0)).toBe(true);
    expect(applyDamage(s, 0, 1)).not.toBeNull();
  });
});

describe('destroyedRatio', () => {
  it('is the share of destroyed targets', () => {
    const s = createGameState(page());
    expect(destroyedRatio(s)).toBe(0);
    applyDamage(s, 3, 100);
    expect(destroyedRatio(s)).toBe(0.25);
  });

  it('treats an empty page as fully destroyed', () => {
    expect(destroyedRatio(createGameState([]))).toBe(1);
  });
});

describe('LocalAuthority', () => {
  it('emits hit then destroy events for accepted hits', () => {
    const auth = new LocalAuthority();
    auth.start([spec(0, null, 1)]);
    const events: AuthorityEvent[] = [];
    auth.subscribe((e) => events.push(e));
    auth.requestHit({ targetId: 0, damage: 1, playerId: 'p1', at: { fx: 0.5, fy: 0.5 } });
    expect(events.map((e) => e.type)).toEqual(['hit', 'destroy']);
    expect(events[0]).toMatchObject({ targetId: 0, playerId: 'p1', hp: 0, maxHp: 1 });
  });

  it('emits nothing for rejected hits and stops after unsubscribe', () => {
    const auth = new LocalAuthority();
    auth.start(page());
    const events: AuthorityEvent[] = [];
    const off = auth.subscribe((e) => events.push(e));
    auth.requestHit({ targetId: 0, damage: 1, playerId: 'p1' }); // container still covered
    expect(events).toHaveLength(0);
    off();
    auth.requestHit({ targetId: 3, damage: 1, playerId: 'p1' });
    expect(events).toHaveLength(0);
    expect(auth.state.targets[3]!.hp).toBeLessThan(auth.state.targets[3]!.maxHp);
  });
});
