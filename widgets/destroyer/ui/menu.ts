// Start menu: short how-to, the items, round length and the start button.
import { h } from '../../../shared/hud';
import { ITEM_KINDS } from '../core/items';
import { DEFAULT_DURATION, DURATION_CHOICES } from '../core/rules';
import { itemIcon } from './icons';
import { TEXT } from './strings';

export interface MenuHandlers {
  onStart(duration: number): void;
  onClose(): void;
}

export class Menu {
  private readonly el: HTMLElement;
  private readonly choices: HTMLButtonElement[] = [];
  private readonly startButton: HTMLButtonElement;
  private duration = DEFAULT_DURATION;

  constructor(root: ShadowRoot, handlers: MenuHandlers) {
    for (const seconds of DURATION_CHOICES) {
      const button = h('button', {
        class: 'px-btn th',
        text: TEXT.menu.minutes(seconds / 60),
        attrs: { type: 'button', 'aria-pressed': 'false' },
        on: { click: () => this.select(seconds) },
      });
      button.dataset.seconds = String(seconds);
      this.choices.push(button);
    }

    this.startButton = h('button', {
      class: 'px-btn th pink start',
      text: TEXT.menu.start,
      attrs: { type: 'button' },
      on: { click: () => handlers.onStart(this.duration) },
    });

    const panel = h(
      'div',
      {
        class: 'panel menu th',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': TEXT.menu.dialogLabel },
      },
      h('button', {
        class: 'px-btn light close',
        text: 'X',
        attrs: { type: 'button', 'aria-label': TEXT.menu.close },
        on: { click: () => handlers.onClose() },
      }),
      h('h2', { text: TEXT.menu.title }),
      h('ul', { class: 'howto' }, ...TEXT.menu.howTo.map((line) => h('li', { text: line }))),
      h('p', { class: 'section-label', text: TEXT.menu.itemsLabel }),
      h(
        'ul',
        { class: 'item-list' },
        ...ITEM_KINDS.map((kind) =>
          h(
            'li',
            {},
            itemIcon(kind),
            h('span', {}, h('b', { text: TEXT.items[kind].name }), TEXT.items[kind].description),
          ),
        ),
      ),
      h('p', { class: 'section-label', text: TEXT.menu.timeLabel }),
      h('div', { class: 'choices' }, ...this.choices),
      this.startButton,
    );

    this.el = h('div', { class: 'backdrop' }, panel);
    this.el.hidden = true;
    root.append(this.el);
  }

  show(duration = this.duration): void {
    this.select(duration);
    this.el.hidden = false;
    this.startButton.focus({ preventScroll: true });
  }

  hide(): void {
    this.el.hidden = true;
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  private select(seconds: number): void {
    this.duration = seconds;
    for (const button of this.choices)
      button.setAttribute('aria-pressed', String(button.dataset.seconds === String(seconds)));
  }
}
