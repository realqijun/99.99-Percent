/* The first run: the guided first combat, played with the mouse and with the keyboard, and resumed after a reload. */
import type { FrameLocator, Page } from "@playwright/test";
import { budgetOf, expect, hand, openGame, reopenGame, tabTo, test } from "./support";

const SEED = "E2E1";

/** Title screen to the first combat of a fresh profile, with the mouse. */
async function startFirstRun(game: FrameLocator) {
  await game.getByRole("button", { name: "New run" }).click();
  await game.getByRole("button", { name: /^Jordan/ }).click();
  await game.getByRole("textbox", { name: "Seed" }).fill(SEED);
  await game.getByRole("button", { name: "Start run" }).click();
  await expect(game.getByRole("heading", { name: "Act 1" })).toBeVisible();
  await game.getByRole("button", { name: "Floor 1: Incident" }).first().click();
  await expect(game.getByRole("main", { name: "Combat" })).toBeVisible();
}

const combat = (game: FrameLocator) => game.getByRole("main", { name: "Combat" });
const rewards = (game: FrameLocator) => game.getByRole("heading", { name: "Rewards" });

/** Plays every Serve it can afford on the first enemy, then any other card, then ends the turn, until the fight is won. */
async function winByClicking(game: FrameLocator) {
  for (let turn = 1; turn <= 12; turn++) {
    await expect(game.getByRole("button", { name: /^End turn/ })).toBeEnabled();
    for (;;) {
      const serve = hand(game).getByRole("button", { name: /^\d+: Serve\+?, Serve/, disabled: false }).first();
      const other = hand(game).getByRole("button", { disabled: false }).first();
      if (await serve.count()) {
        await serve.click();
        await expect(serve).toHaveAttribute("aria-pressed", "true");
        await game.getByRole("button", { name: /^Target / }).first().click();
      } else if (await other.count()) {
        const label = (await other.getAttribute("aria-label")) ?? "";
        await other.click();
        // Untargeted cards play on a second click.
        if (!(await game.getByRole("button", { name: /^Target / }).count())) await other.click();
        else await game.getByRole("button", { name: /^Target / }).first().click();
        await expect(hand(game).getByRole("button", { name: label, exact: true })).toHaveCount(0);
      } else break;
      if (await rewards(game).isVisible()) return;
    }
    if (await rewards(game).isVisible()) return;
    await game.getByRole("button", { name: /^End turn/ }).click();
    if (await rewards(game).isVisible()) return;
  }
  throw new Error("The first combat didn't end");
}

test("a new run goes through the tutorial, the first combat with the mouse, the reward and back to the map", async ({ page }) => {
  const game = await openGame(page);
  await startFirstRun(game);

  // Maya walks through the hand, an intent, Capacity and End turn.
  const tutorial = game.getByRole("region", { name: /^Tutorial/ });
  for (const [step, line] of ["This is your hand", "This is what the incident does next", "Capacity soaks up requests", "End your turn"].entries()) {
    await expect(tutorial).toHaveAccessibleName(`Tutorial, step ${step + 1} of 4`);
    await expect(tutorial).toContainText(line);
    await tutorial.getByRole("button", { name: step === 3 ? "Got it" : "Next" }).click();
  }
  await expect(tutorial).toHaveCount(0);

  // The engine's card text and the enemy's intent are on screen.
  await expect(hand(game).getByRole("button", { name: /^\d+: Serve, Serve, costs 1\. Serve 6\.$/ }).first()).toBeVisible();
  await expect(game.getByRole("img", { name: /^Intent: / })).toBeVisible();

  await winByClicking(game);
  await expect(rewards(game)).toBeVisible();
  await expect(game.getByText("Incident resolved.")).toBeVisible();

  const cash = game.getByRole("button", { name: /^\d+ cash$/ });
  const amount = Number((await cash.getAttribute("aria-label"))!.split(" ")[0]);
  await cash.click();
  await expect(game.getByLabel(`${99 + amount} cash`)).toBeVisible();

  await game.getByRole("button", { name: "Add a card to your deck" }).click();
  const choice = game.getByRole("dialog", { name: "Choose a card" });
  await expect(choice.getByRole("button", { name: /^Take / })).toHaveCount(3);
  await choice.getByRole("button", { name: /^Take / }).first().click();
  await expect(game.getByRole("button", { name: "Deck, 11 cards" })).toBeVisible();

  // Any runbook reward is left behind.
  await game.getByRole("button", { name: /^(Continue|Leave the rest)$/ }).click();
  await expect(game.getByRole("button", { name: "Floor 1: Incident, you are here" })).toBeVisible();
  await expect(game.getByRole("button", { name: /^Floor 2: /, disabled: false }).first()).toBeVisible();
});

