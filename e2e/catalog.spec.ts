import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

test('the catalog lists destroyer, copies its embed code and links to its guide', async ({
  page,
  context,
}) => {
  const errors = trackErrors(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');

  // The catalog is a list, not a playground: no widget is embedded here.
  await expect(page.locator('.widget')).toHaveCount(1);
  await expect(page.locator('web-toybox-destroyer')).toHaveCount(0);

  await page.locator('.widget [data-copy]').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(
    '<script src="https://minttnim19.github.io/web-toybox/v0.1.0/destroyer.js" defer></script>',
  );
  await expect(page.locator('.widget [data-copy]')).toHaveText('คัดลอกแล้ว');

  await page.locator('.widget .btn', { hasText: 'ดูคู่มือ' }).click();
  await expect(page).toHaveURL(/\/destroyer\/$/);
  await expect(page.locator('.launcher')).toBeVisible();
  expect(errors).toEqual([]);
});
