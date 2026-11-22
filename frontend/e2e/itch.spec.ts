import { expect, openGame, test } from "./support";

// itch.io embeds the game in an iframe on its own page.
for (const [width, height] of [[1280, 720], [960, 540]] as const) {
  test(`loads inside a ${width}x${height} iframe from a sub-path and fits it`, async ({ page }) => {
    const game = await openGame(page, { size: [width, height] });
    await expect(game.getByRole("heading", { name: "99.99 Percent" })).toBeVisible();
    await game.locator("body").evaluate(() => document.fonts.ready);
    // The 1280x720 stage scales to fill the frame exactly.
    const stage = await game.locator(".stage").boundingBox();
    const frame = await page.locator("iframe").boundingBox();
    expect(Math.round(stage!.width)).toBe(width);
    expect(Math.round(stage!.height)).toBe(height);
    expect(Math.round(stage!.x - frame!.x)).toBe(0);
  });
}
