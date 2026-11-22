/* Hand-made RunStates, one per screen plus combat variants, for building the UI without the engine. */
import { rand, type RngHolder } from "../../engine/rng";
import type { ActMap, CardInstance, CombatState, EnemyState, Intent, MapNode, NodeKind, RunState, Screen } from "../../engine/types";

function makeMap(): ActMap {
  const rng: RngHolder = { rngState: 20251122 };
  const nodes: Record<string, MapNode> = {};
  const colsFor = (floor: number) => (floor % 2 === 1 ? [0, 2, 4, 6] : [1, 3, 5]);
  const kindFor = (floor: number): NodeKind => {
    if (floor === 1) return "incident";
    if (floor === 9) return "treasure";
    if (floor === 15) return "retro";
    const r = rand(rng);
    if (r < 0.45) return "incident";
    if (r < 0.67) return "event";
    if (r < 0.77 && floor >= 6) return "major";
    if (r < 0.87) return "vendor";
    return floor === 14 ? "incident" : "retro";
  };
  for (let floor = 1; floor <= 15; floor++) {
    for (const col of colsFor(floor)) {
      const next =
        floor === 15
          ? ["boss"]
          : colsFor(floor + 1)
              .filter((c) => Math.abs(c - col) === 1)
              .map((c) => `f${floor + 1}c${c}`);
      // Drop some branches so the paths aren't a perfect lattice.
      const kept = next.length > 1 && rand(rng) < 0.35 ? [next[rand(rng) < 0.5 ? 0 : 1]] : next;
      nodes[`f${floor}c${col}`] = { id: `f${floor}c${col}`, floor, col, kind: kindFor(floor), next: kept };
    }
  }
  nodes.boss = { id: "boss", floor: 16, col: 3, kind: "boss", next: [] };
  return { act: 1, nodes, boss: "launchDay" };
}

export const FIXTURE_MAP = makeMap();

/** A path up the fixture map, `floors` long. */
export function fixtureTrail(floors: number): string[] {
  const trail = ["f1c2"];
  while (trail.length < floors) trail.push(FIXTURE_MAP.nodes[trail[trail.length - 1]].next[0]);
  return trail;
}

let uid = 1;
const inst = (id: string, upgraded = false): CardInstance => ({ uid: uid++, id, upgraded });

const DECK: CardInstance[] = [
  ...["serve", "serve", "serve", "serve", "serve"].map((id) => inst(id)),
  inst("serve", true),
  ...["provision", "provision", "provision", "provision"].map((id) => inst(id)),
  inst("inspect"),
  inst("loadBalancer", true),
  inst("burstServe"),
  inst("readCache"),
];

const STATS = { floorsClimbed: 3, combatsWon: 2, elitesWon: 0, bossesWon: 0, budgetLost: 18, cashEarned: 34, cardsPlayed: 41, turns: 9 };

function run(screen: Screen, over: Partial<RunState> = {}): RunState {
  return {
    version: 1,
    seed: "FX7Q2M",
    character: "jordan",
    difficulty: 1,
    rng: { map: 1, shuffle: 2, cards: 3, ai: 4, events: 5, rewards: 6 },
    act: 1,
    map: FIXTURE_MAP,
    position: fixtureTrail(3)[2],
    path: fixtureTrail(3),
    budget: 54,
    maxBudget: 72,
    cash: 123,
    deck: DECK,
    relics: [
      { id: "monitoring", counter: 0 },
      { id: "coffeeMachine", counter: 0 },
    ],
    runbooks: ["rollback", "killSwitch", null],
    screen,
    nextUid: 100,
    removals: 0,
    rarePity: 1,
    seenEvents: [],
    stats: STATS,
    result: null,
    ...over,
  };
}

const attack = (amount: number, times = 1, move = "spike"): Intent => ({ move, kinds: ["attack"], hit: { amount, times } });

