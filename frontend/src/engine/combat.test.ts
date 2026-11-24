import { describe, expect, it } from "vitest";
import { settleCombat } from "./combat";
import { applyCommand, cantPlay, choiceCards, costNow } from "./index";
import { apply, combat, enemyKeys, FIXTURE, force, inCombat, ofType, setHand } from "./__fixtures__/helpers";
import type { InfraId, RunState, Statuses } from "./types";

/** Taylor against one Practice Bot with 100 Load that idles unless told otherwise. */
function arena(edit: (run: RunState) => void = () => {}, encounter = "tutorial") {
  const run = inCombat(encounter, edit, { character: "taylor" });
  const c = combat(run);
  for (const e of c.enemies) {
    e.load = e.maxLoad = 100;
    if (e.id === "dummy") force(run, e.key, "idle");
  }
  return { run, key: c.enemies[0].key };
}

function install(run: RunState, infra: Partial<Record<InfraId, number>>): void {
  for (const [id, stacks] of Object.entries(infra)) {
    combat(run).infra[id as InfraId] = { stacks: stacks!, disabled: 0, ...(id === "readCache" ? { warmth: 1 } : {}) };
  }
}

const play = (run: RunState, uid: number, target?: number) => apply(run, { type: "playCard", uid, target });
const endTurn = (run: RunState) => apply(run, { type: "endTurn" });

describe("combat start", () => {
  it("shuffles the deck, draws 5, and Monitoring draws 1 more on turn 1", () => {
    const taylor = combat(inCombat("a1spike", () => {}, { character: "taylor" }));
    expect(taylor.hand).toHaveLength(5);
    expect(taylor.drawPile).toHaveLength(5);
    expect(taylor.engineers).toBe(3);
    const jordan = combat(inCombat("a1spike"));
    expect(jordan.hand).toHaveLength(6);
    expect(jordan.revealTurns).toBe(2);
    expect(jordan.enemies[0].upcoming).toHaveLength(2);
  });

  it("puts Innate cards in the opening hand and resolves relic drawbacks", () => {
    const run = inCombat("a1spike", (r) => {
      r.deck = Array.from({ length: 12 }, (_, i) => ({ uid: 100 + i, id: i === 11 ? "harden" : "serve", upgraded: false }));
      r.relics.push({ id: "slowStart", counter: 0 }, { id: "extraHands", counter: 0 });
    }, { character: "taylor" });
    const c = combat(run);
    expect(c.hand.map((h) => h.id)).toContain("harden");
    expect(c.statuses.latency).toBe(2);
    expect(c.engineers).toBe(5);
    expect([...c.hand, ...c.drawPile].filter((h) => h.id === "configDrift")).toHaveLength(1);
  });

  it("keeps Innate cards in the opening hand when drawbacks add cards to the draw pile", () => {
    for (let i = 0; i < 20; i++) {
      const run = inCombat("a1spike", (r) => {
        r.deck = Array.from({ length: 12 }, (_, j) => ({ uid: 100 + j, id: j < 5 ? "harden" : "serve", upgraded: false }));
        r.relics.push({ id: "extraHands", counter: 0 });
      }, { character: "taylor", seed: `innate${i}` });
      expect(combat(run).hand.map((h) => h.id), `seed innate${i}`).toEqual(Array(5).fill("harden"));
    }
  });

  it("scales enemy Load by difficulty and tier", () => {
    const load = (encounter: string, difficulty: 0 | 1 | 2 | 3) => combat(inCombat(encounter, () => {}, { difficulty, seed: "load" })).enemies[0].maxLoad;
    expect(load("a1boss", 3)).toBe(Math.round(80 * 1.2));
    expect(load("a1boss", 2)).toBe(80);
    expect(load("a1flaky", 1)).toBe(Math.round(load("a1flaky", 0) * 1.25));
    expect(load("a1spike", 2)).toBe(Math.round(load("a1spike", 1) * 1.1));
  });
});

