// npm run build: bundle every widget into dist/<name>.js
import { rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, bundleWidget, listWidgets } from './widgets.mjs';

const outDir = resolve(ROOT, 'dist');
rmSync(outDir, { recursive: true, force: true });

for (const name of listWidgets()) {
  await bundleWidget(name, { write: true, minify: true, outDir });
  const kb = (statSync(resolve(outDir, `${name}.js`)).size / 1024).toFixed(1);
  console.log(`  dist/${name}.js  ${kb} kB`);
}
