/*
 * Test content for the engine. It covers every effect op, enemy op, AI kind, relic trigger,
 * relic passive and event outcome, so engine tests don't depend on the real tables.
 */
import type {
  CardDef,
  CharacterDef,
  CharacterId,
  Content,
  EffectTarget,
  EncounterDef,
  EnemyDef,
  EnemyEffect,
  EventDef,
  InfraId,
  RelicDef,
  RunbookDef,
  StatusId,
} from "../types";

type CardInput = Omit<CardDef, "id" | "target" | "pool" | "rarity" | "type"> & Partial<Pick<CardDef, "target" | "pool" | "rarity" | "type">>;

const card = (id: string, def: CardInput): CardDef => ({
  id,
  target: "none",
  pool: "neutral",
  rarity: "common",
  type: "skill",
  ...def,
});

const serve = (amount: number, target: EffectTarget = "enemy", times?: number) => ({ op: "serve" as const, amount, target, ...(times ? { times } : {}) });
const capacity = (amount: number) => ({ op: "capacity" as const, amount });
const self = (status: StatusId, amount: number) => ({ op: "status" as const, status, amount, target: "self" as const });
/** An infrastructure card with id `<infra>Card`. */
const infra = (id: InfraId, name: string, pool: CardDef["pool"] = "neutral", rarity: CardDef["rarity"] = "common"): CardDef =>
  card(`${id}Card`, { name, pool, rarity, type: "power", cost: 1, effects: [{ op: "infra", infra: id, stacks: 1 }], upgrade: { cost: 0 } });

