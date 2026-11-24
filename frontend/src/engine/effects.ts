/*
 * Effect resolution inside a combat. Everything here mutates the already cloned run in `ctx`.
 */
import { intRange, pickFrom, shuffled } from "./rng";
import type {
  Amount,
  CardInstance,
  CardType,
  CardZone,
  CombatState,
  Condition,
  Content,
  Effect,
  EnemyState,
  GameEvent,
  InfraId,
  RelicTrigger,
  RunState,
  StatusId,
} from "./types";
import { canUpgrade, cardStats, gainCash, hasPassive, newCard, recoverBudget } from "./util";

export const HAND_LIMIT = 10;
export const PLAYER_DEBUFFS: StatusId[] = ["backlog", "degraded", "latency"];

export interface Ctx {
  run: RunState;
  c: CombatState;
  content: Content;
  events: GameEvent[];
}

export type Source =
  | { kind: "card"; uid: number; type: CardType }
  | { kind: "runbook"; id: string }
  | { kind: "relic"; id: string }
  | { kind: "other" };

// ---------- numbers shared with the card text ----------

export function alive(c: CombatState): EnemyState[] {
  return c.enemies.filter((e) => !e.resolved);
}

export interface AmountEnv {
  c: CombatState;
  /** maxBudget - budget, or null when unknown (card text has no run). */
  missingBudget: number | null;
  /** Other cards in hand. */
  handSize: number;
}

export function amountValue(amount: Amount, env: AmountEnv | null): number | null {
  if (typeof amount === "number") return amount;
  if (!env) return null;
  const { c } = env;
  const infra = Object.values(c.infra);
  const values = {
    infraKinds: infra.filter((s) => s && s.stacks > 0).length,
    infraStacks: infra.reduce((sum, s) => sum + (s?.stacks ?? 0), 0),
    handSize: env.handSize,
    cardsPlayedThisTurn: c.cardsPlayedThisTurn,
    capacity: c.capacity,
    backlog: c.statuses.backlog ?? 0,
    missingBudget: env.missingBudget,
    enemyCount: alive(c).length,
  };
  const value = values[amount.of];
  return value === null ? null : Math.floor((amount.base ?? 0) + amount.per * value);
}

/** One Serve hit after Optimized, Latency and the target's Exposed. */
export function serveValue(c: CombatState | undefined, base: number, enemy?: EnemyState): number {
  let amount = base + (c?.statuses.optimized ?? 0);
  if ((c?.statuses.latency ?? 0) > 0) amount = Math.floor(amount * 0.75);
  if ((enemy?.statuses.exposed ?? 0) > 0) amount = Math.floor(amount * 1.5);
  return Math.max(0, amount);
}

/** Capacity from a card, after Hardened. */
export function cardCapacityValue(c: CombatState | undefined, base: number): number {
  return Math.max(0, base + (c?.statuses.hardened ?? 0));
}

export function infraOn(c: CombatState, id: InfraId): number {
  const s = c.infra[id];
  return s && s.disabled === 0 ? s.stacks : 0;
}

/** Writes bypass the cache: cache effects are halved in write-heavy encounters. */
export function cacheValue(ctx: Ctx, amount: number): number {
  return ctx.c.workload === "write" && !hasPassive(ctx.run, ctx.content, "noCacheHalving") ? Math.floor(amount / 2) : amount;
}

// ---------- state changes ----------

function over(ctx: Ctx, phase: CombatState["phase"]): boolean {
  return ctx.c.phase !== phase;
}

function checkWon(ctx: Ctx): void {
  if (ctx.c.phase === "player" && alive(ctx.c).length === 0) ctx.c.phase = "won";
}

export function gainCapacity(ctx: Ctx, amount: number): void {
  if (amount <= 0) return;
  ctx.c.capacity += amount;
  ctx.events.push({ type: "capacity", amount });
}

export function gainEngineers(ctx: Ctx, amount: number): void {
  const change = Math.max(-ctx.c.engineers, amount);
  if (change === 0) return;
  ctx.c.engineers += change;
  ctx.events.push({ type: "engineers", amount: change });
}

