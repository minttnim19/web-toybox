import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { ROOT, bundleWidget, listWidgets } from './scripts/widgets.mjs';

/**
 * Dev-only plugin: serves /<widget>.js as a freshly bundled IIFE, exactly like
 * the production file, so example pages can embed widgets with a plain
 * <script src="/destroyer.js" defer> tag. Editing widget or shared code
 * triggers a full page reload.
 */
function widgetDevServer(): Plugin {
  const cache = new Map<string, Promise<string>>();
  return {
    name: 'web-toybox:widget-dev-server',
    apply: 'serve',
    configureServer(server) {
      const watched = [resolve(ROOT, 'widgets'), resolve(ROOT, 'shared')];
      server.watcher.add(watched);
      server.watcher.on('all', (_event, file) => {
        if (watched.some((dir) => file.startsWith(dir))) {
          cache.clear();
          server.ws.send({ type: 'full-reload' });
        }
      });

      server.middlewares.use(async (req, res, next) => {
        const match = /^(?:.*\/)?([a-z0-9-]+)\.js(?:\?.*)?$/.exec(req.url ?? '');
        const name = match?.[1];
        if (!name || !listWidgets().includes(name)) return next();
        try {
          if (!cache.has(name)) cache.set(name, bundleWidget(name, { minify: false }));
          const code = await cache.get(name)!;
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(code);
        } catch (err) {
          cache.delete(name);
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.end(
            `console.error(${JSON.stringify(`[web-toybox] failed to build ${name}: ${err}`)});`,
          );
        }
      });
    },
  };
}

export default defineConfig({
  root: resolve(ROOT, 'examples'),
  plugins: [widgetDevServer()],
  server: { open: '/' },
  test: {
    root: ROOT,
    include: ['widgets/**/*.test.ts', 'shared/**/*.test.ts'],
    passWithNoTests: true,
  },
});
