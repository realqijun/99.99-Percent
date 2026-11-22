import { describe, expect, it } from "vitest";
import { cardText } from "./index";
import { apply, combat, FIXTURE, inCombat, ofType, setHand } from "./__fixtures__/helpers";
import type { CardDef, Effect } from "./types";

const text = (id: string, upgraded = false) => cardText(FIXTURE.cards[id], upgraded, undefined, undefined, FIXTURE);

describe("card text", () => {
  it("reads plainly", () => {
    expect(text("serve")).toBe("Serve 6.");
    expect(text("serve", true)).toBe("Serve 9.");
    expect(text("doubleTap")).toBe("Serve 3 twice.");
    expect(text("scatter")).toBe("Serve 3 to a random enemy, 3 times.");
    expect(text("sweep")).toBe("Serve 4 to all enemies.");
    expect(text("provision")).toBe("Gain 5 Capacity.");
    expect(text("shed")).toBe("Reject 10.");
    expect(text("inspect")).toBe("Apply 2 Exposed. Draw a card.");
    expect(text("exposeAll")).toBe("Apply 1 Exposed to all enemies.");
    expect(text("appServerCard")).toBe("Install App Server.");
    expect(text("dump")).toBe("Draw 2 cards. Discard a card.");
    expect(text("hotfix")).toBe("Gain 1 Engineer. Draw a card. Decommission.");
    expect(text("triage")).toBe("Recover 3 Error Budget. Remove your debuffs.");
    expect(text("profile")).toBe("Retain. Gain 2 Optimized.");
    expect(text("harden")).toBe("Innate. Gain 2 Hardened.");
    expect(text("flashSale")).toBe("Volatile. Serve 8.");
    expect(text("burst")).toBe("Once per Engineer spent: Serve 7.");
    expect(text("refile")).toBe("Put up to 1 card from your discard pile into your hand.");
    expect(text("debtSpiral")).toBe("Shuffle a Tech Debt into your draw pile. Add a Flash Sale+ to your hand. Add 2 Serve cards to your discard pile.");
    expect(text("tuneCache")).toBe("Install Cache Tuning. Warm the Read Cache by 2.");
    expect(text("fanOut")).toBe("Serve 2, plus 2 per kind of installed infrastructure.");
    expect(text("stackUp")).toBe("Gain 2 Capacity, plus 2 per stack of installed infrastructure.");
    expect(text("bodySlam")).toBe("Serve 1 per Capacity you have.");
    expect(text("vent")).toBe("Recover 1 Error Budget per Backlog you have. Recover 0.1 Error Budget per missing Error Budget.");
    expect(text("techDebt")).toBe("Unplayable.");
    expect(text("pager")).toBe("Unplayable. If it is still in your hand at the end of the turn, lose 2 Error Budget.");
    expect(text("configDrift")).toBe("Unplayable. Volatile. When you draw it, lose 1 Engineer.");
    expect(text("adaptive")).toContain("If the workload is write-heavy: Gain 3 Capacity.");
    expect(text("adaptive")).toContain("If you have a working Load Balancer: Gain 1 Capacity.");
    expect(text("adaptive")).toContain("If your hand is empty: Draw 2 cards.");
  });

  it("includes statuses when the combat is known", () => {
    const run = inCombat("tutorial", () => {}, { character: "taylor" });
    const c = combat(run);
    c.statuses = { optimized: 2, hardened: 3, latency: 1 };
    const key = c.enemies[0].key;
    c.enemies[0].statuses.exposed = 1;
    expect(cardText(FIXTURE.cards.serve, false, c, undefined, FIXTURE)).toBe("Serve 6.");
    expect(cardText(FIXTURE.cards.serve, false, c, key, FIXTURE)).toBe("Serve 9.");
    expect(cardText(FIXTURE.cards.provision, false, c, undefined, FIXTURE)).toBe("Gain 8 Capacity.");
    expect(cardText(FIXTURE.cards.shed, false, c, undefined, FIXTURE)).toBe("Reject 13.");
    c.infra.cdn = { stacks: 1, disabled: 0 };
    expect(cardText(FIXTURE.cards.fanOut, false, c, undefined, FIXTURE)).toBe("Serve 4 (2 plus 2 per kind of installed infrastructure).");
  });

  it("never disagrees with what a card does", () => {
    const simple = (effects: Effect[]) => effects.every((e) => (e.op === "serve" && e.target !== "randomEnemy") || e.op === "capacity" || e.op === "reject");
    const cards = Object.values(FIXTURE.cards).filter((card: CardDef) => card.effects.length > 0 && simple(card.effects) && simple(card.upgrade?.effects ?? []));
    expect(cards.length).toBeGreaterThan(8);
    for (const card of cards) {
      for (const upgraded of [false, true]) {
        const run = inCombat("tutorial", () => {}, { character: "taylor" });
        const c = combat(run);
        const [uid] = setHand(run, [card.id, "serve", "serve"]);
        c.hand[0].upgraded = upgraded;
        c.engineers = 2;
        c.capacity = 7;
        c.statuses = { optimized: 1, hardened: 2, latency: 1 };
        c.infra.cdn = { stacks: 2, disabled: 0 };
        const enemy = c.enemies[0];
        enemy.load = enemy.maxLoad = 500;
        enemy.statuses.exposed = 1;
        const words = cardText(card, upgraded, c, enemy.key, FIXTURE);
        const { run: after, events } = apply(run, { type: "playCard", uid, target: enemy.key });
        const serves = [...words.matchAll(/Serve (\d+)/g)].map((m) => Number(m[1]));
        const gains = [...words.matchAll(/(?:Gain (\d+) Capacity|Reject (\d+))/g)].map((m) => Number(m[1] ?? m[2]));
        const timesFor = (e: Effect) => (e.op === "serve" ? (e.times ?? 1) : 1);
        const effects = upgraded && card.upgrade?.effects ? card.upgrade.effects : card.effects;
        const repeat = card.cost === "x" ? 2 : 1;
        const expectedServes = Array.from({ length: repeat }, () => effects.filter((e) => e.op === "serve").flatMap((e, i) => Array(timesFor(e)).fill(serves[i]))).flat();
        expect(ofType(events, "serve").map((e) => e.amount), `${card.id} ${words}`).toEqual(expectedServes);
        const gained = combat(after).capacity - 7;
        expect(gained, `${card.id} ${words}`).toBe(gains.reduce((a, b) => a + b, 0) * repeat);
      }
    }
  });
});
