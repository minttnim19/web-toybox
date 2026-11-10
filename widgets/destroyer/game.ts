// Game session controller: owns the frame loop and connects core logic, the authority,
// page effects, input, rendering, sound and UI. Every change that matters to other
// players goes through `authority`; visuals and sounds react to the events it broadcasts.
//
// Flow: launcher → menu → countdown → playing → result → (replay | back to page).
import { ensureFonts } from '../../shared/fonts';
import { createShadowHost } from '../../shared/shadow-host';
import { LocalAuthority, type GameAuthority } from './core/authority';
import { ITEMS, RAPID_FIRE_RATE } from './core/items';
import { comboMultiplier, destroyedRatio, isHittable, timeLeft } from './core/rules';
import {
  FIRE_RANGE,
  createShip,
  desiredHeading,
  isAimedAt,
  tickFireTimer,
  resetFireTimer,
  spawnBullet,
  steerShip,
  stepBullet,
  turnShip,
  type Bullet,
  type Ship,
} from './core/ship';
import { LOCAL_PLAYER, type GameResult, type PlayerState, type TargetSpec } from './core/state';
import { pickNearest, targetsInShape, type Candidate } from './core/targeting';
import type { DestroyerOptions } from './options';
import { Feedback } from './feedback';
import { EdgeScroller } from './platform/edge-scroll';
import { InputController } from './platform/input';
import { ItemField } from './platform/item-field';
import { TargetRects } from './platform/target-rects';
import { PageEffects } from './platform/page-effects';
import { resolveScope, scanTargets } from './platform/scanner';
import { Sfx } from './platform/sfx';
import { loadMuted, recordScore, saveMuted } from './platform/storage';
import { Particles } from './render/particles';
import { Renderer } from './render/renderer';
import { PALETTE } from './render/sprites';
import { Countdown } from './ui/countdown';
import { Hud } from './ui/hud';
import { Launcher } from './ui/launcher';
import { Menu } from './ui/menu';
import { ResultScreen } from './ui/result';
import { TEXT } from './ui/strings';
import { WIDGET_CSS } from './ui/styles';

type Phase = 'idle' | 'menu' | 'countdown' | 'playing' | 'ended';

const BULLET_DAMAGE = 1;
const COUNTDOWN_STEPS = ['3', '2', '1', 'GO!'];
const COUNTDOWN_STEP_TIME = 0.8; // s per step
const RESULT_DELAY = 0.9; // s between the end of the round and the result screen

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
  private readonly itemField: ItemField;
  private readonly feedback: Feedback;
  private readonly edgeScroller = new EdgeScroller();
  private readonly targets = new TargetRects(() => this.authority.state);

  private phase: Phase = 'idle';
  private duration = 0;
  private ship: Ship | null = null;
  private bullets: Bullet[] = [];
  private unsubscribe: (() => void) | null = null;
  private rafId = 0;
  private lastFrame = 0;
  /** Seconds since the round (countdown included) began; drives animations. */
  private time = 0;
  /** Seconds into the countdown, or since the round ended. */
  private phaseTime = 0;
  private lastScrollX = 0;
  private lastScrollY = 0;
  private pendingResult: GameResult | null = null;
  private countdownStep = 0;

  constructor(private readonly options: DestroyerOptions) {
    const { host, root } = createShadowHost('destroyer', WIDGET_CSS);
    this.host = host;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.effects = new PageEffects(reducedMotion);
    this.sfx.setMuted(loadMuted());

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

    this.itemField = new ItemField(
      this.authority,
      LOCAL_PLAYER,
      (id) => this.targets.elementOf(id),
      (at) => {
        this.renderer.addText(at.x, at.y - 16, TEXT.hud.full, PALETTE.pink, 8);
        this.sfx.play('full');
      },
    );

    this.feedback = new Feedback({
      localPlayer: LOCAL_PLAYER,
      renderer: this.renderer,
      particles: this.particles,
      effects: this.effects,
      sfx: this.sfx,
      itemField: this.itemField,
      targets: this.targets,
      localShip: () => this.ship,
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
    const elements = scanned.map((t) => t.el);
    this.targets.reset(elements);
    this.effects.snapshot(elements);
    // Only plain data goes to the authority (in phase 2 it is sent over the network).
    const specs: TargetSpec[] = scanned.map(({ id, parentId, area, isContainer }) => ({
      id,
      parentId,
      area,
      isContainer,
    }));
    this.authority.start(specs, { duration, players: [LOCAL_PLAYER] });
    this.unsubscribe = this.authority.subscribe((event) => {
      this.feedback.handle(event);
      if (event.type === 'end') this.finishRound(event.result);
    });

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
    this.itemField.clear();
    this.ship = null;
    this.targets.reset([]);
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
    saveMuted(muted);
    if (!muted) this.sfx.unlock();
  }

  // ---- Frame loop -------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    if (this.phase === 'idle' || this.phase === 'menu') return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.phaseTime += dt;
    this.targets.newFrame();
    this.itemField.measure();

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
      this.edgeScroller.update(ship.y, this.input.pointerActive, dt);
    }

    if (this.phase === 'playing' && ship) {
      this.authority.tick(dt);
      // tick() may have ended the round
      if (this.phase === 'playing') {
        const candidates = this.targets.hittableOnScreen();
        ship.fireRate = this.hasBuff('rapid') ? RAPID_FIRE_RATE : 1;
        this.aimAndFire(dt, candidates);
        this.updateBullets(dt, candidates);
        this.itemField.update(dt, ship, this.hasBuff('magnet'), this.time);
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
      items: this.itemField.views(),
      ship: this.phase === 'ended' ? null : this.ship,
      bullets: this.bullets,
      particles: this.particles,
      rectOf: (id) => this.targets.rectOf(id),
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

  // ---- Shooting ---------------------------------------------------------------------

  /** Turn toward the nearest target (or the travel direction) and fire once lined up. */
  private aimAndFire(dt: number, candidates: readonly Candidate[]): void {
    const ship = this.ship!;
    const target = pickNearest(ship.x, ship.y, candidates, FIRE_RANGE);
    turnShip(ship, desiredHeading(ship, target?.rect ?? null), dt);
    if (!tickFireTimer(ship, dt) || !target || !isAimedAt(ship, target.rect)) return;
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

  /** Use the item in a slot: collect the targets its shape covers, then ask the authority. */
  private useSlot(slot: number): void {
    if (this.phase !== 'playing' || !this.ship) return;
    const kind = this.player().inventory[slot];
    if (!kind) return;
    // Covered containers count too: the authority damages inside-out, peeling layers.
    const standing = this.targets.standing();
    const targetIds = targetsInShape(ITEMS[kind].targeting, this.ship.x, this.ship.y, standing, {
      w: window.innerWidth,
      h: window.innerHeight,
    });
    this.authority.requestUseItem({ playerId: LOCAL_PLAYER, slot, targetIds });
  }

  // ---- Helpers ----------------------------------------------------------------------

  private player(): PlayerState {
    return this.authority.state.players[LOCAL_PLAYER]!;
  }

  private hasBuff(kind: 'rapid' | 'magnet'): boolean {
    return this.player().buffs.some((b) => b.kind === kind);
  }
}