/** Loses Error Budget in combat; breaches the SLA at 0. Returns the amount lost. */
export function loseBudget(ctx: Ctx, amount: number): number {
  const { run, c } = ctx;
  const lost = Math.min(Math.max(0, amount), run.budget);
  if (lost <= 0) return 0;
  run.budget -= lost;
  run.stats.budgetLost += lost;
  c.budgetLostThisRound += lost;
  ctx.events.push({ type: "budget", amount: -lost });
  if (run.budget <= 0) {
    c.phase = "lost";
    return lost;
  }
  fireRelics(ctx, "budgetLost");
  return lost;
}

export function serveHit(ctx: Ctx, enemy: EnemyState, base: number): void {
  if (enemy.resolved) return;
  const amount = serveValue(ctx.c, base, enemy);
  const absorbed = Math.min(enemy.buffer, amount);
  enemy.buffer -= absorbed;
  enemy.load = Math.max(0, enemy.load - (amount - absorbed));
  ctx.events.push({ type: "serve", enemy: enemy.key, amount, absorbed });
  if (enemy.load <= 0) {
    enemy.resolved = true;
    enemy.buffer = 0;
    ctx.events.push({ type: "enemyResolved", enemy: enemy.key });
    fireRelics(ctx, "enemyResolved");
    checkWon(ctx);
  }
}

export function randomEnemy(ctx: Ctx): EnemyState | undefined {
  const list = alive(ctx.c);
  return list.length > 0 ? pickFrom(ctx.run.rng, "targets", list) : undefined;
}

export function addStatus(ctx: Ctx, target: "player" | EnemyState, status: StatusId, amount: number): void {
  const statuses = target === "player" ? ctx.c.statuses : target.statuses;
  const value = Math.max(0, (statuses[status] ?? 0) + amount);
  const change = value - (statuses[status] ?? 0);
  if (value > 0) statuses[status] = value;
  else delete statuses[status];
  if (change !== 0) ctx.events.push({ type: "status", target: target === "player" ? "player" : target.key, status, amount: change });
}

export function installInfra(ctx: Ctx, infra: InfraId, stacks: number): void {
  const state = (ctx.c.infra[infra] ??= { stacks: 0, disabled: 0, ...(infra === "readCache" ? { warmth: 1 } : {}) });
  state.stacks += stacks;
  ctx.events.push({ type: "infra", infra, stacks: state.stacks });
}

export function addCards(ctx: Ctx, id: string, zone: CardZone, count: number, upgraded: boolean): void {
  const { c, run } = ctx;
  for (let i = 0; i < count; i++) {
    const card = newCard(run, id, upgraded);
    let to = zone;
    if (zone === "hand" && c.hand.length >= HAND_LIMIT) to = "discard";
    if (to === "hand") c.hand.push(card);
    else if (to === "discard") c.discardPile.push(card);
    else c.drawPile.splice(intRange(run.rng, "shuffle", 0, c.drawPile.length), 0, card);
    ctx.events.push({ type: "cardAdded", card: id, to });
  }
}

/** Draws up to `count` cards, reshuffling the discard pile when the draw pile runs out. */
export function draw(ctx: Ctx, count: number): void {
  const { c, content } = ctx;
  let batch: number[] = [];
  const flush = () => {
    if (batch.length > 0) ctx.events.push({ type: "draw", uids: batch });
    batch = [];
  };
  for (let i = 0; i < count; i++) {
    if (c.phase !== "player" || c.hand.length >= HAND_LIMIT) break;
    if (c.drawPile.length === 0) {
      if (c.discardPile.length === 0) break;
      flush();
      reshuffle(ctx);
    }
    const card = c.drawPile.shift()!;
    c.hand.push(card);
    batch.push(card.uid);
    const def = content.cards[card.id];
    const onDraw = def ? cardStats(def, card.upgraded).onDraw : undefined;
    const onCall = card.id === "pager" ? infraOn(c, "onCall") : 0;
    if (onDraw || onCall > 0) {
      flush();
      if (onDraw) resolveEffects(ctx, onDraw, { kind: "other" });
      for (let s = 0; s < onCall; s++) {
        draw(ctx, 1);
        gainCapacity(ctx, 3);
      }
    }
  }
  flush();
}