describe("drawing", () => {
  it("reshuffles the discard pile when the draw pile runs out", () => {
    const { run } = arena();
    const [dump] = setHand(run, ["dump"], ["serve"]);
    combat(run).discardPile = [{ uid: 900, id: "provision", upgraded: false }];
    run.nextUid = 901;
    const { run: after, events } = play(run, dump);
    const c = combat(after);
    expect(ofType(events, "shuffle")).toHaveLength(1);
    expect(c.hand.map((h) => h.id).sort()).toEqual(["dump", "provision", "serve"]);
    expect(c.pending?.action).toBe("discard");
  });

  it("draws nothing when both piles are empty", () => {
    const { run } = arena();
    const [dump] = setHand(run, ["dump"]);
    const { run: after, events } = play(run, dump);
    expect(ofType(events, "shuffle")).toHaveLength(0);
    expect(ofType(events, "draw")).toHaveLength(0);
    expect(combat(after).pending).toBeNull();
    expect(combat(after).discardPile.map((h) => h.id)).toEqual(["dump"]);
  });

  it("stops at 10 cards in hand", () => {
    const { run } = arena();
    const uids = setHand(run, ["dump", ...Array(8).fill("serve")], ["serve", "serve", "serve"]);
    const after = play(run, uids[0]).run;
    expect(combat(after).hand).toHaveLength(10);
    expect(combat(after).drawPile).toHaveLength(2);
  });

  it("shuffles the discard pile at the start of a turn and fires shuffle relics", () => {
    const { run } = arena((r) => r.relics.push({ id: "shuffleBot", counter: 0 }));
    setHand(run, ["serve", "serve"]);
    combat(run).drawPile = [];
    const { run: after, events } = endTurn(run);
    expect(ofType(events, "shuffle")).toHaveLength(1);
    expect(combat(after).hand).toHaveLength(2);
    expect(combat(after).capacity).toBe(3);
  });
});

describe("playing cards", () => {
  it("spends Engineers and refuses what can't be paid or played", () => {
    const { run } = arena();
    const [serve, debt] = setHand(run, ["serve", "techDebt"]);
    combat(run).engineers = 0;
    expect(cantPlay(run, serve, FIXTURE)).toBe("Not enough Engineers");
    expect(cantPlay(run, debt, FIXTURE)).toBe("Unplayable");
    expect(costNow(run, serve, FIXTURE)).toBe(1);
    expect(costNow(run, debt, FIXTURE)).toBeNull();
    const refused = applyCommand(run, { type: "playCard", uid: serve }, FIXTURE);
    expect(refused.error).toBe("Not enough Engineers");
    expect(refused.run).toBe(run);
    expect(refused.events).toEqual([]);
  });

  it("needs a living target when there is more than one enemy", () => {
    const run = inCombat("a1pair");
    const [serve] = setHand(run, ["serve"]);
    expect(applyCommand(run, { type: "playCard", uid: serve }, FIXTURE).error).toBe("Choose a target");
    expect(applyCommand(run, { type: "playCard", uid: serve, target: 99 }, FIXTURE).error).toBe("Choose a target");
    const [a, b] = enemyKeys(run);
    const { events } = play(run, serve, b);
    expect(ofType(events, "serve")[0].enemy).toBe(b);
    expect(a).not.toBe(b);
  });

  it("resolves effects in order: Body Slam after Provision serves the new Capacity", () => {
    const { run, key } = arena();
    const [provision, slam] = setHand(run, ["provision", "bodySlam"]);
    const after = play(play(run, provision).run, slam, key);
    expect(ofType(after.events, "serve")[0].amount).toBe(5);
    expect(ofType(after.events, "cardPlayed")).toEqual([{ type: "cardPlayed", uid: slam, card: "bodySlam", upgraded: false }]);
  });

  it("X cost cards resolve once per Engineer spent", () => {
    const { run, key } = arena();
    const [burst, burst2] = setHand(run, ["burst", "burst"]);
    combat(run).engineers = 3;
    const first = play(run, burst, key);
    expect(ofType(first.events, "serve")).toHaveLength(3);
    expect(combat(first.run).engineers).toBe(0);
    expect(cantPlay(first.run, burst2, FIXTURE)).toBeNull();
    expect(ofType(play(first.run, burst2, key).events, "serve")).toHaveLength(0);
  });

  it("Decommission, power and Volatile cards leave the deck for the combat; Retain stays", () => {
    const { run } = arena();
    const [hotfix, cdn] = setHand(run, ["hotfix", "cdnCard", "flashSale", "profile", "serve"]);
    let next = play(play(run, hotfix).run, cdn).run;
    next = endTurn(next).run;
    const c = combat(next);
    expect(c.decommissioned.map((h) => h.id).sort()).toEqual(["cdnCard", "flashSale", "hotfix"]);
    expect(c.hand.map((h) => h.id)).toContain("profile");
    expect(c.discardPile.map((h) => h.id)).not.toContain("profile");
  });

  it("counts cards played before this one this turn", () => {
    const { run, key } = arena();
    const [p1, p2, combo] = setHand(run, ["provision", "provision", "combo"]);
    const after = play(play(play(run, p1).run, p2).run, combo, key);
    expect(ofType(after.events, "serve")[0].amount).toBe(2 + 3 * 2);
  });

  it("checks conditions when they are reached", () => {
    const { run } = arena((r) => (r.budget = 20), "a1pair");
    const [adaptive] = setHand(run, ["adaptive"], ["serve", "serve", "serve"]);
    install(run, { loadBalancer: 1 });
    const c = play(run, adaptive).run;
    // 2 base, +3 write-heavy, +1 Load Balancer, +1 an enemy attacks, +1 card for low budget, +2 cards for the empty hand.
    expect(combat(c).capacity).toBe(2 + 3 + 1 + (combat(run).enemies.some((e) => e.intent.kinds.includes("attack")) ? 1 : 0));
    // The low budget draws a card, so the hand isn't empty any more.
    expect(combat(c).hand).toHaveLength(1);
    const { run: full } = arena();
    const [again] = setHand(full, ["adaptive"], ["serve", "serve", "serve"]);
    expect(combat(play(full, again).run).hand).toHaveLength(2);
  });

  it("Reject gives Capacity and counts toward the cash cut", () => {
    const { run } = arena();
    const [shed] = setHand(run, ["shed"]);
    const c = combat(play(run, shed).run);
    expect(c.capacity).toBe(10);
    expect(c.rejects).toBe(1);
  });

  it("adds cards to each zone", () => {
    const { run } = arena();
    const [spiral] = setHand(run, ["debtSpiral"], ["serve", "serve"]);
    const { run: after, events } = play(run, spiral);
    const c = combat(after);
    expect(c.drawPile.filter((h) => h.id === "techDebt")).toHaveLength(1);
    expect(c.hand.find((h) => h.id === "flashSale")?.upgraded).toBe(true);
    expect(c.discardPile.filter((h) => h.id === "serve")).toHaveLength(2);
    expect(ofType(events, "cardAdded").map((e) => e.to)).toEqual(["draw", "hand", "discard", "discard"]);
  });

  it("gains cash and recovers budget scaled by Backlog and missing budget", () => {
    const { run } = arena((r) => (r.budget = 40), "tutorial");
    const [upsell, vent] = setHand(run, ["upsell", "vent"]);
    combat(run).statuses.backlog = 4;
    const cash = run.cash;
    const after = play(play(run, upsell).run, vent).run;
    expect(after.cash).toBe(cash + 5);
    expect(after.budget).toBe(40 + 4 + Math.floor(0.1 * (70 - 44)));
  });
});

