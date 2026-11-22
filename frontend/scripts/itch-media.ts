// The page.evaluate callbacks run in the browser.
/// <reference lib="dom" />
/*
 * Writes the itch.io store page images to `itch/` at the repository root: the cover, the page banner
 * and five 1280x720 screenshots. The key art (`?cover`, `?banner`) and the runs (`?screen=<fixture>`)
 * are dev only, so this starts the Vite dev server and photographs it with Playwright.
 * Run it with `npm run itch:media` after changing the art, the cards or a screen.
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { createServer } from "vite";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const OUT = fileURLToPath(new URL("../../itch/", import.meta.url));

const ART = [
  { file: "cover.png", query: "cover", width: 630, height: 500 },
  { file: "banner.png", query: "banner", width: 960, height: 250 },
];

/** The screenshots, in the order the store page shows them. Each one is a real run from `src/ui/__fixtures__`. */
const SCREENSHOTS: { file: string; fixture: string; prepare?: (page: Page) => Promise<void> }[] = [
  { file: "screenshot-1-combat.png", fixture: "combat-infra-trio" },
  { file: "screenshot-2-map.png", fixture: "map" },
  { file: "screenshot-3-vendor.png", fixture: "shop" },
  { file: "screenshot-4-event.png", fixture: "event-sam", prepare: readWholeScene },
  { file: "screenshot-5-boss.png", fixture: "combat-boss-act2" },
];

/** Steps through the colleague's lines with the keyboard, as a player would, until the choices show. */
async function readWholeScene(page: Page): Promise<void> {
  const next = page.getByRole("button", { name: "Next", exact: true });
  while (await next.isVisible()) {
    await next.focus();
    await page.keyboard.press("Enter");
  }
  await page.locator(".event__choices").waitFor();
}

/** Waits until fonts and images are in, then drops focus so no focus ring shows. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const server = await createServer({ root: FRONTEND, logLevel: "warn", server: { host: "127.0.0.1", port: 5180, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) throw new Error("The dev server did not report a URL.");

  const browser = await chromium.launch();
  const problems: string[] = [];
  try {
    // Reduced motion turns the game's animations off, so nothing is caught mid-tween.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));

    for (const art of ART) {
      await page.setViewportSize({ width: art.width, height: art.height });
      await page.goto(`${base}?${art.query}`);
      const frame = page.locator(`[data-store-art="${art.query}"]`);
      await frame.waitFor();
      await settle(page);
      const box = await frame.boundingBox();
      if (box?.width !== art.width || box.height !== art.height) throw new Error(`${art.file} is ${box?.width}x${box?.height}, not ${art.width}x${art.height}.`);
      await frame.screenshot({ path: `${OUT}${art.file}` });
      console.log(`wrote itch/${art.file}`);
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    for (const shot of SCREENSHOTS) {
      // A fresh page each time, so one screen's state never leaks into the next.
      await page.goto("about:blank");
      await page.goto(`${base}?screen=${shot.fixture}`);
      await page.locator(".stage").waitFor();
      // An unknown fixture falls back to the title screen.
      if (await page.locator(".title-screen").count()) throw new Error(`No fixture "${shot.fixture}" in src/ui/__fixtures__.`);
      await settle(page);
      await shot.prepare?.(page);
      await settle(page);
      await page.screenshot({ path: `${OUT}${shot.file}` });
      console.log(`wrote itch/${shot.file}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (problems.length > 0) throw new Error(`The game reported problems:\n${problems.join("\n")}`);
}

await main();