export function reshuffle(ctx: Ctx): void {
  const { c, run } = ctx;
  c.drawPile = [...c.drawPile, ...shuffled(run.rng, "shuffle", c.discardPile)];
  c.discardPile = [];
  ctx.events.push({ type: "shuffle" });
  fireRelics(ctx, "shuffle");
}

export function fireRelics(ctx: Ctx, trigger: RelicTrigger): void {
  for (const relic of ctx.run.relics) {
    const def = ctx.content.relics[relic.id];
    if (!def || def.trigger !== trigger) continue;
    if (def.every && def.every > 1) {
      relic.counter += 1;
      if (relic.counter < def.every) continue;
      relic.counter = 0;
    }
    ctx.events.push({ type: "relic", relic: relic.id });
    resolveEffects(ctx, def.effects ?? [], { kind: "relic", id: relic.id });
    if (ctx.c.phase === "lost") return;
  }
}

// ---------- choices ----------

export type ChoiceAction = Extract<Effect, { op: "choose" }>["action"];

export function zoneCards(c: CombatState, zone: CardZone): CardInstance[] {
  return zone === "hand" ? c.hand : zone === "draw" ? c.drawPile : c.discardPile;
}

export function choiceCandidates(ctx: Ctx, from: CardZone, action: ChoiceAction, sourceUid: number | null): CardInstance[] {
  return zoneCards(ctx.c, from).filter(
    (card) => card.uid !== sourceUid && (action !== "upgrade" || canUpgrade(card, ctx.content)),
  );
}

export function applyChoice(ctx: Ctx, from: CardZone, action: ChoiceAction, uids: number[]): void {
  const { c } = ctx;
  for (const uid of uids) {
    const zone = zoneCards(c, from);
    const index = zone.findIndex((card) => card.uid === uid);
    if (index < 0) continue;
    const card = zone[index];
    if (action === "upgrade") {
      card.upgraded = true;
      ctx.events.push({ type: "cardUpgraded", uid });
      continue;
    }
    if (action === "retain") {
      c.retained = [...(c.retained ?? []), uid];
      continue;
    }
    if (action === "toHand" && from === "hand") continue;
    if (action === "toHand" && c.hand.length >= HAND_LIMIT) continue;
    zone.splice(index, 1);
    if (action === "decommission") {
      c.decommissioned.push(card);
      ctx.events.push({ type: "cardDecommissioned", uid });
    } else if (action === "discard") c.discardPile.push(card);
    else if (action === "toHand") c.hand.push(card);
    else c.drawPile.unshift(card);
  }
}

// ---------- resolution ----------

function sourceUid(source: Source): number | null {
  return source.kind === "card" ? source.uid : null;
}

export function amountEnv(ctx: Ctx, source: Source): AmountEnv {
  const uid = sourceUid(source);
  return {
    c: ctx.c,
    missingBudget: ctx.run.maxBudget - ctx.run.budget,
    handSize: ctx.c.hand.filter((card) => card.uid !== uid).length,
  };
}

function conditionHolds(ctx: Ctx, cond: Condition, source: Source): boolean {
  const { c, run } = ctx;
  switch (cond.kind) {
    case "workload":
      return c.workload === cond.is;
    case "hasInfra":
      return infraOn(c, cond.infra) > 0;
    case "enemyIntends":
      return alive(c).some((e) => e.intent.kinds.includes(cond.intent));
    case "budgetBelowPct":
      return run.budget < (run.maxBudget * cond.pct) / 100;
    case "handEmpty":
      return c.hand.every((card) => card.uid === sourceUid(source));
  }
}

