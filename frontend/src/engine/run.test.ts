import { describe, expect, it } from "vitest";
import { applyCommand, canCancelDeckChoice, cantChoose, newRun, reachableNodes, retroRecoverAmount, shopPrice, validateRun } from "./index";
import { BOSS_NODE, FLOORS } from "./map";
import { cardChoices, combatRewards, makeShop } from "./rewards";
import { rand } from "./rng";
import { apply, candidateCommands, combat, FIXTURE, fixtureRun, ofType, setHand } from "./__fixtures__/helpers";
import type { Command, RunState, Screen } from "./types";

/** Wins the current combat at once. */
function winWithEvents(run: RunState) {
  for (const e of combat(run).enemies) e.load = 1;
  const [sweep] = setHand(run, ["sweep"]);
  return apply(run, { type: "playCard", uid: sweep });
}

const win = (run: RunState) => winWithEvents(run).run;

function enter(run: RunState, screen: Screen): RunState {
  run.screen = screen;
  return run;
}

/** Puts the player on a floor 15 node, ready to fight the boss. */
function atBoss(run: RunState): RunState {
  run.position = Object.values(run.map.nodes).find((n) => n.floor === FLOORS)!.id;
  run.screen = { kind: "map" };
  return apply(run, { type: "chooseNode", node: BOSS_NODE }).run;
}

describe("a new run", () => {
  it("starts with the character's deck, relic, budget and 99 cash", () => {
    const run = fixtureRun({ character: "taylor" });
    expect(run.deck.map((c) => c.id)).toEqual(FIXTURE.characters.taylor.starterDeck);
    expect(run.relics).toEqual([{ id: "postmortemCulture", counter: 0 }]);
    expect(run).toMatchObject({ budget: 70, maxBudget: 70, cash: 99, act: 1, position: null, screen: { kind: "map" }, result: null });
    expect(run.runbooks).toEqual([null, null, null]);
    expect(new Set(run.deck.map((c) => c.uid)).size).toBe(10);
  });

  it("adds a Tech Debt from 99.99%", () => {
    expect(fixtureRun({ difficulty: 1 }).deck.filter((c) => c.id === "techDebt")).toHaveLength(0);
    expect(fixtureRun({ difficulty: 2 }).deck.filter((c) => c.id === "techDebt")).toHaveLength(1);
  });

  it("is the same for the same seed and differs for another", () => {
    expect(fixtureRun({ seed: "a" })).toEqual(fixtureRun({ seed: "a" }));
    expect(fixtureRun({ seed: "a" }).map).not.toEqual(fixtureRun({ seed: "b" }).map);
  });
});

describe("commands", () => {
  it("never mutate their input", () => {
    let run = fixtureRun({ seed: "pure", tutorial: true });
    run.budget = run.maxBudget = 2000;
    const rng = { rngState: 42 };
    for (let step = 0; step < 600 && !run.result; step++) {
      const commands: Command[] = candidateCommands(run, rng);
      const before = structuredClone(run);
      const cmd = commands[Math.floor(rand(rng) * commands.length)];
      const result = applyCommand(run, cmd, FIXTURE);
      expect(run).toEqual(before);
      if (!result.error) run = result.run;
      else expect(result.events).toEqual([]);
    }
  });

  it("refuse cleanly", () => {
    const run = fixtureRun();
    for (const cmd of [{ type: "endTurn" }, { type: "chooseNode", node: BOSS_NODE }, { type: "rest" }, { type: "leave" }, { type: "takeTreasure" }] as Command[]) {
      const result = applyCommand(run, cmd, FIXTURE);
      expect(result.error).toBeTruthy();
      expect(result.run).toBe(run);
    }
  });

  it("abandon ends the run as lost, and nothing works after", () => {
    const { run, events } = apply(fixtureRun(), { type: "abandon" });
    expect(run.result).toBe("lost");
    expect(run.screen).toEqual({ kind: "summary" });
    expect(events).toEqual([{ type: "runLost" }]);
    expect(applyCommand(run, { type: "abandon" }, FIXTURE).error).toBeTruthy();
  });
});

