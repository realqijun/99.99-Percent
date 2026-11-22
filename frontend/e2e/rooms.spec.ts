/* The rooms between combats, reached through engine-built saves and then used through the screen. */
import { CONTENT } from "../src/content";
import { cardText, retroRecoverAmount, type RunState } from "../src/engine";
import { budgetOf, engineRun, enter, expect, hand, openGame, play, saved, test } from "./support";

const deckButton = /^Deck, \d+ cards?$/;
const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

test("the Vendor sells a card and removes one", async ({ page }) => {
  const run = enter({ ...engineRun({ seed: "SHOP" }), cash: 400 }, "vendor");
  if (run.screen.kind !== "shop") throw new Error("not in a shop");
  const offer = run.screen.shop.cards[0];
  const name = CONTENT.cards[offer.card.id].name;
  const game = await openGame(page, { storage: saved(run) });
  await game.getByRole("button", { name: "Continue" }).click();

  await expect(game.getByRole("heading", { name: "Vendor" })).toBeVisible();
  await expect(game.getByText("You have 400 cash.")).toBeVisible();
  const buy = game.getByRole("button", { name: startsWith(`Buy ${name}, `) });
  await expect(buy).toHaveAccessibleName(new RegExp(`Price ${offer.price}\\.$`));
  await expect(buy).toContainText(cardText(CONTENT.cards[offer.card.id], false));
  await buy.click();
  await expect(game.getByText(`You have ${400 - offer.price} cash.`)).toBeVisible();
  await expect(game.getByRole("button", { name: "Deck, 11 cards" })).toBeVisible();
  await expect(buy).toBeDisabled();

  const price = run.screen.shop.removalPrice;
  await game.getByRole("button", { name: `Remove for ${price}` }).click();
  await expect(game.getByRole("heading", { name: "Remove a card" })).toBeVisible();
  await expect(game.getByRole("button", { name: "Remove", exact: true })).toBeDisabled();
  await game.getByRole("button", { name: /^Inspect, Ops/ }).click();
  await game.getByRole("button", { name: "Remove", exact: true }).click();

  await expect(game.getByRole("heading", { name: "Vendor" })).toBeVisible();
  await expect(game.getByText(`You have ${400 - offer.price - price} cash.`)).toBeVisible();
  await expect(game.getByRole("button", { name: "Done for this visit" })).toBeDisabled();
  await game.getByRole("button", { name: deckButton }).click();
  const deck = game.getByRole("dialog", { name: "Deck (10)" });
  await expect(deck.getByRole("listitem", { name: /^Inspect,/ })).toHaveCount(0);
  await expect(deck.getByRole("listitem", { name: startsWith(`${name},`) }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(deck).toHaveCount(0);

  await game.getByRole("button", { name: "Leave" }).click();
  await expect(game.getByRole("heading", { name: "Act 1" })).toBeVisible();
});

/** A run on a Retro with some Error Budget missing. */
function atRetro(seed: string): RunState {
  return enter({ ...engineRun({ seed }), budget: 30 }, "retro");
}

test("a Retro rest recovers the amount it shows", async ({ page }) => {
  const run = atRetro("REST");
  const amount = retroRecoverAmount(run);
  const game = await openGame(page, { storage: saved(run) });
  await game.getByRole("button", { name: "Continue" }).click();

  const rest = game.getByRole("button", { name: /^Rest/ });
  await expect(rest).toContainText(`Recover ${amount} Error Budget.`);
  await rest.click();
  await expect(game.getByText("Done. Back to work.")).toBeVisible();
  expect(await budgetOf(game)).toBe(30 + amount);
  await game.getByRole("button", { name: "Continue" }).click();
  await expect(game.getByRole("heading", { name: "Act 1" })).toBeVisible();
});

test("a Retro Refactor upgrades the chosen card, with a preview", async ({ page }) => {
  const game = await openGame(page, { storage: saved(atRetro("REFACTOR")) });
  await game.getByRole("button", { name: "Continue" }).click();
  await game.getByRole("button", { name: /^Refactor/ }).click();

  await expect(game.getByRole("heading", { name: "Refactor a card" })).toBeVisible();
  await game.getByRole("button", { name: /^Serve, Serve/ }).first().click();
  const preview = game.getByRole("complementary", { name: "Upgrade preview" });
  await expect(preview).toContainText("Serve 6.");
  await expect(preview).toContainText("Serve+");
  await expect(preview).toContainText("Serve 9.");
  await game.getByRole("button", { name: "Upgrade", exact: true }).click();

  await expect(game.getByText("Done. Back to work.")).toBeVisible();
  await game.getByRole("button", { name: deckButton }).click();
  await expect(game.getByRole("dialog", { name: "Deck (10)" }).getByRole("listitem", { name: /^Serve\+, Serve/ })).toHaveCount(1);
});

test("an event plays out its lines, takes a choice and shows the reply", async ({ page }) => {
  const run = enter({ ...engineRun({ seed: "EVENT" }), cash: 300 }, "event");
  if (run.screen.kind !== "event") throw new Error("not at an event");
  const event = CONTENT.events[run.screen.event];
  // The first choice with nothing to pick from the deck and no fight.
  const index = event.choices.findIndex((c) => c.outcomes.every((o) => o.op !== "chooseCard" && o.op !== "fight"));
  const choice = event.choices[index];
  const game = await openGame(page, { storage: saved(run) });
  await game.getByRole("button", { name: "Continue" }).click();

  const talk = game.getByRole("region", { name: event.title });
  await expect(talk.getByText(event.lines[0])).toBeVisible();
  for (let i = 1; i < event.lines.length; i++) {
    await talk.getByRole("button", { name: "Next" }).click();
    await expect(talk.getByText(event.lines[i])).toBeVisible();
  }
  // Keyboard focus moves to the choices when they appear.
  await expect(talk.getByRole("button", { name: startsWith(event.choices[0].label) })).toBeFocused();

  await talk.getByRole("button", { name: startsWith(choice.label) }).click();
  await expect(talk.getByText(`You: ${choice.label}`)).toBeVisible();
  await expect(talk.getByText(choice.reply)).toBeVisible();
  await talk.getByRole("button", { name: "Continue" }).click();
  await expect(game.getByRole("heading", { name: "Act 1" })).toBeVisible();
});

test("beating a boss offers boss relics, then the next act's map", async ({ page }) => {
  let run = engineRun({ seed: "BOSS" });
  run.position = Object.values(run.map.nodes).find((n) => n.floor === 15)!.id;
  run = play(run, { type: "chooseNode", node: "boss" });
  if (run.screen.kind !== "combat") throw new Error("not fighting the boss");
  for (const enemy of run.screen.combat.enemies) enemy.load = 1;
  run.budget = 20;
  const game = await openGame(page, { storage: saved(run) });
  await game.getByRole("button", { name: "Continue" }).click();

  await hand(game).getByRole("button", { name: /Serve, Serve/ }).first().click();
  await game.getByRole("button", { name: /^Target / }).first().click();
  await expect(game.getByRole("heading", { name: "Rewards" })).toBeVisible();
  await expect(game.getByText("Launch Day is resolved. Error Budget restored.")).toBeVisible();
  expect(await budgetOf(game)).toBe(72);

  await game.getByRole("button", { name: "Leave the rest" }).click();
  await expect(game.getByRole("heading", { name: "Pick a boss relic" })).toBeVisible();
  const relics = game.getByRole("button", { name: /^Take / });
  await expect(relics).toHaveCount(3);
  const name = (await relics.first().getAttribute("aria-label"))!.replace("Take ", "");
  await relics.first().click();

  await expect(game.getByRole("heading", { name: "Act 2" })).toBeVisible();
  await expect(game.getByRole("complementary").getByText("Series A")).toBeVisible();
  await expect(game.getByRole("list", { name: "Relics" }).getByRole("img", { name })).toBeVisible();
  await expect(game.getByRole("button", { name: /^Floor 1: Incident/, disabled: false }).first()).toBeVisible();
});
