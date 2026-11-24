/* Losing a run, and play when storage is blocked or the save is broken. */
import { engineRun, expect, hand, KEYS, openGame, play, readStorage, reopenGame, saved, test } from "./support";

test("losing all Error Budget ends the run with a summary, and the history lists it", async ({ page }) => {
  // The tutorial fight's Traffic Spike always attacks; with 1 Error Budget left its first hit ends the run.
  let run = engineRun({ seed: "LOSS", tutorial: true });
  run = play(run, { type: "chooseNode", node: Object.values(run.map.nodes).find((n) => n.floor === 1)!.id }, { type: "skipTutorial" });
  run.budget = 1;
  const game = await openGame(page, { storage: saved(run) });

  await game.getByRole("button", { name: "Continue" }).click();
  await game.getByRole("button", { name: /^End turn/ }).click();

  await expect(game.getByRole("heading", { name: "SLA breached" })).toBeVisible();
  await expect(game.getByText("Jordan at 99%, in Act 1, Seed Stage.")).toBeVisible();
  await expect(game.getByText("Seed LOSS")).toBeVisible();
  await expect(game.getByRole("region", { name: /^Final deck/ })).toContainText("Serve");

  await game.getByRole("button", { name: "Back to title" }).click();
  await expect(game.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(game.getByRole("button", { name: "New run" })).toBeVisible();
  expect(await readStorage(page, KEYS.run)).toBeNull();

  await game.getByRole("button", { name: "Run history (1)" }).click();
  const history = game.getByRole("dialog", { name: "Run history" });
  await expect(history.getByRole("row", { name: /Jordan 99% Breached Act 1 Seed Stage \d+ LOSS/ })).toBeVisible();
});

test("the game starts and plays when storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, name, {
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    }
  });
  const game = await openGame(page);
  await game.getByRole("button", { name: "New run" }).click();
  await game.getByRole("button", { name: "Start run" }).click();
  await game.getByRole("button", { name: "Floor 1: Incident" }).first().click();
  await game.getByRole("button", { name: "Skip tutorial" }).click();

  const serve = hand(game).getByRole("button", { name: /Serve, Serve/ }).first();
  await serve.click();
  await game.getByRole("button", { name: /^Target / }).first().click();
  await expect(game.getByRole("button", { name: "Discard pile, 1 card" })).toBeVisible();
  await game.getByRole("button", { name: /^End turn/ }).click();
  await expect(game.getByText("Turn 2")).toBeVisible();
});

test("a corrupt saved run moves to the broken-save slot, can be exported and can be discarded", async ({ page }) => {
  const corrupt = JSON.stringify({ version: 1, seed: "OOPS", screen: { kind: "nowhere" } });
  const game = await openGame(page, { storage: { [KEYS.run]: corrupt } });

  await expect(game.getByText("A saved run couldn't be loaded.")).toBeVisible();
  await expect(game.getByRole("button", { name: "Continue" })).toHaveCount(0);
  expect(await readStorage(page, KEYS.run)).toBeNull();
  expect(await readStorage(page, KEYS.broken)).toBe(corrupt);

  const download = page.waitForEvent("download");
  await game.getByRole("button", { name: "Export broken save" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("99.99-percent-broken-save.json");
  expect(await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString())).toBe(corrupt);

  // A new run still works and leaves the broken save alone.
  await game.getByRole("button", { name: "New run" }).click();
  await game.getByRole("button", { name: "Start run" }).click();
  await expect(game.getByRole("heading", { name: "Act 1" })).toBeVisible();
  expect(await readStorage(page, KEYS.broken)).toBe(corrupt);

  // The notice stays until the player discards the broken save, then never comes back.
  let title = await reopenGame(page);
  const notice = title.getByText("A saved run couldn't be loaded.");
  await expect(notice).toBeVisible();
  await title.getByRole("button", { name: "Discard" }).click();
  await expect(notice).toHaveCount(0);
  await expect(title.getByRole("button", { name: "Continue" })).toBeFocused();
  expect(await readStorage(page, KEYS.broken)).toBeNull();

  title = await reopenGame(page);
  await expect(title.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(title.getByText("A saved run couldn't be loaded.")).toHaveCount(0);
});
