import { describe, expect, it } from "vitest";
import { applyCommand, RUN_VERSION, validateRun } from "./index";
import { FIXTURE, fixtureRun, inCombat, playRandomly } from "./__fixtures__/helpers";
import type { MapNode, RunState } from "./types";

const roundTrip = (run: RunState): unknown => JSON.parse(JSON.stringify(run));
const fightNode = (r: Record<string, any>): MapNode => Object.values(r.map.nodes as Record<string, MapNode>).find((n) => n.kind === "incident")!;

describe("validateRun", () => {
  // A whole run with a deep compare at every step; the default 5 second timeout is too tight under coverage.
  it("accepts saves from every screen after a JSON round trip, and play continues identically", { timeout: 120_000 }, () => {
    const { commands, start } = playRandomly("save", "jordan", 0, { budget: 3000 });
    const step = (r: RunState, i: number) => applyCommand(r, commands[i], FIXTURE).run;
    let run = start;
    const kinds = new Set<string>();
    for (let i = 0; i < commands.length; i++) {
      kinds.add(run.screen.kind);
      const saved = validateRun(roundTrip(run), FIXTURE);
      expect(saved, `${i} ${run.screen.kind}`).toEqual(run);
      const next = step(run, i);
      expect(step(saved!, i)).toEqual(next);
      run = next;
    }
    expect(validateRun(roundTrip(run), FIXTURE)).toEqual(run);
    for (const kind of ["map", "combat", "reward", "shop", "retro", "event", "treasure", "bossRelic", "deckChoice"]) expect(kinds).toContain(kind);
  });

  it("accepts a combat with a pending choice", () => {
    const run = inCombat("a1pair");
    if (run.screen.kind !== "combat") throw new Error();
    run.screen.combat.pending = { source: { kind: "card", uid: 1 }, from: "hand", count: 1, action: "discard", optional: false, rest: [{ op: "if", cond: { kind: "handEmpty" }, then: [{ op: "draw", amount: 1 }] }] };
    run.screen.combat.retained = [2];
    expect(validateRun(roundTrip(run), FIXTURE)).not.toBeNull();
  });

  it("rejects anything off", () => {
    const run = inCombat("a1noisy");
    const bad: [string, (r: Record<string, any>) => void][] = [
      ["other version", (r) => (r.version = RUN_VERSION + 1)],
      ["missing field", (r) => delete r.cash],
      ["extra field", (r) => (r.cheat = true)],
      ["wrong type", (r) => (r.budget = "72")],
      ["fractional", (r) => (r.cash = 1.5)],
      ["negative", (r) => (r.cash = -1)],
      ["budget over max", (r) => (r.budget = r.maxBudget + 1)],
      ["unknown character", (r) => (r.character = "sam")],
      ["unknown card", (r) => (r.deck[0].id = "nope")],
      ["unknown relic", (r) => (r.relics[0].id = "nope")],
      ["unknown runbook", (r) => (r.runbooks[0] = "nope")],
      ["unknown event", (r) => r.seenEvents.push("nope")],
      ["unknown screen", (r) => (r.screen = { kind: "casino" })],
      ["unknown encounter", (r) => (r.screen.combat.encounter = "nope")],
      ["unknown enemy", (r) => (r.screen.combat.enemies[0].id = "nope")],
      ["bad status", (r) => (r.screen.combat.statuses = { haste: 1 })],
      ["zero status", (r) => (r.screen.combat.statuses = { latency: 0 })],
      ["bad infra", (r) => (r.screen.combat.infra = { cdn: { stacks: 1 } })],
      ["bad tutorial", (r) => (r.screen.combat.tutorial = 4)],
      ["dangling map edge", (r) => Object.values(r.map.nodes as Record<string, { next: string[] }>)[0].next.push("99-9")],
      ["unknown position", (r) => (r.position = "99-9")],
      ["unknown path node", (r) => r.path.push("99-9")],
      ["path not ending at the position", (r) => r.path.push(Object.keys(r.map.nodes)[0])],
      ["missing path", (r) => delete r.path],
      ["unknown boss", (r) => (r.map.boss = "nope")],
      ["unknown node encounter", (r) => (fightNode(r).encounter = "nope")],
      ["node encounter of the wrong tier", (r) => (fightNode(r).encounter = "a1boss")],
      ["fight node without an encounter", (r) => delete fightNode(r).encounter],
      ["encounter on a non-fight node", (r) => (Object.values(r.map.nodes as Record<string, MapNode>).find((n) => n.kind === "treasure")!.encounter = "a1spike")],
      ["map act mismatch", (r) => (r.act = 2)],
      ["missing rng stream", (r) => delete r.rng.ai],
      ["uid not below nextUid", (r) => (r.nextUid = 1)],
      ["bad intent", (r) => (r.screen.combat.enemies[0].intent.kinds = ["dance"])],
    ];
    for (const [name, corrupt] of bad) {
      const data = roundTrip(run) as Record<string, any>;
      corrupt(data);
      expect(validateRun(data, FIXTURE), name).toBeNull();
    }
    for (const junk of [null, undefined, 3, "run", [], {}]) expect(validateRun(junk, FIXTURE)).toBeNull();
  });

  it("refuses ids missing from the content", () => {
    expect(validateRun(roundTrip(fixtureRun()), { ...FIXTURE, relics: {} })).toBeNull();
  });
});
