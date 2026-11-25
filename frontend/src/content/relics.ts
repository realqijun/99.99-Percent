import type { RelicDef } from "../engine/types";
import { byId } from "./byId";

/* Every relic (tech). `text` is hand written and must match the data exactly. */

const LIST: RelicDef[] = [
  // ---------- starters ----------
  {
    id: "monitoring", name: "Monitoring", rarity: "starter", pool: "jordan", icon: "chart",
    text: "Draw 1 more card on turn 1. See enemy intents 2 turns ahead.",
    flavor: "Graphs for everything, alerts for some.",
    trigger: "firstTurnStart", effects: [{ op: "draw", amount: 1 }], passive: [{ kind: "revealTurns", turns: 2 }],
  },
  {
    id: "postmortemCulture", name: "Postmortem Culture", rarity: "starter", pool: "taylor", icon: "book",
    text: "After each combat, recover 3 Error Budget.",
    flavor: "Every outage is a lesson. Some are long lessons.",
    trigger: "combatEnd", effects: [{ op: "recover", amount: 3 }],
  },

  // ---------- common ----------
  {
    id: "espressoMachine", name: "Espresso Machine", rarity: "common", pool: "neutral", icon: "coffee",
    text: "Gain 1 extra Engineer on turn 1.",
    flavor: "The real production dependency.",
    trigger: "firstTurnStart", effects: [{ op: "engineers", amount: 1 }],
  },
  {
    id: "luckyMug", name: "Lucky Mug", rarity: "common", pool: "neutral", icon: "coffee",
    text: "Draw 2 more cards on turn 1.",
    flavor: "Never washed. Never failed.",
    trigger: "firstTurnStart", effects: [{ op: "draw", amount: 2 }],
  },
  {
    id: "standingDesk", name: "Standing Desk", rarity: "common", pool: "neutral", icon: "gear",
    text: "Max Error Budget +7.",
    flavor: "Mostly used sitting down.",
    passive: [{ kind: "maxBudget", amount: 7 }],
  },
  {
    id: "rateLimiter", name: "Rate Limiter", rarity: "common", pool: "neutral", icon: "lock",
    text: "At the start of each combat, Throttle all enemies for 1 turn.",
    flavor: "Slow down. Everyone. Now.",
    trigger: "combatStart", effects: [{ op: "status", status: "throttled", amount: 1, target: "allEnemies" }],
  },
  {
    id: "wallDashboard", name: "Wall Dashboard", rarity: "common", pool: "neutral", icon: "chart",
    text: "Start each combat with 6 Capacity.",
    flavor: "Big screen, green lights, calm room.",
    passive: [{ kind: "startingCapacity", amount: 6 }],
  },
  {
    id: "loadTester", name: "Load Tester", rarity: "common", pool: "neutral", icon: "bolt",
    text: "Every 10th Serve card you play also Serves a random enemy for 10.",
    flavor: "Point it at prod. What could go wrong?",
    trigger: "attackPlayed", every: 10, effects: [{ op: "serve", amount: 10, target: "randomEnemy" }],
  },
  {
    id: "bugBounty", name: "Bug Bounty", rarity: "common", pool: "neutral", icon: "bug",
    text: "Whenever an enemy is resolved, gain 3 cash.",
    flavor: "Paid by the bug. Morally flexible.",
    trigger: "enemyResolved", effects: [{ op: "cash", amount: 3 }],
  },
  {
    id: "warmStandby", name: "Warm Standby", rarity: "common", pool: "neutral", icon: "shield",
    text: "At the start of each combat, install 1 Failover.",
    flavor: "A spare server, idling politely.",
    trigger: "combatStart", effects: [{ op: "infra", infra: "failover", stacks: 1 }],
  },
  {
    id: "nightlyBackup", name: "Nightly Backup", rarity: "common", pool: "neutral", icon: "database",
    text: "Whenever you lose Error Budget, gain 2 Capacity.",
    flavor: "Restored once. Tested never.",
    trigger: "budgetLost", effects: [{ op: "capacity", amount: 2 }],
  },
  {
    id: "swagHoodie", name: "Swag Hoodie", rarity: "common", pool: "neutral", icon: "rocket",
    text: "Combat cash rewards +15%.",
    flavor: "Logo on the back, budget on the front.",
    passive: [{ kind: "cashRewardPct", pct: 15 }],
  },

  // ---------- uncommon ----------
  {
    id: "stagingEnvironment", name: "Staging Environment", rarity: "uncommon", pool: "neutral", icon: "cloud",
    text: "At the start of each combat, install 1 CDN.",
    flavor: "Just like prod, except where it matters.",
    trigger: "combatStart", effects: [{ op: "infra", infra: "cdn", stacks: 1 }],
  },
  {
    id: "featureFlags", name: "Feature Flags", rarity: "uncommon", pool: "neutral", icon: "key",
    text: "Every 3rd turn, gain 1 extra Engineer.",
    flavor: "Ship it dark, light it up later.",
    trigger: "turnStart", every: 3, effects: [{ op: "engineers", amount: 1 }],
  },
  {
    id: "chaosLab", name: "Chaos Lab", rarity: "uncommon", pool: "neutral", icon: "flask",
    text: "At the start of each combat, all enemies are Exposed for 1 turn.",
    flavor: "We know where it breaks. We broke it.",
    trigger: "combatStart", effects: [{ op: "status", status: "exposed", amount: 1, target: "allEnemies" }],
  },
  {
    id: "pairProgramming", name: "Pair Programming", rarity: "uncommon", pool: "neutral", icon: "terminal",
    text: "Card rewards offer 1 more choice.",
    flavor: "Two keyboards, one opinion.",
    passive: [{ kind: "cardChoices", amount: 1 }],
  },
  {
    id: "spareRack", name: "Spare Rack", rarity: "uncommon", pool: "jordan", icon: "network",
    text: "At the start of each combat, install 1 Load Balancer.",
    flavor: "Pre-cabled, pre-labelled, pre-loved.",
    trigger: "combatStart", effects: [{ op: "infra", infra: "loadBalancer", stacks: 1 }],
  },
  {
    id: "pagerPhone", name: "On-Call Phone", rarity: "uncommon", pool: "taylor", icon: "pager",
    text: "At the start of each combat, install 1 On-Call Rotation.",
    flavor: "Battery always at 100%. Suspicious.",
    trigger: "combatStart", effects: [{ op: "infra", infra: "onCall", stacks: 1 }],
  },
  {
    id: "sloReport", name: "SLO Report", rarity: "uncommon", pool: "neutral", icon: "scroll",
    text: "After each combat, if Error Budget is below 50%, recover 6.",
    flavor: "Red numbers get attention.",
    trigger: "combatEnd",
    effects: [{ op: "if", cond: { kind: "budgetBelowPct", pct: 50 }, then: [{ op: "recover", amount: 6 }] }],
  },
  {
    id: "architectureDiagram", name: "Architecture Diagram", rarity: "uncommon", pool: "neutral", icon: "network",
    text: "Whenever you play an Infrastructure card, gain 3 Capacity.",
    flavor: "Boxes, arrows and one cloud labelled magic.",
    trigger: "powerPlayed", effects: [{ op: "capacity", amount: 3 }],
  },

  // ---------- rare ----------
  {
    id: "globalEdge", name: "Global Edge Network", rarity: "rare", pool: "neutral", icon: "globe",
    text: "At the start of each turn, gain 3 Capacity.",
    flavor: "A point of presence in every time zone.",
    trigger: "turnStart", effects: [{ op: "capacity", amount: 3 }],
  },
  {
    id: "profiler", name: "Profiler", rarity: "rare", pool: "neutral", icon: "clock",
    text: "Start each combat with Optimized 2.",
    flavor: "Found the slow part. It was us.",
    trigger: "combatStart", effects: [{ op: "status", status: "optimized", amount: 2, target: "self" }],
  },
  {
    id: "cacheWarmer", name: "Cache Warmer", rarity: "rare", pool: "neutral", icon: "database",
    text: "Cache effects are not halved in write-heavy encounters.",
    flavor: "Writes through, reads hot.",
    passive: [{ kind: "noCacheHalving" }],
  },
  {
    id: "selfHealingCluster", name: "Self-Healing Cluster", rarity: "rare", pool: "neutral", icon: "server",
    text: "At the start of each turn, repair all disabled infrastructure.",
    flavor: "It restarts itself. We just watch.",
    trigger: "turnStart", effects: [{ op: "repair" }],
  },
  {
    id: "goldenSignals", name: "Golden Signals", rarity: "rare", pool: "neutral", icon: "bolt",
    text: "Every 3rd Serve card you play gives 1 Engineer.",
    flavor: "Latency, traffic, errors, saturation.",
    trigger: "attackPlayed", every: 3, effects: [{ op: "engineers", amount: 1 }],
  },
  {
    id: "chaosDrills", name: "Chaos Drills", rarity: "rare", pool: "taylor", icon: "shield",
    text: "At the start of each combat, install 1 Health Checks and 1 Failover.",
    flavor: "We pull the plug every Thursday.",
    trigger: "combatStart",
    effects: [{ op: "infra", infra: "healthChecks", stacks: 1 }, { op: "infra", infra: "failover", stacks: 1 }],
  },

  // ---------- boss ----------
  {
    id: "offshoreContractors", name: "Offshore Contractors", rarity: "boss", pool: "neutral", icon: "globe",
    text: "Gain 1 extra Engineer each turn. At the start of each combat, add 2 Config Drift to your draw pile.",
    flavor: "Cheap, fast, and on a different config.",
    passive: [{ kind: "engineersPerTurn", amount: 1 }],
    drawback: [{ op: "addCard", card: "configDrift", zone: "draw", count: 2 }],
  },
  {
    id: "containerOrchestrator", name: "Container Orchestrator", rarity: "boss", pool: "neutral", icon: "gear",
    text: "Gain 1 extra Engineer each turn. Start each combat with Latency 2.",
    flavor: "Powerful, once the YAML settles.",
    passive: [{ kind: "engineersPerTurn", amount: 1 }],
    drawback: [{ op: "status", status: "latency", amount: 2, target: "self" }],
  },
  {
    id: "dataLake", name: "Data Lake", rarity: "boss", pool: "neutral", icon: "database",
    text: "Draw 1 more card each turn. At the start of each combat, add 1 Tech Debt to your draw pile.",
    flavor: "Everything goes in. Some of it comes out.",
    passive: [{ kind: "drawPerTurn", amount: 1 }],
    drawback: [{ op: "addCard", card: "techDebt", zone: "draw", count: 1 }],
  },
  {
    id: "multiRegion", name: "Multi-Region", rarity: "boss", pool: "neutral", icon: "cloud",
    text: "At the start of each turn, gain 5 Capacity. At the start of each combat, add 2 Pagers to your draw pile.",
    flavor: "Twice the uptime, twice the alerts.",
    trigger: "turnStart", effects: [{ op: "capacity", amount: 5 }],
    drawback: [{ op: "addCard", card: "pager", zone: "draw", count: 2 }],
  },

  // ---------- shop ----------
  {
    id: "cloudCredits", name: "Cloud Credits", rarity: "shop", pool: "neutral", icon: "cloud",
    text: "Vendor prices are 20% lower.",
    flavor: "Expires in 12 months. Use it or lose it.",
    passive: [{ kind: "shopDiscountPct", pct: 20 }],
  },
  {
    id: "runbookBinder", name: "Runbook Binder", rarity: "shop", pool: "neutral", icon: "book",
    text: "Hold 1 more runbook.",
    flavor: "Laminated, tabbed and slightly coffee-stained.",
    passive: [{ kind: "runbookSlots", amount: 1 }],
  },
  {
    id: "teamOffsite", name: "Team Offsite", rarity: "shop", pool: "neutral", icon: "rocket",
    text: "Resting at a Retro recovers 15% more of your max Error Budget.",
    flavor: "Trust falls, then a nap.",
    passive: [{ kind: "restRecoverPct", pct: 15 }],
  },
  {
    id: "expenseAccount", name: "Expense Account", rarity: "shop", pool: "neutral", icon: "key",
    text: "After each combat, gain 5 cash.",
    flavor: "Team lunch counts as infrastructure.",
    trigger: "combatEnd", effects: [{ op: "cash", amount: 5 }],
  },
];

export const RELICS: Record<string, RelicDef> = byId(LIST);
