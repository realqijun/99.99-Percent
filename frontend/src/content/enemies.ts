import type { EnemyDef, EnemyEffect, EnemyStatusId, PlayerStatusId } from "../engine/types";
import { byId } from "./byId";

/*
 * Every enemy. Load targets: Act 1 normal 12-50, elites 75-110, boss about 240;
 * Act 2 about 1.7x and Act 3 about 2.4x. `sprite` always equals the id.
 */

// ---------- effect helpers ----------

const hit = (amount: number, times?: number): EnemyEffect =>
  times && times > 1 ? { op: "hit", amount, times } : { op: "hit", amount };
const buffer = (amount: number, target: "self" | "allies" = "self"): EnemyEffect => ({ op: "buffer", amount, target });
const onPlayer = (status: PlayerStatusId, amount: number): EnemyEffect => ({ op: "status", status, amount, target: "player" });
const onSelf = (status: EnemyStatusId, amount: number): EnemyEffect => ({ op: "status", status, amount, target: "self" });
const onAllies = (status: EnemyStatusId, amount: number): EnemyEffect => ({ op: "status", status, amount, target: "allies" });
const addCard = (card: string, zone: "hand" | "draw" | "discard", count: number): EnemyEffect => ({ op: "addCard", card, zone, count });
const nodeFailure: EnemyEffect = { op: "nodeFailure" };
const summon = (enemy: string, count: number): EnemyEffect => ({ op: "summon", enemy, count });
const heal = (amount: number): EnemyEffect => ({ op: "heal", amount });

type Def = Omit<EnemyDef, "sprite">;

