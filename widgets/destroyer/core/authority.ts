// The single gateway for every state change that matters to other players: hits,
// destroys, item drops, pickups and item use. The game *requests* changes; the authority
// decides and broadcasts events. LocalAuthority decides immediately. Phase 2 will add a
// SupabaseAuthority with the same interface, so the rest of the game does not change.
import {
  ITEMS,
  ITEM_LIFETIME,
  MAX_INVENTORY,
  rollDrop,
  type BuffKind,
  type ItemContext,
  type ItemKind,
} from './items';
import {
  applyDamage,
  createGameState,
  endReason,
  expireCombo,
  finishGame,
  isHittable,
  scoreDestroy,
  scoreHit,
  type GameOptions,
} from './rules';
import type {
  DroppedItem,
  GameResult,
  GameState,
  ItemId,
  PlayerId,
  TargetId,
  TargetSpec,
} from './state';

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

export interface PickupRequest {
  itemId: ItemId;
  playerId: PlayerId;
}

export interface UseItemRequest {
  playerId: PlayerId;
  /** Inventory slot (0-based). */
  slot: number;
  /** Targets the player's game found inside the item's targeting shape. */
  targetIds: readonly TargetId[];
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
  | {
      type: 'destroy';
      targetId: TargetId;
      playerId: PlayerId;
      maxHp: number;
      points: number;
      combo: number;
      multiplier: number;
    }
  | { type: 'itemDrop'; item: DroppedItem }
  | { type: 'itemPickup'; itemId: ItemId; kind: ItemKind; playerId: PlayerId }
  | { type: 'itemExpire'; itemId: ItemId }
  | { type: 'itemUse'; kind: ItemKind; playerId: PlayerId }
  | { type: 'buff'; kind: BuffKind; playerId: PlayerId; duration: number }
  | { type: 'end'; result: GameResult };

export type AuthorityListener = (event: AuthorityEvent) => void;

export interface GameAuthority {
  /** Read-only view of the authoritative state. */
  readonly state: Readonly<GameState>;
  /** Begin a round with the scanned targets. */
  start(targets: readonly TargetSpec[], options?: GameOptions): void;
  /** Advance game time (timer, buffs, item expiry, end of round). */
  tick(dt: number): void;
  requestHit(request: HitRequest): void;
  requestPickup(request: PickupRequest): void;
  requestUseItem(request: UseItemRequest): void;
  /** Subscribe to accepted changes. Returns an unsubscribe function. */
  subscribe(listener: AuthorityListener): () => void;
  dispose(): void;
}

export class LocalAuthority implements GameAuthority {
  private current: GameState = createGameState([]);
  private readonly listeners = new Set<AuthorityListener>();

  /** @param rng random source in [0, 1), injectable for tests */
  constructor(private readonly rng: () => number = Math.random) {}

  get state(): Readonly<GameState> {
    return this.current;
  }

  start(targets: readonly TargetSpec[], options?: GameOptions): void {
    this.current = createGameState(targets, options);
  }

  tick(dt: number): void {
    const s = this.current;
    if (s.result || !(dt > 0)) return;
    s.elapsed += dt;

    for (const player of Object.values(s.players)) {
      expireCombo(player, s.elapsed);
      for (const buff of player.buffs) buff.remaining -= dt;
      player.buffs = player.buffs.filter((b) => b.remaining > 0);
    }

    const expired = s.items.filter((item) => item.expiresAt <= s.elapsed);
    if (expired.length > 0) {
      s.items = s.items.filter((item) => item.expiresAt > s.elapsed);
      for (const item of expired) this.emit({ type: 'itemExpire', itemId: item.id });
    }

    this.checkEnd();
  }

  requestHit({ targetId, damage, playerId, at }: HitRequest): void {
    if (!this.current.players[playerId]) return;
    this.damage(targetId, damage, playerId, at);
    this.checkEnd();
  }

  requestPickup({ itemId, playerId }: PickupRequest): void {
    const s = this.current;
    const player = s.players[playerId];
    const index = s.items.findIndex((item) => item.id === itemId);
    if (s.result || !player || index < 0 || player.inventory.length >= MAX_INVENTORY) return;
    const [item] = s.items.splice(index, 1);
    player.inventory.push(item!.kind);
    this.emit({ type: 'itemPickup', itemId, kind: item!.kind, playerId });
  }

  requestUseItem({ playerId, slot, targetIds }: UseItemRequest): void {
    const s = this.current;
    const player = s.players[playerId];
    const kind = player?.inventory[slot];
    if (s.result || !player || !kind) return;
    player.inventory.splice(slot, 1);
    this.emit({ type: 'itemUse', kind, playerId });

    const ctx: ItemContext = {
      playerId,
      targetIds,
      damage: (ids, amount) => {
        // Highest ID first = innermost first (children always come after their parent in
        // DOM order), so a blast can uncover and then damage the container behind.
        for (const id of [...new Set(ids)].sort((a, b) => b - a)) {
          if (isHittable(s, id)) this.damage(id, amount, playerId);
        }
      },
      addBuff: (buffKind, duration) => {
        const existing = player.buffs.find((b) => b.kind === buffKind);
        if (existing) existing.remaining = Math.max(existing.remaining, duration);
        else player.buffs.push({ kind: buffKind, remaining: duration });
        this.emit({ type: 'buff', kind: buffKind, playerId, duration });
      },
    };
    ITEMS[kind].use(ctx);
    this.checkEnd();
  }

  subscribe(listener: AuthorityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private damage(targetId: TargetId, amount: number, playerId: PlayerId, at?: HitPoint): void {
    const s = this.current;
    const result = applyDamage(s, targetId, amount);
    if (!result) return;
    const player = s.players[playerId]!;
    const maxHp = s.targets[targetId]!.maxHp;
    scoreHit(player);
    this.emit({
      type: 'hit',
      targetId,
      playerId,
      damage: result.applied,
      hp: result.hp,
      maxHp,
      at,
    });
    if (!result.destroyed) return;

    const score = scoreDestroy(player, maxHp, s.elapsed);
    this.emit({ type: 'destroy', targetId, playerId, maxHp, ...score });

    const kind = rollDrop(maxHp, this.rng);
    if (kind) {
      const item: DroppedItem = {
        id: s.nextItemId++,
        kind,
        targetId,
        fx: at?.fx ?? 0.5,
        fy: at?.fy ?? 0.5,
        expiresAt: s.elapsed + ITEM_LIFETIME,
      };
      s.items.push(item);
      this.emit({ type: 'itemDrop', item });
    }
  }

  private checkEnd(): void {
    const s = this.current;
    if (s.result) return;
    const reason = endReason(s);
    if (reason) this.emit({ type: 'end', result: finishGame(s, reason) });
  }

  private emit(event: AuthorityEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
