// In-game HUD: top bar (progress, time, score, combo, mute, quit) and, at the bottom,
// active buffs and the 3 item slots. Values are pushed in every frame; the DOM is only
// touched when something changed.
import { h, setClass, setText } from '../../../shared/hud';
import { MAX_INVENTORY, type ItemKind } from '../core/items';
import type { Buff } from '../core/state';
import { itemIcon } from './icons';
import { TEXT } from './strings';

export interface HudHandlers {
  onQuit(): void;
  onToggleMute(): void;
  onSlot(index: number): void;
}

export interface HudView {
  /** 0..1 */
  destroyed: number;
  /** Seconds. */
  timeLeft: number;
  score: number;
  combo: number;
  multiplier: number;
  muted: boolean;
  inventory: readonly ItemKind[];
  buffs: readonly Buff[];
}

const LOW_TIME = 30;

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private readonly top: HTMLElement;
  private readonly bottom: HTMLElement;
  private readonly percent: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly timeBox: HTMLElement;
  private readonly time: HTMLElement;
  private readonly score: HTMLElement;
  private readonly comboBox: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly mute: HTMLButtonElement;
  private readonly buffs: HTMLElement;
  private readonly slots: HTMLButtonElement[] = [];
  private readonly fullTag: HTMLElement;
  private shownInventory = '';
  private shownBuffs = '';

  constructor(root: ShadowRoot, handlers: HudHandlers) {
    const value = () => h('span', { class: 'value' });
    this.percent = value();
    this.bar = h('i');
    this.time = value();
    this.score = value();
    this.combo = value();
    this.timeBox = h(
      'div',
      { class: 'box time' },
      h('span', { class: 'label', text: TEXT.hud.time }),
      this.time,
    );
    this.comboBox = h(
      'div',
      { class: 'box combo' },
      h('span', { class: 'label', text: TEXT.hud.combo }),
      this.combo,
    );
    this.mute = h('button', {
      class: 'px-btn light',
      attrs: { type: 'button' },
      on: { click: () => handlers.onToggleMute() },
    });

    this.top = h(
      'div',
      { class: 'hud-top px' },
      h(
        'div',
        { class: 'box progress' },
        h('span', { class: 'label', text: TEXT.hud.destroyed }),
        this.percent,
        h('div', { class: 'bar' }, this.bar),
      ),
      this.timeBox,
      h(
        'div',
        { class: 'box score' },
        h('span', { class: 'label', text: TEXT.hud.score }),
        this.score,
      ),
      this.comboBox,
      h('div', { class: 'spacer' }),
      this.mute,
      h('button', {
        class: 'px-btn th',
        text: TEXT.hud.quit,
        attrs: { type: 'button', title: TEXT.hud.quitTitle },
        on: { click: () => handlers.onQuit() },
      }),
    );

    for (let i = 0; i < MAX_INVENTORY; i++) {
      const slot = h(
        'button',
        { class: 'slot', attrs: { type: 'button' }, on: { click: () => handlers.onSlot(i) } },
        h('span', { class: 'key', text: String(i + 1) }),
      );
      this.slots.push(slot);
    }
    this.fullTag = h('span', { class: 'full', text: TEXT.hud.full });
    this.buffs = h('div', { class: 'buffs' });
    this.bottom = h(
      'div',
      { class: 'hud-bottom' },
      this.buffs,
      h('div', { class: 'slots' }, this.fullTag, ...this.slots),
    );

    this.setVisible(false);
    root.append(this.top, this.bottom);
  }

  setVisible(visible: boolean): void {
    this.top.hidden = !visible;
    this.bottom.hidden = !visible;
  }

  update(view: HudView): void {
    const pct = Math.floor(view.destroyed * 100);
    setText(this.percent, `${pct}%`);
    const width = `${pct}%`;
    if (this.bar.style.width !== width) this.bar.style.width = width;

    setText(this.time, formatTime(view.timeLeft));
    setClass(this.timeBox, 'low', view.timeLeft < LOW_TIME);
    setText(this.score, view.score.toLocaleString('en-US'));
    this.comboBox.hidden = view.combo < 2;
    setText(this.combo, `${view.combo} x${view.multiplier}`);
    setText(this.mute, view.muted ? TEXT.hud.soundOff : TEXT.hud.soundOn);
    this.mute.setAttribute('aria-pressed', String(view.muted));

    const inventoryKey = view.inventory.join(',');
    if (inventoryKey !== this.shownInventory) {
      this.shownInventory = inventoryKey;
      this.slots.forEach((slot, i) => {
        const kind = view.inventory[i];
        const key = slot.firstElementChild!;
        slot.replaceChildren(key);
        if (kind) slot.append(itemIcon(kind));
        slot.title = kind ? `${TEXT.items[kind].name} (${i + 1})` : TEXT.hud.emptySlot;
        slot.setAttribute('aria-label', slot.title);
      });
    }
    this.fullTag.hidden = view.inventory.length < MAX_INVENTORY;

    const buffKey = view.buffs.map((b) => `${b.kind}:${Math.ceil(b.remaining)}`).join(',');
    if (buffKey !== this.shownBuffs) {
      this.shownBuffs = buffKey;
      this.buffs.replaceChildren(
        ...view.buffs.map((b) =>
          h('div', { class: 'box buff' }, itemIcon(b.kind), `${Math.ceil(b.remaining)}s`),
        ),
      );
    }
  }
}