describe("the path", () => {
  it("records the nodes visited this act, in order", () => {
    let run = fixtureRun();
    const first = reachableNodes(run)[0];
    run = apply(run, { type: "chooseNode", node: first }).run;
    expect(run.path).toEqual([first]);
    run = apply(win(run), { type: "leave" }).run;
    const second = reachableNodes(run)[0];
    const after = applyCommand(run, { type: "chooseNode", node: second }, FIXTURE).run;
    expect(after.path).toEqual([first, second]);
  });
});

describe("tutorial", () => {
  it("runs on the first Incident, steps forward, never blocks play and doesn't come back", () => {
    let run = fixtureRun({ tutorial: true });
    run = apply(run, { type: "chooseNode", node: reachableNodes(run)[0] }).run;
    let c = combat(run);
    expect(c.encounter).toBe("tutorial");
    expect(c.tutorial).toBe(0);
    expect(run.tutorial).toBeUndefined();
    const serve = c.hand.find((h) => h.id === "serve")!;
    run = apply(run, { type: "playCard", uid: serve.uid }).run;
    for (const step of [1, 2, 3]) {
      run = apply(run, { type: "advanceTutorial" }).run;
      expect(combat(run).tutorial).toBe(step);
    }
    run = apply(run, { type: "advanceTutorial" }).run;
    expect(combat(run).tutorial).toBeNull();
    expect(applyCommand(run, { type: "skipTutorial" }, FIXTURE).error).toBeTruthy();

    let skipped = fixtureRun({ tutorial: true });
    skipped = apply(skipped, { type: "chooseNode", node: reachableNodes(skipped)[0] }).run;
    skipped = apply(skipped, { type: "skipTutorial" }).run;
    expect(combat(skipped).tutorial).toBeNull();

    run = win(run);
    run = apply(run, { type: "leave" }).run;
    const next = reachableNodes(run).find((id) => run.map.nodes[id].kind === "incident");
    if (next) {
      c = combat(apply(run, { type: "chooseNode", node: next }).run);
      expect(c.encounter).not.toBe("tutorial");
      expect(c.tutorial).toBeNull();
    }
  });

  it("is off without the option", () => {
    let run = fixtureRun();
    run = apply(run, { type: "chooseNode", node: reachableNodes(run)[0] }).run;
    expect(combat(run).tutorial).toBeNull();
    expect(combat(run).encounter).not.toBe("tutorial");
  });
});

