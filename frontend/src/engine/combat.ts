/*
 * Combat turns: starting a combat, the player's turn, playing cards and runbooks, choices,
 * infrastructure and the enemies' turn. Everything mutates the already cloned run in `ctx`.
 */
import { advanceIntent, fillIntents, hitAmount, refreshIntents } from "./ai";
import {
  addCards,
  addStatus,
  alive,
  applyChoice,
  cacheValue,
  choiceCandidates,
  draw,
  fireRelics,
  gainCapacity,
  infraOn,
  loseBudget,
  PLAYER_DEBUFFS,
  randomEnemy,
  resolveEffects,
  serveHit,
  warmthLimit,
  type Ctx,
  type Source,
} from "./effects";
import { intRange, pickFrom, shuffled } from "./rng";
import type { CardInstance, CombatState, Content, EnemyState, GameEvent, InfraId, RunState, StatusId, Tier } from "./types";
import { cardStats, clone, hasKeyword, passiveSum } from "./util";

export const HAND_SIZE = 5;
export const BASE_ENGINEERS = 3;
export const MAX_ENEMIES = 5;
export const TUTORIAL_STEPS = 4;

/** Load multiplier for the encounter's tier at this difficulty. */
export function loadMultiplier(tier: Tier, difficulty: number): number {
  if (tier === "elite" && difficulty >= 1) return 1.25;
  if (tier === "normal" && difficulty >= 2) return 1.1;
  if (tier === "boss" && difficulty >= 3) return 1.2;
  return 1;
}

function makeEnemy(ctx: Ctx, id: string): EnemyState {
  const { c, run, content } = ctx;
  const def = content.enemies[id];
  const [min, max] = def.load;
  const load = Math.max(1, Math.round(intRange(run.rng, "ai", min, max) * loadMultiplier(c.tier, run.difficulty)));
  const enemy: EnemyState = {
    key: c.nextEnemyKey++,
    id,
    load,
    maxLoad: load,
    buffer: 0,
    statuses: {},
    intent: { move: "", kinds: ["unknown"], hit: null },
    upcoming: [],
    history: [],
    resolved: false,
  };
  fillIntents(enemy, c, content, run.rng, true);
  return enemy;
}

export function startCombat(run: RunState, encounterId: string, content: Content, events: GameEvent[], tutorial: boolean): void {
  const encounter = content.encounters[encounterId];
  const c: CombatState = {
    encounter: encounterId,
    tier: encounter.tier,
    workload: encounter.workload,
    turn: 0,
    phase: "player",
    engineers: 0,
    engineersPerTurn: BASE_ENGINEERS + passiveSum(run, content, "engineersPerTurn"),
    capacity: 0,
    drawPile: [],
    hand: [],
    discardPile: [],
    decommissioned: [],
    statuses: {},
    infra: {},
    enemies: [],
    pending: null,
    rejects: 0,
    cardsPlayedThisTurn: 0,
    budgetLostLastRound: 0,
    budgetLostThisRound: 0,
    revealTurns: passiveSum(run, content, "revealTurns"),
    nextEnemyKey: 1,
    tutorial: tutorial ? 0 : null,
  };
  run.screen = { kind: "combat", combat: c };
  const ctx: Ctx = { run, c, content, events };
  events.push({ type: "combatStart", encounter: encounterId });
  for (const id of encounter.enemies) if (content.enemies[id]) c.enemies.push(makeEnemy(ctx, id));

  const deck = shuffled(run.rng, "shuffle", run.deck).map((card) => ({ ...card }));
  const innate = (card: CardInstance) => {
    const def = content.cards[card.id];
    return def !== undefined && hasKeyword(cardStats(def, card.upgraded), "innate");
  };
  c.drawPile = [...deck.filter(innate), ...deck.filter((card) => !innate(card))];

  fireRelics(ctx, "combatStart");
  for (const relic of run.relics) {
    const drawback = content.relics[relic.id]?.drawback;
    if (drawback) resolveEffects(ctx, drawback, { kind: "relic", id: relic.id });
  }
  startPlayerTurn(ctx);
}