function foe(key: number, id: string, load: number, maxLoad: number, intent: Intent, over: Partial<EnemyState> = {}): EnemyState {
  return { key, id, load, maxLoad, buffer: 0, statuses: {}, intent, upcoming: [], history: [], resolved: false, ...over };
}

const HAND_IDS = ["serve", "serve", "provision", "loadBalancer", "inspect"];

function combat(over: Partial<CombatState> = {}): CombatState {
  const hand = HAND_IDS.map((id, i) => inst(id, i === 3));
  return {
    encounter: "bots",
    tier: "normal",
    workload: "read",
    turn: 2,
    phase: "player",
    engineers: 3,
    engineersPerTurn: 3,
    capacity: 4,
    drawPile: [inst("serve"), inst("provision"), inst("burstServe"), inst("readCache")],
    hand,
    discardPile: [inst("serve"), inst("provision"), inst("serve", true)],
    decommissioned: [],
    statuses: { optimized: 1 },
    infra: {},
    enemies: [foe(1, "botSwarm", 24, 32, attack(8), { buffer: 5, statuses: { throttled: 1 } })],
    pending: null,
    rejects: 0,
    cardsPlayedThisTurn: 0,
    budgetLostLastRound: 0,
    budgetLostThisRound: 0,
    revealTurns: 0,
    nextEnemyKey: 2,
    tutorial: null,
    ...over,
  };
}

const inCombat = (c: Partial<CombatState> = {}, r: Partial<RunState> = {}) => run({ kind: "combat", combat: combat(c) }, r);

const upgradeChoice: Screen = { kind: "deckChoice", action: "upgrade", then: { kind: "retro", done: true } };