describe("rewards", () => {
  it("a won Incident offers cash, 3 cards and maybe a runbook", () => {
    let run = fixtureRun();
    run = win(apply(run, { type: "chooseNode", node: reachableNodes(run)[0] }).run);
    if (run.screen.kind !== "reward") throw new Error("no reward");
    const items = run.screen.items;
    const cash = items.find((i) => i.kind === "cash")!;
    expect(cash.kind === "cash" && cash.amount >= 10 && cash.amount <= 20).toBe(true);
    const cards = items.findIndex((i) => i.kind === "cards");
    const offer = items[cards];
    expect(offer.kind === "cards" && offer.choices.length).toBe(3);
    const deck = run.deck.length;
    expect(applyCommand(run, { type: "takeReward", index: cards }, FIXTURE).error).toBe("Choose a card");
    let next = apply(run, { type: "takeReward", index: cards, card: 1 }).run;
    expect(next.deck).toHaveLength(deck + 1);
    expect(applyCommand(next, { type: "takeReward", index: cards, card: 0 }, FIXTURE).error).toBeTruthy();
    next = apply(next, { type: "takeReward", index: items.indexOf(cash) }).run;
    expect(next.cash).toBe(99 + (cash.kind === "cash" ? cash.amount : 0));
    expect(apply(next, { type: "leave" }).run.screen).toEqual({ kind: "map" });
  });

  it("card choices can be skipped, and a full runbook bar refuses a runbook", () => {
    const run = enter(fixtureRun(), {
      kind: "reward",
      items: [
        { kind: "cards", choices: [], taken: false },
        { kind: "runbook", runbook: "hotPatch", taken: false },
      ],
    });
    run.runbooks = ["scaleUp", "scaleUp", "scaleUp"];
    expect(apply(run, { type: "skipCards", index: 0 }).run.screen).toMatchObject({ items: [{ taken: true }, { taken: false }] });
    expect(applyCommand(run, { type: "takeReward", index: 1 }, FIXTURE).error).toBe("Runbook slots are full");
    const freed = apply(run, { type: "discardRunbook", slot: 1 }).run;
    expect(apply(freed, { type: "takeReward", index: 1 }).run.runbooks).toEqual(["scaleUp", "hotPatch", "scaleUp"]);
  });

  it("Major Incidents add a relic, bosses offer only rares", () => {
    const run = fixtureRun();
    const elite = combatRewards(structuredClone(run), FIXTURE, "elite", 0);
    expect(elite.some((i) => i.kind === "relic")).toBe(true);
    const cash = elite.find((i) => i.kind === "cash");
    expect(cash?.kind === "cash" && cash.amount >= 25 && cash.amount <= 35).toBe(true);
    const boss = combatRewards(structuredClone(run), FIXTURE, "boss", 0);
    const cards = boss.find((i) => i.kind === "cards");
    expect(cards?.kind === "cards" && cards.choices.every((c) => FIXTURE.cards[c.id].rarity === "rare")).toBe(true);
    expect(boss.some((i) => i.kind === "runbook" || i.kind === "relic")).toBe(false);
  });

  it("each Reject cuts the cash by 15% of what is left; Bonus adds 25%", () => {
    const run = fixtureRun();
    const cashOf = (rejects: number, relics: string[] = []) => {
      const copy = structuredClone(run);
      copy.relics.push(...relics.map((id) => ({ id, counter: 0 })));
      const item = combatRewards(copy, FIXTURE, "boss", rejects).find((i) => i.kind === "cash");
      return item?.kind === "cash" ? item.amount : 0;
    };
    const base = cashOf(0);
    expect(cashOf(1)).toBe(Math.round(base * 0.85));
    expect(cashOf(2)).toBe(Math.round(base * 0.85 * 0.85));
    expect(cashOf(0, ["bonus"])).toBe(Math.round(base * 1.25));
  });

  it("drops a runbook about 40% of the time", () => {
    let drops = 0;
    for (let i = 0; i < 400; i++) if (combatRewards(fixtureRun({ seed: `rb-${i}` }), FIXTURE, "normal", 0).some((r) => r.kind === "runbook")) drops++;
    expect(drops / 400).toBeGreaterThan(0.33);
    expect(drops / 400).toBeLessThan(0.47);
  });

  it("the rare chance rises with each combat without a rare, and resets when one is offered", () => {
    const rares = (pity: number) => {
      let count = 0;
      for (let i = 0; i < 300; i++) {
        const run = fixtureRun({ seed: `pity-${i}` });
        run.rarePity = pity;
        count += cardChoices(run, FIXTURE, "normal").filter((c) => FIXTURE.cards[c.id].rarity === "rare").length;
      }
      return count;
    };
    expect(rares(20)).toBeGreaterThan(rares(0) * 3);
    const run = fixtureRun();
    run.rarePity = 5;
    cardChoices(run, FIXTURE, "boss");
    expect(run.rarePity).toBe(0);
    cardChoices(run, FIXTURE, "normal");
    expect(run.rarePity).toBeLessThanOrEqual(1);
  });

  it("Picky offers one more card", () => {
    const run = fixtureRun();
    run.relics.push({ id: "picky", counter: 0 });
    expect(cardChoices(run, FIXTURE, "normal")).toHaveLength(4);
  });
});

