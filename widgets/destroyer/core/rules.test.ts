import { describe, expect, it } from 'vitest';
import { LocalAuthority, type AuthorityEvent } from './authority';
import {
  COMBO_WINDOW,
  applyDamage,
  comboMultiplier,
  createGameState,
  createPlayer,
  destroyedRatio,
  endReason,
  expireCombo,
  finishGame,
  hpForTarget,
  isHittable,
  scoreDestroy,
  scoreHit,
  timeBonus,
  timeLeft,
} from './rules';
import { LOCAL_PLAYER, type TargetSpec } from './state';

const spec = (
  id: number,
  parentId: number | null,
  area = 10_000,
  isContainer = false,
): TargetSpec => ({ id, parentId, area, isContainer });

// 0 = container, 1 and 2 inside it, 3 standalone
const page = (): TargetSpec[] => [
  spec(0, null, 400_000, true),
  spec(1, 0),
  spec(2, 0),
  spec(3, null),
];

/** Authority that never drops items, plus a log of its events. */
function setup(targets: TargetSpec[], duration = 60) {
  const auth = new LocalAuthority(() => 0.999);
  auth.start(targets, { duration });
  const events: AuthorityEvent[] = [];
  auth.subscribe((e) => events.push(e));
  return { auth, events, player: () => auth.state.players[LOCAL_PLAYER]! };
}

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
  it('counts direct children and creates the local player', () => {
    const s = createGameState(page());
    expect(s.targets[0]!.aliveChildren).toBe(2);
    expect(s.targets[3]!.aliveChildren).toBe(0);
    expect(s.players[LOCAL_PLAYER]).toMatchObject({ score: 0, combo: 0, inventory: [] });
  });

  it('rejects IDs that are not in DOM order', () => {
    expect(() => createGameState([spec(1, null)])).toThrow();
    expect(() => createGameState([spec(0, 1), spec(1, null)])).toThrow();
  });
});

describe('damage', () => {
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

  it('accepts nothing once the round is over', () => {
    const s = createGameState(page());
    finishGame(s, 'timeup');
    expect(applyDamage(s, 3, 1)).toBeNull();
  });
});

describe('scoring', () => {
  it('gives 1 point per hit and max HP × 10 per destroy', () => {
    const p = createPlayer('p');
    expect(scoreHit(p)).toBe(1);
    expect(scoreDestroy(p, 7, 0)).toEqual({ points: 70, combo: 1, multiplier: 1 });
    expect(p.score).toBe(71);
  });

  it('raises the multiplier every 3 combo, up to x5', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 12, 30].map(comboMultiplier)).toEqual([1, 1, 1, 2, 2, 3, 4, 5, 5]);
  });

  it('chains destroys within the combo window and resets after it', () => {
    const p = createPlayer('p');
    scoreDestroy(p, 1, 0);
    scoreDestroy(p, 1, COMBO_WINDOW - 0.01);
    expect(scoreDestroy(p, 1, COMBO_WINDOW * 2 - 0.02)).toMatchObject({ combo: 3, multiplier: 2 });
    expect(p.maxCombo).toBe(3);
    expect(scoreDestroy(p, 1, 100)).toMatchObject({ combo: 1, multiplier: 1 });
    expect(p.maxCombo).toBe(3);
  });

  it('drops the displayed combo once the window passes', () => {
    const p = createPlayer('p');
    scoreDestroy(p, 1, 0);
    expireCombo(p, COMBO_WINDOW / 2);
    expect(p.combo).toBe(1);
    expireCombo(p, COMBO_WINDOW + 0.01);
    expect(p.combo).toBe(0);
  });
});

describe('end conditions', () => {
  it('ends with a clear when everything is destroyed', () => {
    const s = createGameState([spec(0, null, 1)], { duration: 60 });
    expect(endReason(s)).toBeNull();
    applyDamage(s, 0, 1);
    expect(endReason(s)).toBe('clear');
  });

  it('ends with time up when the timer runs out', () => {
    const s = createGameState(page(), { duration: 60 });
    s.elapsed = 59.9;
    expect(endReason(s)).toBeNull();
    s.elapsed = 60;
    expect(timeLeft(s)).toBe(0);
    expect(endReason(s)).toBe('timeup');
  });

  it('gives 50 points per remaining second on a clear only', () => {
    const s = createGameState(page(), { duration: 120 });
    s.elapsed = 100.4; // 19.6 s left → 19 whole seconds
    expect(timeBonus(s, 'clear')).toBe(950);
    expect(timeBonus(s, 'timeup')).toBe(0);
    const result = finishGame(s, 'clear');
    expect(result).toEqual({ reason: 'clear', timeBonus: 950, timeUsed: 100.4 });
    expect(s.players[LOCAL_PLAYER]!.score).toBe(950);
  });

  it('reports the share of targets destroyed', () => {
    const s = createGameState(page());
    expect(destroyedRatio(s)).toBe(0);
    applyDamage(s, 3, 100);
    expect(destroyedRatio(s)).toBe(0.25);
    expect(destroyedRatio(createGameState([]))).toBe(1);
  });
});

describe('LocalAuthority', () => {
  it('emits hit then destroy with score and combo', () => {
    const { auth, events, player } = setup([spec(0, null, 1), spec(1, null, 1)]);
    auth.requestHit({ targetId: 0, damage: 1, playerId: LOCAL_PLAYER, at: { fx: 0.5, fy: 0.5 } });
    expect(events.map((e) => e.type)).toEqual(['hit', 'destroy']);
    expect(events[1]).toMatchObject({ points: 10, combo: 1, multiplier: 1 });
    expect(player().score).toBe(11);
  });

  it('ends the round with a time bonus when the last target falls', () => {
    const { auth, events, player } = setup([spec(0, null, 1)], 60);
    auth.tick(10);
    auth.requestHit({ targetId: 0, damage: 1, playerId: LOCAL_PLAYER });
    const end = events.find((e) => e.type === 'end');
    expect(end).toMatchObject({ result: { reason: 'clear', timeBonus: 50 * 50, timeUsed: 10 } });
    expect(player().score).toBe(11 + 2500);
    auth.requestHit({ targetId: 0, damage: 1, playerId: LOCAL_PLAYER });
    expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
  });

  it('ends the round when time runs out', () => {
    const { auth, events } = setup(page(), 60);
    auth.tick(30);
    expect(events).toHaveLength(0);
    auth.tick(30);
    expect(events).toEqual([
      { type: 'end', result: { reason: 'timeup', timeBonus: 0, timeUsed: 60 } },
    ]);
    auth.tick(1);
    expect(events).toHaveLength(1);
  });

  it('emits nothing for rejected hits and stops after unsubscribe', () => {
    const { auth, events } = setup(page());
    auth.requestHit({ targetId: 0, damage: 1, playerId: LOCAL_PLAYER }); // still covered
    auth.requestHit({ targetId: 3, damage: 1, playerId: 'stranger' }); // unknown player
    expect(events).toHaveLength(0);
    auth.dispose();
    auth.requestHit({ targetId: 3, damage: 1, playerId: LOCAL_PLAYER });
    expect(events).toHaveLength(0);
  });
});
