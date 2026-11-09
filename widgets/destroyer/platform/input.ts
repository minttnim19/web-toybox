// Pointer, touch and keyboard input, plus blocking normal page interaction while playing.
import { eventInHost } from '../../../shared/shadow-host';

export interface InputHandlers {
  /** Mouse click on the page (not the HUD): use the item in slot 1. */
  onPrimary(): void;
  /** Keys 1–3: use that item slot (0-based index). */
  onSlot(index: number): void;
  onQuit(): void;
}

/** Events whose default action (navigate, submit, select, focus...) is cancelled outside the HUD. */
const BLOCKED_EVENTS = [
  'click',
  'auxclick',
  'dblclick',
  'contextmenu',
  'submit',
  'dragstart',
  'selectstart',
  'mousedown',
] as const;

/**
 * Item slot (0-based) for a key press, or null. Uses the physical key (`code`) so it works
 * with any keyboard layout — on a Thai layout the 1 key types "ๅ", not "1". Falls back to
 * the typed character for unusual keyboards that don't report a code.
 */
export function slotForKey(code: string, key: string): number | null {
  const match = /^(?:Digit|Numpad)([1-3])$/.exec(code);
  if (match) return Number(match[1]) - 1;
  if (!code && key >= '1' && key <= '3' && key.length === 1) return Number(key) - 1;
  return null;
}

export class InputController {
  /** Pointer position in viewport CSS px. */
  x = window.innerWidth / 2;
  y = window.innerHeight / 2;
  /** True once the pointer has moved at least once this round. */
  hasPointer = false;
  /** Mouse over the window, or a finger currently on the screen. */
  private mouseInside = false;
  private touching = false;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {}

  /** Whether edge scrolling should react to the current pointer position. */
  get pointerActive(): boolean {
    return this.hasPointer && (this.mouseInside || this.touching);
  }

  attach(): void {
    const opts = { capture: true, passive: false } as const;
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(type, fn, opts);
      this.cleanups.push(() => window.removeEventListener(type, fn, opts));
    };

    const outside = (e: Event) => !eventInHost(e, this.host);

    on('pointermove', (e) => this.track(e));
    on('pointerdown', (e) => {
      this.track(e);
      if (e.pointerType === 'touch') this.touching = true;
      if (outside(e) && e.pointerType === 'mouse' && e.button === 0) this.handlers.onPrimary();
    });
    const endTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') this.touching = false;
    };
    on('pointerup', endTouch);
    on('pointercancel', endTouch);

    // Stop taps from turning into clicks, focus or native scrolling (the ship scrolls instead).
    on('touchstart', (e) => {
      if (outside(e)) e.preventDefault();
    });
    on('touchmove', (e) => {
      if (outside(e)) e.preventDefault();
    });

    for (const type of BLOCKED_EVENTS) {
      on(type, (e) => {
        if (!outside(e)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      });
    }

    on('focusin', (e) => {
      if (outside(e) && e.target instanceof HTMLElement) e.target.blur();
    });

    on('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.handlers.onQuit();
      } else {
        const slot = slotForKey(e.code, e.key);
        if (slot !== null && !e.repeat) {
          e.preventDefault();
          this.handlers.onSlot(slot);
        }
      }
    });

    const onMouseOut = (e: MouseEvent) => {
      // relatedTarget is also null when the element under the cursor disappears,
      // so only treat it as leaving when the cursor is really at the window edge.
      const atEdge =
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth - 1 ||
        e.clientY >= window.innerHeight - 1;
      if (!e.relatedTarget && atEdge) this.mouseInside = false;
    };
    document.addEventListener('mouseout', onMouseOut);
    this.cleanups.push(() => document.removeEventListener('mouseout', onMouseOut));
    on('blur', () => {
      this.mouseInside = false;
      this.touching = false;
    });

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  detach(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.hasPointer = false;
    this.touching = false;
    this.mouseInside = false;
  }

  private track(e: PointerEvent): void {
    this.x = e.clientX;
    this.y = e.clientY;
    this.hasPointer = true;
    if (e.pointerType === 'mouse') this.mouseInside = true;
  }
}