describe("vendor", () => {
  const shopRun = (relics: string[] = []) => {
    const run = fixtureRun();
    run.relics.push(...relics.map((id) => ({ id, counter: 0 })));
    return enter(run, { kind: "shop", shop: makeShop(run, FIXTURE) });
  };

  it("sells 5 character cards, 2 neutral cards, 3 relics and 3 runbooks at rarity prices", () => {
    const run = shopRun();
    if (run.screen.kind !== "shop") throw new Error();
    const { shop } = run.screen;
    expect(shop.cards.slice(0, 5).every((o) => FIXTURE.cards[o.card.id].pool === "jordan")).toBe(true);
    expect(shop.cards.slice(5).every((o) => FIXTURE.cards[o.card.id].pool === "neutral")).toBe(true);
    expect(shop.cards).toHaveLength(7);
    expect(shop.relics).toHaveLength(3);
    expect(shop.runbooks).toHaveLength(3);
    const base = { common: 50, uncommon: 75, rare: 150 } as Record<string, number>;
    for (const o of shop.cards) {
      const b = base[FIXTURE.cards[o.card.id].rarity];
      expect(o.basePrice).toBeGreaterThanOrEqual(Math.round(b * 0.95));
      expect(o.basePrice).toBeLessThanOrEqual(Math.round(b * 1.05));
    }
    expect(shop.removalBasePrice).toBe(75);
  });

  it("buys, refuses without cash, and removes a card for a rising price", () => {
    let run = shopRun();
    if (run.screen.kind !== "shop") throw new Error();
    const offer = run.screen.shop.cards[0];
    const bought = apply(run, { type: "buyCard", index: 0 }).run;
    expect(bought.cash).toBe(99 - offer.basePrice);
    expect(bought.deck.at(-1)).toEqual(offer.card);
    expect(applyCommand(bought, { type: "buyCard", index: 0 }, FIXTURE).error).toBe("Not for sale");
    run.cash = 10;
    expect(applyCommand(run, { type: "buyRelic", index: 0 }, FIXTURE).error).toBe("Not enough cash");
    run.cash = 200;
    run = apply(run, { type: "buyRemoval" }).run;
    expect(run.cash).toBe(125);
    expect(run.screen.kind).toBe("deckChoice");
    const card = run.deck[0];
    run = apply(run, { type: "chooseCards", uids: [card.uid] }).run;
    expect(run.deck.some((c) => c.uid === card.uid)).toBe(false);
    expect(run.screen).toMatchObject({ kind: "shop", shop: { removalUsed: true } });
    expect(applyCommand(run, { type: "buyRemoval" }, FIXTURE).error).toBe("Already used");
    expect(makeShop(run, FIXTURE).removalBasePrice).toBe(100);
    run.runbooks = ["scaleUp", "scaleUp", "scaleUp"];
    expect(applyCommand(run, { type: "buyRunbook", index: 0 }, FIXTURE).error).toBe("Runbook slots are full");
    expect(apply(run, { type: "leave" }).run.screen).toEqual({ kind: "map" });
  });

  it("backs out of a removal before a card is picked, with the price refunded", () => {
    const run = shopRun();
    run.cash = 200;
    const choosing = apply(run, { type: "buyRemoval" }).run;
    expect(canCancelDeckChoice(choosing)).toBe(true);
    const back = apply(choosing, { type: "cancel" }).run;
    expect(back.cash).toBe(200);
    expect(back.removals).toBe(0);
    expect(back.stats.cashEarned).toBe(run.stats.cashEarned);
    expect(back.deck).toEqual(run.deck);
    expect(back.screen).toEqual(run.screen);
    // The removal can still be bought this visit, at the same price.
    expect(apply(back, { type: "buyRemoval" }).run.cash).toBe(125);
    expect(applyCommand(run, { type: "cancel" }, FIXTURE).error).toBe("Nothing to cancel");
  });

  it("the Coupon discounts everything, removal included", () => {
    const run = shopRun(["coupon"]);
    if (run.screen.kind !== "shop") throw new Error();
    expect(shopPrice(run, run.screen.shop.removalBasePrice, FIXTURE)).toBe(60);
  });

  it("a discount bought at the Vendor applies to its other prices at once, removal included", () => {
    let run = shopRun();
    if (run.screen.kind !== "shop") throw new Error();
    run.screen.shop.relics[0] = { relic: "coupon", basePrice: 150, sold: false };
    run.cash = 1000;
    const card = run.screen.shop.cards[0].basePrice;
    run = apply(run, { type: "buyRelic", index: 0 }).run;
    expect(run.cash).toBe(850);
    expect(shopPrice(run, card, FIXTURE)).toBe(Math.round(card * 0.8));
    run = apply(run, { type: "buyCard", index: 0 }).run;
    expect(run.cash).toBe(850 - Math.round(card * 0.8));
    run = apply(run, { type: "buyRemoval" }).run;
    expect(run.cash).toBe(850 - Math.round(card * 0.8) - 60);
    expect(apply(run, { type: "cancel" }).run.cash).toBe(850 - Math.round(card * 0.8));
  });
});