function enemyTargets(ctx: Ctx, target: "enemy" | "allEnemies" | "randomEnemy", chosen: number | undefined): EnemyState[] {
  if (target === "allEnemies") return alive(ctx.c);
  if (target === "enemy") {
    const enemy = ctx.c.enemies.find((e) => e.key === chosen);
    if (chosen !== undefined) return enemy && !enemy.resolved ? [enemy] : [];
  }
  const enemy = randomEnemy(ctx);
  return enemy ? [enemy] : [];
}

/**
 * Resolves effects in order. A `choose` with candidates pauses: the rest is stored in `combat.pending`
 * and "paused" is returned. Stops early if the combat is won or lost.
 */
export function resolveEffects(ctx: Ctx, effects: Effect[], source: Source, target?: number): "done" | "paused" {
  const { c, run } = ctx;
  const phase = c.phase;
  const queue = effects.slice();
  while (queue.length > 0) {
    if (over(ctx, phase)) return "done";
    const effect = queue.shift()!;
    const amount = (a: Amount) => amountValue(a, amountEnv(ctx, source)) ?? 0;
    switch (effect.op) {
      case "serve": {
        const base = amount(effect.amount);
        for (let t = 0; t < (effect.times ?? 1) && !over(ctx, phase); t++) {
          for (const enemy of enemyTargets(ctx, effect.target, target)) serveHit(ctx, enemy, base);
        }
        break;
      }
      case "capacity":
        gainCapacity(ctx, source.kind === "card" ? cardCapacityValue(c, amount(effect.amount)) : amount(effect.amount));
        break;
      case "reject":
        c.rejects += 1;
        gainCapacity(ctx, source.kind === "card" ? cardCapacityValue(c, amount(effect.amount)) : amount(effect.amount));
        break;
      case "draw":
        draw(ctx, effect.amount);
        break;
      case "engineers":
        gainEngineers(ctx, effect.amount);
        break;
      case "recover":
        recoverBudget(run, amount(effect.amount), ctx.events);
        break;
      case "loseBudget":
        loseBudget(ctx, effect.amount);
        break;
      case "status":
        if (effect.target === "self") addStatus(ctx, "player", effect.status, effect.amount);
        else for (const enemy of enemyTargets(ctx, effect.target, target)) addStatus(ctx, enemy, effect.status, effect.amount);
        break;
      case "removeStatus":
        for (const status of effect.status === "debuffs" ? PLAYER_DEBUFFS : [effect.status]) {
          addStatus(ctx, "player", status, -(c.statuses[status] ?? 0));
        }
        break;
      case "infra":
        installInfra(ctx, effect.infra, effect.stacks);
        break;
      case "repair":
        for (const state of Object.values(c.infra)) if (state) state.disabled = 0;
        break;
      case "warmCache": {
        const cache = c.infra.readCache;
        if (cache) cache.warmth = Math.max(cache.warmth ?? 1, Math.min(warmthLimit(c), (cache.warmth ?? 1) + effect.amount));
        break;
      }
      case "addCard":
        addCards(ctx, effect.card, effect.zone, effect.count, effect.upgraded ?? false);
        break;
      case "choose": {
        if (source.kind !== "card" && source.kind !== "runbook") break;
        if (choiceCandidates(ctx, effect.from, effect.action, sourceUid(source)).length === 0) break;
        c.pending = {
          source: source.kind === "card" ? { kind: "card", uid: source.uid } : { kind: "runbook", id: source.id },
          from: effect.from,
          count: effect.count,
          action: effect.action,
          optional: effect.optional ?? false,
          rest: queue,
          ...(target !== undefined ? { target } : {}),
        };
        return "paused";
      }
      case "reveal":
        c.revealTurns += effect.turns;
        break;
      case "cash":
        gainCash(run, effect.amount, ctx.events);
        break;
      case "if":
        if (conditionHolds(ctx, effect.cond, source)) queue.unshift(...effect.then);
        break;
    }
  }
  return "done";
}

export function warmthLimit(c: CombatState): number {
  return 6 + 2 * infraOn(c, "cacheTuning");
}
