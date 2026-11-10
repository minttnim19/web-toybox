// End-of-round screen: CLEAR! or TIME UP!, stats, best score, play again / back to page.
import { h } from '../../../shared/html';
import type { EndReason } from '../core/state';
import { formatNumber as num, formatTime } from './format';
import { TEXT } from './strings';

export interface ResultHandlers {
  onReplay(): void;
  onExit(): void;
}

export interface ResultView {
  reason: EndReason;
  score: number;
  /** 0..1 */
  destroyed: number;
  timeUsed: number;
  maxCombo: number;
  timeBonus: number;
  best: number;
  isNewBest: boolean;
}

export class ResultScreen {
  private readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly replay: HTMLButtonElement;

  constructor(
    root: ShadowRoot,
    private readonly handlers: ResultHandlers,
  ) {
    this.replay = h('button', {
      class: 'px-btn th pink',
      text: TEXT.result.replay,
      attrs: { type: 'button' },
      on: { click: () => handlers.onReplay() },
    });
    this.panel = h('div', {
      class: 'panel result th',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': TEXT.result.dialogLabel },
    });
    this.el = h('div', { class: 'backdrop' }, this.panel);
    this.el.hidden = true;
    root.append(this.el);
  }

  show(view: ResultView): void {
    const row = (label: string, value: string, extra?: HTMLElement, cls = '') =>
      h('tr', { class: cls }, h('td', { text: label }), h('td', {}, value, extra ?? null));

    this.panel.replaceChildren(
      h('h2', {
        class: view.reason === 'clear' ? 'clear' : 'timeup',
        text: TEXT.result.title[view.reason],
      }),
      h(
        'table',
        { class: 'stats' },
        h(
          'tbody',
          {},
          row(TEXT.result.score, num(view.score), undefined, 'total'),
          row(TEXT.result.destroyed, `${Math.floor(view.destroyed * 100)}%`),
          row(TEXT.result.timeUsed, formatTime(view.timeUsed)),
          row(TEXT.result.maxCombo, num(view.maxCombo)),
          row(TEXT.result.timeBonus, `+${num(view.timeBonus)}`),
          row(
            TEXT.result.best,
            num(view.best),
            view.isNewBest ? h('span', { class: 'new px', text: TEXT.result.newBest }) : undefined,
          ),
        ),
      ),
      h(
        'div',
        { class: 'actions' },
        this.replay,
        h('button', {
          class: 'px-btn th light',
          text: TEXT.result.exit,
          attrs: { type: 'button' },
          on: { click: () => this.handlers.onExit() },
        }),
      ),
    );
    this.el.hidden = false;
    this.replay.focus({ preventScroll: true });
  }

  hide(): void {
    this.el.hidden = true;
  }
}
