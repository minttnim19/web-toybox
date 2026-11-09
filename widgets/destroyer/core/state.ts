// Game state and types. Pure data: no DOM, canvas or window access.

/** Targets are always referred to by ID (their index in DOM order), never by screen position. */
export type TargetId = number;
export type PlayerId = string;

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

export interface GameState {
  /** Indexed by TargetId. */
  targets: TargetState[];
  destroyedCount: number;
}
