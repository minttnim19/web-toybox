import { expect, test } from '@playwright/test';
import {
  destroyEverything,
  dropItem,
  giveItems,
  itemPosition,
  inventory,
  pageHtml,
  phase,
  pressThaiKey,
  runOutTheClock,
  startRound,
  sweep,
  trackErrors,
} from './helpers';

test('plays a full round on the guide page and restores it exactly', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/destroyer/');
  const before = await pageHtml(page);

  await startRound(page, 2);
  expect(await page.evaluate(() => window.__webToyboxDestroyer.authority.state.duration)).toBe(120);
  await expect(page.locator('.hud-top')).toBeVisible();

  // The ship shoots what it flies over.
  await sweep(page, [
    [300, 330],
    [500, 360],
    [250, 520],
    [600, 520],
    [900, 420],
  ]);
  const destroyed = await page.evaluate(
    () => window.__webToyboxDestroyer.authority.state.destroyedCount,
  );
  expect(destroyed).toBeGreaterThan(0);

  // Links don't navigate while playing, and clicking the page never uses an item.
  await giveItems(page, ['rapid', 'magnet']);
  const link = page.locator('.nav-links a').first();
  const box = await link.boundingBox();
  if (box) await page.mouse.click(box.x + 4, box.y + 4);
  expect(new URL(page.url()).hash).toBe('');
  expect(await inventory(page)).toEqual(['rapid', 'magnet']);

  // Keys 1-3 work by physical position, even on a Thai keyboard layout.
  const cdp = await page.context().newCDPSession(page);
  await pressThaiKey(cdp, 'Digit2', '/');
  expect(await inventory(page)).toEqual(['rapid']);
  await pressThaiKey(cdp, 'Digit1', 'ๅ');
  expect(await inventory(page)).toEqual([]);

  // Time up → result screen with the best score saved.
  await runOutTheClock(page);
  await expect(page.locator('.result h2')).toHaveText('TIME UP!');
  await expect(page.locator('.hud-top')).toBeHidden();
  const best = await page.evaluate(() => localStorage.getItem('web-toybox:destroyer:best:120'));
  expect(Number(best)).toBeGreaterThan(0);

  await page.locator('.result button', { hasText: 'กลับไปที่หน้าเว็บ' }).click();
  expect(await phase(page)).toBe('idle');
  await expect(page.locator('.launcher')).toBeVisible();
  expect(await pageHtml(page)).toBe(before);
  expect(errors).toEqual([]);
});

test('Esc on the menu closes it without touching the page', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (r) => r.url().includes('fonts.googleapis.com') && fontRequests.push(r.url()));
  await page.goto('/plain.html');
  const before = await pageHtml(page);
  // Nothing is fetched from Google until someone opens the game.
  expect(fontRequests).toEqual([]);
  await page.locator('.launcher').click();
  await expect.poll(() => fontRequests.length).toBe(1);
  await expect(page.locator('.menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toBeHidden();
  expect(await phase(page)).toBe('idle');
  expect(await pageHtml(page)).toBe(before);
});

test('clearing the page gives CLEAR! with a time bonus, and play again starts fresh', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/plain.html');
  const before = await pageHtml(page);
  await startRound(page);
  expect(
    await page.evaluate(() => window.__webToyboxDestroyer.targets.elements.map((e) => e.localName)),
  ).toEqual(['h1', 'p', 'a', 'li', 'li', 'button', 'div', 'input', 'button']);

  await destroyEverything(page);
  await expect(page.locator('.result h2')).toHaveText('CLEAR!');
  const result = await page.evaluate(() => window.__webToyboxDestroyer.authority.state.result);
  expect(result?.timeBonus).toBeGreaterThan(0);

  // Play again: the page is restored, rescanned and counted down again.
  await page.locator('.result button', { hasText: 'เล่นอีกครั้ง' }).click();
  expect(await phase(page)).toBe('countdown');
  const hidden = await page.evaluate(
    () =>
      [...document.querySelectorAll('body *')].filter((e) => (e as HTMLElement).style.visibility)
        .length,
  );
  expect(hidden).toBe(0);
  await expect.poll(() => phase(page), { timeout: 6000 }).toBe('playing');

  await page.keyboard.press('Escape');
  expect(await phase(page)).toBe('idle');
  expect(await pageHtml(page)).toBe(before);
  expect(errors).toEqual([]);
});

test('reads data-position and data-scope, and skips [data-wd-ignore]', async ({ page }) => {
  await page.goto('/options.html');
  const box = await page.locator('.launcher').boundingBox();
  expect(box!.x).toBeLessThan(40);
  expect(box!.y).toBeLessThan(40);
  await startRound(page);
  expect(
    await page.evaluate(() =>
      window.__webToyboxDestroyer.targets.elements.map((e) => e.textContent),
    ),
  ).toEqual(['Inside scope', 'Only this part can be destroyed.']);
});

test('falls back to defaults with a console warning for invalid options', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await page.goto('/invalid.html');
  await expect(page.locator('.launcher')).toBeVisible();
  await expect.poll(() => warnings.length).toBe(1);
  expect(warnings[0]).toContain('Unknown data-position "middle"');
  const box = await page.locator('.launcher').boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThan(viewport.width / 2); // bottom-right
  await startRound(page);
  expect(warnings.some((w) => w.includes('data-scope "#nope" matched nothing'))).toBe(true);
});

test('a page with nothing to destroy ends at once without a free bonus', async ({ page }) => {
  await page.goto('/empty.html');
  await page.locator('.launcher').click();
  await page.locator('.start').click();
  await expect(page.locator('.result h2')).toHaveText('CLEAR!', { timeout: 6000 });
  const result = await page.evaluate(() => window.__webToyboxDestroyer.authority.state.result);
  expect(result?.timeBonus).toBe(0);
});

test('items on the page: fly over to pick up, FULL keeps them, magnet pulls them in', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/plain.html');
  await startRound(page);
  const items = () => page.evaluate(() => window.__webToyboxDestroyer.authority.state.items.length);

  // With a full inventory the ship can't take it, and it stays on the page.
  await giveItems(page, ['bomb', 'bomb', 'bomb']);
  await dropItem(page, 900, 'laser');
  const pos = await itemPosition(page, 900);
  await page.mouse.move(pos.x, pos.y, { steps: 5 });
  await page.waitForTimeout(400);
  expect(await items()).toBe(1);

  // With room, flying over it picks it up.
  await giveItems(page, []);
  await page.mouse.move(pos.x + 60, pos.y + 60, { steps: 3 });
  await page.waitForTimeout(300);
  await page.mouse.move(pos.x, pos.y, { steps: 5 });
  await expect.poll(() => inventory(page)).toEqual(['laser']);
  expect(await items()).toBe(0);

  // The magnet pulls an item ~200 px away into the ship without moving there.
  await page.mouse.move(pos.x + 200, pos.y, { steps: 5 }); // away from where it will drop
  await page.waitForTimeout(500);
  await giveItems(page, ['magnet']);
  await page.keyboard.press('1');
  await dropItem(page, 901, 'rapid');
  await expect.poll(() => inventory(page), { timeout: 4000 }).toEqual(['rapid']);
  expect(errors).toEqual([]);
});
