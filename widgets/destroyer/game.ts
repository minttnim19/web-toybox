// Game session controller: owns the frame loop and connects core logic, the authority,
// page effects, input, rendering, sound and UI. Every change that matters to other
// players goes through `authority`; visuals and sounds react to the events it broadcasts.
//
// Flow: launcher → menu → countdown → playing → result → (replay | back to page).
import type { StylableElement } from '../../shared/dom';
import { ensureFonts } from '../../shared/fonts';
import { createShadowHost } from '../../shared/shadow-host';
import { LocalAuthority, type AuthorityEvent, type GameAuthority } from './core/authority';
import {
  BOMB_RADIUS,
  ITEMS,
  ITEM_BLINK_TIME,
  LASER_THICKNESS,
  MAGNET_RADIUS,
  MAX_INVENTORY,
  RAPID_FIRE_RATE,
  type ItemKind,
} from './core/items';
import { comboMultiplier, destroyedRatio, isHittable, timeLeft } from './core/rules';
import {
  FIRE_RANGE,
  createShip,
  desiredHeading,
  isAimedAt,
  readyToFire,
  resetFireTimer,
  spawnBullet,
  steerShip,
  stepBullet,
  turnShip,
  type Bullet,
  type Ship,
} from './core/ship';
import {
  LOCAL_PLAYER,
  type GameResult,
  type ItemId,
  type PlayerState,
  type TargetId,
  type TargetSpec,
} from './core/state';
import { distanceToRect, pickNearest, type Candidate, type Rect } from './core/targeting';
import type { DestroyerOptions } from './options';
import { makeColorSampler } from './platform/colors';
import { InputController } from './platform/input';
import { PageEffects } from './platform/page-effects';
import { resolveScope, scanTargets } from './platform/scanner';
import { Sfx } from './platform/sfx';
import { getMuted, recordScore, setMuted } from './platform/storage';
import { Particles } from './render/particles';
import { Renderer, SCALE, type ItemView } from './render/renderer';
import { PALETTE } from './render/sprites';
import { Countdown } from './ui/countdown';
import { Hud } from './ui/hud';
import { Launcher } from './ui/launcher';
import { Menu } from './ui/menu';
import { ResultScreen } from './ui/result';
import { WIDGET_CSS } from './ui/styles';

type Phase = 'idle' | 'menu' | 'countdown' | 'playing' | 'ended';

