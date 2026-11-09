// Game rules: HP, damage, destruction. Pure functions over GameState.
import type { GameState, TargetId, TargetSpec, TargetState } from './state';

export const HP_DIVISOR = 22;
export const HP_MIN = 1;
export const HP_MAX = 30;
/** Containers are mostly "frame", so they take fewer hits once uncovered. */
export const CONTAINER_HP_FACTOR = 0.5;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** HP for a target of the given area (CSS px²). */
export function hpForTarget(area: number, isContainer: boolean): number {
  const base = clamp(Math.round(Math.sqrt(Math.max(0, area)) / HP_DIVISOR), HP_MIN, HP_MAX);
  return isContainer ? Math.max(HP_MIN, Math.round(base * CONTAINER_HP_FACTOR)) : base;
}

export function createGameState(specs: readonly TargetSpec[]): GameState {
  const targets: TargetState[] = specs.map((spec, index) => {
    if (spec.id !== index)
      throw new Error(`Target IDs must be 0..n-1 in order (got ${spec.id} at ${index})`);
    const hp = hpForTarget(spec.area, spec.isContainer);
    return {
      id: spec.id,
      parentId: spec.parentId,
      maxHp: hp,
      hp,
      aliveChildren: 0,
      destroyed: false,
    };
  });
  for (const t of targets) {
    if (t.parentId === null) continue;
    const parent = targets[t.parentId];
    if (!parent || t.parentId >= t.id)
      throw new Error(`Invalid parentId ${t.parentId} for target ${t.id}`);
    parent.aliveChildren++;
  }
  return { targets, destroyedCount: 0 };
}

/** A target can be hit when it is alive and everything inside it has been destroyed. */
export function isHittable(state: GameState, id: TargetId): boolean {
  const t = state.targets[id];
  return !!t && !t.destroyed && t.aliveChildren === 0;
}

export interface DamageResult {
  /** Damage actually applied (capped at remaining HP). */
  applied: number;
  hp: number;
  destroyed: boolean;
}

/** Apply damage to a target. Returns null (and changes nothing) if it can't be hit. */
export function applyDamage(state: GameState, id: TargetId, damage: number): DamageResult | null {
  if (!isHittable(state, id) || !(damage > 0)) return null;
  const t = state.targets[id]!;
  const applied = Math.min(t.hp, damage);
  t.hp -= applied;
  if (t.hp <= 0) {
    t.hp = 0;
    t.destroyed = true;
    state.destroyedCount++;
    if (t.parentId !== null) state.targets[t.parentId]!.aliveChildren--;
  }
  return { applied, hp: t.hp, destroyed: t.destroyed };
}

/** Share of targets destroyed, 0..1. An empty page counts as fully destroyed. */
export function destroyedRatio(state: GameState): number {
  const total = state.targets.length;
  return total === 0 ? 1 : state.destroyedCount / total;
}
