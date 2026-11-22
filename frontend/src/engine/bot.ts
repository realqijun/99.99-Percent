/*
 * A heuristic player for balance testing. It sees what a player sees (the run state, the content
 * tables and the public engine API) and picks one command at a time. No randomness: the same run
 * state always gives the same command, so a seeded run plays out the same way every time.
 *
 * Every option is scored in Error Budget points: a request blocked is worth about 1 point
 * (more when the budget is low), a point of Load served about half that, and lasting effects
 * like infrastructure are worth their expected value over the turns left in the combat.
 */
import { CONTENT } from "../content";
import { cantPlay, costNow, reachableNodes, retroRecoverAmount } from "./index";
import type {
  Amount,
  CardDef,
  CardInstance,
  CardStats,
  CombatState,
  Command,
  Condition,
  Content,
  Effect,
  EnemyState,
  EventOutcome,
  InfraId,
  IntentKind,
  MapNode,
  RunState,
  Workload,
} from "./types";

/** Load a deck serves in a turn, roughly: one point of Load is worth incoming / this, as it shortens the fight. */
const SERVE_PER_TURN = 10;
/** Value of Capacity nothing is going to use. */
const W_SPARE = 0.05;
/** Engineers a card must beat to be worth adding to the deck (Serve and Provision score about this). */
const ENGINEER_VALUE = 4.2;

// ---------- the situation a card is scored against ----------

interface Foe {
  key: number;
  load: number;
  buffer: number;
  /** Requests it sends this turn. */
  incoming: number;
  exposed: boolean;
  throttled: boolean;
  /** How much it is worth hurting it, around 1. */
  threat: number;
}

interface Situation {
  /** Incoming requests this turn that Capacity doesn't cover yet. */
  need: number;
  /** Value of one blocked request. */
  wBlock: number;
  /** Value of one point of Load served. */
  wLoad: number;
  turnsLeft: number;
  engineers: number;
  foes: Foe[];
  optimized: number;
  latency: boolean;
  hardened: number;
  /** "mixed" when scoring a card outside combat. */
  workload: Workload | "mixed";
  /** Working stacks. */
  infra: Partial<Record<InfraId, number>>;
  disabled: number;
  played: number;
  capacity: number;
  handSize: number;
  drawable: number;
  budget: number;
  maxBudget: number;
  backlog: number;
  latencyTurns: number;
  degraded: number;
  intents: IntentKind[];
  /** Cards in the combat's piles, to judge how often an added card comes back. */
  deckSize: number;
  /** Status cards in hand that a decommission choice could remove. */
  junkInHand: number;
  /** Expected Node Failures per turn. */
  failures: number;
  pagers: number;
}

const stacks = (s: Situation, id: InfraId) => s.infra[id] ?? 0;
const totalStacks = (s: Situation) => Object.values(s.infra).reduce((sum, n) => sum + (n ?? 0), 0);

function amountOf(a: Amount, s: Situation): number {
  if (typeof a === "number") return a;
  const of = {
    infraKinds: Object.values(s.infra).filter((n) => (n ?? 0) > 0).length,
    infraStacks: totalStacks(s),
    handSize: s.handSize,
    cardsPlayedThisTurn: s.played,
    capacity: s.capacity,
    backlog: s.backlog,
    missingBudget: s.maxBudget - s.budget,
    enemyCount: s.foes.length,
  }[a.of];
  return Math.floor((a.base ?? 0) + a.per * of);
}

function holds(cond: Condition, s: Situation): number {
  switch (cond.kind) {
    case "workload":
      return s.workload === "mixed" ? 0.5 : s.workload === cond.is ? 1 : 0;
    case "hasInfra":
      return stacks(s, cond.infra) > 0 ? 1 : 0;
    case "enemyIntends":
      return s.intents.includes(cond.intent) ? 1 : 0;
    case "budgetBelowPct":
      return s.budget < (s.maxBudget * cond.pct) / 100 ? 1 : 0.15;
    case "handEmpty":
      return s.handSize === 0 ? 1 : 0;
  }
}