export const FIXTURES: Record<string, { run: RunState; trail?: string[] }> = {
  map: { run: run({ kind: "map" }), trail: fixtureTrail(3) },
  "map-start": { run: run({ kind: "map" }, { position: null, budget: 72 }), trail: [] },
  "map-late": { run: run({ kind: "map" }, { position: fixtureTrail(14)[13] }), trail: fixtureTrail(14) },
  combat: { run: inCombat() },
  ...Object.fromEntries([0, 1, 2, 3].map((step) => [`combat-tutorial-${step}`, { run: inCombat({ turn: 1, tutorial: step, statuses: {}, capacity: 0 }) }])),
  "combat-pending": {
    run: inCombat({
      pending: { source: { kind: "card", uid: 999 }, from: "hand", count: 1, action: "decommission", optional: false, rest: [{ op: "draw", amount: 2 }] },
      engineers: 2,
    }),
  },
  "combat-revealed": {
    run: inCombat({
      revealTurns: 2,
      enemies: [
        foe(1, "botSwarm", 24, 32, attack(8), { upcoming: [{ move: "fortify", kinds: ["defend"], hit: null }, attack(3, 4)] }),
        foe(2, "slowQuery", 20, 24, { move: "lock", kinds: ["attack", "debuff"], hit: { amount: 5, times: 1 } }, { upcoming: [{ move: "fail", kinds: ["failure"], hit: null }, attack(12)] }),
      ],
    }),
  },
  "combat-infra": {
    run: inCombat({
      capacity: 17,
      infra: {
        readCache: { stacks: 1, disabled: 0, warmth: 4 },
        loadBalancer: { stacks: 1, disabled: 2 },
        appServer: { stacks: 3, disabled: 0 },
        cdn: { stacks: 2, disabled: 0 },
        failover: { stacks: 1, disabled: 0 },
        messageQueue: { stacks: 1, disabled: 1 },
        circuitBreaker: { stacks: 2, disabled: 0 },
      },
      enemies: [foe(1, "botSwarm", 24, 32, { move: "fail", kinds: ["failure"], hit: null })],
    }),
  },
  "combat-multi": {
    run: inCombat({
      encounter: "queries",
      workload: "write",
      enemies: [
        foe(1, "slowQuery", 26, 26, attack(6), { statuses: { retries: 3 } }),
        foe(2, "memoryLeak", 0, 20, attack(4), { resolved: true }),
        foe(3, "cronStorm", 9, 16, attack(2, 5), { buffer: 12, statuses: { scaling: 2, exposed: 1 } }),
        foe(4, "botSwarm", 30, 30, { move: "call", kinds: ["summon"], hit: null }),
      ],
      nextEnemyKey: 5,
    }),
  },
  "combat-write": { run: inCombat({ workload: "write", encounter: "queries" }) },
  "combat-low-budget": {
    run: inCombat(
      {
        engineers: 1,
        capacity: 0,
        statuses: { backlog: 3, degraded: 2, latency: 1, reserved: 1 },
        hand: ["serve", "burstServe", "pager", "techDebt", "planetScale", "allHands", "shardDatabase", "zeroDowntime", "garbageCollect", "rateLimit"].map((id) => inst(id)),
        drawPile: [],
        discardPile: Array.from({ length: 14 }, () => inst("serve")),
        decommissioned: [inst("garbageCollect")],
        enemies: [foe(1, "ddos", 61, 72, attack(14, 2))],
        tier: "elite",
        encounter: "ddos",
      },
      { budget: 6, runbooks: ["rollback", "killSwitch", "warmStandby"] },
    ),
  },
  "combat-boss": {
    run: inCombat({ tier: "boss", encounter: "launchDay", enemies: [foe(1, "launchDay", 142, 180, attack(22), { statuses: { scaling: 3 } })] }, { position: "boss" }),
  },
  reward: {
    run: run({
      kind: "reward",
      items: [
        { kind: "cash", amount: 17, taken: false },
        { kind: "cards", choices: [inst("burstServe"), inst("planetScale"), inst("readCache", true)], taken: false },
        { kind: "relic", relic: "statusPage", taken: false },
        { kind: "runbook", runbook: "warmStandby", taken: true },
      ],
    }),
  },
  shop: {
    run: run({
      kind: "shop",
      shop: {
        cards: [
          { card: inst("burstServe"), price: 72, sold: false },
          { card: inst("appServer"), price: 54, sold: false },
          { card: inst("loadBalancer"), price: 49, sold: true },
          { card: inst("shardDatabase"), price: 160, sold: false },
          { card: inst("rateLimit"), price: 51, sold: false },
          { card: inst("zeroDowntime"), price: 68, sold: false },
          { card: inst("shedLoad"), price: 45, sold: false },
        ],
        relics: [
          { relic: "statusPage", price: 190, sold: false },
          { relic: "featureFlags", price: 260, sold: false },
          { relic: "coffeeMachine", price: 150, sold: true },
        ],
        runbooks: [
          { runbook: "rollback", price: 50, sold: false },
          { runbook: "killSwitch", price: 75, sold: false },
          { runbook: "warmStandby", price: 50, sold: false },
        ],
        removalPrice: 75,
        removalUsed: false,
      },
    }),
  },
  retro: { run: run({ kind: "retro", done: false }) },
  "retro-done": { run: run({ kind: "retro", done: true }) },
  event: { run: run({ kind: "event", event: "mayaOffsite", chosen: null }) },
  "event-chosen": { run: run({ kind: "event", event: "mayaOffsite", chosen: 2 }) },
  treasure: { run: run({ kind: "treasure", relic: "featureFlags", taken: false }) },
  "boss-relic": { run: run({ kind: "bossRelic", choices: ["kubernetes", "serviceMesh", "dataLake"] }, { position: "boss" }) },
  "deck-upgrade": { run: run(upgradeChoice) },
  "deck-remove": { run: run({ kind: "deckChoice", action: "remove", then: { kind: "map" } }) },
  "summary-won": {
    run: run({ kind: "summary" }, { result: "won", act: 3, stats: { ...STATS, floorsClimbed: 48, combatsWon: 31, elitesWon: 5, bossesWon: 3, turns: 140 } }),
  },
  "summary-lost": { run: run({ kind: "summary" }, { result: "lost", budget: 0 }) },
};
