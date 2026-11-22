import type { RunbookDef } from "../engine/types";
import { byId } from "./byId";

/* Single-use items used in combat. `text` is hand written and must match the effects exactly. */

const LIST: RunbookDef[] = [
  // common
  {
    id: "restartService", name: "Restart Service", rarity: "common", icon: "server", target: "none",
    effects: [{ op: "capacity", amount: 12 }],
    text: "Gain 12 Capacity.",
  },
  {
    id: "killQuery", name: "Kill Query", rarity: "common", icon: "terminal", target: "enemy",
    effects: [{ op: "serve", amount: 20, target: "enemy" }],
    text: "Serve an enemy for 20.",
  },
  {
    id: "scaleUp", name: "Scale Up", rarity: "common", icon: "rocket", target: "none",
    effects: [{ op: "engineers", amount: 2 }],
    text: "Gain 2 Engineers.",
  },
  {
    id: "flushLogs", name: "Flush Logs", rarity: "common", icon: "scroll", target: "none",
    effects: [{ op: "draw", amount: 3 }],
    text: "Draw 3 cards.",
  },
  // uncommon
  {
    id: "rollback", name: "Rollback", rarity: "uncommon", icon: "clock", target: "none",
    effects: [{ op: "repair" }, { op: "removeStatus", status: "debuffs", target: "self" }],
    text: "Repair all disabled infrastructure and remove all your debuffs.",
  },
  {
    id: "rateLimitRule", name: "Rate Limit Rule", rarity: "uncommon", icon: "lock", target: "none",
    effects: [{ op: "status", status: "throttled", amount: 2, target: "allEnemies" }],
    text: "Throttle all enemies for 2 turns.",
  },
  {
    id: "cacheWarmup", name: "Cache Warmup Script", rarity: "uncommon", icon: "database", target: "none",
    effects: [{ op: "warmCache", amount: 3 }, { op: "capacity", amount: 5 }],
    text: "Warm the Read Cache by 3 and gain 5 Capacity.",
  },
  {
    id: "blockIpRange", name: "Block IP Range", rarity: "uncommon", icon: "shield", target: "enemy",
    effects: [{ op: "serve", amount: 10, target: "enemy" }, { op: "status", status: "exposed", amount: 2, target: "enemy" }],
    text: "Serve an enemy for 10, then make it Exposed for 2 turns.",
  },
  // rare
  {
    id: "budgetWaiver", name: "Error Budget Waiver", rarity: "rare", icon: "key", target: "none",
    effects: [{ op: "recover", amount: 15 }],
    text: "Recover 15 Error Budget.",
  },
  {
    id: "globalFailover", name: "Global Failover", rarity: "rare", icon: "globe", target: "none",
    effects: [{ op: "infra", infra: "failover", stacks: 2 }, { op: "capacity", amount: 10 }],
    text: "Install 2 Failover and gain 10 Capacity.",
  },
];

export const RUNBOOKS: Record<string, RunbookDef> = byId(LIST);
