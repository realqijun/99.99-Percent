import { describe, expect, it } from "vitest";
import type { Act, CardDef, Effect, EnemyAi, EventOutcome, Tier } from "../engine/types";
import { CONTENT } from ".";
import { byId } from "./byId";

const { cards, enemies, encounters, relics, runbooks, events, characters } = CONTENT;
const ACTS: Act[] = [1, 2, 3];

/** Every effect, including those nested in `if`. */
function flatten(effects: Effect[] = []): Effect[] {
  return effects.flatMap((e) => (e.op === "if" ? [e, ...flatten(e.then)] : [e]));
}

function cardEffects(card: CardDef): Effect[] {
  return flatten([...card.effects, ...(card.upgrade?.effects ?? []), ...(card.endOfTurnInHand ?? []), ...(card.onDraw ?? [])]);
}

const allPlayerEffects: Effect[] = [
  ...Object.values(cards).flatMap(cardEffects),
  ...Object.values(relics).flatMap((r) => flatten([...(r.effects ?? []), ...(r.drawback ?? [])])),
  ...Object.values(runbooks).flatMap((r) => flatten(r.effects)),
];
const allOutcomes: EventOutcome[] = Object.values(events).flatMap((e) => e.choices.flatMap((c) => c.outcomes));

function aiMoves(ai: EnemyAi): string[] {
  switch (ai.kind) {
    case "cycle":
      return ai.moves;
    case "weighted":
      return Object.keys(ai.weights);
    case "script":
      return [...ai.opening, ...aiMoves(ai.then)];
    case "phases":
      return ai.phases.flatMap((p) => aiMoves(p.ai));
  }
}