const cardList: CardDef[] = [
  // Starters and status cards with the ids the engine relies on.
  card("serve", { name: "Serve", rarity: "starter", type: "attack", target: "enemy", cost: 1, effects: [serve(6)], upgrade: { effects: [serve(9)] } }),
  card("provision", { name: "Provision", rarity: "starter", cost: 1, effects: [capacity(5)], upgrade: { effects: [capacity(8)] } }),
  card("inspect", { name: "Inspect", pool: "jordan", rarity: "starter", target: "enemy", cost: 1, effects: [{ op: "status", status: "exposed", amount: 2, target: "enemy" }, { op: "draw", amount: 1 }], upgrade: { effects: [{ op: "status", status: "exposed", amount: 3, target: "enemy" }, { op: "draw", amount: 1 }] } }),
  card("triage", { name: "Triage", pool: "taylor", rarity: "starter", cost: 1, effects: [{ op: "recover", amount: 3 }, { op: "removeStatus", status: "debuffs", target: "self" }], upgrade: { effects: [{ op: "recover", amount: 5 }, { op: "removeStatus", status: "debuffs", target: "self" }] } }),
  card("techDebt", { name: "Tech Debt", pool: "status", rarity: "special", type: "status", cost: null, effects: [], keywords: ["unplayable"] }),
  card("pager", { name: "Pager", pool: "status", rarity: "special", type: "status", cost: null, effects: [], keywords: ["unplayable"], endOfTurnInHand: [{ op: "loseBudget", amount: 2 }] }),
  card("configDrift", { name: "Config Drift", pool: "status", rarity: "special", type: "status", cost: null, effects: [], keywords: ["unplayable", "volatile"], onDraw: [{ op: "engineers", amount: -1 }] }),

  // Attacks.
  card("doubleTap", { name: "Double Tap", pool: "jordan", type: "attack", target: "enemy", cost: 1, effects: [serve(3, "enemy", 2)], upgrade: { effects: [serve(4, "enemy", 2)] } }),
  card("sweep", { name: "Sweep", type: "attack", cost: 1, effects: [serve(4, "allEnemies")], upgrade: { effects: [serve(6, "allEnemies")] } }),
  card("scatter", { name: "Scatter", rarity: "uncommon", type: "attack", cost: 1, effects: [serve(3, "randomEnemy", 3)] }),
  card("burst", { name: "Burst", pool: "jordan", rarity: "rare", type: "attack", target: "enemy", cost: "x", effects: [serve(7)], upgrade: { effects: [serve(9)] } }),
  card("fanOut", { name: "Fan Out", pool: "jordan", rarity: "uncommon", type: "attack", target: "enemy", cost: 1, effects: [{ op: "serve", amount: { base: 2, per: 2, of: "infraKinds" }, target: "enemy" }] }),
  card("handful", { name: "Handful", type: "attack", target: "enemy", cost: 1, effects: [{ op: "serve", amount: { per: 2, of: "handSize" }, target: "enemy" }] }),
  card("combo", { name: "Combo", rarity: "uncommon", type: "attack", target: "enemy", cost: 0, effects: [{ op: "serve", amount: { base: 2, per: 3, of: "cardsPlayedThisTurn" }, target: "enemy" }] }),
  card("bodySlam", { name: "Body Slam", pool: "taylor", rarity: "rare", type: "attack", target: "enemy", cost: 1, effects: [{ op: "serve", amount: { per: 1, of: "capacity" }, target: "enemy" }] }),
  card("flashSale", { name: "Flash Sale", type: "attack", target: "enemy", cost: 0, keywords: ["volatile"], effects: [serve(8)] }),

  // Capacity and Reject.
  card("shed", { name: "Shed Load", cost: 1, effects: [{ op: "reject", amount: 10 }], upgrade: { effects: [{ op: "reject", amount: 14 }] } }),
  card("stackUp", { name: "Stack Up", pool: "jordan", rarity: "uncommon", cost: 1, effects: [{ op: "capacity", amount: { base: 2, per: 2, of: "infraStacks" } }] }),
  card("perEnemy", { name: "Crowd Control", pool: "taylor", cost: 1, effects: [{ op: "capacity", amount: { per: 4, of: "enemyCount" } }] }),
  card("vent", { name: "Vent", pool: "taylor", cost: 1, effects: [{ op: "recover", amount: { per: 1, of: "backlog" } }, { op: "recover", amount: { per: 0.1, of: "missingBudget" } }] }),
  card("capacityX", { name: "Overprovision", rarity: "rare", cost: "x", effects: [capacity(6)] }),

  // Statuses.
  card("profile", { name: "Profile", rarity: "uncommon", cost: 1, keywords: ["retain"], effects: [self("optimized", 2)] }),
  card("harden", { name: "Harden", cost: 1, keywords: ["innate"], effects: [self("hardened", 2)] }),
  card("reserve", { name: "Reserve", pool: "taylor", cost: 1, effects: [capacity(6), self("reserved", 1)] }),
  card("throttle", { name: "Rate Limit", target: "enemy", cost: 1, effects: [{ op: "status", status: "throttled", amount: 2, target: "enemy" }, capacity(3)] }),
  card("exposeAll", { name: "Trace All", rarity: "uncommon", cost: 1, effects: [{ op: "status", status: "exposed", amount: 1, target: "allEnemies" }] }),
  card("exposeOne", { name: "Sample", cost: 0, effects: [{ op: "status", status: "exposed", amount: 1, target: "randomEnemy" }] }),

  // Infrastructure.
  infra("readCache", "Read Cache"),
  card("tuneCache", { name: "Tune Cache", rarity: "uncommon", type: "power", cost: 1, effects: [{ op: "infra", infra: "cacheTuning", stacks: 1 }, { op: "warmCache", amount: 2 }] }),
  infra("loadBalancer", "Load Balancer", "jordan"),
  infra("appServer", "App Server", "jordan"),
  infra("autoscaler", "Autoscaler", "jordan", "uncommon"),
  infra("cdn", "CDN"),
  infra("messageQueue", "Message Queue", "neutral", "uncommon"),
  infra("readReplica", "Read Replica", "neutral", "uncommon"),
  infra("healthChecks", "Health Checks", "taylor"),
  infra("failover", "Failover", "taylor", "uncommon"),
  infra("circuitBreaker", "Circuit Breaker", "taylor", "uncommon"),
  infra("autoRemediation", "Auto Remediation", "taylor", "rare"),
  infra("onCall", "On-Call Rotation", "taylor", "uncommon"),
  card("repairCrew", { name: "Repair Crew", pool: "taylor", cost: 1, effects: [{ op: "repair" }, capacity(3)] }),

  // Cards, engineers, choices and the rest.
  card("hotfix", { name: "Hotfix", cost: 0, keywords: ["decommission"], effects: [{ op: "engineers", amount: 1 }, { op: "draw", amount: 1 }] }),
  card("allNighter", { name: "All Nighter", rarity: "uncommon", cost: 0, effects: [{ op: "loseBudget", amount: 3 }, { op: "engineers", amount: 2 }] }),
  card("rollback", { name: "Rollback", pool: "taylor", cost: 1, effects: [{ op: "choose", from: "hand", count: 1, action: "decommission" }, capacity(4)] }),
  card("refile", { name: "Refile", rarity: "uncommon", cost: 1, effects: [{ op: "choose", from: "discard", count: 1, action: "toHand", optional: true }] }),
  card("stash", { name: "Stash", cost: 0, effects: [{ op: "choose", from: "hand", count: 1, action: "toTopOfDraw" }] }),
  card("polish", { name: "Polish", rarity: "uncommon", cost: 1, effects: [{ op: "choose", from: "hand", count: 1, action: "upgrade" }] }),
  card("hold", { name: "Hold", cost: 1, effects: [{ op: "choose", from: "hand", count: 1, action: "retain" }, capacity(3)] }),
  card("dump", { name: "Dump", cost: 1, effects: [{ op: "draw", amount: 2 }, { op: "choose", from: "hand", count: 1, action: "discard" }] }),
  card("debtSpiral", { name: "Debt Spiral", cost: 0, effects: [{ op: "addCard", card: "techDebt", zone: "draw", count: 1 }, { op: "addCard", card: "flashSale", zone: "hand", count: 1, upgraded: true }, { op: "addCard", card: "serve", zone: "discard", count: 2 }] }),
  card("dashboards", { name: "Dashboards", rarity: "uncommon", cost: 1, effects: [{ op: "reveal", turns: 1 }, { op: "draw", amount: 1 }] }),
  card("upsell", { name: "Upsell", rarity: "rare", cost: 1, keywords: ["decommission"], effects: [{ op: "cash", amount: 5 }] }),
  card("adaptive", {
    name: "Adaptive",
    rarity: "uncommon",
    cost: 1,
    effects: [
      capacity(2),
      { op: "if", cond: { kind: "workload", is: "write" }, then: [capacity(3)] },
      { op: "if", cond: { kind: "hasInfra", infra: "loadBalancer" }, then: [capacity(1)] },
      { op: "if", cond: { kind: "enemyIntends", intent: "attack" }, then: [capacity(1)] },
      { op: "if", cond: { kind: "budgetBelowPct", pct: 50 }, then: [{ op: "draw", amount: 1 }] },
      { op: "if", cond: { kind: "handEmpty" }, then: [{ op: "draw", amount: 2 }] },
    ],
  }),
];