/** Expected value of an infrastructure piece per stack per turn, or in total for one-off pieces. */
function infraValue(id: InfraId, s: Situation): { perTurn: number } | { total: number } {
  const write = s.workload === "write" ? 1 : s.workload === "mixed" ? 0.5 : 0;
  switch (id) {
    case "readCache":
      return { perTurn: 3 * (1 - write / 2) };
    case "cacheTuning":
      return { perTurn: stacks(s, "readCache") > 0 ? 1 : 0.1 };
    case "loadBalancer":
      return { perTurn: stacks(s, "loadBalancer") > 0 ? 0 : 0.8 + 4 * stacks(s, "appServer") };
    case "appServer":
      return { perTurn: stacks(s, "loadBalancer") > 0 ? 4 : 1.2 };
    case "autoscaler":
      return { perTurn: 2.5 };
    case "cdn":
      return { perTurn: 2 };
    case "messageQueue":
      return { perTurn: 1.5 };
    case "readReplica":
      return { perTurn: 3 * (1 - write / 2) * s.wLoad };
    case "healthChecks":
      return { perTurn: stacks(s, "healthChecks") > 0 ? 0 : s.failures * 3 };
    case "failover":
      return { total: Math.min(4, s.failures * s.turnsLeft * 4) };
    case "circuitBreaker":
      return { perTurn: 1.2 };
    case "autoRemediation":
      return { perTurn: s.backlog + s.latencyTurns + s.degraded > 0 || s.intents.includes("debuff") ? 1.5 : 0.3 };
    case "onCall":
      // A Pager comes up about every third turn.
      return { perTurn: 1.6 * s.pagers };
  }
}

function hitFoe(s: Situation, foe: Foe, base: number): number {
  let amount = base + s.optimized;
  if (s.latency) amount = Math.floor(amount * 0.75);
  if (foe.exposed) amount = Math.floor(amount * 1.5);
  const absorbed = Math.min(foe.buffer, amount);
  foe.buffer -= absorbed;
  const done = Math.min(foe.load, amount - absorbed);
  foe.load -= done;
  let v = done * s.wLoad * foe.threat;
  if (done > 0 && foe.load <= 0) {
    // A resolved enemy sends nothing this turn and nothing ever again.
    const saved = Math.min(foe.incoming, s.need);
    s.need -= saved;
    v += saved * s.wBlock + foe.incoming * 0.5 + 2;
    foe.incoming = 0;
  }
  return v;
}

function targets(s: Situation, target: "enemy" | "allEnemies" | "randomEnemy", chosen: Foe | undefined, hit: number): Foe[] {
  const living = s.foes.filter((f) => f.load > 0);
  if (target === "allEnemies") return living;
  if (target === "enemy" && chosen) return chosen.load > 0 ? [chosen] : [];
  return living.length > 0 ? [living[hit % living.length]] : [];
}

function gainCapacity(s: Situation, amount: number): number {
  const blocked = Math.min(amount, s.need);
  s.need -= blocked;
  s.capacity += amount;
  const spareValue = stacks(s, "messageQueue") > 0 ? 0.5 : W_SPARE;
  return blocked * s.wBlock + (amount - blocked) * spareValue;
}