function dropStatus(statuses: Partial<Record<StatusId, number>>, status: StatusId): void {
  const value = (statuses[status] ?? 0) - 1;
  if (value > 0) statuses[status] = value;
  else delete statuses[status];
}

function infraTurnStart(ctx: Ctx): void {
  const { c } = ctx;
  for (let i = 0; i < infraOn(c, "autoRemediation"); i++) {
    const worst = PLAYER_DEBUFFS.filter((s) => (c.statuses[s] ?? 0) > 0).sort((a, b) => (c.statuses[b] ?? 0) - (c.statuses[a] ?? 0))[0];
    if (worst) addStatus(ctx, "player", worst, -1);
  }
  const cache = c.infra.readCache;
  if (cache && infraOn(c, "readCache") > 0) {
    const warmth = cache.warmth ?? 1;
    gainCapacity(ctx, cacheValue(ctx, warmth * cache.stacks));
    if (warmth < warmthLimit(c)) cache.warmth = warmth + 1;
  }
  if (infraOn(c, "loadBalancer") > 0) gainCapacity(ctx, 4 * infraOn(c, "appServer"));
  gainCapacity(ctx, Math.min(c.budgetLostLastRound, 6 * infraOn(c, "autoscaler")));
  gainCapacity(ctx, 2 * infraOn(c, "cdn"));
  const replicas = infraOn(c, "readReplica");
  if (replicas > 0) {
    const target = randomEnemy(ctx);
    if (target) serveHit(ctx, target, cacheValue(ctx, 3 * replicas));
  }
}

/** `keepCapacity`: Reserved was active at the end of the previous turn. */
function startPlayerTurn(ctx: Ctx, keepCapacity = false): void {
  const { c, run, content } = ctx;
  c.turn += 1;
  run.stats.turns += 1;
  c.budgetLostLastRound = c.budgetLostThisRound;
  c.budgetLostThisRound = 0;
  ctx.events.push({ type: "turnStart", turn: c.turn });

  if (!keepCapacity) c.capacity = Math.min(c.capacity, 5 * infraOn(c, "messageQueue"));
  if (c.turn === 1) gainCapacity(ctx, passiveSum(run, content, "startingCapacity"));

  const backlog = c.statuses.backlog ?? 0;
  if (backlog > 0) {
    loseBudget(ctx, backlog);
    addStatus(ctx, "player", "backlog", -1);
    if (c.phase !== "player") return;
  }
  infraTurnStart(ctx);
  if (c.phase !== "player") return;

  c.engineers = c.engineersPerTurn;
  ctx.events.push({ type: "engineers", amount: c.engineers });
  if (c.turn === 1) fireRelics(ctx, "firstTurnStart");
  fireRelics(ctx, "turnStart");
  if (c.phase !== "player") return;
  draw(ctx, HAND_SIZE + passiveSum(run, content, "drawPerTurn"));
}

// ---------- playing cards and runbooks ----------

export function cardCost(c: CombatState, uid: number, content: Content): number | "x" | null {
  const card = c.hand.find((h) => h.uid === uid);
  const def = card && content.cards[card.id];
  if (!card || !def) return null;
  const stats = cardStats(def, card.upgraded);
  return hasKeyword(stats, "unplayable") ? null : stats.cost;
}

export function cantPlayReason(c: CombatState, uid: number, content: Content): string | null {
  if (c.phase !== "player") return "Combat is over";
  if (c.pending) return "Finish the current choice first";
  const card = c.hand.find((h) => h.uid === uid);
  if (!card) return "Card is not in your hand";
  if (!content.cards[card.id]) return "Unknown card";
  const cost = cardCost(c, uid, content);
  if (cost === null) return "Unplayable";
  if (cost !== "x" && cost > c.engineers) return "Not enough Engineers";
  return null;
}

