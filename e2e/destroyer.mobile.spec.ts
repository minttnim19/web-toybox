import { expect, test, type CDPSession } from '@playwright/test';
import { giveItems, inventory, pageHtml, phase, startRound, trackErrors } from './helpers';

const touch = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });

test('touch: drag steers without scrolling, taps never navigate, slots use items', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/destroyer/');
  const before = await pageHtml(page);
  await startRound(page);
  const cdp = await page.context().newCDPSession(page);

  // Dragging a finger moves the ship; the page itself must not scroll natively.
  await touch(cdp, 'touchStart', 100, 420);
  for (let k = 0; k < 30; k++) {
    await touch(cdp, 'touchMove', 100 + (k % 10) * 20, 400 + Math.floor(k / 10) * 40);
    await page.waitForTimeout(30);
  }
  await touch(cdp, 'touchEnd');
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // Tapping a link only moves the ship.
  const link = await page.locator('.nav-links a').first().boundingBox();
  await touch(cdp, 'touchStart', link!.x + 4, link!.y + 4);
  await touch(cdp, 'touchEnd');
  await page.waitForTimeout(200);
  expect(new URL(page.url()).hash).toBe('');

  // Tapping an item slot uses that item.
  await giveItems(page, ['magnet', 'rapid']);
  await page.locator('.slot').nth(1).tap();
  expect(await inventory(page)).toEqual(['magnet']);

  await page.locator('.hud-top button', { hasText: 'ออก' }).tap();
  expect(await phase(page)).toBe('idle');
  expect(await pageHtml(page)).toBe(before);
  expect(errors).toEqual([]);
});
