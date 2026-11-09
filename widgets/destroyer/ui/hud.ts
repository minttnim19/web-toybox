// In-game HUD. For now only the quit button; the full HUD (score, timer, items) comes next.
export class Hud {
  private readonly quit: HTMLButtonElement;

  constructor(root: ShadowRoot, onQuit: () => void) {
    this.quit = document.createElement('button');
    this.quit.type = 'button';
    this.quit.className = 'px-btn th quit';
    this.quit.textContent = '✕ ออก';
    this.quit.title = 'ออกจากเกมและคืนหน้าเว็บ (Esc)';
    this.quit.hidden = true;
    this.quit.addEventListener('click', onQuit);
    root.append(this.quit);
  }

  setVisible(visible: boolean): void {
    this.quit.hidden = !visible;
  }
}