const BULLET_DAMAGE = 1;
const EDGE_ZONE = 80; // px from the top/bottom edge where scrolling starts
const EDGE_MAX_SPEED = 900; // px/s at the very edge
const BIG_TARGET_AREA = 60_000; // px²; destroying something bigger shakes the screen
const MAX_SHATTER_BLOCKS = 320;
const SPARK_COLORS = [PALETTE.yellow, PALETTE.white, PALETTE.orange];
const COUNTDOWN_STEPS = ['3', '2', '1', 'GO!'];
const COUNTDOWN_STEP_TIME = 0.8; // s per step
const PICKUP_RADIUS = 26; // px between ship and item box
const MAGNET_SPEED = 520; // px/s items fly toward the ship
const RESULT_DELAY = 0.9; // s between the end of the round and the result screen
const ITEM_LABEL: Record<ItemKind, string> = {
  bomb: 'BOMB',
  rapid: 'RAPID!',
  laser: 'LASER',
  magnet: 'MAGNET!',
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Local, presentation-only state of an item lying on the page. */
interface ItemPresence {
  /** Offset from its anchor point, from being pulled by a magnet. */
  dx: number;
  dy: number;
  /** Time (s) "FULL" was last shown for it. */
  fullShownAt: number;
}

export class DestroyerGame {
  private readonly host: HTMLElement;
  private readonly authority: GameAuthority = new LocalAuthority();
  private readonly effects: PageEffects;
  private readonly input: InputController;
  private readonly renderer: Renderer;
  private readonly particles = new Particles();
  private readonly sfx = new Sfx();
  private readonly launcher: Launcher;
  private readonly menu: Menu;
  private readonly countdown: Countdown;
  private readonly hud: Hud;
  private readonly result: ResultScreen;

  private phase: Phase = 'idle';
  private duration = 0;
  private elements: StylableElement[] = [];
  private ship: Ship | null = null;
  private bullets: Bullet[] = [];
  private readonly items = new Map<ItemId, ItemPresence>();
  private unsubscribe: (() => void) | null = null;
  private rafId = 0;
  private lastFrame = 0;
  /** Seconds since the round (countdown included) began; drives animations. */
  private time = 0;
  /** Seconds into the countdown, or since the round ended. */
  private phaseTime = 0;
  private lastScrollX = 0;
  private lastScrollY = 0;
  private scrollRemainder = 0;
  private pendingResult: GameResult | null = null;
  private countdownStep = 0;
  /** Per-frame cache of target rects (getBoundingClientRect at most once per frame). */
  private readonly rectCache = new Map<TargetId, Rect | null>();

  constructor(private readonly options: DestroyerOptions) {
    const { host, root } = createShadowHost('destroyer', WIDGET_CSS);
    this.host = host;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.effects = new PageEffects(reducedMotion);
    this.sfx.setMuted(getMuted());

    this.renderer = new Renderer(root);
    this.renderer.setVisible(false);
    this.hud = new Hud(root, {
      onQuit: () => this.exitToPage(),
      onToggleMute: () => this.toggleMute(),
      onSlot: (i) => this.useSlot(i),
    });
    this.countdown = new Countdown(root);
    this.menu = new Menu(root, {
      onStart: (duration) => {
        this.sfx.unlock(); // first user gesture: audio may start now
        this.beginRound(duration);
      },
      onClose: () => this.closeMenu(),
    });
    this.result = new ResultScreen(root, {
      onReplay: () => this.replay(),
      onExit: () => this.exitToPage(),
    });
    this.launcher = new Launcher(root, options.position, () => this.openMenu());
    this.input = new InputController(host, {
      onSlot: (i) => this.useSlot(i),
      onQuit: () => this.exitToPage(),
    });

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.phase === 'menu') this.closeMenu();
    });
  }

  // ---- Flow -------------------------------------------------------------------------

  private openMenu(): void {
    if (this.phase !== 'idle') return;
    // Fonts come from Google Fonts, so only fetch them once someone actually wants to play.
    ensureFonts();
    this.phase = 'menu';
    this.launcher.setVisible(false);
    this.menu.show(this.duration || undefined);
  }

  private closeMenu(): void {
    if (this.phase !== 'menu') return;
    this.phase = 'idle';
    this.menu.hide();
    this.launcher.setVisible(true);
  }

  /** Scan the page, take over input, and start the 3-2-1 countdown. */
  private beginRound(duration: number): void {
    this.menu.hide();
    this.result.hide();
    this.duration = duration;

    const scanned = scanTargets(resolveScope(this.options.scope), this.host);
    this.elements = scanned.map((t) => t.el);
    this.effects.snapshot(this.elements);
    const specs: TargetSpec[] = scanned.map(({ id, parentId, area, isContainer }) => ({
      id,
      parentId,
      area,
      isContainer,
    }));
    this.authority.start(specs, { duration, players: [LOCAL_PLAYER] });
    this.unsubscribe = this.authority.subscribe((e) => this.onAuthorityEvent(e));

    const x = window.innerWidth / 2;
    const y = window.innerHeight * 0.6;
    this.ship = createShip(x, y);
    this.input.x = x;
    this.input.y = y;
    this.input.attach();
    this.effects.setPlaying(true);

    this.launcher.setVisible(false);
    this.hud.setVisible(true);
    this.renderer.setVisible(true);

    this.lastScrollX = window.scrollX;
    this.lastScrollY = window.scrollY;
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.time = 0;
    this.pendingResult = null;
    this.countdownStep = 0;
    this.countdown.set(COUNTDOWN_STEPS[0]!);
    this.sfx.play('countdown');
    this.lastFrame = performance.now();
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Restore the page and play again with the same round length. */
  private replay(): void {
    const duration = this.duration;
    this.teardownRound();
    this.beginRound(duration);
  }

  /** Quit (or leave the result screen): restore the page exactly as it was. */
  private exitToPage(): void {
    if (this.phase === 'idle' || this.phase === 'menu') return;
    this.teardownRound();
    this.hud.setVisible(false);
    this.result.hide();
    this.launcher.setVisible(true);
    this.phase = 'idle';
  }

  private teardownRound(): void {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.effects.restoreAll();
    this.particles.clear();
    this.bullets = [];
    this.items.clear();
    this.ship = null;
    this.elements = [];
    this.rectCache.clear();
    this.countdown.set(null);
    this.renderer.reset();
    this.renderer.setOffset(0, 0);
    this.renderer.setVisible(false);
  }

  private finishRound(result: GameResult): void {
    this.phase = 'ended';
    this.phaseTime = 0;
    this.pendingResult = result;
    this.bullets = [];
    this.countdown.set(null);
    this.sfx.play(result.reason === 'clear' ? 'clear' : 'gameover');
  }

  private showResult(result: GameResult): void {
    const player = this.player();
    const { best, isNew } = recordScore(this.duration, player.score);
    this.ship = null;
    this.hud.setVisible(false); // the result screen shows the final numbers
    this.result.show({
      reason: result.reason,
      score: player.score,
      destroyed: destroyedRatio(this.authority.state),
      timeUsed: result.timeUsed,
      maxCombo: player.maxCombo,
      timeBonus: result.timeBonus,
      best,
      isNewBest: isNew,
    });
  }

  private toggleMute(): void {
    const muted = !this.sfx.muted;
    this.sfx.setMuted(muted);
    setMuted(muted);
    if (!muted) this.sfx.unlock();
  }

  // ---- Frame loop -------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    if (this.phase === 'idle' || this.phase === 'menu') return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.phaseTime += dt;
    this.rectCache.clear();

    // Keep debris and floating text attached to the page while it scrolls.
    const sx = window.scrollX;
    const sy = window.scrollY;
    if (sx !== this.lastScrollX || sy !== this.lastScrollY) {
      this.particles.shift(this.lastScrollX - sx, this.lastScrollY - sy);
      this.renderer.shift(this.lastScrollX - sx, this.lastScrollY - sy);
      this.lastScrollX = sx;
      this.lastScrollY = sy;
    }

    if (this.phase === 'countdown') this.updateCountdown();
    else if (this.phase === 'playing' && this.phaseTime > COUNTDOWN_STEP_TIME * 0.75)
      this.countdown.set(null); // let "GO!" linger briefly

    const ship = this.ship;
    if (ship && this.phase !== 'ended') {
      ship.targetX = this.input.x;
      ship.targetY = this.input.y;
      steerShip(ship, dt);
      this.edgeScroll(dt);
    }

    if (this.phase === 'playing' && ship) {
      this.authority.tick(dt);
      // tick() may have ended the round
      if (this.phase === 'playing') {
        const candidates = this.visibleCandidates();
        ship.fireRate = this.hasBuff('rapid') ? RAPID_FIRE_RATE : 1;
        this.aimAndFire(dt, candidates);
        this.updateBullets(dt, candidates);
        this.updateItems(dt);
      }
    } else if (ship && this.phase === 'countdown') {
      turnShip(ship, desiredHeading(ship, null), dt);
    }

    if (this.phase === 'ended' && this.pendingResult && this.phaseTime >= RESULT_DELAY) {
      const result = this.pendingResult;
      this.pendingResult = null;
      this.showResult(result);
    }

    this.particles.update(dt);
    this.effects.tick(dt);
    this.updateHud();

    this.renderer.setOffset(this.effects.shakeOffset.x, this.effects.shakeOffset.y);
    this.renderer.draw({
      time: this.time,
      dt,
      items: this.itemViews(),
      ship: this.phase === 'ended' ? null : this.ship,
      bullets: this.bullets,
      particles: this.particles,
      rectOf: (id) => this.rectOf(id),
      range: FIRE_RANGE,
    });
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Advance 3-2-1-GO; the round starts on GO. */
  private updateCountdown(): void {
    const step = Math.min(
      Math.floor(this.phaseTime / COUNTDOWN_STEP_TIME),
      COUNTDOWN_STEPS.length - 1,
    );
    if (step === this.countdownStep) return;
    this.countdownStep = step;
    const label = COUNTDOWN_STEPS[step]!;
    this.countdown.set(label);
    this.sfx.play(label === 'GO!' ? 'go' : 'countdown');
    if (label === 'GO!') {
      this.phase = 'playing';
      this.phaseTime = 0;
    }
  }

  private updateHud(): void {
    const state = this.authority.state;
    const player = this.player();
    this.hud.update({
      destroyed: destroyedRatio(state),
      timeLeft: timeLeft(state),
      score: player.score,
      combo: player.combo,
      multiplier: comboMultiplier(player.combo),
      muted: this.sfx.muted,
      inventory: player.inventory,
      buffs: player.buffs,
    });
  }

  /** Near the top/bottom edge the page scrolls; the closer to the edge, the faster. */
  private edgeScroll(dt: number): void {
    if (!this.ship || !this.input.pointerActive) return;
    const y = this.ship.y;
    const h = window.innerHeight;
    let speed = 0;
    if (y < EDGE_ZONE) speed = -(((EDGE_ZONE - y) / EDGE_ZONE) ** 2);
    else if (y > h - EDGE_ZONE) speed = ((y - (h - EDGE_ZONE)) / EDGE_ZONE) ** 2;
    if (speed === 0) {
      this.scrollRemainder = 0;
      return;
    }
    this.scrollRemainder += Math.max(-1, Math.min(1, speed)) * EDGE_MAX_SPEED * dt;
    const step = Math.trunc(this.scrollRemainder);
    if (step !== 0) {
      this.scrollRemainder -= step;
      // 'instant' overrides a page's `scroll-behavior: smooth`; TS's DOM types lack it.
      window.scrollBy({ top: step, behavior: 'instant' as ScrollBehavior });
    }
  }

  // ---- Shooting ---------------------------------------------------------------------

  /** Hittable targets currently on screen. */
  private visibleCandidates(): Candidate[] {
    const state = this.authority.state;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const out: Candidate[] = [];
    for (const t of state.targets) {
      if (!isHittable(state, t.id)) continue;
      const rect = this.rectOf(t.id);
      if (!rect || rect.x > w || rect.y > h || rect.x + rect.w < 0 || rect.y + rect.h < 0) continue;
      out.push({ id: t.id, rect });
    }
    return out;
  }

  /** Turn toward the nearest target (or the travel direction) and fire once lined up. */
  private aimAndFire(dt: number, candidates: readonly Candidate[]): void {
    const ship = this.ship!;
    const target = pickNearest(ship.x, ship.y, candidates, FIRE_RANGE);
    turnShip(ship, desiredHeading(ship, target?.rect ?? null), dt);
    if (!readyToFire(ship, dt) || !target || !isAimedAt(ship, target.rect)) return;
    this.bullets.push(spawnBullet(ship));
    resetFireTimer(ship);
    this.sfx.play('shoot');
  }

  private updateBullets(dt: number, candidates: Candidate[]): void {
    const state = this.authority.state;
    this.bullets = this.bullets.filter((b) => {
      const step = stepBullet(b, dt, candidates);
      if (step.kind === 'hit') {
        this.authority.requestHit({
          targetId: step.targetId,
          damage: BULLET_DAMAGE,
          playerId: LOCAL_PLAYER,
          at: { fx: step.fx, fy: step.fy },
        });
        // A destroyed target changes what later bullets in this frame can hit.
        if (!isHittable(state, step.targetId)) {
          const index = candidates.findIndex((c) => c.id === step.targetId);
          if (index >= 0) candidates.splice(index, 1);
        }
        return false;
      }
      return step.kind === 'flying';
    });
  }

  // ---- Items ------------------------------------------------------------------------

  /** Where an item is on screen: its anchor inside the (possibly hidden) target, plus magnet pull. */
  private itemPosition(itemId: ItemId): { x: number; y: number } | null {
    const item = this.authority.state.items.find((i) => i.id === itemId);
    const el = item && this.elements[item.targetId];
    if (!item || !el) return null;
    // Hidden elements keep their layout box, so the anchor stays put.
    const r = el.getBoundingClientRect();
    const presence = this.items.get(itemId) ?? { dx: 0, dy: 0, fullShownAt: -Infinity };
    return {
      x: r.left + item.fx * r.width + presence.dx,
      y: r.top + item.fy * r.height + presence.dy,
    };
  }

  private updateItems(dt: number): void {
    const ship = this.ship!;
    const player = this.player();
    const magnet = this.hasBuff('magnet');
    // Copy: a pickup removes the item from the list while we iterate.
    for (const item of [...this.authority.state.items]) {
      const presence = this.items.get(item.id);
      const pos = this.itemPosition(item.id);
      if (!presence || !pos) continue;
      let dx = ship.x - pos.x;
      let dy = ship.y - pos.y;
      let dist = Math.hypot(dx, dy);

      if (magnet && dist < MAGNET_RADIUS && dist > 1) {
        const step = Math.min(dist, MAGNET_SPEED * dt);
        presence.dx += (dx / dist) * step;
        presence.dy += (dy / dist) * step;
        dx -= (dx / dist) * step;
        dy -= (dy / dist) * step;
        dist = Math.hypot(dx, dy);
      }

      if (dist > PICKUP_RADIUS) continue;
      if (player.inventory.length >= MAX_INVENTORY) {
        if (this.time - presence.fullShownAt > 1) {
          presence.fullShownAt = this.time;
          this.renderer.addText(pos.x, pos.y - 16, 'FULL', PALETTE.pink, 8);
          this.sfx.play('full');
        }
      } else {
        this.authority.requestPickup({ itemId: item.id, playerId: LOCAL_PLAYER });
      }
    }
  }

  private itemViews(): ItemView[] {
    const state = this.authority.state;
    const views: ItemView[] = [];
    for (const item of state.items) {
      const pos = this.itemPosition(item.id);
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

  /** Use the item in a slot: collect the targets its shape covers, then ask the authority. */
  private useSlot(slot: number): void {
    if (this.phase !== 'playing' || !this.ship) return;
    const kind = this.player().inventory[slot];
    if (!kind) return;
    const ship = this.ship;
    const targeting = ITEMS[kind].targeting;
    const targetIds: TargetId[] = [];
    if (targeting.shape !== 'none') {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const half = targeting.shape === 'cross' ? targeting.thickness / 2 : 0;
      for (const t of this.authority.state.targets) {
        if (t.destroyed) continue;
        const r = this.rectOf(t.id);
        if (!r) continue;
        const hit =
          targeting.shape === 'circle'
            ? distanceToRect(ship.x, ship.y, r) <= targeting.radius
            : // horizontal beam across the screen, or vertical beam down it
              (r.y <= ship.y + half && r.y + r.h >= ship.y - half && r.x <= w && r.x + r.w >= 0) ||
              (r.x <= ship.x + half && r.x + r.w >= ship.x - half && r.y <= h && r.y + r.h >= 0);
        if (hit) targetIds.push(t.id);
      }
    }
    this.authority.requestUseItem({ playerId: LOCAL_PLAYER, slot, targetIds });
  }

  // ---- Reacting to the authority ----------------------------------------------------

  private onAuthorityEvent(event: AuthorityEvent): void {
    switch (event.type) {
      case 'hit': {
        const el = this.elements[event.targetId];
        if (!el) break;
        const rect = this.rectOf(event.targetId);
        if (rect && event.at) {
          this.renderer.addCrack(event.targetId, event.at.fx, event.at.fy);
          this.particles.sparks(
            rect.x + event.at.fx * rect.w,
            rect.y + event.at.fy * rect.h,
            SPARK_COLORS,
          );
        }
        if (event.hp > 0) {
          this.effects.damage(el, event.hp / event.maxHp);
          this.effects.shake(el);
          this.sfx.play('hit');
        }
        break;
      }
      case 'destroy': {
        const el = this.elements[event.targetId];
        if (!el) break;
        const r = el.getBoundingClientRect();
        this.shatter(el);
        this.effects.hide(el);
        this.renderer.clearCracks(event.targetId);
        this.rectCache.set(event.targetId, null);
        this.sfx.play('break');
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        this.renderer.addText(
          cx,
          cy,
          `+${event.points}`,
          PALETTE.yellow,
          event.points >= 500 ? 16 : 8,
        );
        if (event.multiplier > 1)
          this.renderer.addText(cx, cy + 30, `x${event.multiplier}`, PALETTE.pink, 8);
        break;
      }
      case 'itemDrop':
        this.items.set(event.item.id, { dx: 0, dy: 0, fullShownAt: -Infinity });
        break;
      case 'itemPickup': {
        const pos = this.itemPosition(event.itemId);
        this.items.delete(event.itemId);
        if (event.playerId !== LOCAL_PLAYER) break;
        this.sfx.play('pickup');
        if (pos) this.renderer.addText(pos.x, pos.y - 12, ITEM_LABEL[event.kind], PALETTE.cyan, 8);
        break;
      }
      case 'itemExpire':
        this.items.delete(event.itemId);
        break;
      case 'itemUse':
        if (event.playerId === LOCAL_PLAYER) this.showItemUse(event.kind);
        break;
      case 'buff':
        break;
      case 'end':
        this.finishRound(event.result);
        break;
    }
  }

  private showItemUse(kind: ItemKind): void {
    const ship = this.ship;
    if (!ship) return;
    switch (kind) {
      case 'bomb':
        this.renderer.addShockwave(ship.x, ship.y, BOMB_RADIUS);
        this.effects.screenShake(9, 0.45);
        this.sfx.play('explode');
        break;
      case 'laser':
        this.renderer.addLaser(ship.x, ship.y, LASER_THICKNESS);
        this.effects.screenShake(4, 0.25);
        this.sfx.play('laser');
        break;
      default:
        this.renderer.addText(ship.x, ship.y - 24, ITEM_LABEL[kind], PALETTE.cyan, 8);
        this.sfx.play('powerup');
    }
  }

  // ---- Helpers ----------------------------------------------------------------------

  private player(): PlayerState {
    return this.authority.state.players[LOCAL_PLAYER]!;
  }

  private hasBuff(kind: 'rapid' | 'magnet'): boolean {
    return this.player().buffs.some((b) => b.kind === kind);
  }

  /** Break the element into pixel blocks using its real colors. */
  private shatter(el: StylableElement): void {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > BIG_TARGET_AREA) this.effects.screenShake(Math.min(10, Math.sqrt(area) / 70), 0.35);

    // Only the on-screen part produces debris.
    const x0 = Math.max(r.left, -20);
    const y0 = Math.max(r.top, -20);
    const x1 = Math.min(r.right, window.innerWidth + 20);
    const y1 = Math.min(r.bottom, window.innerHeight + 20);
    if (x1 <= x0 || y1 <= y0) return;

    const visibleArea = (x1 - x0) * (y1 - y0);
    const block = Math.min(
      4 * SCALE,
      SCALE * Math.max(1, Math.ceil(Math.sqrt(visibleArea / MAX_SHATTER_BLOCKS) / SCALE)),
    );
    const cols = Math.ceil((x1 - x0) / block);
    const rows = Math.ceil((y1 - y0) / block);
    const keep = Math.min(1, MAX_SHATTER_BLOCKS / (cols * rows));
    const sample = makeColorSampler(el);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const halfW = Math.max(1, r.width / 2);
    const halfH = Math.max(1, r.height / 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() > keep) continue;
        const x = x0 + col * block + block / 2;
        const y = y0 + row * block + block / 2;
        const color = sample((x - r.left) / r.width, (y - r.top) / r.height);
        const dx = (x - cx) / halfW;
        const dy = (y - cy) / halfH;
        this.particles.spawn(
          x - block / 2,
          y - block / 2,
          dx * rand(80, 260) + rand(-60, 60),
          dy * rand(60, 200) - rand(120, 380),
          rand(0.9, 1.7),
          color,
          block / SCALE,
        );
      }
    }
  }

  /** On-screen rect of a target that is still alive (cached per frame). */
  private rectOf(id: TargetId): Rect | null {
    if (this.rectCache.has(id)) return this.rectCache.get(id)!;
    const el = this.elements[id];
    const t = this.authority.state.targets[id];
    let rect: Rect | null = null;
    if (el && t && !t.destroyed) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    this.rectCache.set(id, rect);
    return rect;
  }
}