/** Scores effects against the situation, which it updates as it goes. */
function score(effects: Effect[], s: Situation, chosen: Foe | undefined, fromCard: boolean): number {
  let v = 0;
  const future = Math.max(0.5, s.turnsLeft - 1) * 0.8;
  for (const e of effects) {
    switch (e.op) {
      case "serve": {
        const base = amountOf(e.amount, s);
        for (let t = 0; t < (e.times ?? 1); t++) for (const foe of targets(s, e.target, chosen, t)) v += hitFoe(s, foe, base);
        break;
      }
      case "capacity":
        v += gainCapacity(s, amountOf(e.amount, s) + (fromCard ? s.hardened : 0));
        break;
      case "reject":
        v += gainCapacity(s, amountOf(e.amount, s) + (fromCard ? s.hardened : 0)) - 1;
        break;
      case "draw":
        v += Math.min(e.amount, 10 - s.handSize, s.drawable) * 2.5;
        break;
      case "engineers":
        v += e.amount > 0 ? e.amount * 4 : -Math.min(-e.amount, s.engineers) * 4;
        break;
      case "recover":
        v += Math.min(amountOf(e.amount, s), s.maxBudget - s.budget) * 0.8;
        break;
      case "loseBudget":
        v -= e.amount >= s.budget ? 1000 : e.amount * s.wBlock;
        break;
      case "status": {
        if (e.target === "self") {
          // About two Serve hits and one Capacity card a turn benefit; Reserved saves what this turn won't use.
          if (e.status === "optimized") v += e.amount * 2 * Math.min(5, s.turnsLeft) * s.wLoad;
          else if (e.status === "hardened") v += e.amount * Math.min(5, s.turnsLeft);
          else if (e.status === "reserved") v += e.amount + (s.need === 0 ? Math.min(15, s.capacity) * 0.4 : 0);
          else v -= e.amount * 2;
          break;
        }
        for (const foe of targets(s, e.target, chosen, 0)) {
          if (e.status === "throttled" && !foe.throttled) {
            const cut = Math.min(s.need, Math.floor(foe.incoming * 0.25));
            s.need -= cut;
            foe.throttled = true;
            v += cut * s.wBlock + (e.amount - 1) * 2;
          } else if (e.status === "exposed" && !foe.exposed) {
            foe.exposed = true;
            v += Math.min(e.amount, s.turnsLeft) * 4 * s.wLoad * foe.threat;
          }
        }
        break;
      }
      case "removeStatus": {
        const all = e.status === "debuffs";
        if (all || e.status === "backlog") v += (s.backlog * (s.backlog + 1)) / 2;
        if (all || e.status === "latency") v += 3 * Math.min(s.latencyTurns, s.turnsLeft);
        if (all || e.status === "degraded") v += s.degraded > 0 ? (s.need / 3) * s.wBlock : 0;
        break;
      }
      case "infra": {
        const iv = infraValue(e.infra, s);
        v += "total" in iv ? iv.total * e.stacks : iv.perTurn * e.stacks * future;
        s.infra[e.infra] = stacks(s, e.infra) + e.stacks;
        break;
      }
      case "repair":
        v += s.disabled * 3;
        break;
      case "warmCache":
        v += stacks(s, "readCache") > 0 ? e.amount * stacks(s, "readCache") * Math.min(s.turnsLeft, 3) * 0.6 : 0;
        break;
      case "addCard": {
        // A status card comes back every few turns for the rest of the combat, costing a draw each time.
        const draws = e.zone === "hand" ? 1 : (Math.min(8, s.turnsLeft) * 5) / Math.max(10, s.deckSize);
        const perDraw = e.card === "pager" ? 2 + 2 * s.wBlock : e.card === "configDrift" ? 5 : e.card === "techDebt" ? 2 : -2;
        v -= e.count * draws * perDraw;
        break;
      }
      case "choose":
        if (e.action === "decommission") v += Math.min(e.count, s.junkInHand) * 2.5;
        else v += { discard: 0.3, toHand: 3, toTopOfDraw: 1, upgrade: 2, retain: 1 }[e.action];
        break;
      case "reveal":
        v += 0.5;
        break;
      case "cash":
        v += e.amount * 0.05;
        break;
      case "if": {
        const chance = holds(e.cond, s);
        if (chance > 0) v += chance * score(e.then, s, chosen, fromCard);
        break;
      }
    }
  }
  return v;
}

function copy(s: Situation): Situation {
  return { ...s, infra: { ...s.infra }, foes: s.foes.map((f) => ({ ...f })) };
}

// ---------- reading the run ----------

function stats(content: Content, card: CardInstance): CardStats {
  const def = content.cards[card.id];
  return card.upgraded && def.upgrade ? { ...def, ...def.upgrade } : def;
}

const isJunk = (def: CardDef) => def.pool === "status";

function enemyFails(content: Content, e: EnemyState): boolean {
  return Object.values(content.enemies[e.id]?.moves ?? {}).some((m) => m.effects.some((x) => x.op === "nodeFailure"));
}

/** Requests an enemy sends in an average turn, from its moves. */
function averageHit(content: Content, id: string): number {
  const moves = Object.values(content.enemies[id]?.moves ?? {});
  const total = moves.reduce((sum, m) => sum + m.effects.reduce((t, e) => t + (e.op === "hit" ? e.amount * (e.times ?? 1) : 0), 0), 0);
  return total / Math.max(1, moves.length);
}

