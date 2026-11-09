// Shared helpers for the destroyer end-to-end tests.
import { expect, type CDPSession, type Page } from '@playwright/test';

/** The parts of the game instance the tests look at (exposed as window.__webToyboxDestroyer). */
export interface TestGame {
  phase: 'idle' | 'menu' | 'countdown' | 'playing' | 'ended';
  elements: Element[];
  authority: {
    tick(dt: number): void;
    requestHit(request: { targetId: number; damage: number; playerId: string }): void;
    state: {
      duration: number;
      destroyedCount: number;
      targets: { id: number; destroyed: boolean }[];
      players: Record<string, { score: number; inventory: string[] }>;
      result: { reason: string; timeBonus: number } | null;
    };
  };
}

declare global {
  interface Window {
    __webToyboxDestroyer: TestGame;
  }
}

/** Collect uncaught page errors; assert it is empty at the end of a test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** The page's HTML without the widget's own elements (its host and the font stylesheet). */
export const pageHtml = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.outerHTML
      .replace(/<web-toybox-destroyer[^>]*><\/web-toybox-destroyer>/, '')
      .replace(/<link[^>]*data-web-toybox-fonts[^>]*>/, ''),
  );

export const phase = (page: Page) => page.evaluate(() => window.__webToyboxDestroyer.phase);

export const inventory = (page: Page) =>
  page.evaluate(() => [...window.__webToyboxDestroyer.authority.state.players.local!.inventory]);

/** Replace the local player's items (for testing item use without hunting for drops). */
export const giveItems = (page: Page, kinds: string[]) =>
  page.evaluate((k) => {
    window.__webToyboxDestroyer.authority.state.players.local!.inventory.splice(0, 9, ...k);
  }, kinds);

/** Open the menu, pick a round length (minutes) and wait through the countdown. */
export async function startRound(page: Page, minutes = 2): Promise<void> {
  await page.locator('.launcher').click();
  await expect(page.locator('.menu')).toBeVisible();
  await page.locator('.choices button', { hasText: `${minutes} นาที` }).click();
  await page.locator('.start').click();
  await expect.poll(() => phase(page)).toBe('countdown');
  await expect.poll(() => phase(page), { timeout: 6000 }).toBe('playing');
}

/** End the round by running out the clock. */
export const runOutTheClock = (page: Page) =>
  page.evaluate(() => window.__webToyboxDestroyer.authority.tick(10_000));

/** Destroy every target through the authority, innermost first. */
export const destroyEverything = (page: Page) =>
  page.evaluate(() => {
    const { authority } = window.__webToyboxDestroyer;
    for (let id = authority.state.targets.length - 1; id >= 0; id--)
      authority.requestHit({ targetId: id, damage: 999, playerId: 'local' });
  });

/** Press a key by physical position, with the character a Thai layout would type. */
export async function pressThaiKey(cdp: CDPSession, code: string, text: string): Promise<void> {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: text, text });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text });
}

/** Fly the ship around a region so it shoots whatever is there. */
export async function sweep(page: Page, points: [number, number][], rounds = 2): Promise<void> {
  for (let r = 0; r < rounds; r++)
    for (const [x, y] of points) {
      await page.mouse.move(x, y, { steps: 6 });
      await page.waitForTimeout(120);
    }
}
