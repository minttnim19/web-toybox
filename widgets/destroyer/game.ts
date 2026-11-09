// Game session controller: owns the frame loop and connects core logic, the authority,
// page effects, input, rendering and UI. Every change that matters to other players
// goes through `authority`; visuals react to the events it broadcasts.
import type { StylableElement } from '../../shared/dom';
import { ensureFonts } from '../../shared/fonts';
import { createShadowHost } from '../../shared/shadow-host';
import { LocalAuthority, type AuthorityEvent, type GameAuthority } from './core/authority';
import { isHittable } from './core/rules';
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
import { LOCAL_PLAYER, type TargetId } from './core/state';
import { pickNearest, type Candidate, type Rect } from './core/targeting';
import type { DestroyerOptions } from './options';
import { makeColorSampler } from './platform/colors';
import { InputController } from './platform/input';
import { PageEffects } from './platform/page-effects';
import { resolveScope, scanTargets } from './platform/scanner';
import { Particles } from './render/particles';
import { Renderer, SCALE } from './render/renderer';
import { PALETTE } from './render/sprites';
import { Hud } from './ui/hud';
import { Launcher } from './ui/launcher';
import { WIDGET_CSS } from './ui/styles';

const BULLET_DAMAGE = 1;
const EDGE_ZONE = 80; // px from the top/bottom edge where scrolling starts
const EDGE_MAX_SPEED = 900; // px/s at the very edge
const BIG_TARGET_AREA = 60_000; // px²; destroying something bigger shakes the screen
const MAX_SHATTER_BLOCKS = 320;
const SPARK_COLORS = [PALETTE.yellow, PALETTE.white, PALETTE.orange];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class DestroyerGame {
  private readonly host: HTMLElement;
  private readonly authority: GameAuthority = new LocalAuthority();
  private readonly effects: PageEffects;
  private readonly input: InputController;
  private readonly renderer: Renderer;
  private readonly particles = new Particles();
  private readonly launcher: Launcher;
  private readonly hud: Hud;

  private playing = false;
  private elements: StylableElement[] = [];
  private ship: Ship | null = null;
  private bullets: Bullet[] = [];
  private unsubscribe: (() => void) | null = null;
  private rafId = 0;
  private lastFrame = 0;
  private time = 0;
  private lastScrollX = 0;
  private lastScrollY = 0;
  private scrollRemainder = 0;
  /** Per-frame cache of target rects (getBoundingClientRect is called at most once per frame). */
  private readonly rectCache = new Map<TargetId, Rect | null>();

  constructor(private readonly options: DestroyerOptions) {
    ensureFonts();
    const { host, root } = createShadowHost('destroyer', WIDGET_CSS);
    this.host = host;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.effects = new PageEffects(reducedMotion);
    this.renderer = new Renderer(root);
    this.renderer.setVisible(false);
    this.hud = new Hud(root, () => this.stop());
    this.launcher = new Launcher(root, options.position, () => this.start());
    this.input = new InputController(host, {
      onPrimary: () => {}, // items arrive in the next step
      onSlot: () => {},
      onQuit: () => this.stop(),
    });
    window.addEventListener('resize', () => this.renderer.resize());
  }

  start(): void {
    if (this.playing) return;
    const scanned = scanTargets(resolveScope(this.options.scope), this.host);
    this.elements = scanned.map((t) => t.el);
    this.effects.snapshot(this.elements);
    this.authority.start(scanned);
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
    this.playing = true;
    this.time = 0;
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Quit: stop the loop and restore the page exactly as it was. */
  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.effects.restoreAll();
    this.particles.clear();
    this.bullets = [];
    this.ship = null;
    this.elements = [];
    this.rectCache.clear();
    this.renderer.reset();
    this.renderer.setOffset(0, 0);
    this.renderer.setVisible(false);
    this.hud.setVisible(false);
    this.launcher.setVisible(true);
  }

  private readonly frame = (now: number): void => {
    if (!this.playing || !this.ship) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.rectCache.clear();

    // Keep debris attached to the page while it scrolls.
    const sx = window.scrollX;
    const sy = window.scrollY;
    if (sx !== this.lastScrollX || sy !== this.lastScrollY) {
      this.particles.shift(this.lastScrollX - sx, this.lastScrollY - sy);
      this.lastScrollX = sx;
      this.lastScrollY = sy;
    }

    const ship = this.ship;
    ship.targetX = this.input.x;
    ship.targetY = this.input.y;
    steerShip(ship, dt);
    this.edgeScroll(dt);
    const candidates = this.visibleCandidates();
    this.aimAndFire(dt, candidates);
    this.updateBullets(dt, candidates);
    this.particles.update(dt);
    this.effects.tick(dt);

    this.renderer.setOffset(this.effects.shakeOffset.x, this.effects.shakeOffset.y);
    this.renderer.draw({
      time: this.time,
      ship,
      bullets: this.bullets,
      particles: this.particles,
      rectOf: (id) => this.rectOf(id),
      range: FIRE_RANGE,
    });
    this.rafId = requestAnimationFrame(this.frame);
  };

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
        // A destroyed target (or a container it uncovered) changes what later bullets can hit.
        if (!isHittable(state, step.targetId)) {
          const index = candidates.findIndex((c) => c.id === step.targetId);
          if (index >= 0) candidates.splice(index, 1);
        }
        return false;
      }
      return step.kind === 'flying';
    });
  }

  private onAuthorityEvent(event: AuthorityEvent): void {
    const el = this.elements[event.targetId];
    if (!el) return;
    switch (event.type) {
      case 'hit': {
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
        }
        break;
      }
      case 'destroy':
        this.shatter(el);
        this.effects.hide(el);
        this.renderer.clearCracks(event.targetId);
        this.rectCache.set(event.targetId, null);
        break;
    }
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