describe("retro", () => {
  const retro = (difficulty: 0 | 3, relics: string[] = []) => {
    const run = enter(fixtureRun({ difficulty }), { kind: "retro", done: false });
    run.relics.push(...relics.map((id) => ({ id, counter: 0 })));
    run.budget = 10;
    return apply(run, { type: "rest" }).run;
  };

  it("shows what a rest would recover, capped at what is missing", () => {
    const run = fixtureRun({ difficulty: 3 });
    run.budget = 10;
    expect(retroRecoverAmount(run, FIXTURE)).toBe(Math.round(72 * 0.2));
    run.relics.push({ id: "spa", counter: 0 });
    expect(retroRecoverAmount(run, FIXTURE)).toBe(Math.round(72 * 0.3));
    run.budget = 70;
    expect(retroRecoverAmount(run, FIXTURE)).toBe(2);
  });

  it("rests for 30%, 20% at 99.999%, plus relics", () => {
    expect(retro(0).budget).toBe(10 + Math.round(72 * 0.3));
    expect(retro(3).budget).toBe(10 + Math.round(72 * 0.2));
    expect(retro(0, ["spa"]).budget).toBe(10 + Math.round(72 * 0.4));
    expect(applyCommand(retro(0), { type: "refactor" }, FIXTURE).error).toBeTruthy();
  });

  it("refactors one card", () => {
    let run = apply(enter(fixtureRun(), { kind: "retro", done: false }), { type: "refactor" }).run;
    expect(run.screen).toEqual({ kind: "deckChoice", action: "upgrade", then: { kind: "retro", done: true } });
    const debt = { uid: run.nextUid++, id: "techDebt", upgraded: false };
    run.deck.push(debt);
    expect(applyCommand(run, { type: "chooseCards", uids: [debt.uid] }, FIXTURE).error).toBeTruthy();
    run = apply(run, { type: "chooseCards", uids: [run.deck[0].uid] }).run;
    expect(run.deck[0].upgraded).toBe(true);
    expect(run.screen).toEqual({ kind: "retro", done: true });
  });

  it("backs out of a Refactor before a card is picked, and the Retro is still open", () => {
    const run = enter(fixtureRun(), { kind: "retro", done: false });
    run.budget = 10;
    const back = apply(apply(run, { type: "refactor" }).run, { type: "cancel" }).run;
    expect(back.screen).toEqual({ kind: "retro", done: false });
    expect(back.deck).toEqual(run.deck);
    expect(apply(back, { type: "rest" }).run.budget).toBeGreaterThan(10);
  });
});

