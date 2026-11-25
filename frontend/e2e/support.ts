/*
 * Shared setup for the browser journeys. The game runs from the itch.io-like sub-path inside an iframe,
 * on a host page of the same origin so a test can seed localStorage before the game loads.
 * Every test fails on console errors, page errors and failed requests.
 */
import { expect, test as base, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { GAME_URL } from "../playwright.config";
import { applyCommand, newRun, type Command, type NewRunOptions, type RunState } from "../src/engine";

export const KEYS = { run: "n9999.run", profile: "n9999.profile", settings: "n9999.settings", broken: "n9999.run.broken" } as const;

const HOST_URL = new URL("host.html", GAME_URL).href;

export const test = base.extend<{ problems: string[] }>({
  problems: [async ({ page }, use) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    page.on("requestfailed", (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText ?? ""}`));
    page.on("response", (r) => {
      if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
    });
    // The host page stands in for itch.io's page around the game.
    await page.route(HOST_URL, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Host</title><body style='margin:0;background:#000'></body>" }));
    await use(problems);
    expect(problems).toEqual([]);
  }, { auto: true }],
});

export { expect };

/** Opens the host page, optionally seeding storage first, and loads the game in an iframe of this size. */
export async function openGame(page: Page, { storage = {}, size = [1280, 720] }: { storage?: Record<string, string>; size?: [number, number] } = {}): Promise<FrameLocator> {
  await page.goto(HOST_URL);
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);
  return mountGame(page, size);
}

/** Puts the game's iframe on the host page and waits for the game to draw. */
export async function mountGame(page: Page, [width, height]: [number, number] = [1280, 720]): Promise<FrameLocator> {
  await page.evaluate(
    ({ src, width, height }) => {
      const frame = document.createElement("iframe");
      Object.assign(frame, { src, width: String(width), height: String(height), title: "99.99 Percent" });
      frame.style.border = "0";
      document.body.append(frame);
    },
    { src: GAME_URL, width, height },
  );
  const game = page.frameLocator("iframe");
  await expect(game.locator(".stage")).toBeVisible();
  return game;
}

/** Closes the game and opens it again, as leaving the tab and coming back does. */
export async function reopenGame(page: Page): Promise<FrameLocator> {
  await page.reload();
  return mountGame(page);
}

export async function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

// ---------- runs built with the engine ----------

/** A new run, as the title screen starts it. */
export function engineRun(opts: Partial<NewRunOptions> = {}): RunState {
  return newRun({ seed: "E2E", character: "jordan", difficulty: 0, tutorial: false, ...opts });
}

/** Applies commands that must all be accepted. */
export function play(run: RunState, ...commands: Command[]): RunState {
  for (const command of commands) {
    const result = applyCommand(run, command);
    if (result.error) throw new Error(`${JSON.stringify(command)}: ${result.error}`);
    run = result.run;
  }
  return run;
}

/** Storage for a run in progress, with the tutorial already done. */
export function saved(run: RunState): Record<string, string> {
  return { [KEYS.run]: JSON.stringify(run), [KEYS.profile]: JSON.stringify({ unlocked: { jordan: 0, taylor: 0 }, history: [], tutorialDone: true }) };
}

/** Turns every node the run can move to next into this room, then moves to the first one. */
export function enter(run: RunState, kind: "event" | "vendor" | "retro" | "treasure"): RunState {
  const next = structuredClone(run);
  const ids = next.position === null ? Object.values(next.map.nodes).filter((n) => n.floor === 1).map((n) => n.id) : next.map.nodes[next.position].next;
  for (const id of ids) {
    next.map.nodes[id].kind = kind;
    // Only fight nodes hold an encounter.
    delete next.map.nodes[id].encounter;
  }
  return play(next, { type: "chooseNode", node: ids[0] });
}

// ---------- the game's own controls ----------

export const hand = (game: FrameLocator) => game.getByRole("group", { name: /^Hand/ });

/** The Error Budget shown in the top bar, as a number. */
export async function budgetOf(game: FrameLocator): Promise<number> {
  const label = await game.getByLabel(/^Error Budget \d+ of \d+$/).getAttribute("aria-label");
  return Number(/(\d+) of/.exec(label ?? "")?.[1]);
}

/** Presses Tab until the locator has focus. */
export async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
