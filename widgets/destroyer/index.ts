// destroyer widget entry point.
// Embed with: <script src="destroyer.js" defer></script>
import { DestroyerGame } from './game';
import { readOptions } from './options';

declare global {
  interface Window {
    __webToyboxDestroyer?: DestroyerGame;
  }
}

// currentScript is only available while the script is first executing, so capture it now.
const options = readOptions(document.currentScript as HTMLScriptElement | null);

function boot(): void {
  // Guard against the script being included twice.
  if (window.__webToyboxDestroyer) return;
  window.__webToyboxDestroyer = new DestroyerGame(options);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
