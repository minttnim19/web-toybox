// Scroll the page when the ship is near the top or bottom edge; closer = faster.

const EDGE_ZONE = 80; // px from the top/bottom edge where scrolling starts
const EDGE_MAX_SPEED = 900; // px/s at the very edge

export class EdgeScroller {
  /** Sub-pixel scroll carried over between frames, so slow speeds still move. */
  private remainder = 0;

  /** @param y ship position in viewport px; @param active whether the pointer is steering */
  update(y: number, active: boolean, dt: number): void {
    const h = window.innerHeight;
    let speed = 0;
    if (active && y < EDGE_ZONE) speed = -(((EDGE_ZONE - y) / EDGE_ZONE) ** 2);
    else if (active && y > h - EDGE_ZONE) speed = ((y - (h - EDGE_ZONE)) / EDGE_ZONE) ** 2;
    if (speed === 0) {
      this.remainder = 0;
      return;
    }
    this.remainder += Math.max(-1, Math.min(1, speed)) * EDGE_MAX_SPEED * dt;
    const step = Math.trunc(this.remainder);
    if (step === 0) return;
    this.remainder -= step;
    // 'instant' overrides a page's `scroll-behavior: smooth`; TS's DOM types lack it.
    window.scrollBy({ top: step, behavior: 'instant' as ScrollBehavior });
  }
}