/** Every string anywhere in the content tables. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => [k, ...strings(v)]);
  return [];
}

const playable = Object.values(cards).filter((c) => c.pool !== "status");
const inPool = (pool: CardDef["pool"]) => Object.values(cards).filter((c) => c.pool === pool && c.rarity !== "starter");
const rarities = (list: { rarity: string }[]) =>
  list.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.rarity]: (acc[c.rarity] ?? 0) + 1 }), {});

describe("ids", () => {
  it("match their record keys in every table", () => {
    for (const table of [cards, enemies, encounters, relics, runbooks, events, characters]) {
      for (const [key, value] of Object.entries(table)) expect(value.id, key).toBe(key);
    }
  });

  it("refuses duplicate ids", () => {
    expect(() => byId([{ id: "a" }, { id: "a" }])).toThrow(/Duplicate content id: a/);
  });

  it("are camelCase for cards", () => {
    for (const id of Object.keys(cards)) expect(id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
  });
});

describe("references", () => {
  it("point at real cards", () => {
    const refs = [
      ...Object.values(characters).flatMap((c) => c.starterDeck),
      ...allPlayerEffects.flatMap((e) => (e.op === "addCard" ? [e.card] : [])),
      ...Object.values(enemies).flatMap((e) => Object.values(e.moves).flatMap((m) => m.effects.flatMap((x) => (x.op === "addCard" ? [x.card] : [])))),
      ...allOutcomes.flatMap((o) => (o.op === "addCard" ? [o.card] : [])),
    ];
    expect(refs.length).toBeGreaterThan(0);
    for (const id of refs) expect(cards[id], id).toBeDefined();
  });

  it("point at real enemies, encounters, relics and runbooks", () => {
    for (const enc of Object.values(encounters)) for (const id of enc.enemies) expect(enemies[id], `${enc.id}: ${id}`).toBeDefined();
    for (const enemy of Object.values(enemies)) {
      for (const move of Object.values(enemy.moves)) {
        for (const e of move.effects) if (e.op === "summon") expect(enemies[e.enemy], `${enemy.id} summons ${e.enemy}`).toBeDefined();
      }
    }
    for (const o of allOutcomes) {
      if (o.op === "fight") expect(encounters[o.encounter], o.encounter).toBeDefined();
      if (o.op === "relic" && o.relic) expect(relics[o.relic], o.relic).toBeDefined();
      if (o.op === "runbook" && o.runbook) expect(runbooks[o.runbook], o.runbook).toBeDefined();
    }
    for (const c of Object.values(characters)) expect(relics[c.starterRelic], c.starterRelic).toBeDefined();
  });

  it("only uses AI moves an enemy has, and uses every move", () => {
    for (const enemy of Object.values(enemies)) {
      const used = aiMoves(enemy.ai);
      for (const move of used) expect(enemy.moves[move], `${enemy.id}.${move}`).toBeDefined();
      expect(new Set(used), enemy.id).toEqual(new Set(Object.keys(enemy.moves)));
    }
  });
});

describe("cards", () => {
  it("has the starters in the right pools", () => {
    expect(cards.serve).toMatchObject({ pool: "neutral", rarity: "starter", type: "attack", cost: 1 });
    expect(cards.provision).toMatchObject({ pool: "neutral", rarity: "starter", type: "skill", cost: 1 });
    expect(cards.inspect).toMatchObject({ pool: "jordan", rarity: "starter", type: "skill", cost: 0 });
    expect(cards.triage).toMatchObject({ pool: "taylor", rarity: "starter", type: "skill" });
    expect(characters.jordan.starterDeck).toHaveLength(10);
    expect(characters.taylor.starterDeck).toHaveLength(10);
    expect(relics.monitoring).toMatchObject({ rarity: "starter", pool: "jordan" });
    expect(relics.postmortemCulture).toMatchObject({ rarity: "starter", pool: "taylor" });
  });

  it("has unplayable status cards without upgrades", () => {
    for (const id of ["techDebt", "pager", "configDrift"]) {
      expect(cards[id]).toMatchObject({ pool: "status", rarity: "special", type: "status", cost: null });
      expect(cards[id].keywords).toContain("unplayable");
      expect(cards[id].upgrade).toBeUndefined();
    }
    expect(cards.pager.endOfTurnInHand).toEqual([{ op: "loseBudget", amount: 2 }]);
    expect(cards.configDrift.keywords).toContain("volatile");
    expect(cards.configDrift.onDraw).toEqual([{ op: "engineers", amount: -1 }]);
    expect(Object.values(cards).filter((c) => c.pool === "status")).toHaveLength(3);
  });

  it("gives every non-status card a real upgrade", () => {
    for (const card of playable) {
      expect(card.upgrade, card.id).toBeDefined();
      expect(Object.keys(card.upgrade ?? {}).length, card.id).toBeGreaterThan(0);
      expect(card.type, card.id).not.toBe("status");
      expect(card.cost, card.id).not.toBeNull();
    }
  });

  it("has the planned pool sizes and rarity split", () => {
    expect(inPool("jordan")).toHaveLength(30);
    expect(inPool("taylor")).toHaveLength(30);
    expect(inPool("neutral")).toHaveLength(20);
    expect(rarities(inPool("jordan"))).toEqual({ common: 14, uncommon: 11, rare: 5 });
    expect(rarities(inPool("taylor"))).toEqual({ common: 14, uncommon: 11, rare: 5 });
  });

  it("targets an enemy exactly when an effect needs one", () => {
    for (const card of playable) {
      const needs = flatten(card.effects).some((e) => (e.op === "serve" || e.op === "status") && e.target === "enemy");
      expect(card.target, card.id).toBe(needs ? "enemy" : "none");
    }
  });

  it("keeps flavour short", () => {
    for (const card of Object.values(cards)) if (card.flavor) expect(card.flavor.length, card.id).toBeLessThan(60);
  });
});

describe("enemies and encounters", () => {
  const required: Record<Act, Record<Tier, string[]>> = {
    1: { normal: ["trafficSpike", "slowQuery", "botCrawler", "memoryLeak", "coldStart", "logFlood"], elite: ["thunderingHerd", "lockContention"], boss: ["launchDay"] },
    2: { normal: ["cacheStampede", "retryStorm", "noisyNeighbor", "connectionLeak", "hotPartition", "flakyDeploy"], elite: ["ddosBotnet", "splitBrain"], boss: ["blackFriday"] },
    3: { normal: ["cascadingFailure", "certExpiry", "dnsOutage", "clockSkew", "zombieProcess", "configGhost"], elite: ["dataCorruption", "legacyMonolith"], boss: ["regionOutage"] },
  };
  const summonOnly = ["shopperWave", "failingZone"];

  it("has exactly the agreed enemy ids, each with its own sprite", () => {
    const expected = [...ACTS.flatMap((a) => Object.values(required[a]).flat()), ...summonOnly];
    expect(Object.keys(enemies).sort()).toEqual([...expected].sort());
    for (const act of ACTS) {
      for (const tier of ["normal", "elite", "boss"] as Tier[]) for (const id of required[act][tier]) expect(enemies[id].tier, id).toBe(tier);
    }
    for (const id of summonOnly) expect(enemies[id].tier).toBe("normal");
    for (const enemy of Object.values(enemies)) {
      expect(enemy.sprite).toBe(enemy.id);
      expect(enemy.description.length, enemy.id).toBeGreaterThan(0);
      expect(enemy.load[0], enemy.id).toBeLessThanOrEqual(enemy.load[1]);
      expect(Object.keys(enemy.moves).length, enemy.id).toBeGreaterThanOrEqual(2);
      expect(Object.keys(enemy.moves).length, enemy.id).toBeLessThanOrEqual(4);
    }
  });

  it("only meets summon-only enemies through summons", () => {
    const summoned = Object.values(enemies).flatMap((e) => Object.values(e.moves).flatMap((m) => m.effects.flatMap((x) => (x.op === "summon" ? [x.enemy] : []))));
    expect(new Set(summoned)).toEqual(new Set(["trafficSpike", "shopperWave", "failingZone"]));
    for (const enc of Object.values(encounters)) for (const id of summonOnly) expect(enc.enemies, enc.id).not.toContain(id);
  });

  it("gives every act enough normal, elite and boss encounters with mixed workloads", () => {
    for (const act of ACTS) {
      const of = (tier: Tier) => Object.values(encounters).filter((e) => e.act === act && e.tier === tier && e.weight > 0);
      expect(of("normal").length, `act ${act}`).toBeGreaterThanOrEqual(10);
      expect(of("elite").length, `act ${act}`).toBeGreaterThanOrEqual(3);
      expect(of("boss"), `act ${act}`).toHaveLength(1);
      expect(of("boss")[0].enemies).toEqual(required[act].boss);
      const workloads = new Set(Object.values(encounters).filter((e) => e.act === act && e.tier !== "boss").map((e) => e.workload));
      expect(workloads, `act ${act}`).toEqual(new Set(["read", "write"]));
      const sizes = new Set(of("normal").map((e) => e.enemies.length));
      expect([...sizes].sort(), `act ${act}`).toEqual([1, 2, 3]);
      for (const id of required[act].normal) expect(of("normal").some((e) => e.enemies.includes(id)), id).toBe(true);
      for (const id of required[act].elite) expect(of("elite").some((e) => e.enemies.includes(id)), id).toBe(true);
    }
  });

  it("keeps normal encounter Load near each act's target", () => {
    const cap: Record<Act, number> = { 1: 50, 2: 90, 3: 130 };
    for (const enc of Object.values(encounters).filter((e) => e.tier === "normal")) {
      const max = enc.enemies.reduce((sum, id) => sum + enemies[id].load[1], 0);
      expect(max, enc.id).toBeLessThanOrEqual(cap[enc.act]);
    }
  });

  it("has a gentle tutorial", () => {
    expect(encounters.tutorial).toEqual({ id: "tutorial", act: 1, tier: "normal", enemies: ["trafficSpike"], workload: "read", weight: 0 });
  });
});

describe("relics and runbooks", () => {
  it("has the planned relic counts", () => {
    expect(rarities(Object.values(relics))).toEqual({ starter: 2, common: 10, uncommon: 8, rare: 6, boss: 4, shop: 4 });
  });

  it("gives every relic text and something to do", () => {
    for (const relic of Object.values(relics)) {
      expect(relic.text.trim().length, relic.id).toBeGreaterThan(0);
      const hasEffects = (relic.effects?.length ?? 0) > 0;
      expect(hasEffects || (relic.passive?.length ?? 0) > 0, relic.id).toBe(true);
      expect(hasEffects, `${relic.id} trigger`).toBe(relic.trigger !== undefined);
    }
    for (const relic of Object.values(relics).filter((r) => r.rarity === "boss")) expect(relic.drawback?.length, relic.id).toBeGreaterThan(0);
  });

  it("has 10 runbooks with text", () => {
    expect(Object.keys(runbooks)).toHaveLength(10);
    for (const rb of Object.values(runbooks)) {
      expect(rb.text.trim().length, rb.id).toBeGreaterThan(0);
      expect(rb.effects.length, rb.id).toBeGreaterThan(0);
      const needs = flatten(rb.effects).some((e) => (e.op === "serve" || e.op === "status") && e.target === "enemy");
      expect(rb.target, rb.id).toBe(needs ? "enemy" : "none");
    }
  });
});

describe("events", () => {
  it("has 12 events with at least 3 per act", () => {
    expect(Object.keys(events)).toHaveLength(12);
    for (const act of ACTS) expect(Object.values(events).filter((e) => e.acts.includes(act)).length, `act ${act}`).toBeGreaterThanOrEqual(3);
  });

  it("uses only Maya, Alex and Sam, with short scenes", () => {
    for (const event of Object.values(events)) {
      expect(["maya", "alex", "sam"]).toContain(event.speaker);
      expect(event.lines.length, event.id).toBeGreaterThanOrEqual(2);
      expect(event.lines.length, event.id).toBeLessThanOrEqual(4);
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(2);
      expect(event.choices.length, event.id).toBeLessThanOrEqual(3);
      for (const choice of event.choices) {
        expect(choice.detail.length, `${event.id}: ${choice.label}`).toBeGreaterThan(0);
        expect(choice.reply.length, `${event.id}: ${choice.label}`).toBeGreaterThan(0);
      }
    }
  });

  it("asks for the cash or budget a choice spends", () => {
    for (const event of Object.values(events)) {
      for (const choice of event.choices) {
        for (const o of choice.outcomes) {
          if (o.op === "cash" && o.amount < 0) expect(choice.requires?.cash, `${event.id}: ${choice.label}`).toBeGreaterThanOrEqual(-o.amount);
          if (o.op === "budget" && o.amount < 0) expect(choice.requires?.budget, `${event.id}: ${choice.label}`).toBeGreaterThan(-o.amount);
        }
      }
    }
  });
});

describe("text", () => {
  it("has no em dashes and no misspelt game name", () => {
    for (const s of strings(CONTENT)) {
      expect(s, s).not.toMatch(/—/);
      expect(s, s).not.toMatch(/99\.9-Percent/);
    }
  });
});
