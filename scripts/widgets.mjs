// Shared helpers for discovering and bundling widgets.
// Each widget lives in widgets/<name>/index.ts and is bundled into a single
// self-contained IIFE (no runtime dependencies) so it can be embedded with one <script> tag.
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WIDGETS_DIR = resolve(ROOT, 'widgets');

/** Names of all widgets that have an entry point. */
export function listWidgets() {
  return readdirSync(WIDGETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(WIDGETS_DIR, d.name, 'index.ts')))
    .map((d) => d.name)
    .sort();
}

/** "destroyer" -> "WebToyboxDestroyer" (global name of the IIFE). */
function globalName(name) {
  return 'WebToybox' + name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}

/**
 * Bundle one widget.
 * @param {string} name widget directory name
 * @param {{ write?: boolean, minify?: boolean, outDir?: string }} [opts]
 * @returns {Promise<string>} the bundled code
 */
export async function bundleWidget(name, opts = {}) {
  const { write = false, minify = true, outDir = resolve(ROOT, 'dist') } = opts;
  const result = await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    publicDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify(minify ? 'production' : 'development') },
    build: {
      write,
      outDir,
      emptyOutDir: false,
      minify,
      sourcemap: minify ? false : 'inline',
      target: 'es2020',
      lib: {
        entry: resolve(WIDGETS_DIR, name, 'index.ts'),
        name: globalName(name),
        formats: ['iife'],
        fileName: () => `${name}.js`,
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((o) => o.output ?? []).find((o) => o.type === 'chunk');
  if (!chunk) throw new Error(`No output produced for widget "${name}"`);
  return chunk.code;
}
