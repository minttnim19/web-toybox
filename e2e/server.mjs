// Static server for end-to-end tests. Serves the example pages and the e2e fixture
// pages, and answers any request for "<widget>.js" with the *built* bundle from dist/,
// exactly as a site embedding the widget would load it.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const PORT = Number(process.env.PORT ?? 5299);
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
};
const SITES = [join(ROOT, 'e2e/pages'), join(ROOT, 'examples')];

function resolveFile(urlPath) {
  const path = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const widget = /(?:^|\/)([a-z0-9-]+\.js)$/.exec(path);
  if (widget && existsSync(join(ROOT, 'dist', widget[1]))) return join(ROOT, 'dist', widget[1]);
  for (const site of SITES) {
    let file = join(site, path);
    if (!file.startsWith(site)) return null;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (existsSync(file)) return file;
  }
  return null;
}

createServer((req, res) => {
  const file = resolveFile(new URL(req.url ?? '/', 'http://x').pathname);
  if (!file) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': `${TYPES[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`,
  });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`e2e server on http://localhost:${PORT}`));
