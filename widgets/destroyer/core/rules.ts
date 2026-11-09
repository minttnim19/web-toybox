// Game rules: HP, damage, scoring, combo, time and end conditions. Pure functions over GameState.
import type {
  EndReason,
  GameResult,
  GameState,
  PlayerId,
  PlayerState,
  TargetId,
  TargetSpec,
  TargetState,
} from './state';
import { LOCAL_PLAYER } from './state';

export const HP_DIVISOR = 22;
export const HP_MIN = 1;
export const HP_MAX = 30;
/** Containers are mostly "frame", so they take fewer hits once uncovered. */
export const CONTAINER_HP_FACTOR = 0.5;

export const DEFAULT_DURATION = 5 * 60; // s
export const DURATION_CHOICES = [2 * 60, 5 * 60, 10 * 60] as const;
export const HIT_POINTS = 1;
export const DESTROY_POINTS_PER_HP = 10;
export const COMBO_WINDOW = 1.4; // s between destroys to keep a combo going
export const COMBO_STEP = 3; // multiplier goes up every this many combo
export const MAX_MULTIPLIER = 5;
export const TIME_BONUS_PER_SECOND = 50;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** HP for a target of the given area (CSS px²). */
export function hpForTarget(area: number, isContainer: boolean): number {
  const base = clamp(Math.round(Math.sqrt(Math.max(0, area)) / HP_DIVISOR), HP_MIN, HP_MAX);
  return isContainer ? Math.max(HP_MIN, Math.round(base * CONTAINER_HP_FACTOR)) : base;
}

export function createPlayer(id: PlayerId): PlayerState {
  return {
    id,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastDestroyAt: null,
    inventory: [],
    buffs: [],
  };
}

export interface GameOptions {
  /** Round length in seconds. */
  duration?: number;
  players?: readonly PlayerId[];
}

export function createGameState(
  specs: readonly TargetSpec[],
  options: GameOptions = {},
): GameState {
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
  const players: Record<PlayerId, PlayerState> = {};
  for (const id of options.players ?? [LOCAL_PLAYER]) players[id] = createPlayer(id);
  return {
    targets,
    destroyedCount: 0,
    duration: options.duration ?? DEFAULT_DURATION,
    elapsed: 0,
    players,
    items: [],
    nextItemId: 0,
    result: null,
  };
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
  if (state.result || !isHittable(state, id) || !(damage > 0)) return null;
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

export function timeLeft(state: GameState): number {
  return Math.max(0, state.duration - state.elapsed);
}

/** Score multiplier for a combo count: x1, then +1 every COMBO_STEP, up to MAX_MULTIPLIER. */
export function comboMultiplier(combo: number): number {
  return clamp(1 + Math.floor(combo / COMBO_STEP), 1, MAX_MULTIPLIER);
}

/** +1 point for landing a hit. */
export function scoreHit(player: PlayerState): number {
  player.score += HIT_POINTS;
  return HIT_POINTS;
}

export interface DestroyScore {
  points: number;
  combo: number;
  multiplier: number;
}

/** Score a destroy: max HP × 10, times the combo multiplier. Updates the combo chain. */
export function scoreDestroy(player: PlayerState, maxHp: number, now: number): DestroyScore {
  const chained = player.lastDestroyAt !== null && now - player.lastDestroyAt <= COMBO_WINDOW;
  player.combo = chained ? player.combo + 1 : 1;
  player.maxCombo = Math.max(player.maxCombo, player.combo);
  player.lastDestroyAt = now;
  const multiplier = comboMultiplier(player.combo);
  const points = maxHp * DESTROY_POINTS_PER_HP * multiplier;
  player.score += points;
  return { points, combo: player.combo, multiplier };
}

/** Drop a combo whose window has passed (for display; scoring checks the window itself). */
export function expireCombo(player: PlayerState, now: number): void {
  if (
    player.combo > 0 &&
    player.lastDestroyAt !== null &&
    now - player.lastDestroyAt > COMBO_WINDOW
  )
    player.combo = 0;
}

/** The round is over when everything is destroyed or time has run out. */
export function endReason(state: GameState): EndReason | null {
  if (state.destroyedCount >= state.targets.length) return 'clear';
  if (timeLeft(state) <= 0) return 'timeup';
  return null;
}

/** Bonus for clearing early: 50 points per whole second left (none if there was nothing to destroy). */
export function timeBonus(state: GameState, reason: EndReason): number {
  if (reason !== 'clear' || state.targets.length === 0) return 0;
  return Math.floor(timeLeft(state)) * TIME_BONUS_PER_SECOND;
}

/** Finish the round. The time bonus goes to every player who scored (in single player: the player). */
export function finishGame(state: GameState, reason: EndReason): GameResult {
  const bonus = timeBonus(state, reason);
  for (const player of Object.values(state.players)) player.score += bonus;
  state.result = { reason, timeBonus: bonus, timeUsed: Math.min(state.elapsed, state.duration) };
  return state.result;
}