function combatSituation(run: RunState, c: CombatState, content: Content): Situation {
  const living = c.enemies.filter((e) => !e.resolved);
  const foes: Foe[] = living.map((e) => ({
    key: e.key,
    load: e.load,
    buffer: e.buffer,
    incoming: e.intent.hit ? e.intent.hit.amount * e.intent.hit.times : 0,
    exposed: (e.statuses.exposed ?? 0) > 0,
    throttled: (e.statuses.throttled ?? 0) > 0,
    threat: 1 + 0.1 * (e.statuses.scaling ?? 0) + ((e.statuses.retries ?? 0) > 0 ? 0.3 : 0),
  }));
  // Serve the enemies that send the most per point of Load first: they cost the most to leave standing.
  const typicalHit = living.map((e, i) => (foes[i].incoming + averageHit(content, e.id)) / 2);
  const pressure = living.map((e, i) => typicalHit[i] / Math.max(1, e.load));
  const meanPressure = pressure.reduce((a, b) => a + b, 0) / Math.max(1, pressure.length);
  foes.forEach((f, i) => (f.threat *= Math.min(1.8, Math.max(0.6, Math.sqrt(pressure[i] / Math.max(1e-6, meanPressure))))));
  const incoming = foes.reduce((sum, f) => sum + f.incoming, 0);
  const infra: Partial<Record<InfraId, number>> = {};
  let disabled = 0;
  for (const [id, state] of Object.entries(c.infra)) {
    if (!state) continue;
    if (state.disabled > 0) disabled += 1;
    else infra[id as InfraId] = state.stacks;
  }
  const totalLoad = foes.reduce((sum, f) => sum + f.load, 0);
  const allCards = [...c.hand, ...c.drawPile, ...c.discardPile];
  return {
    need: Math.max(0, incoming - c.capacity),
    wBlock: 1 + 1.2 * (1 - run.budget / run.maxBudget),
    // Judged on a typical turn, so a quiet turn doesn't make serving look pointless.
    wLoad: Math.min(1.5, Math.max(0.35, typicalHit.reduce((a, b) => a + b, 0) / SERVE_PER_TURN)),
    turnsLeft: Math.min(8, Math.max(1, Math.ceil(totalLoad / 10))),
    engineers: c.engineers,
    foes,
    optimized: c.statuses.optimized ?? 0,
    latency: (c.statuses.latency ?? 0) > 0,
    hardened: c.statuses.hardened ?? 0,
    workload: c.workload,
    infra,
    disabled,
    played: c.cardsPlayedThisTurn,
    capacity: c.capacity,
    handSize: c.hand.length - 1,
    drawable: c.drawPile.length + c.discardPile.length,
    budget: run.budget,
    maxBudget: run.maxBudget,
    backlog: c.statuses.backlog ?? 0,
    latencyTurns: c.statuses.latency ?? 0,
    degraded: c.statuses.degraded ?? 0,
    intents: living.flatMap((e) => e.intent.kinds),
    deckSize: allCards.length,
    junkInHand: c.hand.filter((h) => isJunk(content.cards[h.id])).length,
    failures: living.some((e) => enemyFails(content, e)) ? 0.4 : 0,
    pagers: allCards.filter((h) => h.id === "pager").length,
  };
}

/** A made-up average turn, for judging cards outside combat. */
function typicalSituation(run: RunState, content: Content): Situation {
  // Infrastructure in the deck is out about half the time.
  const infra: Partial<Record<InfraId, number>> = {};
  const install = (effects: Effect[] = []) => {
    for (const e of effects) if (e.op === "infra") infra[e.infra] = (infra[e.infra] ?? 0) + e.stacks * 0.5;
  };
  for (const card of run.deck) install(stats(content, card).effects);
  for (const relic of run.relics) install(content.relics[relic.id]?.effects);
  const foe = (key: number): Foe => ({ key, load: 22, buffer: 0, incoming: 9, exposed: false, throttled: false, threat: 1.25 });
  return {
    need: 12,
    wBlock: 0.8,
    wLoad: 0.75,
    turnsLeft: 5,
    engineers: 3,
    foes: [foe(1), foe(2)],
    optimized: 0,
    latency: false,
    hardened: 0,
    workload: "mixed",
    infra,
    disabled: 0,
    played: 1,
    capacity: 6,
    handSize: 4,
    drawable: 5,
    // Mid-combat, some Error Budget is usually gone.
    budget: Math.min(run.budget, run.maxBudget - 12),
    maxBudget: run.maxBudget,
    backlog: 0,
    latencyTurns: 0,
    degraded: 0,
    intents: ["attack"],
    deckSize: run.deck.length,
    junkInHand: 0.3,
    failures: 0.1,
    // On-Call cards bring their own Pager.
    pagers: 1 + run.deck.filter((card) => card.id === "pager").length,
  };
}

