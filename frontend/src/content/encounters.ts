import type { Act, EncounterDef, Tier, Workload } from "../engine/types";
import { byId } from "./byId";

/*
 * Every encounter. Normal encounters may mix enemies from earlier acts.
 * Total Load targets per normal encounter: Act 1 12-50, Act 2 20-85, Act 3 30-120.
 */

type Row = [id: string, act: Act, tier: Tier, enemies: string[], workload: Workload, weight?: number];

const ROWS: Row[] = [
  // the guided first combat; weight 0 keeps it out of the random pool
  ["tutorial", 1, "normal", ["trafficSpike"], "read", 0],

  // ---------- Act 1 ----------
  ["a1SpikePair", 1, "normal", ["trafficSpike", "trafficSpike"], "read"],
  ["a1SlowQuery", 1, "normal", ["slowQuery"], "read"],
  ["a1MemoryLeak", 1, "normal", ["memoryLeak"], "write"],
  ["a1LogFlood", 1, "normal", ["logFlood"], "write"],
  ["a1ColdStart", 1, "normal", ["coldStart"], "read"],
  ["a1Crawlers", 1, "normal", ["botCrawler", "botCrawler"], "read"],
  ["a1CrawlerSpike", 1, "normal", ["botCrawler", "trafficSpike"], "write"],
  ["a1ColdSpike", 1, "normal", ["coldStart", "trafficSpike"], "write"],
  ["a1SpikeTrio", 1, "normal", ["trafficSpike", "trafficSpike", "trafficSpike"], "read"],
  ["a1NoisyLogs", 1, "normal", ["logFlood", "trafficSpike"], "write"],
  ["a1CrawlerTrio", 1, "normal", ["trafficSpike", "botCrawler", "trafficSpike"], "read"],
  ["a1Herd", 1, "elite", ["thunderingHerd"], "read"],
  ["a1Lock", 1, "elite", ["lockContention"], "write"],
  ["a1HerdSpike", 1, "elite", ["thunderingHerd", "trafficSpike"], "write"],
  ["a1LaunchDay", 1, "boss", ["launchDay"], "read"],

  // ---------- Act 2 ----------
  ["a2CacheStampede", 2, "normal", ["cacheStampede"], "read"],
  ["a2RetryStorm", 2, "normal", ["retryStorm"], "write"],
  ["a2NoisyNeighbor", 2, "normal", ["noisyNeighbor"], "read"],
  ["a2ConnectionLeak", 2, "normal", ["connectionLeak"], "write"],
  ["a2HotPartition", 2, "normal", ["hotPartition"], "write"],
  ["a2FlakyDeploy", 2, "normal", ["flakyDeploy"], "read"],
  ["a2NeighborCrawler", 2, "normal", ["noisyNeighbor", "botCrawler"], "read"],
  ["a2RetrySpike", 2, "normal", ["retryStorm", "trafficSpike"], "write"],
  ["a2FlakyQuery", 2, "normal", ["flakyDeploy", "slowQuery"], "write"],
  ["a2StampedeTrio", 2, "normal", ["trafficSpike", "cacheStampede", "trafficSpike"], "read"],
  ["a2ColdLeak", 2, "normal", ["coldStart", "connectionLeak"], "write"],
  ["a2Botnet", 2, "elite", ["ddosBotnet"], "read"],
  ["a2SplitBrain", 2, "elite", ["splitBrain", "splitBrain"], "write"],
  ["a2BotnetRetry", 2, "elite", ["retryStorm", "ddosBotnet"], "write"],
  ["a2BlackFriday", 2, "boss", ["blackFriday"], "write"],

  // ---------- Act 3 ----------
  ["a3Cascading", 3, "normal", ["cascadingFailure"], "write"],
  ["a3CertExpiry", 3, "normal", ["certExpiry"], "read"],
  ["a3DnsOutage", 3, "normal", ["dnsOutage"], "read"],
  ["a3ClockSkew", 3, "normal", ["clockSkew"], "write"],
  ["a3Zombie", 3, "normal", ["zombieProcess"], "write"],
  ["a3ConfigGhost", 3, "normal", ["configGhost"], "read"],
  ["a3CertLeak", 3, "normal", ["certExpiry", "connectionLeak"], "read"],
  ["a3ZombieRetry", 3, "normal", ["zombieProcess", "retryStorm"], "write"],
  ["a3HauntedLogs", 3, "normal", ["configGhost", "logFlood"], "write"],
  ["a3DnsSpikes", 3, "normal", ["trafficSpike", "dnsOutage", "trafficSpike"], "read"],
  ["a3ZombieStampede", 3, "normal", ["zombieProcess", "cacheStampede"], "read"],
  ["a3DataCorruption", 3, "elite", ["dataCorruption"], "write"],
  ["a3Monolith", 3, "elite", ["legacyMonolith"], "read"],
  ["a3CorruptZombie", 3, "elite", ["dataCorruption", "zombieProcess"], "read"],
  ["a3RegionOutage", 3, "boss", ["regionOutage"], "write"],
];

export const ENCOUNTERS: Record<string, EncounterDef> = byId(
  ROWS.map(([id, act, tier, enemies, workload, weight = 1]) => ({ id, act, tier, enemies, workload, weight })),
);