describe("choices", () => {
  it("pauses for a choice, blocks other commands, then resolves the rest", () => {
    const { run } = arena();
    const [rollback, serve, debt] = setHand(run, ["rollback", "serve", "techDebt"]);
    const paused = play(run, rollback).run;
    const c = combat(paused);
    expect(c.pending).toMatchObject({ from: "hand", count: 1, action: "decommission", optional: false });
    expect(c.capacity).toBe(0);
    expect(applyCommand(paused, { type: "playCard", uid: serve }, FIXTURE).error).toBeDefined();
    expect(applyCommand(paused, { type: "endTurn" }, FIXTURE).error).toBeDefined();
    expect(applyCommand(paused, { type: "chooseCards", uids: [] }, FIXTURE).error).toBeDefined();
    expect(applyCommand(paused, { type: "chooseCards", uids: [rollback] }, FIXTURE).error).toBe("Invalid choice");
    expect(applyCommand(paused, { type: "chooseCards", uids: [serve, debt] }, FIXTURE).error).toBeDefined();
    const done = combat(apply(paused, { type: "chooseCards", uids: [debt] }).run);
    expect(done.pending).toBeNull();
    expect(done.decommissioned.map((h) => h.id)).toEqual(["techDebt"]);
    expect(done.capacity).toBe(4);
    expect(done.discardPile.map((h) => h.id)).toEqual(["rollback"]);
  });

  it("allows skipping an optional choice and skips a choice with no candidates", () => {
    const { run } = arena();
    const [refile, rollback] = setHand(run, ["refile", "rollback"]);
    combat(run).discardPile = [{ uid: 900, id: "serve", upgraded: false }];
    run.nextUid = 901;
    const paused = play(run, refile).run;
    expect(combat(paused).pending?.optional).toBe(true);
    const skipped = apply(paused, { type: "chooseCards", uids: [] }).run;
    expect(combat(skipped).hand.map((h) => h.id)).toEqual(["rollback"]);
    // Rollback alone: nothing else in hand, so it just gives its Capacity.
    const solo = play(skipped, rollback).run;
    expect(combat(solo).pending).toBeNull();
    expect(combat(solo).capacity).toBe(4);
  });

  it("moves, upgrades and retains chosen cards", () => {
    const { run } = arena();
    const [stash, polish, hold, a, b, cc] = setHand(run, ["stash", "polish", "hold", "serve", "serve", "serve"]);
    let next = apply(play(run, stash).run, { type: "chooseCards", uids: [a] }).run;
    expect(combat(next).drawPile[0].uid).toBe(a);
    next = apply(play(next, polish).run, { type: "chooseCards", uids: [b] }).run;
    expect(combat(next).hand.find((h) => h.uid === b)?.upgraded).toBe(true);
    next = apply(play(next, hold).run, { type: "chooseCards", uids: [cc] }).run;
    next = endTurn(next).run;
    expect(combat(next).hand.map((h) => h.uid)).toContain(cc);
    expect(combat(next).retained).toBeUndefined();
  });

  it("lists the cards a pending choice can pick: not the source, and only upgradable ones for an upgrade", () => {
    const { run } = arena();
    const [polish, serve, debt, done] = setHand(run, ["polish", "serve", "techDebt", "serve"]);
    combat(run).hand[3].upgraded = true;
    expect(choiceCards(run)).toEqual([]);
    const paused = play(run, polish).run;
    expect(choiceCards(paused, FIXTURE).map((h) => h.uid)).toEqual([serve]);
    expect(applyCommand(paused, { type: "chooseCards", uids: [debt] }, FIXTURE).error).toBe("Invalid choice");
    expect(applyCommand(paused, { type: "chooseCards", uids: [done] }, FIXTURE).error).toBe("Invalid choice");
  });

  it("works for runbooks too", () => {
    const { run } = arena((r) => (r.runbooks = ["incidentCall", "hotPatch", null]));
    const [serve] = setHand(run, ["serve"], ["provision", "provision"]);
    const paused = apply(run, { type: "useRunbook", slot: 0 }).run;
    expect(paused.runbooks[0]).toBeNull();
    expect(combat(paused).pending?.source).toEqual({ kind: "runbook", id: "incidentCall" });
    const done = combat(apply(paused, { type: "chooseCards", uids: [serve] }).run);
    expect(done.decommissioned.map((h) => h.uid)).toEqual([serve]);
    expect(done.hand.map((h) => h.id)).toEqual(["provision", "provision"]);
  });
});