/** How much better a card makes the deck, in points per draw. Status cards are negative. */
export function cardWorth(run: RunState, card: CardInstance, content: Content = CONTENT): number {
  const def = content.cards[card.id];
  if (!def || isJunk(def)) return -8;
  const st = stats(content, card);
  if (st.cost === null) return -8;
  const x = st.cost === "x";
  const effects = x ? [...st.effects, ...st.effects, ...st.effects] : st.effects;
  const cost = x ? 3 : (st.cost as number);
  const s = typicalSituation(run, content);
  const repeatable = def.type !== "power" && !st.keywords?.includes("decommission");
  let v = score(effects, s, s.foes[0], true) - cost * ENGINEER_VALUE;
  // A second copy of a one-off piece of infrastructure adds little.
  if (def.type === "power" && run.deck.filter((d) => d.id === card.id).length >= (def.id === "appServer" ? 3 : 1)) v -= 3;
  if (st.keywords?.includes("retain")) v += 0.5;
  if (st.keywords?.includes("innate")) v += 1;
  return repeatable ? v : v - 0.5;
}

// ---------- combat ----------

type Option = { cmd: Command; value: number; cost: number };

function cardOptions(run: RunState, c: CombatState, content: Content): Option[] {
  const base = combatSituation(run, c, content);
  const options: Option[] = [];
  for (const card of c.hand) {
    if (cantPlay(run, card.uid, content) !== null) continue;
    const st = stats(content, card);
    const cost = costNow(run, card.uid, content);
    const times = cost === "x" ? c.engineers : 1;
    if (times === 0) continue;
    const effects = Array.from({ length: times }, () => st.effects).flat();
    const keys = st.target === "enemy" ? base.foes.map((f) => f.key) : [undefined];
    for (const key of keys) {
      const s = copy(base);
      const chosen = s.foes.find((f) => f.key === key);
      let value = score(effects, s, chosen, true);
      // Infrastructure pays off over the whole combat, so put it down early.
      if (content.cards[card.id].type === "power") value += Math.max(0, 3 - c.turn);
      options.push({ cmd: { type: "playCard", uid: card.uid, ...(key !== undefined ? { target: key } : {}) }, value, cost: cost === "x" ? times : (cost ?? 0) });
    }
  }
  return options;
}

function runbookOptions(run: RunState, c: CombatState, content: Content): Option[] {
  const base = combatSituation(run, c, content);
  const danger = base.need > 0 && (base.need >= run.budget * 0.3 || run.budget - base.need <= run.maxBudget * 0.3);
  if (!danger && c.tier !== "boss") return [];
  const options: Option[] = [];
  run.runbooks.forEach((id, slot) => {
    const def = id ? content.runbooks[id] : undefined;
    if (!def) return;
    const keys = def.target === "enemy" ? base.foes.map((f) => f.key) : [undefined];
    for (const key of keys) {
      const s = copy(base);
      const value = score(def.effects, s, s.foes.find((f) => f.key === key), false);
      if (value >= 3) options.push({ cmd: { type: "useRunbook", slot, ...(key !== undefined ? { target: key } : {}) }, value, cost: 1 });
    }
  });
  return options;
}

function best(options: Option[]): Option | undefined {
  let top: Option | undefined;
  for (const o of options) {
    const rate = o.value / Math.max(0.75, o.cost);
    if (!top || rate > top.value / Math.max(0.75, top.cost)) top = o;
  }
  return top;
}

function choose(run: RunState, c: CombatState, content: Content): Command {
  const p = c.pending!;
  const source = p.source.kind === "card" ? p.source.uid : null;
  const zone = p.from === "hand" ? c.hand : p.from === "draw" ? c.drawPile : c.discardPile;
  const candidates = zone.filter((card) => card.uid !== source && (p.action !== "upgrade" || (!card.upgraded && content.cards[card.id].upgrade)));
  const ranked = candidates
    .map((card) => ({ card, worth: cardWorth(run, card, content) }))
    .sort((a, b) => b.worth - a.worth || a.card.uid - b.card.uid);
  const count = Math.min(p.count, ranked.length);
  let picked: CardInstance[];
  if (p.action === "decommission" || p.action === "discard") {
    const worst = ranked.slice().reverse();
    picked = p.optional ? worst.filter((r) => r.worth < -2).slice(0, count).map((r) => r.card) : worst.slice(0, count).map((r) => r.card);
  } else picked = ranked.slice(0, count).map((r) => r.card);
  return { type: "chooseCards", uids: picked.map((card) => card.uid) };
}

