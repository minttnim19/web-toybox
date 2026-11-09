// The floating "💥 DESTROY" button that opens the game.
import type { LauncherPosition } from '../options';
import { TEXT } from './strings';

export class Launcher {
  readonly el: HTMLButtonElement;

  constructor(root: ShadowRoot, position: LauncherPosition, onClick: () => void) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'px-btn launcher';
    this.el.dataset.pos = position;
    this.el.textContent = TEXT.launcher.label;
    this.el.title = TEXT.launcher.title;
    this.el.addEventListener('click', onClick);
    root.append(this.el);
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }
}