function resolveTarget(c: CombatState, needsTarget: boolean, target: number | undefined): number | undefined | "invalid" {
  if (!needsTarget) return undefined;
  const living = alive(c);
  if (target === undefined) return living.length === 1 ? living[0].key : "invalid";
  return living.some((e) => e.key === target) ? target : "invalid";
}

export function playCard(ctx: Ctx, uid: number, target: number | undefined): string | null {
  const { c, run, content } = ctx;
  const reason = cantPlayReason(c, uid, content);
  if (reason) return reason;
  const card = c.hand.find((h) => h.uid === uid)!;
  const def = content.cards[card.id];
  const stats = cardStats(def, card.upgraded);
  const chosen = resolveTarget(c, stats.target === "enemy", target);
  if (chosen === "invalid") return "Choose a target";

  let effects = stats.effects;
  if (stats.cost === "x") {
    const x = c.engineers;
    effects = Array.from({ length: x }, () => stats.effects).flat();
    c.engineers = 0;
  } else c.engineers -= stats.cost ?? 0;
  ctx.events.push({ type: "cardPlayed", uid, card: card.id, upgraded: card.upgraded });
  run.stats.cardsPlayed += 1;
  const source: Source = { kind: "card", uid, type: def.type };
  if (resolveEffects(ctx, effects, source, chosen) === "done") finishCard(ctx, uid);
  return null;
}

/** Moves a played card out of the hand once its effects are done, then fires play triggers. */
function finishCard(ctx: Ctx, uid: number): void {
  const { c, content } = ctx;
  const index = c.hand.findIndex((h) => h.uid === uid);
  if (index < 0) return;
  const [card] = c.hand.splice(index, 1);
  const def = content.cards[card.id];
  const stats = cardStats(def, card.upgraded);
  if (hasKeyword(stats, "decommission")) {
    c.decommissioned.push(card);
    ctx.events.push({ type: "cardDecommissioned", uid });
  } else if (def.type === "power") c.decommissioned.push(card);
  else c.discardPile.push(card);
  c.cardsPlayedThisTurn += 1;
  if (c.phase !== "player") return;
  if (def.type === "attack") fireRelics(ctx, "attackPlayed");
  else if (def.type === "skill") fireRelics(ctx, "skillPlayed");
  else if (def.type === "power") fireRelics(ctx, "powerPlayed");
}

export function activateRunbook(ctx: Ctx, slot: number, target: number | undefined): string | null {
  const { c, run, content } = ctx;
  if (c.phase !== "player") return "Combat is over";
  if (c.pending) return "Finish the current choice first";
  const id = run.runbooks[slot];
  const def = id ? content.runbooks[id] : undefined;
  if (!id || !def) return "No runbook in that slot";
  const chosen = resolveTarget(c, def.target === "enemy", target);
  if (chosen === "invalid") return "Choose a target";
  run.runbooks[slot] = null;
  ctx.events.push({ type: "runbook", runbook: id });
  resolveEffects(ctx, def.effects, { kind: "runbook", id }, chosen);
  return null;
}

export function chooseInCombat(ctx: Ctx, uids: number[]): string | null {
  const { c, content } = ctx;
  const pending = c.pending;
  if (!pending) return "Nothing to choose";
  const sourceUid = pending.source.kind === "card" ? pending.source.uid : null;
  const candidates = choiceCandidates(ctx, pending.from, pending.action, sourceUid).map((card) => card.uid);
  const needed = Math.min(pending.count, candidates.length);
  if (new Set(uids).size !== uids.length || uids.some((uid) => !candidates.includes(uid))) return "Invalid choice";
  if (uids.length > needed || (!pending.optional && uids.length < needed)) return `Choose ${needed} card${needed === 1 ? "" : "s"}`;
  c.pending = null;
  applyChoice(ctx, pending.from, pending.action, uids);
  let source: Source;
  if (pending.source.kind === "card") {
    const uid = pending.source.uid;
    const card = c.hand.find((h) => h.uid === uid);
    source = { kind: "card", uid, type: card ? content.cards[card.id].type : "skill" };
  } else source = { kind: "runbook", id: pending.source.id };
  const target = pending.target !== undefined && alive(c).some((e) => e.key === pending.target) ? pending.target : undefined;
  if (resolveEffects(ctx, pending.rest, source, target) === "done" && source.kind === "card") finishCard(ctx, source.uid);
  return null;
}