function combatCommand(run: RunState, c: CombatState, content: Content): Command {
  if (c.pending) return choose(run, c, content);
  const card = best(cardOptions(run, c, content));
  if (card && card.value > 0.4) return card.cmd;
  const runbook = best(runbookOptions(run, c, content));
  if (runbook) return runbook.cmd;
  return { type: "endTurn" };
}

// ---------- between combats ----------

function nodeValue(node: MapNode, run: RunState): number {
  const health = run.budget / run.maxBudget;
  switch (node.kind) {
    case "incident":
      return health > 0.4 ? 1 : 0.3;
    case "major":
      return health >= 0.6 ? 2.5 : health >= 0.45 ? 0.3 : -4;
    case "retro":
      return health < 0.5 ? 3 : health < 0.75 ? 1.5 : 0.8;
    case "vendor":
      return run.cash >= 120 ? 2 : 0.3;
    case "event":
      return 1.2;
    case "treasure":
      return 3;
    case "boss":
      return 0;
  }
}

/** The next node on the path with the best discounted value to the end of the act. */
function pickNode(run: RunState): Command {
  const memo = new Map<string, number>();
  const pathValue = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const node = run.map.nodes[id];
    const rest = node.next.length > 0 ? Math.max(...node.next.map(pathValue)) : 0;
    const v = nodeValue(node, run) + 0.8 * rest;
    memo.set(id, v);
    return v;
  };
  const options = reachableNodes(run);
  let top = options[0];
  for (const id of options) if (pathValue(id) > pathValue(top)) top = id;
  return { type: "chooseNode", node: top };
}

function rewardCommand(run: RunState, content: Content): Command {
  if (run.screen.kind !== "reward") return { type: "leave" };
  const items = run.screen.items;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.taken) continue;
    if (item.kind === "runbook" && !run.runbooks.includes(null)) continue;
    if (item.kind !== "cards") return { type: "takeReward", index };
    const worths = item.choices.map((card) => cardWorth(run, card, content));
    const top = worths.indexOf(Math.max(...worths));
    const bar = 0.5 + 0.12 * Math.max(0, run.deck.length - 10);
    return worths[top] > bar ? { type: "takeReward", index, card: top } : { type: "skipCards", index };
  }
  return { type: "leave" };
}

/** The card a removal should take: junk first, then the weakest. */
function weakest(run: RunState, content: Content, uids?: number[]): CardInstance | undefined {
  const pool = uids ? run.deck.filter((card) => uids.includes(card.uid)) : run.deck;
  return pool.slice().sort((a, b) => cardWorth(run, a, content) - cardWorth(run, b, content) || a.uid - b.uid)[0];
}

function upgradeGain(run: RunState, card: CardInstance, content: Content): number {
  if (card.upgraded || !content.cards[card.id]?.upgrade) return -Infinity;
  return cardWorth(run, { ...card, upgraded: true }, content) - cardWorth(run, card, content);
}

function deckChoiceCommand(run: RunState, content: Content): Command {
  if (run.screen.kind !== "deckChoice") return { type: "leave" };
  const action = run.screen.action;
  const deck = run.deck.slice().sort((a, b) => a.uid - b.uid);
  let pick: CardInstance | undefined;
  if (action === "remove") pick = weakest(run, content);
  else if (action === "upgrade") pick = deck.reduce((top, card) => (upgradeGain(run, card, content) > upgradeGain(run, top, content) ? card : top), deck[0]);
  else pick = deck.reduce((top, card) => (cardWorth(run, card, content) > cardWorth(run, top, content) ? card : top), deck[0]);
  return { type: "chooseCards", uids: pick ? [pick.uid] : [] };
}

