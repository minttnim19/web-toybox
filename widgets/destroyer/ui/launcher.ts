// The floating "💥 DESTROY" button that opens the game.
import type { LauncherPosition } from '../options';

export class Launcher {
  readonly el: HTMLButtonElement;

  constructor(root: ShadowRoot, position: LauncherPosition, onClick: () => void) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'px-btn launcher';
    this.el.dataset.pos = position;
    this.el.textContent = '💥 DESTROY';
    this.el.title = 'เล่นเกมทำลายหน้าเว็บนี้';
    this.el.addEventListener('click', onClick);
    root.append(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }
}
