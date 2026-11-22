/*
 * Runs for every screen, built with the real engine and content so names, card text and intents are the
 * ones players see. Dev only: `?screen=<name>` shows one, and UI tests start from them.
 */
import { CONTENT } from "../../content";
// Engine internals rather than ../../engine, so tests that mock the engine's API can still use these.
import { settleCombat, startCombat } from "../../engine/combat";
import { reachableNodes } from "../../engine/map";
import { makeShop } from "../../engine/rewards";
import { createRun } from "../../engine/run";
import type { CardInstance, CombatState, RunState, Screen } from "../../engine/types";

const BASE: RunState = (() => {
  const run = createRun({ seed: "FX7Q2M", character: "jordan", difficulty: 1, tutorial: false }, CONTENT);
  run.budget = 54;
  run.cash = 123;
  run.relics.push({ id: "espressoMachine", counter: 0 }, { id: "goldenSignals", counter: 2 });
  run.runbooks = ["rollback", "killQuery", null];
  for (const [id, upgraded] of [["serve", true], ["loadBalancer", true], ["blueGreen", false], ["readCache", false]] as const) {
    run.deck.push({ uid: run.nextUid++, id, upgraded });
  }
  return run;
})();

/** A path up the map, following the first branch each time. */
const PATH: string[] = (() => {
  const path = [reachableNodes(BASE)[0]];
  while (path.length < 15) path.push(BASE.map.nodes[path[path.length - 1]].next[0]);
  return path;
})();

const STATS = { floorsClimbed: 3, combatsWon: 2, elitesWon: 0, bossesWon: 0, budgetLost: 18, cashEarned: 34, cardsPlayed: 41, turns: 9 };

function run(screen: Screen, over: Partial<RunState> = {}): RunState {
  return { ...structuredClone(BASE), position: PATH[2], path: PATH.slice(0, 3), stats: STATS, screen, ...over };
}

const card = (r: RunState, id: string, upgraded = false): CardInstance => ({ uid: r.nextUid++, id, upgraded });

/** A run inside a real combat of this encounter; `edit` sets up the hand, statuses and so on, then intents are refreshed. */
function inCombat(encounter: string, edit: (c: CombatState, r: RunState) => void = () => {}, over: Partial<RunState> = {}): RunState {
  const r = run({ kind: "map" }, over);
  startCombat(r, encounter, CONTENT, [], false);
  if (r.screen.kind !== "combat") throw new Error(`No combat for ${encounter}`);
  const c = r.screen.combat;
  edit(c, r);
  settleCombat({ run: r, c, content: CONTENT, events: [] });
  return r;
}

const hand = (r: RunState, ids: string[], upgraded: number[] = []) => ids.map((id, i) => card(r, id, upgraded.includes(i)));

/** Turn 2 of a fight with two Bot Crawlers, a typical hand and a little Capacity. */
const typical = (c: CombatState, r: RunState) => {
  c.turn = 2;
  c.capacity = 4;
  c.statuses = { optimized: 1 };
  c.hand = hand(r, ["serve", "serve", "provision", "loadBalancer", "inspect"], [3]);
  c.discardPile = hand(r, ["serve", "provision", "serve"], [2]);
};