const hit = (amount: number, times?: number): EnemyEffect => ({ op: "hit", amount, ...(times ? { times } : {}) });

const enemyList: EnemyDef[] = [
  {
    id: "spike", name: "Traffic Spike", tier: "normal", load: [18, 22], sprite: "spike", description: "Hits, then grows.",
    moves: { burst: { name: "Burst", effects: [hit(6)] }, rampUp: { name: "Ramp Up", effects: [{ op: "status", status: "scaling", amount: 2, target: "self" }, { op: "buffer", amount: 5 }] } },
    ai: { kind: "cycle", moves: ["burst", "rampUp", "burst"] },
  },
  {
    id: "crawler", name: "Crawler", tier: "normal", load: [16, 20], sprite: "crawler", description: "Leaves you Degraded and slow.",
    moves: {
      scrape: { name: "Scrape", effects: [hit(5), { op: "status", status: "degraded", amount: 1, target: "player" }] },
      scan: { name: "Scan", effects: [hit(4), { op: "status", status: "latency", amount: 1, target: "player" }, { op: "addCard", card: "pager", zone: "discard", count: 1 }] },
    },
    ai: { kind: "weighted", weights: { scrape: 2, scan: 1 }, maxRepeat: 2 },
  },
  {
    id: "leak", name: "Memory Leak", tier: "normal", load: [20, 24], sprite: "leak", description: "Boots, then clogs.",
    moves: {
      boot: { name: "Boot", effects: [{ op: "buffer", amount: 6 }] },
      drip: { name: "Drip", effects: [hit(7)] },
      clog: { name: "Clog", effects: [hit(3), { op: "status", status: "backlog", amount: 2, target: "player" }, { op: "addCard", card: "techDebt", zone: "draw", count: 1 }] },
    },
    ai: { kind: "script", opening: ["boot"], then: { kind: "cycle", moves: ["drip", "clog"] } },
  },
  {
    id: "flaky", name: "Flaky Deploy", tier: "elite", load: [36, 40], sprite: "flaky", description: "Causes Node Failures and retries.",
    moves: {
      fail: { name: "Bad Push", effects: [{ op: "nodeFailure" }, hit(6)] },
      storm: { name: "Retry Storm", effects: [hit(3, 3)] },
      harden: { name: "Add Retries", effects: [{ op: "status", status: "retries", amount: 2, target: "self" }, hit(4)] },
      mend: { name: "Self Heal", effects: [{ op: "heal", amount: 6 }, hit(4)] },
    },
    ai: { kind: "script", opening: ["harden"], then: { kind: "cycle", moves: ["fail", "storm", "mend"] } },
  },
  {
    id: "noisy", name: "Noisy Neighbour", tier: "elite", load: [30, 34], sprite: "noisy", description: "Buffs its allies.",
    moves: {
      share: { name: "Share CPU", effects: [{ op: "status", status: "scaling", amount: 2, target: "allies" }, hit(5)] },
      shield: { name: "Shield", effects: [{ op: "buffer", amount: 5, target: "allies" }, hit(4)] },
      debuff: { name: "Contend", effects: [{ op: "status", status: "throttled", amount: 1, target: "self" }, { op: "addCard", card: "configDrift", zone: "hand", count: 1 }, hit(6)] },
    },
    ai: { kind: "weighted", weights: { share: 1, shield: 1, debuff: 1 } },
  },
  {
    id: "launch", name: "Launch Day", tier: "boss", load: [80, 80], sprite: "launch", description: "Calls Traffic Spikes and gets wilder at half Load.",
    moves: {
      frontPage: { name: "Front Page", effects: [hit(12)] },
      signups: { name: "Signups", effects: [hit(4, 2)] },
      callSpike: { name: "Call a Spike", effects: [{ op: "summon", enemy: "spike", count: 1 }, hit(5)] },
      enrage: { name: "Go Viral", effects: [{ op: "status", status: "scaling", amount: 3, target: "self" }] },
    },
    ai: {
      kind: "phases",
      phases: [
        { atOrBelowPct: 50, ai: { kind: "script", opening: ["enrage"], then: { kind: "cycle", moves: ["frontPage", "callSpike"] } } },
        { atOrBelowPct: 100, ai: { kind: "cycle", moves: ["frontPage", "signups", "callSpike"] } },
      ],
    },
  },
  {
    id: "dummy", name: "Practice Bot", tier: "normal", load: [12, 12], sprite: "dummy", description: "Gentle.",
    moves: { poke: { name: "Poke", effects: [hit(3)] }, idle: { name: "Idle", effects: [] } },
    ai: { kind: "cycle", moves: ["poke", "idle"] },
  },
];