describe("statuses", () => {
  const withStatuses = (player: Statuses, enemy: Statuses = {}) => {
    const { run, key } = arena();
    Object.assign(combat(run).statuses, player);
    Object.assign(combat(run).enemies[0].statuses, enemy);
    return { run, key };
  };
  const serveOnce = (player: Statuses, enemy: Statuses = {}) => {
    const { run, key } = withStatuses(player, enemy);
    const [serve] = setHand(run, ["serve"]);
    return ofType(play(run, serve, key).events, "serve")[0].amount;
  };
  const hitOnce = (player: Statuses, enemy: Statuses = {}) => {
    const { run, key } = withStatuses(player, enemy);
    setHand(run, []);
    force(run, key, "poke");
    const { run: after, events } = endTurn(run);
    return { amount: ofType(events, "hit")[0].amount, run: after };
  };

  it("Optimized, Latency and Exposed change Serve", () => {
    expect(serveOnce({})).toBe(6);
    expect(serveOnce({ optimized: 2 })).toBe(8);
    expect(serveOnce({ latency: 1 })).toBe(4);
    expect(serveOnce({}, { exposed: 1 })).toBe(9);
    expect(serveOnce({ optimized: 2, latency: 1 }, { exposed: 1 })).toBe(9);
  });

  it("Hardened adds to each card that gives Capacity", () => {
    const { run } = withStatuses({ hardened: 2 });
    const [provision, shed] = setHand(run, ["provision", "shed"]);
    expect(combat(play(play(run, provision).run, shed).run).capacity).toBe(7 + 12);
  });

  it("Scaling, Throttled and Degraded change incoming requests", () => {
    expect(hitOnce({}).amount).toBe(3);
    expect(hitOnce({}, { scaling: 5 }).amount).toBe(8);
    expect(hitOnce({}, { scaling: 5, throttled: 1 }).amount).toBe(6);
    expect(hitOnce({ degraded: 1 }, { scaling: 5 }).amount).toBe(12);
  });

  it("turn-counted statuses drop at the end of their owner's turn; whole-combat ones stay", () => {
    const { run } = hitOnce({ latency: 2, degraded: 2, optimized: 1, hardened: 1, reserved: 2 }, { throttled: 2, exposed: 2, scaling: 1, retries: 1 });
    const c = combat(run);
    expect(c.statuses).toEqual({ latency: 1, degraded: 1, optimized: 1, hardened: 1, reserved: 1 });
    expect(c.enemies[0].statuses).toEqual({ throttled: 1, exposed: 1, scaling: 1, retries: 1 });
  });

  it("Degraded gained during the enemies' turn lasts to their next turn", () => {
    const run = inCombat("a1pair", () => {}, { character: "taylor" });
    const [crawler, leak] = enemyKeys(run);
    force(run, crawler, "scrape");
    force(run, leak, "boot");
    setHand(run, []);
    const after = endTurn(run).run;
    expect(combat(after).statuses.degraded).toBe(1);
    force(after, crawler, "scan");
    const { run: later, events } = endTurn(after);
    expect(ofType(events, "hit")[0].amount).toBe(Math.floor(4 * 1.5));
    expect(combat(later).statuses.degraded).toBeUndefined();
  });

  it("Backlog burns budget at the start of your turn, then drops by 1", () => {
    const { run } = withStatuses({ backlog: 3 });
    const budget = run.budget;
    const after = endTurn(run).run;
    expect(after.budget).toBe(budget - 3);
    expect(combat(after).statuses.backlog).toBe(2);
  });

  it("Reserved keeps Capacity through the next reset only", () => {
    const { run } = arena();
    const [reserve] = setHand(run, ["reserve"]);
    let next = play(run, reserve).run;
    expect(combat(next).statuses.reserved).toBe(1);
    next = endTurn(next).run;
    expect(combat(next).capacity).toBe(6);
    expect(combat(next).statuses.reserved).toBeUndefined();
    next = endTurn(next).run;
    expect(combat(next).capacity).toBe(0);
  });

  it("Retries regains Load at the end of the enemy's turn, up to its max", () => {
    const { run, key } = withStatuses({}, { retries: 4 });
    combat(run).enemies[0].load = 90;
    const after = endTurn(run).run;
    expect(combat(after).enemies.find((e) => e.key === key)!.load).toBe(94);
  });

  it("an enemy's Buffer absorbs Serve and resets at the start of the enemies' turn", () => {
    const { run, key } = arena();
    combat(run).enemies[0].buffer = 4;
    const [serve] = setHand(run, ["serve"]);
    const { run: after, events } = play(run, serve, key);
    expect(ofType(events, "serve")[0]).toMatchObject({ amount: 6, absorbed: 4 });
    expect(combat(after).enemies[0].load).toBe(98);
    expect(combat(endTurn(after).run).enemies[0].buffer).toBe(0);
  });

  it("keeps Buffer an ally gave earlier in the enemies' turn until the player's next turn", () => {
    const run = inCombat("a1noisy");
    const [noisy, spike] = enemyKeys(run);
    force(run, noisy, "shield");
    force(run, spike, "rampUp");
    setHand(run, []);
    const c = combat(endTurn(run).run);
    expect(c.phase).toBe("player");
    expect(c.enemies.find((e) => e.key === spike)!.buffer).toBe(10);
  });

  it("removes debuffs", () => {
    const { run } = withStatuses({ backlog: 2, latency: 1, degraded: 3, optimized: 2 });
    const [triage] = setHand(run, ["triage"]);
    expect(combat(play(run, triage).run).statuses).toEqual({ optimized: 2 });
  });

  it("enemy allies effects skip the enemy using the move", () => {
    const run = inCombat("a1noisy");
    const [noisy, spike] = enemyKeys(run);
    force(run, noisy, "share");
    force(run, spike, "rampUp");
    setHand(run, []);
    const c = combat(endTurn(run).run);
    expect(c.enemies.find((e) => e.key === noisy)!.statuses.scaling).toBeUndefined();
    expect(c.enemies.find((e) => e.key === spike)!.statuses.scaling).toBe(4);
  });
});

