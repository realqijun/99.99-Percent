import { expect, test } from '@playwright/test';
import { GAME_URL } from '../playwright.config';

// itch.io embeds the game in an iframe on its own page.
test('loads inside a 1280x720 iframe from a sub-path', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error') failed.push(m.text()); });

  await page.setContent(`<iframe src="${GAME_URL}" width="1280" height="720" style="border:0"></iframe>`);
  const game = page.frameLocator('iframe');
  await expect(game.getByRole('heading', { name: '99.99 Percent' })).toBeVisible();
  await game.locator('body').evaluate(() => document.fonts.ready);
  expect(failed).toEqual([]);
});