// ---------- end of turn and the enemies' turn ----------

export function endTurn(ctx: Ctx): string | null {
  const { c } = ctx;
  if (c.phase !== "player") return "Combat is over";
  if (c.pending) return "Finish the current choice first";
  const keepCapacity = endPlayerTurn(ctx);
  if (c.phase !== "player") return null;
  enemyPhase(ctx);
  if (c.phase === "player") startPlayerTurn(ctx, keepCapacity);
  return null;
}

/** End-of-turn effects, discarding and status drops. Returns whether Reserved keeps Capacity at the next reset. */
function endPlayerTurn(ctx: Ctx): boolean {
  const { c, content } = ctx;
  fireRelics(ctx, "turnEnd");
  if (c.phase !== "player") return false;

  for (const card of c.hand.slice()) {
    const def = content.cards[card.id];
    const effects = def && cardStats(def, card.upgraded).endOfTurnInHand;
    if (effects) resolveEffects(ctx, effects, { kind: "other" });
    if (c.phase !== "player") return false;
  }
  const retained = new Set(c.retained ?? []);
  const kept: CardInstance[] = [];
  for (const card of c.hand) {
    const def = content.cards[card.id];
    const stats = def ? cardStats(def, card.upgraded) : null;
    if (stats && hasKeyword(stats, "volatile")) {
      c.decommissioned.push(card);
      ctx.events.push({ type: "cardDecommissioned", uid: card.uid });
    } else if ((stats && hasKeyword(stats, "retain")) || retained.has(card.uid)) kept.push(card);
    else c.discardPile.push(card);
  }
  c.hand = kept;
  delete c.retained;
  const keepCapacity = (c.statuses.reserved ?? 0) > 0;
  dropStatus(c.statuses, "latency");
  dropStatus(c.statuses, "reserved");
  for (const state of Object.values(c.infra)) if (state && state.disabled > 0) state.disabled -= 1;
  c.engineers = 0;
  c.cardsPlayedThisTurn = 0;
  return keepCapacity;
}

function enemyPhase(ctx: Ctx): void {
  const { c } = ctx;
  const degradedBefore = c.statuses.degraded ?? 0;
  for (const enemy of c.enemies) enemy.buffer = 0;
  for (const key of alive(c).map((e) => e.key)) {
    const enemy = c.enemies.find((e) => e.key === key);
    if (!enemy || enemy.resolved) continue;
    enemyTurn(ctx, enemy);
    if (c.phase !== "player") return;
  }
  if (degradedBefore > 0) dropStatus(c.statuses, "degraded");
}

function nodeFailure(ctx: Ctx): void {
  const { c, run } = ctx;
  if (infraOn(c, "failover") > 0) {
    const failover = c.infra.failover!;
    failover.stacks -= 1;
    if (failover.stacks <= 0) delete c.infra.failover;
    ctx.events.push({ type: "nodeFailure", infra: "failover", prevented: true });
    return;
  }
  const working = (Object.keys(c.infra) as InfraId[]).filter((id) => c.infra[id]!.disabled === 0);
  if (working.length === 0) {
    ctx.events.push({ type: "nodeFailure", infra: null, prevented: false });
    return;
  }
  const infra = pickFrom(run.rng, "ai", working);
  c.infra[infra]!.disabled = infraOn(c, "healthChecks") > 0 ? 1 : 2;
  ctx.events.push({ type: "nodeFailure", infra, prevented: false });
}

/** The other living enemies. */
function allies(c: CombatState, enemy: EnemyState): EnemyState[] {
  return alive(c).filter((e) => e.key !== enemy.key);
}

