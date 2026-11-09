// npm run build:site — assemble the GitHub Pages site in site/:
//
//   /<widget>.js                 latest build of every widget (from dist/, built from this commit)
//   /v<version>/<widget>.js      one folder per git tag v*, built from that tag, never changes
//   /index.html, /<widget>/      the example pages (each also gets its widget next to it)
//
// Run `npm run build` first. Set SKIP_TAG_BUILDS=1 to skip building the tagged versions.
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, listWidgets } from './widgets.mjs';

const SITE = resolve(ROOT, 'site');
const DIST = resolve(ROOT, 'dist');
const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const widgetFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.js'));

if (!existsSync(DIST)) throw new Error('dist/ is missing: run `npm run build` first');
rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

// Latest widgets at the site root.
for (const file of widgetFiles(DIST)) cpSync(join(DIST, file), join(SITE, file));

// Example pages; each widget page loads "<widget>.js" next to itself.
cpSync(resolve(ROOT, 'examples'), SITE, { recursive: true });
for (const name of listWidgets()) {
  if (existsSync(join(SITE, name)))
    cpSync(join(DIST, `${name}.js`), join(SITE, name, `${name}.js`));
}

// Version-locked builds, one per release tag.
const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);
if (process.env.SKIP_TAG_BUILDS) {
  console.log(`Skipping ${tags.length} tagged build(s) (SKIP_TAG_BUILDS is set)`);
} else {
  for (const tag of tags) {
    const dir = mkdtempSync(join(tmpdir(), `web-toybox-${tag}-`));
    try {
      console.log(`\nBuilding ${tag}…`);
      run('git', ['worktree', 'add', '--detach', dir, tag]);
      run('npm', ['ci', '--no-audit', '--no-fund'], dir);
      run('npm', ['run', 'build'], dir);
      mkdirSync(join(SITE, tag));
      for (const file of widgetFiles(join(dir, 'dist')))
        cpSync(join(dir, 'dist', file), join(SITE, tag, file));
    } finally {
      run('git', ['worktree', 'remove', '--force', dir]);
    }
  }
}

// GitHub Pages: serve files as they are.
writeFileSync(join(SITE, '.nojekyll'), '');

// The guide links to the current version; warn if that link can't work yet.
const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
const guide = readFileSync(resolve(ROOT, 'examples/destroyer/index.html'), 'utf8');
if (!guide.includes(`/v${version}/destroyer.js`))
  throw new Error(
    `examples/destroyer/index.html does not link to /v${version}/destroyer.js (package.json version)`,
  );
if (!tags.includes(`v${version}`))
  console.warn(
    `\nNote: tag v${version} does not exist yet, so /v${version}/ will 404 until it is tagged and pushed.`,
  );

console.log(`\nSite ready in site/ (${tags.length} tagged version(s))`);