const encounterList: EncounterDef[] = [
  { id: "tutorial", act: 1, tier: "normal", enemies: ["dummy"], workload: "read", weight: 1 },
  ...([1, 2, 3] as const).flatMap((act): EncounterDef[] => [
    { id: `a${act}spike`, act, tier: "normal", enemies: ["spike"], workload: "read", weight: 3 },
    { id: `a${act}pair`, act, tier: "normal", enemies: ["crawler", "leak"], workload: "write", weight: 2 },
    { id: `a${act}flaky`, act, tier: "elite", enemies: ["flaky"], workload: "write", weight: 1 },
    { id: `a${act}noisy`, act, tier: "elite", enemies: ["noisy", "spike"], workload: "read", weight: 1 },
    { id: `a${act}boss`, act, tier: "boss", enemies: ["launch"], workload: act === 2 ? "write" : "read", weight: 1 },
  ]),
];

const relic = (id: string, def: Omit<RelicDef, "id" | "icon" | "text" | "pool"> & Partial<Pick<RelicDef, "pool">>): RelicDef => ({
  id,
  icon: "gear",
  text: id,
  pool: "neutral",
  ...def,
});

const relicList: RelicDef[] = [
  relic("monitoring", { name: "Monitoring", rarity: "starter", pool: "jordan", trigger: "firstTurnStart", effects: [{ op: "draw", amount: 1 }], passive: [{ kind: "revealTurns", turns: 2 }] }),
  relic("postmortemCulture", { name: "Postmortem Culture", rarity: "starter", pool: "taylor", trigger: "combatEnd", effects: [{ op: "recover", amount: 4 }] }),
  relic("warmStandby", { name: "Warm Standby", rarity: "common", trigger: "combatStart", effects: [{ op: "status", status: "throttled", amount: 1, target: "allEnemies" }] }),
  relic("coffee", { name: "Coffee", rarity: "common", trigger: "turnStart", every: 3, effects: [{ op: "engineers", amount: 1 }] }),
  relic("nightly", { name: "Nightly Build", rarity: "common", trigger: "turnEnd", effects: [capacity(2)] }),
  relic("whetstone", { name: "Benchmarks", rarity: "uncommon", trigger: "attackPlayed", every: 3, effects: [serve(3, "randomEnemy")] }),
  relic("clipboard", { name: "Clipboard", rarity: "common", trigger: "skillPlayed", effects: [capacity(1)] }),
  relic("blueprint", { name: "Blueprint", rarity: "uncommon", trigger: "powerPlayed", effects: [{ op: "draw", amount: 1 }] }),
  relic("alarm", { name: "Alarm", rarity: "common", trigger: "budgetLost", effects: [capacity(2)] }),
  relic("trophy", { name: "Trophy", rarity: "uncommon", trigger: "enemyResolved", effects: [{ op: "cash", amount: 3 }] }),
  relic("shuffleBot", { name: "Shuffle Bot", rarity: "common", trigger: "shuffle", effects: [capacity(3)] }),
  relic("bigBudget", { name: "Big Budget", rarity: "rare", passive: [{ kind: "maxBudget", amount: 10 }] }),
  relic("coupon", { name: "Coupon", rarity: "shop", passive: [{ kind: "shopDiscountPct", pct: 20 }] }),
  relic("picky", { name: "Picky", rarity: "uncommon", passive: [{ kind: "cardChoices", amount: 1 }] }),
  relic("spa", { name: "Spa Day", rarity: "common", passive: [{ kind: "restRecoverPct", pct: 10 }] }),
  relic("bonus", { name: "Bonus", rarity: "common", passive: [{ kind: "cashRewardPct", pct: 25 }] }),
  relic("binder", { name: "Binder", rarity: "uncommon", passive: [{ kind: "runbookSlots", amount: 1 }] }),
  relic("writeThrough", { name: "Write Through", rarity: "rare", passive: [{ kind: "noCacheHalving" }] }),
  relic("preWarm", { name: "Pre-Warm", rarity: "common", pool: "taylor", passive: [{ kind: "startingCapacity", amount: 6 }] }),
  relic("extraHands", { name: "Extra Hands", rarity: "boss", passive: [{ kind: "engineersPerTurn", amount: 1 }], drawback: [{ op: "addCard", card: "configDrift", zone: "draw", count: 1 }] }),
  relic("wideView", { name: "Wide View", rarity: "boss", passive: [{ kind: "drawPerTurn", amount: 1 }] }),
  relic("radar", { name: "Radar", rarity: "boss", passive: [{ kind: "revealTurns", turns: 1 }] }),
  relic("slowStart", { name: "Slow Start", rarity: "boss", passive: [{ kind: "engineersPerTurn", amount: 1 }], drawback: [self("latency", 2)] }),
];

