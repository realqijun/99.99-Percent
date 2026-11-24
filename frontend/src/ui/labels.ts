/* Display names and short explanations, from docs/GAMEPLAY.md. */
import type { Act, CardType, ColleagueId, Difficulty, InfraId, Intent, IntentKind, NodeKind, StatusId } from "../engine/types";

export const DIFFICULTIES: { level: Difficulty; label: string; adds: string }[] = [
  { level: 0, label: "99%", adds: "Base rules." },
  { level: 1, label: "99.9%", adds: "Major Incidents have 25% more Load." },
  { level: 2, label: "99.99%", adds: "Incidents have 10% more Load. You start with a Tech Debt." },
  { level: 3, label: "99.999%", adds: "Bosses have 20% more Load. A Retro recovers 20%." },
];

export const difficultyLabel = (d: Difficulty) => DIFFICULTIES[d].label;

export const ACT_NAMES: Record<Act, string> = { 1: "Seed Stage", 2: "Series A", 3: "Hypergrowth" };

export const COLLEAGUE_NAMES: Record<ColleagueId, string> = { maya: "Maya", alex: "Alex", jordan: "Jordan", sam: "Sam", taylor: "Taylor" };

export const portrait = (who: ColleagueId, celebrating = false) =>
  `${import.meta.env.BASE_URL}characters/${who}${celebrating ? "-celebrating" : ""}.webp`;

export const CARD_TYPES: Record<CardType, string> = { attack: "Serve", skill: "Ops", power: "Infrastructure", status: "Status" };

export const NODE_KINDS: Record<NodeKind, { name: string; text: string }> = {
  incident: { name: "Incident", text: "A normal combat." },
  major: { name: "Major Incident", text: "An elite combat. Drops a relic." },
  event: { name: "Event", text: "A scene with a colleague." },
  vendor: { name: "Vendor", text: "Buy cards, relics and runbooks, or remove a card." },
  retro: { name: "Retro", text: "Rest or upgrade a card." },
  treasure: { name: "Treasure", text: "A free relic." },
  boss: { name: "Boss", text: "The end of the act." },
};

export const INTENTS: Record<IntentKind, string> = {
  attack: "Sends requests",
  defend: "Adds Buffer",
  buff: "Buffs incidents",
  debuff: "Debuffs you",
  failure: "Node Failure: disables a piece of your infrastructure",
  summon: "Calls for backup",
  unknown: "Unknown",
};

export function intentText(intent: Intent): string {
  const hit = intent.hit ? `Sends ${plural(intent.hit.amount, "request")}${intent.hit.times > 1 ? `, ${intent.hit.times} times` : ""}` : INTENTS.attack;
  return intent.kinds.map((k) => (k === "attack" ? hit : INTENTS[k])).join(". ") || INTENTS.unknown;
}

export const STATUSES: Record<StatusId, { name: string; text: string; bad: boolean }> = {
  backlog: { name: "Backlog", text: "At the start of your turn, lose this much Error Budget, then it drops by 1.", bad: true },
  latency: { name: "Latency", text: "Your Serve does 25% less. Turns left.", bad: true },
  degraded: { name: "Degraded", text: "You take 50% more from incoming requests. Turns left.", bad: true },
  optimized: { name: "Optimized", text: "Each Serve hit does this much more.", bad: false },
  hardened: { name: "Hardened", text: "Each card that gives Capacity gives this much more.", bad: false },
  reserved: { name: "Reserved", text: "Capacity doesn't reset for this many turns.", bad: false },
  throttled: { name: "Throttled", text: "Sends 25% fewer requests. Turns left.", bad: true },
  exposed: { name: "Exposed", text: "Takes 50% more Serve. Turns left.", bad: true },
  scaling: { name: "Scaling", text: "Each hit sends this many more requests.", bad: false },
  retries: { name: "Retries", text: "Regains this much Load at the end of its turn.", bad: false },
};

export const INFRA: Record<InfraId, { name: string; text: string }> = {
  readCache: { name: "Read Cache", text: "Each turn, gain Capacity equal to its warmth times its stacks, halved in write-heavy encounters. Then warmth rises by 1, up to its limit of 6." },
  cacheTuning: { name: "Cache Tuning", text: "Raises the Read Cache warmth limit by 2 per stack." },
  loadBalancer: { name: "Load Balancer", text: "Routes App Servers. Without it they do nothing." },
  appServer: { name: "App Server", text: "With a Load Balancer, gain 4 Capacity per stack each turn." },
  autoscaler: { name: "Autoscaler", text: "Gain Capacity equal to the Error Budget you lost last round, up to 6 per stack." },
  cdn: { name: "CDN", text: "Gain 2 Capacity per stack each turn." },
  messageQueue: { name: "Message Queue", text: "Keep up to 5 unused Capacity per stack for the next turn." },
  readReplica: { name: "Read Replica", text: "Each turn, Serve a random enemy for 3 per stack, halved in write-heavy encounters." },
  healthChecks: { name: "Health Checks", text: "Node Failures last 1 turn instead of 2." },
  failover: { name: "Failover", text: "Ignores the next Node Failure, once per stack." },
  circuitBreaker: { name: "Circuit Breaker", text: "Each enemy hit that burns your Error Budget gives that enemy Throttled 1 per stack." },
  autoRemediation: { name: "Auto Remediation", text: "Each turn, lower your largest debuff by 1, once per stack." },
  onCall: { name: "On-Call Rotation", text: "When you draw a Pager, draw 1 and gain 3 Capacity, per stack." },
};

export const WORKLOADS = {
  read: { name: "Read-heavy", text: "Cache effects work in full." },
  write: { name: "Write-heavy", text: "Writes bypass the cache: cache effects are halved." },
} as const;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
