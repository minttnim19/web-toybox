// npm run build: bundle every widget into dist/<name>.js
import { readFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { ROOT, bundleWidget, listWidgets } from './widgets.mjs';

const outDir = resolve(ROOT, 'dist');
rmSync(outDir, { recursive: true, force: true });

for (const name of listWidgets()) {
  await bundleWidget(name, { write: true, minify: true, outDir });
  const code = readFileSync(resolve(outDir, `${name}.js`));
  const kb = (n) => (n / 1024).toFixed(1);
  console.log(`  dist/${name}.js  ${kb(code.length)} kB  (gzip ${kb(gzipSync(code).length)} kB)`);
}