function enemyTurn(ctx: Ctx, enemy: EnemyState): void {
  const { c, run, content } = ctx;
  const throttledBefore = enemy.statuses.throttled ?? 0;
  const exposedBefore = enemy.statuses.exposed ?? 0;
  const move = content.enemies[enemy.id]?.moves[enemy.intent.move];
  ctx.events.push({ type: "enemyMove", enemy: enemy.key, move: enemy.intent.move });
  let burns = 0;
  for (const effect of move?.effects ?? []) {
    switch (effect.op) {
      case "hit":
        for (let t = 0; t < (effect.times ?? 1); t++) {
          const amount = hitAmount(enemy, c, effect.amount);
          const absorbed = Math.min(c.capacity, amount);
          c.capacity -= absorbed;
          const burned = amount - absorbed;
          ctx.events.push({ type: "hit", enemy: enemy.key, amount, absorbed, budgetLost: Math.min(burned, run.budget) });
          if (burned > 0) {
            burns += 1;
            loseBudget(ctx, burned);
            if (c.phase !== "player") return;
          }
        }
        break;
      case "buffer":
        for (const e of effect.target === "allies" ? allies(c, enemy) : [enemy]) e.buffer += effect.amount;
        break;
      case "status":
        if (effect.target === "player") addStatus(ctx, "player", effect.status, effect.amount);
        else for (const e of effect.target === "allies" ? allies(c, enemy) : [enemy]) addStatus(ctx, e, effect.status, effect.amount);
        break;
      case "addCard":
        addCards(ctx, effect.card, effect.zone, effect.count, false);
        break;
      case "nodeFailure":
        nodeFailure(ctx);
        break;
      case "summon":
        for (let i = 0; i < effect.count && alive(c).length < MAX_ENEMIES; i++) {
          if (!content.enemies[effect.enemy]) break;
          const summoned = makeEnemy(ctx, effect.enemy);
          c.enemies.push(summoned);
          ctx.events.push({ type: "summon", enemy: summoned.key, id: summoned.id });
        }
        break;
      case "heal":
        enemy.load = Math.min(enemy.maxLoad, enemy.load + effect.amount);
        break;
    }
  }
  const retries = enemy.statuses.retries ?? 0;
  if (retries > 0) enemy.load = Math.min(enemy.maxLoad, enemy.load + retries);
  if (throttledBefore > 0) dropStatus(enemy.statuses, "throttled");
  if (exposedBefore > 0) dropStatus(enemy.statuses, "exposed");
  const breakers = infraOn(c, "circuitBreaker");
  if (burns > 0 && breakers > 0) addStatus(ctx, enemy, "throttled", burns * breakers);
  advanceIntent(enemy, c, content, run.rng);
}

/** Tops up revealed intents and refreshes their numbers; run after every combat command. */
export function settleCombat(ctx: Ctx): void {
  const { c, run, content } = ctx;
  if (c.phase !== "player") return;
  for (const enemy of alive(c)) fillIntents(enemy, c, content, run.rng, false);
  refreshIntents(c, content);
  // The current intents show exactly what would hit if you ended the turn now: play the enemies' turn
  // out on a copy, so statuses gained during it (an ally's Scaling, an earlier Degraded) are included.
  const simRun = clone(run);
  if (simRun.screen.kind !== "combat") return;
  const sim: Ctx = { run: simRun, c: simRun.screen.combat, content, events: [] };
  endPlayerTurn(sim);
  if (sim.c.phase === "player") enemyPhase(sim);
  const firstHit = new Map<number, number>();
  for (const e of sim.events) if (e.type === "hit" && !firstHit.has(e.enemy)) firstHit.set(e.enemy, e.amount);
  for (const enemy of alive(c)) {
    const amount = firstHit.get(enemy.key);
    if (enemy.intent.hit && amount !== undefined) enemy.intent.hit.amount = amount;
  }
}