function shopCommand(run: RunState, content: Content): Command {
  if (run.screen.kind !== "shop") return { type: "leave" };
  const shop = run.screen.shop;
  const junk = run.deck.some((card) => isJunk(content.cards[card.id]));
  const starters = run.deck.filter((card) => content.cards[card.id].rarity === "starter").length;
  if (!shop.removalUsed && run.cash >= shop.removalPrice && (junk || starters >= 7)) return { type: "buyRemoval" };
  const relic = shop.relics.findIndex((r) => !r.sold && r.price <= run.cash);
  if (relic >= 0) return { type: "buyRelic", index: relic };
  const bar = 1.5 + 0.12 * Math.max(0, run.deck.length - 10);
  let card = -1;
  shop.cards.forEach((offer, index) => {
    if (offer.sold || offer.price > run.cash) return;
    const worth = cardWorth(run, offer.card, content);
    if (worth > bar && (card < 0 || worth > cardWorth(run, shop.cards[card].card, content))) card = index;
  });
  if (card >= 0) return { type: "buyCard", index: card };
  const runbook = shop.runbooks.findIndex((r) => !r.sold && r.price <= run.cash - 40);
  if (runbook >= 0 && run.runbooks.includes(null)) return { type: "buyRunbook", index: runbook };
  return { type: "leave" };
}

function outcomeValue(o: EventOutcome, run: RunState): number {
  const health = run.budget / run.maxBudget;
  switch (o.op) {
    case "cash":
      return o.amount * 0.06;
    case "budget":
      return o.amount > 0 ? Math.min(o.amount, run.maxBudget - run.budget) * 0.5 : o.amount * (1.5 - health);
    case "maxBudget":
      return o.amount * 0.6;
    case "addCard":
      return o.card === "pager" || o.card === "techDebt" || o.card === "configDrift" ? -4 : 2;
    case "randomCard":
      return { common: 1, uncommon: 2, rare: 4 }[o.rarity];
    case "chooseCard":
      return { remove: 3, upgrade: 3, duplicate: 1.5 }[o.action];
    case "relic":
      return { common: 4, uncommon: 5, rare: 7 }[o.rarity ?? "common"];
    case "runbook":
      return run.runbooks.includes(null) ? 2 : 0;
    case "fight":
      return health > 0.7 ? -2 : -8;
  }
}

function eventCommand(run: RunState, content: Content): Command {
  if (run.screen.kind !== "event" || run.screen.chosen !== null) return { type: "leave" };
  const choices = content.events[run.screen.event].choices;
  let top = -1;
  let topValue = 0;
  choices.forEach((choice, index) => {
    if (choice.requires?.cash !== undefined && run.cash < choice.requires.cash) return;
    if (choice.requires?.budget !== undefined && run.budget <= choice.requires.budget) return;
    const value = choice.outcomes.reduce((sum, o) => sum + outcomeValue(o, run), 0);
    if (top < 0 || value > topValue) [top, topValue] = [index, value];
  });
  return top >= 0 ? { type: "eventChoice", index: top } : { type: "leave" };
}

/** Boss relics in the order the bot likes them. */
const BOSS_RELIC_ORDER = ["offshoreContractors", "containerOrchestrator", "multiRegion", "dataLake"];

/** The bot's next command for this run. Always a legal command while the run is going. */
export function botCommand(run: RunState, content: Content = CONTENT): Command {
  const s = run.screen;
  switch (s.kind) {
    case "map":
      return pickNode(run);
    case "combat":
      return combatCommand(run, s.combat, content);
    case "reward":
      return rewardCommand(run, content);
    case "shop":
      return shopCommand(run, content);
    case "retro":
      if (s.done) return { type: "leave" };
      if (run.budget < run.maxBudget * 0.6 && retroRecoverAmount(run, content) > 0) return { type: "rest" };
      return run.deck.some((card) => upgradeGain(run, card, content) > -Infinity) ? { type: "refactor" } : { type: "rest" };
    case "event":
      return eventCommand(run, content);
    case "treasure":
      return s.taken ? { type: "leave" } : { type: "takeTreasure" };
    case "bossRelic": {
      const ranked = s.choices.map((id) => BOSS_RELIC_ORDER.indexOf(id)).map((rank) => (rank < 0 ? 99 : rank));
      return { type: "pickBossRelic", index: ranked.indexOf(Math.min(...ranked)) };
    }
    case "deckChoice":
      return deckChoiceCommand(run, content);
    case "summary":
      return { type: "leave" };
  }
}
