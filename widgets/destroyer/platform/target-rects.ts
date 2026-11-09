// Where the scanned targets are on screen. Rects are measured lazily and cached for one
// frame, so getBoundingClientRect runs at most once per target per frame.
import type { StylableElement } from '../../../shared/dom';
import { isHittable } from '../core/rules';
import type { GameState, TargetId } from '../core/state';
import type { Candidate, Rect } from '../core/targeting';

export class TargetRects {
  private elements: StylableElement[] = [];
  private readonly cache = new Map<TargetId, Rect | null>();

  constructor(private readonly state: () => Readonly<GameState>) {}

  /** Start a round with the scanned elements, indexed by target ID. */
  reset(elements: StylableElement[]): void {
    this.elements = elements;
    this.cache.clear();
  }

  elementOf(id: TargetId): StylableElement | undefined {
    return this.elements[id];
  }

  /** Call at the start of every frame: the page may have scrolled or reflowed. */
  newFrame(): void {
    this.cache.clear();
  }

  /** The target was destroyed: stop reporting a rect for it this frame. */
  forget(id: TargetId): void {
    this.cache.set(id, null);
  }

  /** On-screen rect of a target that is still standing, or null. */
  rectOf(id: TargetId): Rect | null {
    if (this.cache.has(id)) return this.cache.get(id)!;
    const el = this.elements[id];
    const target = this.state().targets[id];
    let rect: Rect | null = null;
    if (el && target && !target.destroyed) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    this.cache.set(id, rect);
    return rect;
  }

  /** Targets that can be shot right now and are on screen. */
  hittableOnScreen(): Candidate[] {
    const state = this.state();
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

  /** Every target still standing, covered containers included. */
  standing(): Candidate[] {
    const out: Candidate[] = [];
    for (const t of this.state().targets) {
      const rect = t.destroyed ? null : this.rectOf(t.id);
      if (rect) out.push({ id: t.id, rect });
    }
    return out;
  }
}