describe("infrastructure", () => {
  const nextTurn = (infra: Partial<Record<InfraId, number>>, edit: (run: RunState) => void = () => {}, encounter = "tutorial") => {
    const { run, key } = arena(edit, encounter);
    install(run, infra);
    setHand(run, []);
    for (const e of combat(run).enemies) force(run, e.key, e.id === "dummy" ? "idle" : Object.keys(FIXTURE.enemies[e.id].moves)[0]);
    return { ...endTurn(run), key };
  };

  it("Read Cache warms by 1 a turn up to 6, or more with Cache Tuning", () => {
    let { run } = nextTurn({ readCache: 1 });
    const gains: number[] = [combat(run).capacity];
    for (let i = 0; i < 6; i++) {
      run = endTurn(run).run;
      gains.push(combat(run).capacity);
    }
    expect(gains).toEqual([1, 2, 3, 4, 5, 6, 6]);
    install(run, { cacheTuning: 1 });
    run = endTurn(endTurn(endTurn(run).run).run).run;
    expect(combat(run).capacity).toBe(8);
  });

  it("Read Cache is halved when write-heavy, unless a relic stops it", () => {
    const write = (relics: string[]) => {
      const { run } = arena((r) => r.relics.push(...relics.map((id) => ({ id, counter: 0 }))), "a1pair");
      install(run, { readCache: 1 });
      combat(run).infra.readCache!.warmth = 5;
      setHand(run, []);
      for (const e of combat(run).enemies) force(run, e.key, "boot");
      return combat(endTurn(run).run).capacity;
    };
    expect(write([])).toBe(2);
    expect(write(["writeThrough"])).toBe(5);
  });

  it("App Servers need a Load Balancer", () => {
    expect(combat(nextTurn({ appServer: 2 }).run).capacity).toBe(0);
    expect(combat(nextTurn({ appServer: 2, loadBalancer: 1 }).run).capacity).toBe(8);
  });

  it("CDN, Autoscaler and Message Queue", () => {
    expect(combat(nextTurn({ cdn: 2 }).run).capacity).toBe(4);
    const { run } = arena();
    install(run, { autoscaler: 1, messageQueue: 1 });
    setHand(run, []);
    combat(run).enemies[0].statuses.scaling = 7;
    force(run, combat(run).enemies[0].key, "poke");
    combat(run).capacity = 12;
    // Capacity 12 absorbs the hit of 10, the queue keeps the 2 left, and the Autoscaler adds nothing (no budget lost).
    let next = endTurn(run).run;
    expect(combat(next).capacity).toBe(2);
    force(next, combat(next).enemies[0].key, "poke");
    combat(next).capacity = 0;
    next = endTurn(next).run;
    // 10 burned last round, capped at 6.
    expect(combat(next).capacity).toBe(6);
  });

  it("Read Replica serves a random enemy, halved when write-heavy", () => {
    expect(ofType(nextTurn({ readReplica: 2 }).events, "serve")[0].amount).toBe(6);
    expect(ofType(nextTurn({ readReplica: 2 }, () => {}, "a1pair").events, "serve")[0].amount).toBe(3);
  });

  const failure = (infra: Partial<Record<InfraId, number>>) => {
    const { run } = arena(() => {}, "a1flaky");
    install(run, infra);
    setHand(run, []);
    force(run, combat(run).enemies[0].key, "fail");
    return endTurn(run);
  };

  it("Node Failure disables a piece for 2 turns, keeping its stacks", () => {
    const { run, events } = failure({ cdn: 3 });
    expect(ofType(events, "nodeFailure")[0]).toEqual({ type: "nodeFailure", infra: "cdn", prevented: false });
    expect(combat(run).infra.cdn).toEqual({ stacks: 3, disabled: 2 });
    expect(combat(run).capacity).toBe(0);
    const later = (r: RunState) => {
      for (const e of combat(r).enemies) force(r, e.key, "storm");
      return endTurn(r).run;
    };
    const t2 = later(run);
    expect(combat(t2).capacity).toBe(0);
    expect(combat(later(t2)).capacity).toBe(6);
  });

  it("Health Checks shorten it to 1 turn; Failover prevents it once per stack", () => {
    const checked = failure({ healthChecks: 1 });
    expect(combat(checked.run).infra.healthChecks?.disabled).toBe(1);
    const failover = failure({ failover: 1, cdn: 1 });
    expect(ofType(failover.events, "nodeFailure")[0].prevented).toBe(true);
    expect(combat(failover.run).infra.failover).toBeUndefined();
    expect(combat(failover.run).infra.cdn?.disabled).toBe(0);
  });

  it("disabled pieces do nothing and Repair brings them back", () => {
    const { run } = arena();
    install(run, { cdn: 1 });
    combat(run).infra.cdn!.disabled = 2;
    const [repair] = setHand(run, ["repairCrew"]);
    const after = play(run, repair).run;
    expect(combat(after).infra.cdn?.disabled).toBe(0);
  });

  it("Circuit Breaker throttles an enemy that burns budget, through its next turn", () => {
    const { run, key } = arena();
    install(run, { circuitBreaker: 1 });
    setHand(run, []);
    force(run, key, "poke");
    const after = endTurn(run).run;
    expect(combat(after).enemies[0].statuses.throttled).toBe(1);
    combat(after).enemies[0].statuses.scaling = 5;
    force(after, key, "poke");
    expect(ofType(endTurn(after).events, "hit")[0].amount).toBe(6);
  });

  it("Auto Remediation removes a stack of your worst debuff", () => {
    const { run: r2 } = arena();
    install(r2, { autoRemediation: 2 });
    combat(r2).statuses = { latency: 2, degraded: 4 };
    setHand(r2, []);
    expect(combat(endTurn(r2).run).statuses).toEqual({ latency: 1, degraded: 1 });
  });

  it("On-Call Rotation draws a card and gives Capacity when you draw a Pager", () => {
    const { run } = arena();
    install(run, { onCall: 1 });
    setHand(run, [], ["pager", "serve", "serve", "serve", "serve", "serve", "serve"]);
    const after = combat(endTurn(run).run);
    expect(after.hand).toHaveLength(6);
    expect(after.capacity).toBe(3);
  });

  it("installing again adds a stack", () => {
    const { run } = arena();
    const [a, b] = setHand(run, ["cdnCard", "cdnCard"]);
    const { events, run: after } = play(play(run, a).run, b);
    expect(combat(after).infra.cdn?.stacks).toBe(2);
    expect(ofType(events, "infra")).toEqual([{ type: "infra", infra: "cdn", stacks: 2 }]);
  });
});

