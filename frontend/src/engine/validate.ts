/*
 * Structural check of a saved run. Every field is checked, unknown keys are refused,
 * and every id must exist in the content.
 */
import { FIGHT_TIERS } from "./map";
import { STREAMS } from "./rng";
import type { Content, MapNode, RunState } from "./types";

type Check = (x: unknown) => boolean;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str: Check = (x) => typeof x === "string";
const bool: Check = (x) => typeof x === "boolean";
const int: Check = (x) => Number.isSafeInteger(x);
const nat: Check = (x) => int(x) && (x as number) >= 0;
const oneOf =
  (...values: readonly unknown[]): Check =>
  (x) =>
    values.includes(x);
const nullable =
  (check: Check): Check =>
  (x) =>
    x === null || check(x);
const list =
  (check: Check): Check =>
  (x) =>
    Array.isArray(x) && x.every(check);
const idIn =
  (table: Record<string, unknown>): Check =>
  (x) =>
    typeof x === "string" && Object.hasOwn(table, x);
const record =
  (keys: Check, value: Check): Check =>
  (x) =>
    isObj(x) && Object.entries(x).every(([k, v]) => keys(k) && value(v));

/** An object with exactly these keys (optional ones may be missing). */
function shape(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return (x) => {
    if (!isObj(x)) return false;
    for (const [key, check] of Object.entries(required)) if (!Object.hasOwn(x, key) || !check(x[key])) return false;
    for (const [key, value] of Object.entries(x)) {
      if (Object.hasOwn(required, key)) continue;
      if (!Object.hasOwn(optional, key) || (value !== undefined && !optional[key](value))) return false;
    }
    return true;
  };
}

/** A tagged union: `tag` picks the shape. */
function union(tag: string, shapes: Record<string, Record<string, Check>>, optional: Record<string, Record<string, Check>> = {}): Check {
  return (x) => isObj(x) && typeof x[tag] === "string" && Object.hasOwn(shapes, x[tag] as string)
    && shape({ [tag]: str, ...shapes[x[tag] as string] }, optional[x[tag] as string])(x);
}

const STATUS_IDS = ["backlog", "latency", "degraded", "optimized", "hardened", "reserved", "throttled", "exposed", "scaling", "retries"];
const INFRA_IDS = [
  "readCache", "cacheTuning", "loadBalancer", "appServer", "autoscaler", "cdn", "messageQueue",
  "readReplica", "healthChecks", "failover", "circuitBreaker", "autoRemediation", "onCall",
];
const INTENT_KINDS = ["attack", "defend", "buff", "debuff", "failure", "summon", "unknown"];
const ZONES = ["hand", "draw", "discard"];
const CHOICE_ACTIONS = ["decommission", "discard", "toHand", "toTopOfDraw", "upgrade", "retain"];
const NODE_KINDS = ["incident", "major", "event", "vendor", "retro", "treasure", "boss"];
const TIERS = ["normal", "elite", "boss"];

