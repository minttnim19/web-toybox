// destroyer widget entry point.
// Embed with: <script src="destroyer.js" defer></script>
import { readOptions } from './options';

// currentScript is only available while the script is first executing, so capture it now.
const options = readOptions(document.currentScript as HTMLScriptElement | null);

function boot(): void {
  // The game itself is wired up in the next step; for now just confirm the embed works.
  console.info('[destroyer] loaded', options);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