describe("events", () => {
  const at = (event: string, edit: (run: RunState) => void = () => {}) => {
    const run = enter(fixtureRun(), { kind: "event", event, chosen: null });
    edit(run);
    return run;
  };

  it("checks requirements: more budget than asked, at least the cash", () => {
    expect(applyCommand(at("coffeeChat", (r) => (r.budget = 5)), { type: "eventChoice", index: 1 }, FIXTURE).error).toBeTruthy();
    expect(applyCommand(at("coffeeChat", (r) => (r.budget = 6)), { type: "eventChoice", index: 1 }, FIXTURE).error).toBeUndefined();
    expect(applyCommand(at("coffeeChat", (r) => (r.cash = 39)), { type: "eventChoice", index: 2 }, FIXTURE).error).toBeTruthy();
    expect(applyCommand(at("coffeeChat", (r) => (r.cash = 40)), { type: "eventChoice", index: 2 }, FIXTURE).error).toBeUndefined();
  });

  it("says why a choice can't be made, matching what eventChoice refuses", () => {
    expect(cantChoose(at("coffeeChat", (r) => (r.budget = 5)), 1, FIXTURE)).toBe("Needs more than 5 Error Budget");
    expect(cantChoose(at("coffeeChat", (r) => (r.budget = 6)), 1, FIXTURE)).toBeNull();
    expect(cantChoose(at("coffeeChat", (r) => (r.cash = 39)), 2, FIXTURE)).toBe("Needs 40 cash");
    expect(cantChoose(at("coffeeChat", (r) => (r.cash = 40)), 2, FIXTURE)).toBeNull();
    expect(cantChoose(at("coffeeChat"), 9, FIXTURE)).toBe("No such choice");
    expect(cantChoose(fixtureRun(), 0, FIXTURE)).toBe("No choice to make");
  });

  it("resolves every kind of outcome", () => {
    const cash = apply(at("coffeeChat"), { type: "eventChoice", index: 0 }).run;
    expect(cash.cash).toBe(129);
    expect(cash.screen).toEqual({ kind: "event", event: "coffeeChat", chosen: 0 });
    expect(applyCommand(cash, { type: "eventChoice", index: 1 }, FIXTURE).error).toBeTruthy();

    const rare = apply(at("coffeeChat"), { type: "eventChoice", index: 1 }).run;
    expect(rare.budget).toBe(67);
    expect(FIXTURE.cards[rare.deck.at(-1)!.id].rarity).toBe("rare");

    const removal = apply(at("coffeeChat"), { type: "eventChoice", index: 2 }).run;
    expect(removal.cash).toBe(59);
    expect(removal.screen).toMatchObject({ kind: "deckChoice", action: "remove", then: { kind: "event", chosen: 2 } });

    const healed = apply(at("coffeeChat", (r) => (r.budget = 50)), { type: "eventChoice", index: 3 }).run;
    expect(healed.budget).toBe(58);

    const max = apply(at("hackathon"), { type: "eventChoice", index: 0 }).run;
    expect([max.maxBudget, max.budget]).toEqual([77, 77]);

    const corners = apply(at("hackathon"), { type: "eventChoice", index: 1 }).run;
    expect(corners.deck.at(-1)!.id).toBe("techDebt");
    expect(FIXTURE.relics[corners.relics.at(-1)!.id].rarity).toBe("uncommon");

    let dup = apply(at("hackathon"), { type: "eventChoice", index: 3 }).run;
    // An event's card choice comes after its cost is paid, so it can't be backed out of.
    expect(canCancelDeckChoice(dup)).toBe(false);
    expect(applyCommand(dup, { type: "cancel" }, FIXTURE).error).toBe("This choice can't be cancelled");
    expect(dup.deck.at(-1)).toMatchObject({ id: "serve", upgraded: true });
    const first = dup.deck[9];
    dup = apply(dup, { type: "chooseCards", uids: [first.uid] }).run;
    expect(dup.deck.at(-1)).toMatchObject({ id: first.id, upgraded: false });
    expect(dup.deck.at(-1)!.uid).not.toBe(first.uid);

    const runbook = apply(at("vendorDemo"), { type: "eventChoice", index: 0 }).run;
    expect(runbook.runbooks.filter(Boolean)).toHaveLength(1);
    const named = apply(at("vendorDemo"), { type: "eventChoice", index: 1 }).run;
    expect(named.runbooks[0]).toBe("hotPatch");
    expect(named.relics.map((r) => r.id)).toContain("coupon");

    const shrink = apply(at("vendorDemo", (r) => (r.budget = 72)), { type: "eventChoice", index: 2 }).run;
    expect([shrink.maxBudget, shrink.budget]).toEqual([69, 69]);

    const fight = apply(at("vendorDemo"), { type: "eventChoice", index: 3 }).run;
    expect(combat(fight).encounter).toBe("a1flaky");
    const after = win(fight);
    expect(after.screen.kind).toBe("reward");
    expect(after.stats.elitesWon).toBe(1);
    expect(apply(after, { type: "leave" }).run.screen).toEqual({ kind: "map" });
  });

  it("blocks a choice that would do nothing, before its cost is paid", () => {
    const upgraded = (r: RunState) => r.deck.forEach((c) => (c.upgraded = true));
    const full = (r: RunState) => (r.runbooks = ["scaleUp", "scaleUp", "scaleUp"]);
    const empty = (r: RunState) => (r.deck = []);
    const allRelics = (r: RunState) => (r.relics = Object.keys(FIXTURE.relics).filter((id) => FIXTURE.relics[id].rarity !== "boss").map((id) => ({ id, counter: 0 })));
    const cases: [RunState, number, string][] = [
      [at("hackathon", upgraded), 2, "No card to upgrade"],
      [at("hackathon", empty), 3, "No card to duplicate"],
      [at("coffeeChat", empty), 2, "No card to remove"],
      [at("vendorDemo", full), 0, "No free runbook slot"],
      [at("vendorDemo", full), 1, "No free runbook slot"],
      [at("hackathon", allRelics), 1, "No relic left"],
    ];
    for (const [run, index, reason] of cases) {
      expect(cantChoose(run, index, FIXTURE)).toBe(reason);
      expect(applyCommand(run, { type: "eventChoice", index }, FIXTURE)).toMatchObject({ run, error: reason });
    }
    // A full slot can be freed, and then the runbook can be taken.
    const freed = apply(at("vendorDemo", full), { type: "discardRunbook", slot: 0 }).run;
    expect(cantChoose(freed, 0, FIXTURE)).toBeNull();
  });

  it("picks an unseen event for the act at an event node", () => {
    const run = fixtureRun();
    const node = Object.values(run.map.nodes).find((n) => n.kind === "event" && n.floor > 1)!;
    const parent = Object.values(run.map.nodes).find((n) => n.next.includes(node.id))!;
    run.position = parent.id;
    run.seenEvents = ["coffeeChat", "hackathon"];
    const after = apply(run, { type: "chooseNode", node: node.id }).run;
    expect(after.screen).toEqual({ kind: "event", event: "vendorDemo", chosen: null });
    expect(after.seenEvents).toContain("vendorDemo");
  });

  it("makes an event node an Incident once every event for the act is seen", () => {
    const run = fixtureRun();
    const node = Object.values(run.map.nodes).find((n) => n.kind === "event" && n.floor > 1)!;
    run.position = Object.values(run.map.nodes).find((n) => n.next.includes(node.id))!.id;
    run.seenEvents = ["coffeeChat", "hackathon", "vendorDemo"];
    const after = apply(run, { type: "chooseNode", node: node.id }).run;
    expect(combat(after)).toMatchObject({ tier: "normal" });
    expect(FIXTURE.encounters[combat(after).encounter]).toMatchObject({ act: 1, tier: "normal" });
    expect(after.seenEvents).toEqual(run.seenEvents);
    // The node stays an Event node, so the save still validates.
    expect(validateRun(JSON.parse(JSON.stringify(after)), FIXTURE)).not.toBeNull();
  });
});