function checks(content: Content, version: number) {
  const card = shape({ uid: nat, id: idIn(content.cards), upgraded: bool });
  const statuses = record(oneOf(...STATUS_IDS), (x) => int(x) && (x as number) > 0);
  const infraState = shape({ stacks: nat, disabled: nat }, { warmth: nat });
  const intent = shape({ move: str, kinds: list(oneOf(...INTENT_KINDS)), hit: nullable(shape({ amount: nat, times: nat })) });
  const enemy = shape(
    {
      key: nat, id: idIn(content.enemies), load: nat, maxLoad: nat, buffer: nat, statuses, intent,
      upcoming: list(intent), history: list(str), resolved: bool,
    },
    { phase: shape({ index: nat, since: nat }) },
  );

  const amount: Check = (x) =>
    int(x) ||
    shape(
      { per: (v) => typeof v === "number" && Number.isFinite(v), of: oneOf("infraKinds", "infraStacks", "handSize", "cardsPlayedThisTurn", "capacity", "backlog", "missingBudget", "enemyCount") },
      { base: int },
    )(x);
  const target = oneOf("enemy", "allEnemies", "randomEnemy");
  const condition = union("kind", {
    workload: { is: oneOf("read", "write") },
    hasInfra: { infra: oneOf(...INFRA_IDS) },
    enemyIntends: { intent: oneOf(...INTENT_KINDS) },
    budgetBelowPct: { pct: int },
    handEmpty: {},
  });
  const effect: Check = (x) =>
    union(
      "op",
      {
        serve: { amount, target },
        capacity: { amount },
        reject: { amount },
        draw: { amount: int },
        engineers: { amount: int },
        recover: { amount },
        loseBudget: { amount: int },
        status: { status: oneOf(...STATUS_IDS), amount: int, target: oneOf("self", "enemy", "allEnemies", "randomEnemy") },
        removeStatus: { status: oneOf(...STATUS_IDS, "debuffs"), target: oneOf("self") },
        infra: { infra: oneOf(...INFRA_IDS), stacks: nat },
        repair: {},
        warmCache: { amount: int },
        addCard: { card: idIn(content.cards), zone: oneOf(...ZONES), count: nat },
        choose: { from: oneOf(...ZONES), count: nat, action: oneOf(...CHOICE_ACTIONS) },
        reveal: { turns: nat },
        cash: { amount: int },
        if: { cond: condition, then: list(effect) },
      },
      { serve: { times: nat }, addCard: { upgraded: bool }, choose: { optional: bool } },
    )(x);

  const pending = shape(
    {
      source: union("kind", { card: { uid: nat }, runbook: { id: idIn(content.runbooks) } }),
      from: oneOf(...ZONES), count: nat, action: oneOf(...CHOICE_ACTIONS), optional: bool, rest: list(effect),
    },
    { target: nat },
  );
  const combat = shape(
    {
      encounter: idIn(content.encounters), tier: oneOf(...TIERS), workload: oneOf("read", "write"), turn: nat,
      phase: oneOf("player", "won", "lost"), engineers: nat, engineersPerTurn: nat, capacity: nat,
      drawPile: list(card), hand: list(card), discardPile: list(card), decommissioned: list(card), statuses,
      infra: record(oneOf(...INFRA_IDS), infraState), enemies: list(enemy), pending: nullable(pending), rejects: nat,
      cardsPlayedThisTurn: nat, budgetLostLastRound: nat, budgetLostThisRound: nat, revealTurns: nat, nextEnemyKey: nat,
      tutorial: nullable(oneOf(0, 1, 2, 3)),
    },
    { retained: list(nat) },
  );

  const rewardItem = union("kind", {
    cash: { amount: nat, taken: bool },
    cards: { choices: list(card), taken: bool },
    relic: { relic: idIn(content.relics), taken: bool },
    runbook: { runbook: idIn(content.runbooks), taken: bool },
  });
  const shop = shape({
    cards: list(shape({ card, price: nat, sold: bool })),
    relics: list(shape({ relic: idIn(content.relics), price: nat, sold: bool })),
    runbooks: list(shape({ runbook: idIn(content.runbooks), price: nat, sold: bool })),
    removalPrice: nat,
    removalUsed: bool,
  });
  const screen: Check = (x) =>
    union("kind", {
      map: {},
      combat: { combat },
      reward: { items: list(rewardItem) },
      shop: { shop },
      retro: { done: bool },
      event: { event: idIn(content.events), chosen: nullable(nat) },
      treasure: { relic: idIn(content.relics), taken: bool },
      bossRelic: { choices: list(idIn(content.relics)) },
      deckChoice: { action: oneOf("remove", "upgrade", "duplicate"), then: screen },
      summary: {},
    })(x);

  const mapNode = shape(
    { id: str, floor: (x) => int(x) && (x as number) >= 1 && (x as number) <= 16, col: (x) => int(x) && (x as number) >= 0 && (x as number) <= 6, kind: oneOf(...NODE_KINDS), next: list(str) },
    { encounter: idIn(content.encounters) },
  );
  /** Fight nodes hold an encounter of their tier; other nodes hold none. */
  const nodeEncounter = (node: MapNode) => {
    const tier = FIGHT_TIERS[node.kind];
    return tier ? node.encounter !== undefined && content.encounters[node.encounter].tier === tier : node.encounter === undefined;
  };
  const map = (x: unknown) =>
    shape({ act: oneOf(1, 2, 3), nodes: record(str, mapNode), boss: idIn(content.encounters) })(x) &&
    Object.entries((x as RunState["map"]).nodes).every(
      ([id, node]) => node.id === id && nodeEncounter(node) && node.next.every((n) => Object.hasOwn((x as RunState["map"]).nodes, n)),
    );

  const stats = shape({
    floorsClimbed: nat, combatsWon: nat, elitesWon: nat, bossesWon: nat, budgetLost: nat, cashEarned: nat, cardsPlayed: nat, turns: nat,
  });
  const rng = shape(Object.fromEntries(STREAMS.map((s) => [s, int])));

  return shape(
    {
      version: oneOf(version), seed: str, character: idIn(content.characters), difficulty: oneOf(0, 1, 2, 3), rng, act: oneOf(1, 2, 3), map,
      position: nullable(str), path: list(str), budget: nat, maxBudget: (x) => int(x) && (x as number) >= 1, cash: nat, deck: list(card),
      relics: list(shape({ id: idIn(content.relics), counter: nat })), runbooks: list(nullable(idIn(content.runbooks))), screen,
      nextUid: nat, removals: nat, rarePity: nat, seenEvents: list(idIn(content.events)), stats, result: nullable(oneOf("won", "lost")),
    },
    { tutorial: bool },
  );
}

/** Every card instance in the run, wherever it is. */
function allCards(run: RunState): { uid: number }[] {
  const out: { uid: number }[] = [...run.deck];
  const visit = (screen: RunState["screen"]): void => {
    if (screen.kind === "combat") {
      const c = screen.combat;
      out.push(...c.drawPile, ...c.hand, ...c.discardPile, ...c.decommissioned);
    } else if (screen.kind === "reward") {
      for (const item of screen.items) if (item.kind === "cards") out.push(...item.choices);
    } else if (screen.kind === "shop") {
      out.push(...screen.shop.cards.map((o) => o.card));
    } else if (screen.kind === "deckChoice") visit(screen.then);
  };
  visit(run.screen);
  return out;
}

export function checkRun(data: unknown, version: number, content: Content): RunState | null {
  if (!checks(content, version)(data)) return null;
  const run = data as unknown as RunState;
  if (run.budget > run.maxBudget || run.map.act !== run.act) return null;
  if (run.position !== null && !Object.hasOwn(run.map.nodes, run.position)) return null;
  if (run.path.some((id) => !Object.hasOwn(run.map.nodes, id)) || (run.path.at(-1) ?? null) !== run.position) return null;
  if (allCards(run).some((card) => card.uid >= run.nextUid)) return null;
  return run;
}