/** Plays the first combat with number keys, Enter and E only. */
async function winByKeyboard(page: Page, game: FrameLocator) {
  for (let turn = 1; turn <= 12; turn++) {
    await expect(game.getByRole("button", { name: /^End turn/ })).toBeEnabled();
    for (;;) {
      const playable = hand(game).getByRole("button", { disabled: false });
      if ((await playable.count()) === 0 || (await rewards(game).isVisible())) break;
      const label = (await playable.first().getAttribute("aria-label"))!;
      const played = game.getByRole("button", { name: /^Discard pile|^Decommissioned/ });
      const before = await played.evaluateAll((piles) => piles.map((p) => p.getAttribute("aria-label")).join());
      await page.keyboard.press(label.split(":")[0]);
      await expect(hand(game).getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Enter");
      if (await rewards(game).isVisible()) return;
      // The card left the hand for the discard pile or for good.
      await expect.poll(() => played.evaluateAll((piles) => piles.map((p) => p.getAttribute("aria-label")).join())).not.toBe(before);
    }
    if (await rewards(game).isVisible()) return;
    await page.keyboard.press("e");
    await expect(game.getByText(`Turn ${turn + 1}`).or(rewards(game))).toBeVisible();
    if (await rewards(game).isVisible()) return;
  }
  throw new Error("The first combat didn't end");
}

test("the first combat can be played with the keyboard alone", async ({ page }) => {
  const game = await openGame(page);
  // Title screen to the map with Tab and Enter.
  await tabTo(page, game.getByRole("button", { name: "New run" }));
  await page.keyboard.press("Enter");
  await tabTo(page, game.getByRole("textbox", { name: "Seed" }));
  await page.keyboard.type(SEED);
  await tabTo(page, game.getByRole("button", { name: "Start run" }));
  await page.keyboard.press("Enter");
  const first = game.getByRole("button", { name: "Floor 1: Incident" }).first();
  await tabTo(page, first);
  await page.keyboard.press("Enter");
  await expect(combat(game)).toBeVisible();

  const tutorial = game.getByRole("region", { name: /^Tutorial/ });
  for (const name of ["Next", "Next", "Next", "Got it"]) {
    await tabTo(page, tutorial.getByRole("button", { name }));
    await page.keyboard.press("Enter");
  }
  await expect(tutorial).toHaveCount(0);

  await winByKeyboard(page, game);
  await expect(rewards(game)).toBeVisible();
  await tabTo(page, game.getByRole("button", { name: "Leave the rest" }));
  await page.keyboard.press("Enter");
  await expect(game.getByRole("button", { name: "Floor 1: Incident, you are here" })).toBeVisible();
});

test("reloading mid-combat resumes the same hand, intents and Error Budget", async ({ page }) => {
  let game = await openGame(page);
  await startFirstRun(game);
  await game.getByRole("button", { name: "Skip tutorial" }).click();
  // Play a card and end a turn so the state is not the opening one.
  await hand(game).getByRole("button", { name: /Provision/ }).first().click();
  await hand(game).getByRole("button", { name: /Provision/, pressed: true }).click();
  await game.getByRole("button", { name: /^End turn/ }).click();
  await expect(game.getByText("Turn 2")).toBeVisible();

  const snapshot = async (g: FrameLocator) => ({
    hand: await hand(g).getByRole("button").evaluateAll((cards) => cards.map((c) => c.getAttribute("aria-label"))),
    intents: await g.getByRole("img", { name: /^Intent: / }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
    load: await g.getByRole("meter", { name: /Load$/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-valuenow"))),
    budget: await budgetOf(g),
    turn: await g.getByText(/^Turn \d+$/).textContent(),
  });
  const before = await snapshot(game);
  expect(before.hand.length).toBeGreaterThan(0);

  game = await reopenGame(page);
  await game.getByRole("button", { name: "Continue" }).click();
  await expect(combat(game)).toBeVisible();
  expect(await snapshot(game)).toEqual(before);
});