const runbookList: RunbookDef[] = [
  { id: "hotPatch", name: "Hot Patch", rarity: "common", icon: "bolt", target: "enemy", effects: [serve(12)], text: "Serve 12." },
  { id: "scaleUp", name: "Scale Up", rarity: "common", icon: "cloud", target: "none", effects: [capacity(10)], text: "Gain 10 Capacity." },
  { id: "incidentCall", name: "Incident Call", rarity: "uncommon", icon: "pager", target: "none", effects: [{ op: "choose", from: "hand", count: 1, action: "decommission", optional: true }, { op: "draw", amount: 2 }], text: "Decommission up to 1 card. Draw 2." },
  { id: "restart", name: "Restart", rarity: "rare", icon: "terminal", target: "none", effects: [{ op: "repair" }, { op: "recover", amount: 10 }], text: "Repair. Recover 10." },
  { id: "surge", name: "Surge Pricing", rarity: "common", icon: "chart", target: "none", effects: [{ op: "status", status: "throttled", amount: 2, target: "allEnemies" }], text: "Throttle all." },
];

const eventList: EventDef[] = [
  {
    id: "coffeeChat", title: "Coffee Chat", acts: [1, 2, 3], speaker: "maya", lines: ["Got a minute?"],
    choices: [
      { label: "Take the bonus", detail: "Gain 30 cash.", outcomes: [{ op: "cash", amount: 30 }], reply: "Nice." },
      { label: "Pull an all-nighter", detail: "Lose 5 budget, get a rare card.", requires: { budget: 5 }, outcomes: [{ op: "budget", amount: -5 }, { op: "randomCard", rarity: "rare" }], reply: "Get some sleep." },
      { label: "Pay for a cleanup", detail: "Pay 40 cash, remove a card.", requires: { cash: 40 }, outcomes: [{ op: "cash", amount: -40 }, { op: "chooseCard", action: "remove" }], reply: "Clean." },
      { label: "Rest", detail: "Recover 8.", outcomes: [{ op: "budget", amount: 8 }], reply: "Better." },
    ],
  },
  {
    id: "hackathon", title: "Hackathon", acts: [1, 2, 3], speaker: "alex", lines: ["Let's build."],
    choices: [
      { label: "Ship it", detail: "Max budget +5.", outcomes: [{ op: "maxBudget", amount: 5 }], reply: "Shipped." },
      { label: "Cut corners", detail: "Gain a Tech Debt and an uncommon relic.", outcomes: [{ op: "addCard", card: "techDebt" }, { op: "relic", rarity: "uncommon" }], reply: "Hmm." },
      { label: "Refactor", detail: "Upgrade a card.", outcomes: [{ op: "chooseCard", action: "upgrade" }], reply: "Cleaner." },
      { label: "Fork", detail: "Duplicate a card and add an upgraded Serve.", outcomes: [{ op: "chooseCard", action: "duplicate" }, { op: "addCard", card: "serve", upgraded: true }], reply: "Twice the fun." },
    ],
  },
  {
    id: "vendorDemo", title: "Vendor Demo", acts: [1, 2, 3], speaker: "sam", lines: ["Free trial!"],
    choices: [
      { label: "Take a sample", detail: "Gain a random runbook.", outcomes: [{ op: "runbook" }], reply: "Enjoy." },
      { label: "Take the patch", detail: "Gain Hot Patch and the Coupon.", outcomes: [{ op: "runbook", runbook: "hotPatch" }, { op: "relic", relic: "coupon" }], reply: "Deal." },
      { label: "Shrink the budget", detail: "Max budget -3.", outcomes: [{ op: "maxBudget", amount: -3 }], reply: "Lean." },
      { label: "Challenge them", detail: "Fight a Flaky Deploy.", outcomes: [{ op: "fight", encounter: "a1flaky" }], reply: "Bring it." },
    ],
  },
  {
    id: "lateNight", title: "Late Night", acts: [2, 3], speaker: "taylor", lines: ["Still here?"],
    choices: [{ label: "Go home", detail: "Nothing happens.", outcomes: [], reply: "Night." }],
  },
];

const characters: Record<CharacterId, CharacterDef> = {
  jordan: {
    id: "jordan", name: "Jordan", role: "Platform Engineer", maxBudget: 72, starterRelic: "monitoring", blurb: "Scales out.",
    starterDeck: ["serve", "serve", "serve", "serve", "serve", "provision", "provision", "provision", "provision", "inspect"],
  },
  taylor: {
    id: "taylor", name: "Taylor", role: "Site Reliability Engineer", maxBudget: 70, starterRelic: "postmortemCulture", blurb: "Survives.",
    starterDeck: ["serve", "serve", "serve", "serve", "serve", "provision", "provision", "provision", "provision", "triage"],
  },
};

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]));

export const FIXTURE: Content = {
  cards: byId(cardList),
  enemies: byId(enemyList),
  encounters: byId(encounterList),
  relics: byId(relicList),
  runbooks: byId(runbookList),
  events: byId(eventList),
  characters,
};
