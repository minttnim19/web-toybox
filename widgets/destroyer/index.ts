// destroyer widget entry point.
// Embed with: <script src="destroyer.js" defer></script>
import { DestroyerGame } from './game';
import { readOptions } from './options';

/** Where the running instance is kept: guards against double inclusion, and lets tests inspect it. */
const INSTANCE_KEY = '__webToyboxDestroyer';
const globals = window as unknown as Record<string, unknown>;

// currentScript is only available while the script is first executing, so capture it now.
const options = readOptions(document.currentScript as HTMLScriptElement | null);

function boot(): void {
  if (globals[INSTANCE_KEY]) return; // script included twice
  globals[INSTANCE_KEY] = new DestroyerGame(options);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