export const FIXTURES: Record<string, { run: RunState }> = {
  map: { run: run({ kind: "map" }) },
  "map-start": { run: run({ kind: "map" }, { position: null, path: [], budget: 72 }) },
  "map-late": { run: run({ kind: "map" }, { position: PATH[13], path: PATH.slice(0, 14) }) },
  combat: { run: inCombat("a1Crawlers", typical) },
  ...Object.fromEntries(
    [0, 1, 2, 3].map((step) => [`combat-tutorial-${step}`, { run: inCombat("tutorial", (c) => (c.tutorial = step)) }]),
  ),
  "combat-pending": {
    run: inCombat("a1SlowQuery", (c, r) => {
      typical(c, r);
      const migration = card(r, "weekendMigration");
      c.hand.push(migration);
      c.engineers = 2;
      c.pending = { source: { kind: "card", uid: migration.uid }, from: "hand", count: 1, action: "upgrade", optional: false, rest: [{ op: "capacity", amount: 4 }] };
    }),
  },
  "combat-revealed": { run: inCombat("a1CrawlerSpike", (c, r) => (typical(c, r), (c.revealTurns = 2))) },
  "combat-infra": {
    run: inCombat("a1ColdStart", (c, r) => {
      typical(c, r);
      c.capacity = 17;
      c.infra = {
        readCache: { stacks: 1, disabled: 0, warmth: 4 },
        loadBalancer: { stacks: 1, disabled: 2 },
        appServer: { stacks: 3, disabled: 0 },
        cdn: { stacks: 2, disabled: 0 },
        failover: { stacks: 1, disabled: 0 },
        messageQueue: { stacks: 1, disabled: 1 },
        circuitBreaker: { stacks: 2, disabled: 0 },
        autoRemediation: { stacks: 1, disabled: 0 },
      };
    }),
  },
  "combat-multi": {
    run: inCombat("a1CrawlerTrio", (c, r) => {
      typical(c, r);
      c.workload = "write";
      const [a, b, d] = c.enemies;
      a.statuses = { retries: 3 };
      b.load = 0;
      b.resolved = true;
      d.buffer = 12;
      d.statuses = { scaling: 2, exposed: 1, throttled: 1 };
    }),
  },
  // Launch Day calls in Traffic Spikes; never more than 5 enemies.
  "combat-five": {
    run: inCombat(
      "a1LaunchDay",
      (c, r) => {
        typical(c, r);
        const spike = { ...c.enemies[0], id: "trafficSpike", load: 13, maxLoad: 13, history: [], phase: undefined };
        for (let i = 0; i < 4; i++) c.enemies.push(structuredClone({ ...spike, key: c.nextEnemyKey++, intent: { move: "surge", kinds: ["attack"], hit: { amount: 6, times: 1 } } }));
      },
      { position: "boss" },
    ),
  },
  "combat-write": { run: inCombat("a1MemoryLeak", typical) },
  "combat-low-budget": {
    run: inCombat(
      "a2Botnet",
      (c, r) => {
        c.engineers = 1;
        c.capacity = 0;
        c.statuses = { backlog: 3, degraded: 2, latency: 1, reserved: 1 };
        c.hand = hand(r, ["serve", "zeroDowntime", "pager", "techDebt", "planetScaleDb", "spotFleet", "shardDatabase", "containBlastRadius", "ackAlert", "rateLimit"]);
        c.drawPile = [];
        c.discardPile = Array.from({ length: 14 }, () => card(r, "serve"));
        c.decommissioned = [card(r, "shipIt")];
      },
      { budget: 6, act: 2, runbooks: ["rollback", "killQuery", "scaleUp"] },
    ),
  },
  "combat-boss": { run: inCombat("a1LaunchDay", typical, { position: "boss" }) },
  reward: {
    run: (() => {
      const r = run({ kind: "map" });
      r.screen = {
        kind: "reward",
        items: [
          { kind: "cash", amount: 17, taken: false },
          { kind: "cards", choices: [card(r, "blueGreen"), card(r, "planetScaleDb"), card(r, "readCache", true)], taken: false },
          { kind: "relic", relic: "architectureDiagram", taken: false },
          { kind: "runbook", runbook: "scaleUp", taken: true },
        ],
      };
      return r;
    })(),
  },
  shop: {
    run: (() => {
      const r = run({ kind: "map" });
      const shop = makeShop(r, CONTENT);
      shop.cards[2].sold = true;
      shop.relics[2].sold = true;
      r.screen = { kind: "shop", shop };
      return r;
    })(),
  },
  retro: { run: run({ kind: "retro", done: false }) },
  "retro-done": { run: run({ kind: "retro", done: true }) },
  event: { run: run({ kind: "event", event: "ticketQueue", chosen: null }) },
  "event-chosen": { run: run({ kind: "event", event: "ticketQueue", chosen: 1 }) },
  treasure: { run: run({ kind: "treasure", relic: "featureFlags", taken: false }) },
  "boss-relic": { run: run({ kind: "bossRelic", choices: ["offshoreContractors", "containerOrchestrator", "multiRegion"] }, { position: "boss" }) },
  "deck-upgrade": { run: run({ kind: "deckChoice", action: "upgrade", then: { kind: "retro", done: true } }) },
  "deck-remove": { run: run({ kind: "deckChoice", action: "remove", then: { kind: "map" } }) },
  "summary-won": {
    run: run({ kind: "summary" }, { result: "won", act: 3, stats: { ...STATS, floorsClimbed: 48, combatsWon: 31, elitesWon: 5, bossesWon: 3, turns: 140 } }),
  },
  "summary-lost": { run: run({ kind: "summary" }, { result: "lost", budget: 0 }) },
};
