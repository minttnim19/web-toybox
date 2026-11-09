// What the player sees and hears when the authority accepts a change: cracks, sparks,
// shattering, floating scores, item effects and sounds. Presentation only — it never
// changes game state, so in phase 2 it can react to other players' events the same way.
import type { AuthorityEvent } from './core/authority';
import { BOMB_RADIUS, LASER_THICKNESS, type ItemKind } from './core/items';
import type { Ship } from './core/ship';
import type { PlayerId } from './core/state';
import type { ItemField } from './platform/item-field';
import type { PageEffects } from './platform/page-effects';
import type { Sfx } from './platform/sfx';
import type { TargetRects } from './platform/target-rects';
import { shatter } from './platform/shatter';
import type { Particles } from './render/particles';
import type { Renderer } from './render/renderer';
import { PALETTE } from './render/sprites';
import { TEXT } from './ui/strings';

const BIG_TARGET_AREA = 60_000; // px²; destroying something bigger shakes the screen
const BIG_SCORE = 500; // points shown in large text
const SPARK_COLORS = [PALETTE.yellow, PALETTE.white, PALETTE.orange];

export interface FeedbackDeps {
  localPlayer: PlayerId;
  renderer: Renderer;
  particles: Particles;
  effects: PageEffects;
  sfx: Sfx;
  itemField: ItemField;
  targets: TargetRects;
  localShip(): Ship | null;
}

export class Feedback {
  constructor(private readonly d: FeedbackDeps) {}

  handle(event: AuthorityEvent): void {
    const { renderer, particles, effects, sfx, itemField } = this.d;
    switch (event.type) {
      case 'hit': {
        const el = this.d.targets.elementOf(event.targetId);
        if (!el) return;
        const rect = this.d.targets.rectOf(event.targetId);
        if (rect && event.at) {
          renderer.addCrack(event.targetId, event.at.fx, event.at.fy);
          const x = rect.x + event.at.fx * rect.w;
          const y = rect.y + event.at.fy * rect.h;
          particles.sparks(x, y, SPARK_COLORS);
        }
        if (event.hp > 0) {
          effects.damage(el, event.hp / event.maxHp);
          effects.shake(el);
          sfx.play('hit');
        }
        return;
      }

      case 'destroy': {
        const el = this.d.targets.elementOf(event.targetId);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > BIG_TARGET_AREA) effects.screenShake(Math.min(10, Math.sqrt(area) / 70), 0.35);
        shatter(el, particles); // before hiding, while its colors can still be read
        effects.hide(el);
        renderer.clearCracks(event.targetId);
        this.d.targets.forget(event.targetId);
        sfx.play('break');

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const size = event.points >= BIG_SCORE ? 16 : 8;
        renderer.addText(cx, cy, `+${event.points}`, PALETTE.yellow, size);
        if (event.multiplier > 1)
          renderer.addText(cx, cy + 30, `x${event.multiplier}`, PALETTE.pink);
        return;
      }

      case 'itemPickup': {
        const pos = itemField.positionOf(event.itemId);
        itemField.forget(event.itemId);
        if (event.playerId !== this.d.localPlayer) return;
        sfx.play('pickup');
        if (pos) renderer.addText(pos.x, pos.y - 12, TEXT.items[event.kind].label, PALETTE.cyan);
        return;
      }

      case 'itemExpire':
        itemField.forget(event.itemId);
        return;

      case 'itemUse':
        if (event.playerId === this.d.localPlayer) this.showItemUse(event.kind);
        return;

      case 'itemDrop': // drawn from the state by the item field
      case 'buff': // shown by the HUD
      case 'end': // handled by the game flow
        return;
    }
  }

  private showItemUse(kind: ItemKind): void {
    const ship = this.d.localShip();
    if (!ship) return;
    const { renderer, effects, sfx } = this.d;
    switch (kind) {
      case 'bomb':
        renderer.addShockwave(ship.x, ship.y, BOMB_RADIUS);
        effects.screenShake(9, 0.45);
        sfx.play('explode');
        return;
      case 'laser':
        renderer.addLaser(ship.x, ship.y, LASER_THICKNESS);
        effects.screenShake(4, 0.25);
        sfx.play('laser');
        return;
      default:
        renderer.addText(ship.x, ship.y - 24, TEXT.items[kind].label, PALETTE.cyan);
        sfx.play('powerup');
    }
  }
}