const LIST: Def[] = [
  // ---------- Act 1: Seed Stage ----------
  {
    id: "trafficSpike", name: "Traffic Spike", tier: "normal", load: [12, 15],
    moves: {
      surge: { name: "Surge", effects: [hit(7)] },
      doubleTap: { name: "Double Tap", effects: [hit(4, 2)] },
      rampUp: { name: "Ramp Up", effects: [hit(4), onSelf("scaling", 1)] },
    },
    ai: { kind: "weighted", weights: { surge: 3, doubleTap: 2, rampUp: 1 }, maxRepeat: 2 },
    description: "A sudden pile of requests. Loud, simple and over soon.",
  },
  {
    id: "botCrawler", name: "Bot Crawler", tier: "normal", load: [18, 22],
    moves: {
      crawl: { name: "Crawl Every Page", effects: [hit(4, 3)] },
      scrape: { name: "Scrape", effects: [hit(7), onPlayer("degraded", 1)] },
      spoof: { name: "Spoof User Agent", effects: [buffer(7)] },
    },
    ai: { kind: "weighted", weights: { crawl: 2, scrape: 2, spoof: 1 }, maxRepeat: 1 },
    description: "Reads every page you have, many times, and buys nothing.",
  },
  {
    id: "slowQuery", name: "Slow Query", tier: "normal", load: [34, 38],
    moves: {
      fullTableScan: { name: "Full Table Scan", effects: [hit(9), onPlayer("latency", 2)] },
      nPlusOne: { name: "N+1 Queries", effects: [hit(4, 4)] },
      lockWait: { name: "Lock Wait", effects: [hit(14)] },
    },
    ai: { kind: "cycle", moves: ["fullTableScan", "nPlusOne", "lockWait"] },
    description: "Scans the whole table and adds Latency, slowing your Serve.",
  },
  {
    id: "memoryLeak", name: "Memory Leak", tier: "normal", load: [40, 46],
    moves: {
      allocate: { name: "Allocate", effects: [hit(8), onSelf("scaling", 1)] },
      swapThrash: { name: "Swap Thrash", effects: [hit(4, 2), onSelf("scaling", 1)] },
    },
    ai: { kind: "cycle", moves: ["allocate", "swapThrash"] },
    description: "Gains Scaling every turn. Deal with it before it eats the heap.",
  },
  {
    id: "coldStart", name: "Cold Start", tier: "normal", load: [28, 34],
    moves: {
      booting: { name: "Booting", effects: [buffer(8)] },
      initBurst: { name: "Init Burst", effects: [hit(17)] },
      warmIdle: { name: "Warm Idle", effects: [hit(7), buffer(6)] },
    },
    ai: { kind: "script", opening: ["booting"], then: { kind: "cycle", moves: ["initBurst", "warmIdle"] } },
    description: "Spends a turn booting, then hits hard on the first request.",
  },
  {
    id: "logFlood", name: "Log Flood", tier: "normal", load: [32, 38],
    moves: {
      verbose: { name: "Verbose Logging", effects: [hit(7), addCard("techDebt", "discard", 1)] },
      stackTrace: { name: "Stack Trace", effects: [hit(14)] },
      debugMode: { name: "Debug Mode", effects: [hit(5), addCard("techDebt", "draw", 2)] },
    },
    ai: { kind: "weighted", weights: { verbose: 3, stackTrace: 2, debugMode: 1 }, maxRepeat: 1 },
    description: "Writes everything down and clogs your deck with Tech Debt.",
  },
  {
    id: "thunderingHerd", name: "Thundering Herd", tier: "elite", load: [78, 84],
    moves: {
      stampede: { name: "Stampede", effects: [hit(4, 4)] },
      regroup: { name: "Regroup", effects: [onSelf("scaling", 1), buffer(12)] },
      wakeAll: { name: "Wake Everyone", effects: [hit(17), onPlayer("degraded", 1)] },
    },
    ai: { kind: "script", opening: ["stampede"], then: { kind: "cycle", moves: ["regroup", "stampede", "wakeAll"] } },
    description: "Every client retries at once. Its many hits grow after each Regroup.",
  },
  {
    id: "lockContention", name: "Lock Contention", tier: "elite", load: [90, 98],
    moves: {
      acquireLock: { name: "Acquire Lock", effects: [buffer(12), hit(8)] },
      waitQueue: { name: "Wait Queue", effects: [hit(7), onPlayer("backlog", 3)] },
      deadlock: { name: "Deadlock", effects: [hit(23)] },
    },
    ai: { kind: "cycle", moves: ["acquireLock", "waitQueue", "deadlock"] },
    description: "Holds a Buffer, queues Backlog, then deadlocks for a big hit.",
  },
  {
    id: "launchDay", name: "Launch Day", tier: "boss", load: [110, 120],
    moves: {
      pressRelease: { name: "Press Release", effects: [summon("trafficSpike", 1)] },
      frontPage: { name: "Front Page", effects: [hit(6, 3)] },
      signupRush: { name: "Signup Rush", effects: [hit(14), addCard("pager", "draw", 1)] },
      hugOfDeath: { name: "Hug of Death", effects: [hit(9, 3)] },
    },
    ai: {
      kind: "phases",
      phases: [
        { atOrBelowPct: 50, ai: { kind: "cycle", moves: ["pressRelease", "hugOfDeath", "signupRush", "frontPage"] } },
        {
          atOrBelowPct: 100,
          ai: { kind: "script", opening: ["pressRelease"], then: { kind: "cycle", moves: ["frontPage", "signupRush", "pressRelease"] } },
        },
      ],
    },
    description: "The launch everyone wanted. Calls in Traffic Spikes and gets wilder at half Load.",
  },

  // ---------- Act 2: Series A ----------
  {
    id: "cacheStampede", name: "Cache Stampede", tier: "normal", load: [50, 58],
    moves: {
      missStorm: { name: "Miss Storm", effects: [hit(4, 4)] },
      coldKeys: { name: "Cold Keys", effects: [hit(7), onPlayer("degraded", 2)] },
      rebuild: { name: "Rebuild Everything", effects: [buffer(12), onSelf("scaling", 1)] },
    },
    ai: { kind: "weighted", weights: { missStorm: 2, coldKeys: 2, rebuild: 1 }, maxRepeat: 2 },
    description: "A hot key expires and everyone recomputes it. Leaves you Degraded.",
  },
  {
    id: "retryStorm", name: "Retry Storm", tier: "normal", load: [44, 50],
    moves: {
      backoff: { name: "Exponential Backoff", effects: [buffer(8), onSelf("retries", 3)] },
      retry: { name: "Retry", effects: [hit(6, 2)] },
      retryAll: { name: "Retry Everything", effects: [hit(4, 4)] },
      jitter: { name: "Jittered Backoff", effects: [buffer(8), hit(5)] },
    },
    // Retries stack twice, then stop, so a slow deck still wins in the end.
    ai: { kind: "script", opening: ["backoff", "retry", "retryAll", "backoff"], then: { kind: "cycle", moves: ["retry", "retryAll", "jitter"] } },
    description: "Gains Retries early, so it regains Load each turn. Finish it quickly.",
  },
  {
    id: "noisyNeighbor", name: "Noisy Neighbor", tier: "normal", load: [60, 68],
    moves: {
      stealCpu: { name: "Steal CPU", effects: [hit(9), onPlayer("degraded", 1)] },
      thrashDisk: { name: "Thrash Disk", effects: [hit(16)] },
      hogResources: { name: "Hog Resources", effects: [buffer(10), onAllies("scaling", 1)] },
    },
    ai: { kind: "weighted", weights: { stealCpu: 2, thrashDisk: 2, hogResources: 1 }, maxRepeat: 1 },
    description: "Shares your host and your CPU. Gives Scaling to its allies.",
  },
  {
    id: "connectionLeak", name: "Connection Leak", tier: "normal", load: [52, 60],
    moves: {
      openSocket: { name: "Open Socket", effects: [hit(5), onPlayer("backlog", 2)] },
      exhaustPool: { name: "Exhaust Pool", effects: [hit(12)] },
      holdOpen: { name: "Hold Open", effects: [buffer(10), onPlayer("backlog", 2)] },
    },
    ai: { kind: "cycle", moves: ["openSocket", "exhaustPool", "holdOpen"] },
    description: "Never closes a socket. Piles Backlog on you turn after turn.",
  },
  {
    id: "hotPartition", name: "Hot Partition", tier: "normal", load: [70, 80],
    moves: {
      hotShard: { name: "Hot Shard", effects: [hit(9), onSelf("scaling", 2)] },
      skewedKey: { name: "Skewed Key", effects: [hit(19)] },
      rebalance: { name: "Rebalance", effects: [buffer(18)] },
    },
    ai: { kind: "cycle", moves: ["hotShard", "skewedKey", "rebalance"] },
    description: "One shard takes all the traffic. Telegraphs one huge hit.",
  },
  {
    id: "flakyDeploy", name: "Flaky Deploy", tier: "normal", load: [48, 56],
    moves: {
      badRollout: { name: "Bad Rollout", effects: [nodeFailure, hit(8)] },
      flakyTest: { name: "Flaky Test", effects: [hit(5, 2)] },
      rollback: { name: "Rollback", effects: [heal(10), buffer(6)] },
    },
    ai: { kind: "weighted", weights: { badRollout: 2, flakyTest: 2, rollback: 1 }, maxRepeat: 1 },
    description: "Passes on retry, fails in prod. Causes Node Failures.",
  },
  {
    id: "ddosBotnet", name: "DDoS Botnet", tier: "elite", load: [100, 108],
    moves: {
      amplify: { name: "Amplify", effects: [hit(8), onSelf("scaling", 2)] },
      packetFlood: { name: "Packet Flood", effects: [hit(2, 6)] },
      spoofOrigins: { name: "Spoof Origins", effects: [buffer(20), addCard("pager", "discard", 1)] },
    },
    ai: { kind: "script", opening: ["amplify"], then: { kind: "cycle", moves: ["packetFlood", "spoofOrigins", "amplify"] } },
    description: "Thousands of hijacked toasters. Its many small hits keep Scaling up.",
  },
  {
    id: "splitBrain", name: "Split Brain", tier: "elite", load: [70, 78],
    moves: {
      conflictingWrites: { name: "Conflicting Writes", effects: [hit(9), onPlayer("degraded", 1)] },
      electSelf: { name: "Elect Self", effects: [buffer(14), onSelf("scaling", 1)] },
      quorumGrab: { name: "Quorum Grab", effects: [hit(5, 2)] },
      resync: { name: "Resync", effects: [heal(12), buffer(6, "allies")] },
    },
    ai: { kind: "weighted", weights: { conflictingWrites: 3, electSelf: 2, quorumGrab: 2, resync: 1 }, maxRepeat: 1 },
    description: "One half of a cluster with two leaders. The other half is never far.",
  },
  {
    id: "blackFriday", name: "Black Friday", tier: "boss", load: [190, 200],
    moves: {
      doorbusters: { name: "Doorbusters", effects: [summon("shopperWave", 1)] },
      checkoutRush: { name: "Checkout Rush", effects: [hit(7, 3)] },
      flashSale: { name: "Flash Sale", effects: [hit(24)] },
      inventoryLock: { name: "Inventory Lock", effects: [buffer(25), addCard("pager", "draw", 2)] },
    },
    ai: {
      kind: "phases",
      phases: [
        { atOrBelowPct: 50, ai: { kind: "cycle", moves: ["doorbusters", "flashSale", "checkoutRush", "inventoryLock"] } },
        {
          atOrBelowPct: 100,
          ai: { kind: "script", opening: ["doorbusters"], then: { kind: "cycle", moves: ["checkoutRush", "inventoryLock", "flashSale", "doorbusters"] } },
        },
      ],
    },
    description: "The biggest sales day of the year. Summons Shopper Waves and floods you with Pagers.",
  },
  {
    id: "shopperWave", name: "Shopper Wave", tier: "normal", load: [20, 24],
    moves: {
      addToCart: { name: "Add to Cart", effects: [hit(6)] },
      refreshSpam: { name: "Refresh Spam", effects: [hit(3, 3)] },
    },
    ai: { kind: "weighted", weights: { addToCart: 1, refreshSpam: 1 }, maxRepeat: 2 },
    description: "Deal hunters mashing refresh on the checkout page.",
  },

  // ---------- Act 3: Hypergrowth ----------
  {
    id: "cascadingFailure", name: "Cascading Failure", tier: "normal", load: [82, 90],
    moves: {
      spread: { name: "Spread", effects: [hit(8), onPlayer("degraded", 2)] },
      domino: { name: "Domino", effects: [hit(7, 2), onSelf("scaling", 2)] },
      collapse: { name: "Collapse", effects: [hit(21)] },
    },
    ai: { kind: "cycle", moves: ["spread", "domino", "collapse"] },
    description: "One failure knocks over the next. Degrades you and keeps Scaling.",
  },
  {
    id: "certExpiry", name: "Cert Expiry", tier: "normal", load: [62, 70],
    moves: {
      renewalReminder: { name: "Renewal Reminder", effects: [buffer(18)] },
      finalWarning: { name: "Final Warning", effects: [buffer(18), onSelf("scaling", 4)] },
      expired: { name: "Expired", effects: [hit(25)] },
      handshakeFailures: { name: "Handshake Failures", effects: [hit(6, 3)] },
    },
    ai: {
      kind: "script",
      opening: ["renewalReminder", "finalWarning"],
      then: { kind: "cycle", moves: ["expired", "handshakeFailures"] },
    },
    description: "Quiet for two turns, then every handshake fails at once.",
  },
  {
    id: "dnsOutage", name: "DNS Outage", tier: "normal", load: [80, 90],
    moves: {
      nxdomain: { name: "NXDOMAIN", effects: [hit(16)] },
      resolverDown: { name: "Resolver Down", effects: [hit(10), addCard("pager", "draw", 2)] },
      slowPropagation: { name: "Slow Propagation", effects: [hit(6, 3), onPlayer("latency", 1)] },
    },
    ai: { kind: "weighted", weights: { nxdomain: 2, resolverDown: 2, slowPropagation: 2 }, maxRepeat: 1 },
    description: "It's always DNS. Sets off Pagers across the whole team.",
  },
  {
    id: "clockSkew", name: "Clock Skew", tier: "normal", load: [70, 78],
    moves: {
      desync: { name: "Desync", effects: [hit(6), onPlayer("latency", 2), onPlayer("degraded", 2)] },
      futureTimestamp: { name: "Future Timestamp", effects: [hit(20)] },
      outOfOrder: { name: "Out of Order", effects: [hit(7, 3)] },
      leapSecond: { name: "Leap Second", effects: [hit(10), buffer(14)] },
    },
    ai: { kind: "weighted", weights: { desync: 1, futureTimestamp: 2, outOfOrder: 2, leapSecond: 1 }, maxRepeat: 1 },
    description: "Nobody agrees what time it is. Hard to predict, worse when it Desyncs.",
  },
  {
    id: "zombieProcess", name: "Zombie Process", tier: "normal", load: [56, 64],
    moves: {
      holdHandles: { name: "Hold File Handles", effects: [hit(9), onPlayer("backlog", 2)] },
      gnaw: { name: "Gnaw", effects: [hit(15)] },
      respawn: { name: "Respawn", effects: [heal(15), buffer(8)] },
    },
    ai: { kind: "cycle", moves: ["holdHandles", "gnaw", "respawn"] },
    description: "Killed long ago and still running. Heals itself every third turn.",
  },
  {
    id: "configGhost", name: "Config Ghost", tier: "normal", load: [64, 72],
    moves: {
      haunt: { name: "Haunt", effects: [hit(8), addCard("configDrift", "draw", 2)] },
      phantomOverride: { name: "Phantom Override", effects: [hit(14), onPlayer("degraded", 1)] },
      fadeAway: { name: "Fade Away", effects: [buffer(24)] },
    },
    ai: { kind: "weighted", weights: { haunt: 2, phantomOverride: 3, fadeAway: 1 }, maxRepeat: 1 },
    description: "A setting nobody remembers changing. Slips Config Drift into your deck.",
  },
  {
    id: "dataCorruption", name: "Data Corruption", tier: "elite", load: [135, 145],
    moves: {
      silentCorruption: { name: "Silent Corruption", effects: [onPlayer("backlog", 5), onPlayer("latency", 2)] },
      bitRot: { name: "Bit Rot", effects: [hit(8, 2), addCard("techDebt", "draw", 1)] },
      checksumFailure: { name: "Checksum Failure", effects: [hit(27)] },
    },
    ai: { kind: "cycle", moves: ["silentCorruption", "bitRot", "checksumFailure"] },
    description: "Quietly wrong for weeks. Stacks Backlog, Latency and Tech Debt.",
  },
  {
    id: "legacyMonolith", name: "Legacy Monolith", tier: "elite", load: [180, 190],
    moves: {
      bigBallOfMud: { name: "Big Ball of Mud", effects: [buffer(40), addCard("techDebt", "discard", 2)] },
      tightCoupling: { name: "Tight Coupling", effects: [hit(12), onSelf("scaling", 3)] },
      nightlyBatch: { name: "Nightly Batch Job", effects: [hit(32)] },
    },
    ai: { kind: "cycle", moves: ["bigBallOfMud", "tightCoupling", "nightlyBatch"] },
    description: "Twenty years of code in one process. Huge Buffer, endless Tech Debt.",
  },
  {
    id: "regionOutage", name: "Region Outage", tier: "boss", load: [250, 260],
    moves: {
      zoneDown: { name: "Zone Down", effects: [nodeFailure, summon("failingZone", 1)] },
      brownout: { name: "Brownout", effects: [hit(8, 3)] },
      failoverStorm: { name: "Failover Storm", effects: [nodeFailure, nodeFailure, hit(12)] },
      totalBlackout: { name: "Total Blackout", effects: [hit(30)] },
    },
    ai: {
      kind: "phases",
      phases: [
        { atOrBelowPct: 33, ai: { kind: "cycle", moves: ["failoverStorm", "totalBlackout", "brownout"] } },
        { atOrBelowPct: 66, ai: { kind: "cycle", moves: ["failoverStorm", "brownout", "zoneDown", "totalBlackout"] } },
        { atOrBelowPct: 100, ai: { kind: "cycle", moves: ["zoneDown", "brownout"] } },
      ],
    },
    description: "A whole region goes dark. Knocks out your infrastructure, zone by zone.",
  },
  {
    id: "failingZone", name: "Failing Zone", tier: "normal", load: [40, 48],
    moves: {
      partialOutage: { name: "Partial Outage", effects: [hit(10)] },
      packetLoss: { name: "Packet Loss", effects: [hit(6), onPlayer("degraded", 1)] },
    },
    ai: { kind: "cycle", moves: ["partialOutage", "packetLoss"] },
    description: "An availability zone on its way down, dragging traffic with it.",
  },
];

export const ENEMIES: Record<string, EnemyDef> = byId(LIST.map((def) => ({ ...def, sprite: def.id })));