describe("status cards", () => {
  it("Pager burns 2 at the end of the turn, Config Drift costs an Engineer and is Volatile", () => {
    const { run } = arena();
    setHand(run, ["pager", "techDebt"], ["configDrift", "serve", "serve", "serve", "serve"]);
    const budget = run.budget;
    const after = endTurn(run).run;
    const c = combat(after);
    expect(after.budget).toBe(budget - 2);
    expect(c.engineers).toBe(2);
    const final = combat(endTurn(after).run);
    expect(final.decommissioned.map((h) => h.id)).toEqual(["configDrift"]);
  });
});

describe("intents", () => {
  it("previewed hits equal the requests actually sent", () => {
    for (const seed of ["i1", "i2", "i3", "i4", "i5"]) {
      let run = inCombat("a1noisy", () => {}, { seed });
      for (let turn = 0; turn < 6 && run.screen.kind === "combat"; turn++) {
        const c = combat(run);
        c.capacity = 1000;
        if (turn % 2 === 0) c.statuses.degraded = 1;
        c.enemies[0].statuses.throttled = turn % 3 === 0 ? 1 : 0;
        if (!c.enemies[0].statuses.throttled) delete c.enemies[0].statuses.throttled;
        setHand(run, []);
        // Settle intents with the edited statuses, as every command does.
        settleCombat({ run, c, content: FIXTURE, events: [] });
        const preview = combat(run).enemies.filter((e) => !e.resolved).map((e) => [e.key, e.intent.hit] as const);
        const { run: next, events } = endTurn(run);
        for (const [key, hit] of preview) {
          const hits = ofType(events, "hit").filter((h) => h.enemy === key).map((h) => h.amount);
          expect(hits).toEqual(hit ? Array(hit.times).fill(hit.amount) : []);
        }
        run = next;
      }
    }
  });

  it("revealed intents are the moves actually made", () => {
    let run = inCombat("a1noisy", () => {}, { seed: "reveal" });
    const c = combat(run);
    const key = c.enemies[0].key;
    const planned = [c.enemies[0].intent.move, ...c.enemies[0].upcoming.map((i) => i.move)];
    expect(planned).toHaveLength(3);
    const made: string[] = [];
    for (let i = 0; i < 3; i++) {
      combat(run).capacity = 1000;
      setHand(run, []);
      const { run: next, events } = endTurn(run);
      made.push(ofType(events, "enemyMove").find((e) => e.enemy === key)!.move);
      run = next;
    }
    expect(made).toEqual(planned);
  });

  it("follows each AI kind", () => {
    // Script then cycle: the leak boots first.
    const pair = combat(inCombat("a1pair"));
    expect(pair.enemies[1].intent.move).toBe("boot");
    expect(pair.enemies[1].upcoming.map((i) => i.move)).toEqual(["drip", "clog"]);
    // Weighted with maxRepeat 2: never three of a kind in a row.
    let run = inCombat("a1pair", () => {}, { seed: "weights" });
    const moves: string[] = [];
    for (let i = 0; i < 30; i++) {
      combat(run).capacity = 1000;
      for (const e of combat(run).enemies) e.load = e.maxLoad;
      setHand(run, []);
      const { run: next, events } = endTurn(run);
      moves.push(ofType(events, "enemyMove")[0].move);
      run = next;
    }
    for (let i = 2; i < moves.length; i++) expect(moves[i] === moves[i - 1] && moves[i] === moves[i - 2]).toBe(false);
    // Phases: below half Load the boss opens its new phase with Go Viral.
    let boss = inCombat("a1boss", () => {}, { character: "taylor" });
    const b = combat(boss).enemies[0];
    expect(b.intent.move).toBe("frontPage");
    b.load = 30;
    b.intent = { move: "signups", kinds: ["attack"], hit: null };
    b.upcoming = [];
    combat(boss).capacity = 1000;
    setHand(boss, []);
    boss = endTurn(boss).run;
    expect(combat(boss).enemies[0].intent.move).toBe("enrage");
  });

  it("summons join the fight with their own intents", () => {
    const run = inCombat("a1boss");
    const key = combat(run).enemies[0].key;
    force(run, key, "callSpike");
    combat(run).capacity = 100;
    setHand(run, []);
    const { run: after, events } = endTurn(run);
    expect(ofType(events, "summon")).toHaveLength(1);
    const spike = combat(after).enemies[1];
    expect(spike.id).toBe("spike");
    expect(spike.intent.move).toBe("burst");
  });
});