describe("treasure, bosses and acts", () => {
  it("treasure gives a relic", () => {
    const run = fixtureRun();
    const node = Object.values(run.map.nodes).find((n) => n.floor === 9)!;
    run.position = Object.values(run.map.nodes).find((n) => n.next.includes(node.id))!.id;
    let after = apply(run, { type: "chooseNode", node: node.id }).run;
    if (after.screen.kind !== "treasure") throw new Error();
    const relic = after.screen.relic;
    after = apply(after, { type: "takeTreasure" }).run;
    expect(after.relics.map((r) => r.id)).toContain(relic);
    expect(applyCommand(after, { type: "takeTreasure" }, FIXTURE).error).toBeTruthy();
    expect(apply(after, { type: "leave" }).run.screen).toEqual({ kind: "map" });
  });

  it("a boss restores the budget, then offers boss relics, then the next act", () => {
    let run = fixtureRun({ character: "taylor" });
    run.budget = 20;
    run = atBoss(run);
    expect(combat(run).tier).toBe("boss");
    const won = win(run);
    expect(won.budget).toBe(won.maxBudget);
    run = apply(won, { type: "leave" }).run;
    if (run.screen.kind !== "bossRelic") throw new Error(run.screen.kind);
    expect(run.screen.choices).toHaveLength(3);
    expect(run.screen.choices.every((id) => FIXTURE.relics[id].rarity === "boss")).toBe(true);
    const picked = run.screen.choices[0];
    const { run: act2, events } = apply(run, { type: "pickBossRelic", index: 0 });
    expect(act2.relics.map((r) => r.id)).toContain(picked);
    expect(act2).toMatchObject({ act: 2, position: null, path: [], screen: { kind: "map" }, map: { act: 2 } });
    expect(ofType(events, "actComplete")).toEqual([{ type: "actComplete", act: 1 }]);
    expect(act2.stats.bossesWon).toBe(1);
  });

  it("the path taken through an act doesn't change the next act's map or boss", () => {
    const fights = new Set(["incident", "major"]);
    /** Climbs Act 1 by real commands, preferring fight nodes or avoiding them, then beats the boss. */
    const climb = (preferFights: boolean) => {
      let run = fixtureRun({ seed: "paths" });
      let fought = 0;
      while (run.act === 1) {
        if (run.screen.kind === "map") {
          const options = reachableNodes(run);
          const node = options.find((id) => fights.has(run.map.nodes[id].kind) === preferFights) ?? options[0];
          run = apply(run, { type: "chooseNode", node }).run;
        } else if (run.screen.kind === "combat") {
          fought += 1;
          run = win(run);
        } else if (run.screen.kind === "bossRelic") run = apply(run, { type: "pickBossRelic", index: 0 }).run;
        else run = apply(run, { type: "leave" }).run;
      }
      return { run, fought };
    };
    const a = climb(true);
    const b = climb(false);
    expect(a.fought).not.toBe(b.fought);
    expect(a.run.map).toEqual(b.run.map);
    expect(a.run.map.boss).toBe(b.run.map.boss);
  });

  it("beating the Act 3 boss wins the run", () => {
    let run = fixtureRun();
    run.act = 3;
    run.map.act = 3;
    run = atBoss(run);
    const { run: done, events } = winWithEvents(run);
    expect(done.result).toBe("won");
    expect(done.screen).toEqual({ kind: "summary" });
    expect(events.at(-1)).toEqual({ type: "runWon" });
  });
});

describe("relics outside combat", () => {
  it("max budget and runbook slot passives apply when gained", () => {
    const run = enter(fixtureRun(), { kind: "treasure", relic: "bigBudget", taken: false });
    const after = apply(run, { type: "takeTreasure" }).run;
    expect([after.maxBudget, after.budget]).toEqual([82, 82]);
    const binder = apply(enter(fixtureRun(), { kind: "treasure", relic: "binder", taken: false }), { type: "takeTreasure" }).run;
    expect(binder.runbooks).toHaveLength(4);
  });

  it("new runs work with the real starter relic ids", () => {
    const run = newRun({ seed: "x", character: "jordan", difficulty: 0, tutorial: false }, FIXTURE);
    expect(run.relics[0].id).toBe("monitoring");
  });
});
