// Big centered 3-2-1-GO.
import { h } from '../../../shared/html';

export class Countdown {
  private readonly el: HTMLElement;

  constructor(root: ShadowRoot) {
    this.el = h('div', { class: 'countdown', attrs: { 'aria-live': 'assertive' } });
    this.el.hidden = true;
    root.append(this.el);
  }

  /** Show a step ("3", "2", "1", "GO!"), or hide with null. */
  set(text: string | null): void {
    if (text === null) {
      this.el.hidden = true;
      this.el.replaceChildren();
      return;
    }
    this.el.hidden = false;
    // A fresh element restarts the pop-in animation.
    this.el.replaceChildren(h('span', { text }));
  }
}
