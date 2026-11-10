// Items lying on the page, as this player sees them: where each box is on screen
// (anchored to the target it dropped from), the magnet pull, and pickups when the ship
// flies over one. Pickups are only *requested*; the authority decides.
import type { StylableElement } from '../../../shared/dom';
import type { GameAuthority } from '../core/authority';
import { ITEM_BLINK_TIME, MAGNET_RADIUS, MAX_INVENTORY } from '../core/items';
import type { ItemId, PlayerId, TargetId } from '../core/state';
import type { Point } from '../core/targeting';
import type { ItemView } from '../render/renderer';

const PICKUP_RADIUS = 26; // px between ship and item box
const MAGNET_SPEED = 520; // px/s items fly toward the ship
const FULL_NOTICE_INTERVAL = 1; // s between "FULL" notices for the same item

export class ItemField {
  /** Magnet pull so far, as an offset from each item's anchor. */
  private readonly pulled = new Map<ItemId, Point>();
  private readonly fullNoticeAt = new Map<ItemId, number>();
  /** Screen positions measured this frame. */
  private positions = new Map<ItemId, Point>();

  constructor(
    private readonly authority: GameAuthority,
    private readonly playerId: PlayerId,
    private readonly elementOf: (id: TargetId) => StylableElement | undefined,
    /** The ship touched an item while the inventory is full. */
    private readonly onFull: (at: Point) => void,
  ) {}

  /** Measure where every item is on screen. Call once per frame, before update/views. */
  measure(): void {
    this.positions = new Map();
    for (const item of this.authority.state.items) {
      const el = this.elementOf(item.targetId);
      if (!el) continue;
      // Destroyed elements are only hidden and keep their layout box, so the anchor stays put.
      const r = el.getBoundingClientRect();
      const pull = this.pulled.get(item.id);
      this.positions.set(item.id, {
        x: r.left + item.fx * r.width + (pull?.x ?? 0),
        y: r.top + item.fy * r.height + (pull?.y ?? 0),
      });
    }
  }

  positionOf(id: ItemId): Point | null {
    return this.positions.get(id) ?? null;
  }

  /** Apply the magnet pull and pick up items the ship (at `ship`) is touching. */
  update(dt: number, ship: Point, magnet: boolean, time: number): void {
    const state = this.authority.state;
    const player = state.players[this.playerId];
    if (!player) return;
    // Copy: a pickup removes the item from the list while we iterate.
    for (const item of [...state.items]) {
      const pos = this.positions.get(item.id);
      if (!pos) continue;
      let dist = Math.hypot(ship.x - pos.x, ship.y - pos.y);

      if (magnet && dist < MAGNET_RADIUS && dist > 1) {
        const step = Math.min(dist, MAGNET_SPEED * dt);
        const mx = ((ship.x - pos.x) / dist) * step;
        const my = ((ship.y - pos.y) / dist) * step;
        const pull = this.pulled.get(item.id) ?? { x: 0, y: 0 };
        this.pulled.set(item.id, { x: pull.x + mx, y: pull.y + my });
        pos.x += mx;
        pos.y += my;
        dist -= step;
      }

      if (dist > PICKUP_RADIUS) continue;
      if (player.inventory.length < MAX_INVENTORY) {
        this.authority.requestPickup({ itemId: item.id, playerId: this.playerId });
      } else if (time - (this.fullNoticeAt.get(item.id) ?? -Infinity) > FULL_NOTICE_INTERVAL) {
        this.fullNoticeAt.set(item.id, time);
        this.onFull(pos);
      }
    }
  }

  /** What the renderer should draw this frame. */
  views(): ItemView[] {
    const state = this.authority.state;
    const views: ItemView[] = [];
    for (const item of state.items) {
      const pos = this.positions.get(item.id);
      if (!pos) continue;
      views.push({
        id: item.id,
        kind: item.kind,
        x: pos.x,
        y: pos.y,
        blinking: item.expiresAt - state.elapsed < ITEM_BLINK_TIME,
      });
    }
    return views;
  }

  /** Drop local state for an item that was picked up or expired. */
  forget(id: ItemId): void {
    this.pulled.delete(id);
    this.fullNoticeAt.delete(id);
    this.positions.delete(id);
  }

  clear(): void {
    this.pulled.clear();
    this.fullNoticeAt.clear();
    this.positions.clear();
  }
}
