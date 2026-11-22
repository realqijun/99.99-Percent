/* Hand-made content for UI fixtures and tests, independent of the real tables. */
import { CHARACTERS } from "../../content/characters";
import type { CardDef, Content, EnemyDef, EventDef, RelicDef, RunbookDef } from "../../engine/types";

const card = (c: Omit<CardDef, "pool" | "rarity"> & Partial<Pick<CardDef, "pool" | "rarity">>): CardDef => ({ pool: "neutral", rarity: "common", ...c });

const CARDS: CardDef[] = [
  card({ id: "serve", name: "Serve", rarity: "starter", type: "attack", cost: 1, target: "enemy", effects: [{ op: "serve", amount: 6, target: "enemy" }], upgrade: { effects: [{ op: "serve", amount: 9, target: "enemy" }] } }),
  card({ id: "provision", name: "Provision", rarity: "starter", type: "skill", cost: 1, target: "none", effects: [{ op: "capacity", amount: 5 }], upgrade: { effects: [{ op: "capacity", amount: 8 }] } }),
  card({ id: "inspect", name: "Inspect", pool: "jordan", rarity: "starter", type: "skill", cost: 0, target: "none", effects: [{ op: "reveal", turns: 1 }, { op: "draw", amount: 1 }], upgrade: { effects: [{ op: "reveal", turns: 2 }, { op: "draw", amount: 2 }] } }),
  card({ id: "triage", name: "Triage", pool: "taylor", rarity: "starter", type: "skill", cost: 1, target: "none", effects: [{ op: "recover", amount: 3 }, { op: "removeStatus", status: "debuffs", target: "self" }] }),
  card({ id: "loadBalancer", name: "Load Balancer", pool: "jordan", type: "power", cost: 1, target: "none", effects: [{ op: "infra", infra: "loadBalancer", stacks: 1 }], upgrade: { cost: 0 } }),
  card({ id: "appServer", name: "App Server", pool: "jordan", type: "power", cost: 2, target: "none", effects: [{ op: "infra", infra: "appServer", stacks: 1 }] }),
  card({ id: "readCache", name: "Read Cache", type: "power", cost: 1, target: "none", effects: [{ op: "infra", infra: "readCache", stacks: 1 }] }),
  card({ id: "burstServe", name: "Burst Serve", rarity: "uncommon", type: "attack", cost: 2, target: "enemy", effects: [{ op: "serve", amount: 4, times: 3, target: "enemy" }] }),
  card({ id: "fanOut", name: "Fan Out", type: "attack", cost: 1, target: "none", effects: [{ op: "serve", amount: 4, target: "allEnemies" }] }),
  card({ id: "rateLimit", name: "Rate Limit", type: "skill", cost: 1, target: "enemy", effects: [{ op: "status", status: "throttled", amount: 2, target: "enemy" }] }),
  card({ id: "shedLoad", name: "Shed Load", type: "skill", cost: 0, target: "none", effects: [{ op: "reject", amount: 6 }] }),
  card({ id: "garbageCollect", name: "Garbage Collect", rarity: "uncommon", type: "skill", cost: 1, target: "none", keywords: ["decommission"], effects: [{ op: "choose", from: "hand", count: 1, action: "decommission" }, { op: "draw", amount: 2 }] }),
  card({ id: "shardDatabase", name: "Shard the Database", rarity: "rare", type: "power", cost: 3, target: "none", effects: [{ op: "status", status: "optimized", amount: 3, target: "self" }], upgrade: { cost: 2 } }),
  card({ id: "allHands", name: "All Hands", rarity: "rare", type: "attack", cost: "x", target: "enemy", effects: [{ op: "serve", amount: 7, target: "enemy" }] }),
  card({ id: "planetScale", name: "Planet-Scale Database", rarity: "rare", type: "power", cost: 3, target: "none", effects: [{ op: "infra", infra: "readReplica", stacks: 2 }, { op: "infra", infra: "readCache", stacks: 1 }, { op: "warmCache", amount: 2 }] }),
  card({ id: "zeroDowntime", name: "Zero Downtime Deploy", rarity: "uncommon", type: "skill", cost: 2, target: "none", keywords: ["retain"], effects: [{ op: "capacity", amount: { base: 4, per: 2, of: "infraKinds" } }, { op: "draw", amount: 1 }] }),
  card({ id: "techDebt", name: "Tech Debt", pool: "status", rarity: "special", type: "status", cost: null, target: "none", keywords: ["unplayable"], effects: [] }),
  card({ id: "pager", name: "Pager", pool: "status", rarity: "special", type: "status", cost: null, target: "none", keywords: ["unplayable"], effects: [], endOfTurnInHand: [{ op: "loseBudget", amount: 2 }] }),
];

const enemy = (e: Omit<EnemyDef, "ai" | "moves"> & Partial<Pick<EnemyDef, "ai" | "moves">>): EnemyDef => ({
  moves: { spike: { name: "Spike", effects: [{ op: "hit", amount: 8 }] } },
  ai: { kind: "cycle", moves: ["spike"] },
  ...e,
});

