// Game state and types. Pure data: no DOM, canvas or window access.
import type { BuffKind, ItemKind } from './items';

/** Targets are always referred to by ID (their index in DOM order), never by screen position. */
export type TargetId = number;
export type PlayerId = string;
export type ItemId = number;

/** Local player's ID. Phase 2 will use real per-player IDs. */
export const LOCAL_PLAYER: PlayerId = 'local';

/**
 * What the core needs to know about a target, as produced by the page scanner.
 * IDs must be 0..n-1 in DOM order so every machine viewing the same page agrees on them.
 */
export interface TargetSpec {
  id: TargetId;
  /** Nearest ancestor that is also a target, or null. */
  parentId: TargetId | null;
  /** Area in CSS px² at scan time; drives HP. */
  area: number;
  /** True when other targets are nested inside this one. */
  isContainer: boolean;
}

export interface TargetState {
  id: TargetId;
  parentId: TargetId | null;
  maxHp: number;
  hp: number;
  /** Number of direct child targets not yet destroyed. A target is only hittable at 0. */
  aliveChildren: number;
  destroyed: boolean;
}

export interface Buff {
  kind: BuffKind;
  /** Seconds left. */
  remaining: number;
}

export interface PlayerState {
  id: PlayerId;
  score: number;
  /** Destroys chained within the combo window; 0 when the chain has lapsed. */
  combo: number;
  maxCombo: number;
  /** Game time (s) of this player's last destroy. */
  lastDestroyAt: number | null;
  /** Held items, slot order. */
  inventory: ItemKind[];
  buffs: Buff[];
}

/** An item lying on the page, anchored to the target it dropped from (not to screen coordinates). */
export interface DroppedItem {
  id: ItemId;
  kind: ItemKind;
  targetId: TargetId;
  /** Position inside the target's box, as fractions of its size. */
  fx: number;
  fy: number;
  /** Game time (s) when it disappears. */
  expiresAt: number;
}

export type EndReason = 'clear' | 'timeup';

export interface GameResult {
  reason: EndReason;
  /** Bonus points for seconds left on a clear. */
  timeBonus: number;
  /** Seconds played. */
  timeUsed: number;
}

export interface GameState {
  /** Indexed by TargetId. */
  targets: TargetState[];
  destroyedCount: number;
  /** Round length in seconds. */
  duration: number;
  /** Seconds since the round started. */
  elapsed: number;
  players: Record<PlayerId, PlayerState>;
  items: DroppedItem[];
  nextItemId: ItemId;
  /** Set once the round is over; no more changes are accepted after that. */
  result: GameResult | null;
}
