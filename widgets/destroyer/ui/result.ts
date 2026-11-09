// End-of-round screen: CLEAR! or TIME UP!, stats, best score, play again / back to page.
import { h } from '../../../shared/hud';
import type { EndReason } from '../core/state';
import { formatTime } from './hud';

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

const num = (n: number) => n.toLocaleString('en-US');

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
      text: 'เล่นอีกครั้ง',
      attrs: { type: 'button' },
      on: { click: () => handlers.onReplay() },
    });
    this.panel = h('div', {
      class: 'panel result th',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ผลการเล่น' },
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
        text: view.reason === 'clear' ? 'CLEAR!' : 'TIME UP!',
      }),
      h(
        'table',
        { class: 'stats' },
        h(
          'tbody',
          {},
          row('คะแนน', num(view.score), undefined, 'total'),
          row('ทำลายไป', `${Math.floor(view.destroyed * 100)}%`),
          row('เวลาที่ใช้', formatTime(view.timeUsed)),
          row('คอมโบสูงสุด', num(view.maxCombo)),
          row('โบนัสเวลา', `+${num(view.timeBonus)}`),
          row(
            'สถิติสูงสุด',
            num(view.best),
            view.isNewBest ? h('span', { class: 'new px', text: 'NEW!' }) : undefined,
          ),
        ),
      ),
      h(
        'div',
        { class: 'actions' },
        this.replay,
        h('button', {
          class: 'px-btn th light',
          text: 'กลับไปที่หน้าเว็บ',
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

  get visible(): boolean {
    return !this.el.hidden;
  }
}