const ENEMIES: EnemyDef[] = [
  enemy({ id: "botSwarm", name: "Bot Swarm", tier: "normal", load: [30, 34], description: "Lots of small requests.", sprite: "botSwarm" }),
  enemy({ id: "slowQuery", name: "Slow Query", tier: "normal", load: [22, 26], description: "Ties up a connection, then retries.", sprite: "slowQuery" }),
  enemy({ id: "memoryLeak", name: "Memory Leak", tier: "normal", load: [18, 20], description: "Grows a little every turn.", sprite: "memoryLeak" }),
  enemy({ id: "cronStorm", name: "Cron Storm", tier: "normal", load: [14, 16], description: "Every job fires at midnight.", sprite: "cronStorm" }),
  enemy({ id: "ddos", name: "DDoS Botnet", tier: "elite", load: [70, 74], description: "A flood from everywhere at once.", sprite: "ddos" }),
  enemy({ id: "launchDay", name: "Launch Day", tier: "boss", load: [180, 180], description: "Everyone shows up at once.", sprite: "launchDay" }),
];

const RELICS: RelicDef[] = [
  { id: "monitoring", name: "Monitoring", rarity: "starter", pool: "jordan", icon: "chart", text: "Draw 1 more card on turn 1. See enemy intents 2 turns ahead." },
  { id: "postmortemCulture", name: "Postmortem Culture", rarity: "starter", pool: "taylor", icon: "scroll", text: "Recover 4 Error Budget after each combat." },
  { id: "coffeeMachine", name: "Coffee Machine", rarity: "common", pool: "neutral", icon: "coffee", text: "Start each combat with 1 more Engineer." },
  { id: "statusPage", name: "Status Page", rarity: "uncommon", pool: "neutral", icon: "globe", text: "The first time you lose Error Budget each combat, gain 4 Capacity." },
  { id: "featureFlags", name: "Feature Flags", rarity: "rare", pool: "neutral", icon: "flask", text: "Your first Serve card each turn is played twice." },
  { id: "kubernetes", name: "Kubernetes", rarity: "boss", pool: "neutral", icon: "server", text: "Gain 1 Engineer each turn. Add a Config Drift to your deck at the start of each combat." },
  { id: "serviceMesh", name: "Service Mesh", rarity: "boss", pool: "neutral", icon: "network", text: "Cache effects are never halved." },
  { id: "dataLake", name: "Data Lake", rarity: "boss", pool: "neutral", icon: "database", text: "Choose from 1 more card in rewards." },
];

const RUNBOOKS: RunbookDef[] = [
  { id: "rollback", name: "Rollback", rarity: "common", icon: "clock", target: "none", effects: [{ op: "recover", amount: 10 }], text: "Recover 10 Error Budget." },
  { id: "killSwitch", name: "Kill Switch", rarity: "uncommon", icon: "bolt", target: "enemy", effects: [{ op: "serve", amount: 20, target: "enemy" }], text: "Serve 20 to an enemy." },
  { id: "warmStandby", name: "Warm Standby", rarity: "common", icon: "shield", target: "none", effects: [{ op: "capacity", amount: 12 }], text: "Gain 12 Capacity." },
];

const EVENTS: EventDef[] = [
  {
    id: "mayaOffsite",
    title: "The Offsite",
    acts: [1],
    speaker: "maya",
    lines: [
      "The team offsite is booked for Friday. Somebody has to stay on call.",
      "I could cover it, but I'd want something in return.",
      "Or we pay a contractor. They're good, but they aren't cheap.",
    ],
    choices: [
      { label: "Cover it yourself", detail: "Lose 6 Error Budget. Upgrade a card.", outcomes: [{ op: "budget", amount: -6 }, { op: "chooseCard", action: "upgrade" }], reply: "Good luck. Take notes for the retro." },
      { label: "Hire the contractor", detail: "Pay 120 cash. Gain a random rare card.", requires: { cash: 120 }, outcomes: [{ op: "cash", amount: -120 }, { op: "randomCard", rarity: "rare" }], reply: "Money well spent." },
      { label: "Skip the offsite", detail: "Nothing happens.", outcomes: [], reply: "Fair enough. Next time." },
    ],
  },
];

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]));

export const FIXTURE_CONTENT: Content = {
  cards: byId(CARDS),
  enemies: byId(ENEMIES),
  encounters: {
    bots: { id: "bots", act: 1, tier: "normal", enemies: ["botSwarm"], workload: "read", weight: 1 },
    queries: { id: "queries", act: 1, tier: "normal", enemies: ["slowQuery", "memoryLeak", "cronStorm"], workload: "write", weight: 1 },
    ddos: { id: "ddos", act: 1, tier: "elite", enemies: ["ddos"], workload: "read", weight: 1 },
    launchDay: { id: "launchDay", act: 1, tier: "boss", enemies: ["launchDay"], workload: "read", weight: 1 },
  },
  relics: byId(RELICS),
  runbooks: byId(RUNBOOKS),
  events: byId(EVENTS),
  characters: CHARACTERS,
};
