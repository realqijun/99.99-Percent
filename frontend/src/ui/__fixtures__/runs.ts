/*
 * Runs for every screen, built with the real engine and content so names, card text and intents are the
 * ones players see. Dev only: `?screen=<name>` shows one, and UI tests start from them.
 */
import { CONTENT } from "../../content";
// Engine internals rather than ../../engine, so tests that mock the engine's API can still use these.
import { settleCombat, startCombat } from "../../engine/combat";
import { generateMap, reachableNodes } from "../../engine/map";
import { makeShop } from "../../engine/rewards";
import { createRun } from "../../engine/run";
import type { CardInstance, CombatState, EnemyState, RunState, Screen } from "../../engine/types";

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

/** Taylor at the end of Act 2, for a late-run fight. */
const TAYLOR: RunState = (() => {
  const run = createRun({ seed: "K3V9RA", character: "taylor", difficulty: 2, tutorial: false }, CONTENT);
  run.act = 2;
  run.map = generateMap(run.rng, CONTENT, 2);
  run.position = "boss";
  run.budget = 43;
  run.cash = 214;
  run.relics.push({ id: "warmStandby", counter: 0 }, { id: "sloReport", counter: 0 }, { id: "wallDashboard", counter: 0 });
  run.runbooks = ["scaleUp", "rollback", null];
  const added = [["killSwitch", true], ["failover", false], ["circuitBreaker", false], ["shedLoad", false], ["escalate", false], ["readCache", true], ["autoRemediation", false]] as const;
  for (const [id, upgraded] of added) run.deck.push({ uid: run.nextUid++, id, upgraded });
  return run;
})();

/** A run inside a real combat of this encounter; `edit` sets up the hand, statuses and so on, then intents are refreshed. */
function inCombat(
  encounter: string,
  edit: (c: CombatState, r: RunState) => void = () => {},
  over: Partial<RunState> = {},
  r: RunState = run({ kind: "map" }, over),
): RunState {
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

/** An enemy that joined mid-fight, as a summon adds it. Its intent numbers are filled in when the combat settles. */
const summoned = (c: CombatState, id: string, load: number, maxLoad: number, move: string): EnemyState => ({
  key: c.nextEnemyKey++,
  id,
  load,
  maxLoad,
  buffer: 0,
  statuses: {},
  intent: { move, kinds: [], hit: null },
  upcoming: [],
  history: [],
  resolved: false,
});

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
        const spike = { ...c.enemies[0], id: "trafficSpike", load: 13, maxLoad: 13, history: [], upcoming: [], phase: undefined };
        for (let i = 0; i < 4; i++) c.enemies.push(structuredClone({ ...spike, key: c.nextEnemyKey++, intent: { move: "surge", kinds: ["attack"], hit: { amount: 6, times: 1 } } }));
      },
      { position: "boss" },
    ),
  },
  "combat-write": { run: inCombat("a1MemoryLeak", typical) },
  // Act 2 with the infrastructure warmed up and routed. The itch.io page shows it.
  "combat-infra-trio": {
    run: inCombat(
      "a2StampedeTrio",
      (c, r) => {
        c.turn = 4;
        c.engineers = 3;
        c.capacity = 13;
        c.statuses = { optimized: 1 };
        c.infra = {
          readCache: { stacks: 1, disabled: 0, warmth: 3 },
          loadBalancer: { stacks: 1, disabled: 0 },
          appServer: { stacks: 2, disabled: 0 },
          cdn: { stacks: 1, disabled: 0 },
        };
        c.hand = hand(r, ["serve", "fanOut", "readReplica", "hotfix", "warmCache"], [0]);
        c.discardPile = hand(r, ["serve", "provision", "loadBalancer", "appServer", "serve", "readCache"]);
        const [spike, stampede, other] = c.enemies;
        spike.load = 6;
        stampede.statuses = { exposed: 2 };
        other.statuses = { scaling: 1 };
      },
      { act: 2, budget: 47, cash: 186, position: PATH[6], path: PATH.slice(0, 7) },
    ),
  },
  // Taylor against Black Friday after its Doorbusters, with failover and circuit breakers up. The itch.io page shows it.
  "combat-boss-act2": {
    run: inCombat(
      "a2BlackFriday",
      (c, r) => {
        c.turn = 5;
        c.engineers = 3;
        c.capacity = 11;
        c.statuses = { hardened: 1 };
        c.infra = {
          readCache: { stacks: 1, disabled: 0, warmth: 5 },
          healthChecks: { stacks: 1, disabled: 0 },
          failover: { stacks: 2, disabled: 0 },
          circuitBreaker: { stacks: 2, disabled: 0 },
          autoRemediation: { stacks: 1, disabled: 0 },
        };
        c.hand = hand(r, ["killSwitch", "serve", "shedLoad", "escalate", "failover"], [0]);
        c.discardPile = hand(r, ["serve", "provision", "serve", "triage", "circuitBreaker", "provision", "serve"]);
        const [boss] = c.enemies;
        boss.load = Math.round(boss.maxLoad * 0.64);
        boss.history = ["doorbusters", "checkoutRush", "inventoryLock"];
        boss.intent = { move: "flashSale", kinds: [], hit: null };
        c.enemies.push(summoned(c, "shopperWave", 22, 22, "refreshSpam"), summoned(c, "shopperWave", 9, 23, "addToCart"));
        c.enemies[1].statuses = { throttled: 1 };
      },
      {},
      structuredClone(TAYLOR),
    ),
  },
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
  "event-sam": { run: run({ kind: "event", event: "goingViral", chosen: null }) },
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
