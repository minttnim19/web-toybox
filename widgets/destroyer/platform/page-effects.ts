// Visual effects applied to the real page. Destruction is purely visual: elements are
// hidden with visibility:hidden (never removed), and every touched element's original
// inline style is snapshotted so the page can be restored exactly.
import type { StylableElement } from '../../../shared/dom';

const PLAYING_CLASS = 'wd-destroyer-playing';
const STYLE_ID = 'wd-destroyer-page-style';

const PAGE_CSS = `
html.${PLAYING_CLASS}, html.${PLAYING_CLASS} * {
  cursor: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  -webkit-touch-callout: none !important;
}
html.${PLAYING_CLASS} {
  touch-action: none !important;
  overscroll-behavior: none !important;
}`;

const ELEMENT_SHAKE_TIME = 0.09;

export class PageEffects {
  /** Original `style` attribute (null = none) of every element we may modify. */
  private readonly snapshots = new Map<StylableElement, string | null>();
  /** Original computed filter, so damage tint can be layered on top of it. */
  private readonly baseFilters = new Map<StylableElement, string>();
  private readonly shaking = new Map<StylableElement, number>();
  private screenShakeTime = 0;
  private screenShakeDuration = 0;
  private screenShakePower = 0;
  /** Current screen shake offset in px, so the overlay can follow the page. */
  readonly shakeOffset = { x: 0, y: 0 };

  constructor(private readonly reducedMotion: boolean) {}

  /** Remember the original inline styles of everything we might touch. */
  snapshot(elements: Iterable<StylableElement>): void {
    for (const el of [document.body, ...elements]) {
      if (this.snapshots.has(el)) continue;
      this.snapshots.set(el, el.getAttribute('style'));
      const filter = getComputedStyle(el).filter;
      this.baseFilters.set(el, filter && filter !== 'none' ? filter + ' ' : '');
    }
  }

  setPlaying(playing: boolean): void {
    const root = document.documentElement;
    if (playing) {
      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = PAGE_CSS;
        document.head.append(style);
      }
      root.classList.add(PLAYING_CLASS);
    } else {
      root.classList.remove(PLAYING_CLASS);
      document.getElementById(STYLE_ID)?.remove();
    }
  }

  /** Darken and desaturate as HP drops (ratio = hp / maxHp). */
  damage(el: StylableElement, ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    const brightness = (0.55 + 0.45 * r).toFixed(2);
    const saturate = (0.15 + 0.85 * r).toFixed(2);
    el.style.setProperty(
      'filter',
      `${this.baseFilters.get(el) ?? ''}brightness(${brightness}) saturate(${saturate})`,
      'important',
    );
  }

  shake(el: StylableElement): void {
    this.shaking.set(el, ELEMENT_SHAKE_TIME);
  }

  hide(el: StylableElement): void {
    this.shaking.delete(el);
    this.restoreProperty(el, 'translate');
    el.style.setProperty('visibility', 'hidden', 'important');
  }

  screenShake(power: number, duration: number): void {
    const p = this.reducedMotion ? power * 0.3 : power;
    if (p < this.screenShakePower && this.screenShakeTime > 0) return;
    this.screenShakePower = p;
    this.screenShakeTime = this.screenShakeDuration = duration;
  }

  tick(dt: number): void {
    for (const [el, time] of this.shaking) {
      const left = time - dt;
      if (left <= 0) {
        this.shaking.delete(el);
        this.restoreProperty(el, 'translate');
      } else {
        this.shaking.set(el, left);
        const dx = Math.round((Math.random() - 0.5) * 4);
        const dy = Math.round((Math.random() - 0.5) * 4);
        el.style.setProperty('translate', `${dx}px ${dy}px`, 'important');
      }
    }

    if (this.screenShakeTime > 0) {
      this.screenShakeTime = Math.max(0, this.screenShakeTime - dt);
      const power = this.screenShakePower * (this.screenShakeTime / this.screenShakeDuration);
      if (this.screenShakeTime === 0) {
        this.shakeOffset.x = this.shakeOffset.y = 0;
        this.screenShakePower = 0;
        this.restoreProperty(document.body, 'translate');
      } else {
        this.shakeOffset.x = Math.round((Math.random() - 0.5) * 2 * power);
        this.shakeOffset.y = Math.round((Math.random() - 0.5) * 2 * power);
        document.body.style.setProperty(
          'translate',
          `${this.shakeOffset.x}px ${this.shakeOffset.y}px`,
          'important',
        );
      }
    }
  }

  /** Put every touched element back exactly as it was. */
  restoreAll(): void {
    for (const [el, original] of this.snapshots) {
      // Chrome syncs CSSOM inline-style edits to the attribute lazily; read the attribute
      // first to flush that, or a pending sync can re-add style="" after removeAttribute.
      el.getAttribute('style');
      if (original === null) el.removeAttribute('style');
      else el.setAttribute('style', original);
    }
    this.snapshots.clear();
    this.baseFilters.clear();
    this.shaking.clear();
    this.screenShakeTime = 0;
    this.screenShakePower = 0;
    this.shakeOffset.x = this.shakeOffset.y = 0;
    this.setPlaying(false);
  }

  /** Reset one property to its value in the element's original inline style. */
  private restoreProperty(el: StylableElement, property: string): void {
    const original = this.snapshots.get(el);
    const probe = document.createElement('div');
    if (original) probe.setAttribute('style', original);
    const value = probe.style.getPropertyValue(property);
    if (value) el.style.setProperty(property, value, probe.style.getPropertyPriority(property));
    else el.style.removeProperty(property);
  }
}