describe("relics in combat", () => {
  it("fire on their triggers, every Nth time when they have a counter", () => {
    const { run, key } = arena((r) =>
      r.relics.push(...["coffee", "nightly", "whetstone", "clipboard", "blueprint", "alarm", "trophy"].map((id) => ({ id, counter: 0 }))),
    );
    combat(run).enemies[0].load = 6;
    const [provision, cdn, serve] = setHand(run, ["provision", "cdnCard", "serve"], ["serve"]);
    let next = play(run, provision).run;
    expect(combat(next).capacity).toBe(5 + 1);
    next = play(next, cdn).run;
    expect(combat(next).hand).toHaveLength(2);
    const cash = next.cash;
    const won = play(next, serve, key).run;
    expect(won.cash).toBe(cash + 3);
    expect(won.screen.kind).toBe("reward");
  });

  it("fires budgetLost and turnEnd relics", () => {
    const { run, key } = arena((r) => r.relics.push({ id: "alarm", counter: 0 }, { id: "nightly", counter: 0 }));
    setHand(run, []);
    combat(run).enemies[0].statuses.scaling = 10;
    force(run, key, "poke");
    // Nightly gives 2 Capacity at turn end, the hit of 13 burns 11, Alarm adds 2 that is then reset.
    const { events } = endTurn(run);
    expect(ofType(events, "hit")[0]).toMatchObject({ amount: 13, absorbed: 2, budgetLost: 11 });
    expect(ofType(events, "relic").map((e) => e.relic)).toEqual(["nightly", "alarm"]);
  });

  it("starting Capacity is there on turn 1", () => {
    const run = inCombat("a1spike", (r) => r.relics.push({ id: "preWarm", counter: 0 }), { character: "taylor" });
    expect(combat(run).capacity).toBe(6);
  });

  it("Coffee gives an Engineer every third turn", () => {
    let { run } = arena((r) => r.relics.push({ id: "coffee", counter: 0 }));
    const engineers = [combat(run).engineers];
    for (let i = 0; i < 3; i++) {
      setHand(run, []);
      combat(run).engineers = 0;
      run = endTurn(run).run;
      engineers.push(combat(run).engineers);
    }
    expect(engineers).toEqual([3, 3, 4, 3]);
  });
});

describe("ending a combat", () => {
  it("wins when every enemy is resolved and Postmortem Culture recovers 4", () => {
    const { run, key } = arena((r) => (r.budget = 50));
    combat(run).enemies[0].load = 5;
    const [serve] = setHand(run, ["serve"]);
    const { run: after, events } = play(run, serve, key);
    expect(after.screen.kind).toBe("reward");
    expect(after.budget).toBe(54);
    expect(after.stats.combatsWon).toBe(1);
    expect(events.map((e) => e.type)).toContain("combatWon");
  });

  it("loses when Error Budget reaches 0", () => {
    const { run, key } = arena((r) => (r.budget = 2));
    setHand(run, []);
    force(run, key, "poke");
    const { run: after, events } = endTurn(run);
    expect(after.result).toBe("lost");
    expect(after.budget).toBe(0);
    expect(after.screen.kind).toBe("summary");
    expect(events.at(-1)).toEqual({ type: "runLost" });
  });
});
