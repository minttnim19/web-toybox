// The single gateway for every state change that matters to other players.
// The game *requests* changes; the authority decides and broadcasts events.
// LocalAuthority decides immediately. Phase 2 will add a SupabaseAuthority with
// the same interface, so the rest of the game does not change.
import { applyDamage, createGameState } from './rules';
import type { GameState, PlayerId, TargetId, TargetSpec } from './state';

/** Hit position as a fraction of the target's size (0..1), so it is screen-independent. */
export interface HitPoint {
  fx: number;
  fy: number;
}

export interface HitRequest {
  targetId: TargetId;
  damage: number;
  playerId: PlayerId;
  at?: HitPoint;
}

export type AuthorityEvent =
  | {
      type: 'hit';
      targetId: TargetId;
      playerId: PlayerId;
      damage: number;
      hp: number;
      maxHp: number;
      at?: HitPoint;
    }
  | { type: 'destroy'; targetId: TargetId; playerId: PlayerId; maxHp: number };

export type AuthorityListener = (event: AuthorityEvent) => void;

export interface GameAuthority {
  /** Read-only view of the authoritative state. */
  readonly state: Readonly<GameState>;
  /** Begin a round with the scanned targets. */
  start(targets: readonly TargetSpec[]): void;
  requestHit(request: HitRequest): void;
  /** Subscribe to accepted changes. Returns an unsubscribe function. */
  subscribe(listener: AuthorityListener): () => void;
  dispose(): void;
}

export class LocalAuthority implements GameAuthority {
  private current: GameState = createGameState([]);
  private readonly listeners = new Set<AuthorityListener>();

  get state(): Readonly<GameState> {
    return this.current;
  }

  start(targets: readonly TargetSpec[]): void {
    this.current = createGameState(targets);
  }

  requestHit({ targetId, damage, playerId, at }: HitRequest): void {
    const result = applyDamage(this.current, targetId, damage);
    if (!result) return;
    const maxHp = this.current.targets[targetId]!.maxHp;
    this.emit({
      type: 'hit',
      targetId,
      playerId,
      damage: result.applied,
      hp: result.hp,
      maxHp,
      at,
    });
    if (result.destroyed) this.emit({ type: 'destroy', targetId, playerId, maxHp });
  }

  subscribe(listener: AuthorityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(event: AuthorityEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
