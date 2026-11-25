/*
 * Rules text generated from card effects, so it can never disagree with what a card does.
 */
import { amountValue, cardCapacityValue, serveValue, type AmountEnv } from "./effects";
import type { Amount, CardDef, CardZone, CombatState, Condition, Effect, EnemyState, InfraId, IntentKind, StatusId } from "./types";
import { cardStats, hasKeyword } from "./util";

export const INFRA_NAMES: Record<InfraId, string> = {
  readCache: "Read Cache",
  cacheTuning: "Cache Tuning",
  loadBalancer: "Load Balancer",
  appServer: "App Server",
  autoscaler: "Autoscaler",
  cdn: "CDN",
  messageQueue: "Message Queue",
  readReplica: "Read Replica",
  healthChecks: "Health Checks",
  failover: "Failover",
  circuitBreaker: "Circuit Breaker",
  autoRemediation: "Auto Remediation",
  onCall: "On-Call Rotation",
};

export const STATUS_NAMES: Record<StatusId, string> = {
  backlog: "Backlog",
  latency: "Latency",
  degraded: "Degraded",
  optimized: "Optimized",
  hardened: "Hardened",
  reserved: "Reserved",
  throttled: "Throttled",
  exposed: "Exposed",
  scaling: "Scaling",
  retries: "Retries",
};

const AMOUNT_OF: Record<Exclude<Amount, number>["of"], string> = {
  infraKinds: "per kind of installed infrastructure",
  infraStacks: "per stack of installed infrastructure",
  handSize: "per other card in your hand",
  cardsPlayedThisTurn: "per card played this turn",
  capacity: "per Capacity you have",
  backlog: "per Backlog you have",
  missingBudget: "per missing Error Budget",
  enemyCount: "per enemy",
};

const INTENT_WORDS: Record<IntentKind, string> = {
  attack: "attack",
  defend: "defend",
  buff: "buff",
  debuff: "debuff you",
  failure: "cause a Node Failure",
  summon: "summon",
  unknown: "act",
};

const ZONE_FROM: Record<CardZone, string> = { hand: "from your hand", draw: "from your draw pile", discard: "from your discard pile" };
const ZONE_IN: Record<CardZone, string> = { hand: "in your hand", draw: "in your draw pile", discard: "in your discard pile" };

/** "techDebt" -> "Tech Debt", for cards the name table doesn't know. */
function humanize(id: string): string {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const article = (word: string) => (/^[AEIOU]/i.test(word) ? `an ${word}` : `a ${word}`);
const timesText = (n: number) => (n === 1 ? "" : n === 2 ? " twice" : `, ${n} times`);

interface TextEnv {
  combat?: CombatState;
  target?: EnemyState;
  amountEnv: AmountEnv | null;
  names: Record<string, CardDef>;
}

/**
 * A number and a note for the end of the sentence. When the combat is known it is the exact value,
 * with the formula as the note; otherwise the formula is split across both. `finish` applies statuses.
 */
function numberText(amount: Amount, env: TextEnv, finish: (n: number) => number): [string, string] {
  if (typeof amount === "number") return [String(finish(amount)), ""];
  const per = AMOUNT_OF[amount.of];
  const value = amountValue(amount, env.amountEnv);
  if (value !== null) return [String(finish(value)), ` (${amount.base ? `${amount.base} plus ` : ""}${amount.per} ${per})`];
  return amount.base ? [String(amount.base), `, plus ${amount.per} ${per}`] : [String(amount.per), ` ${per}`];
}

function cardsText(count: number, optional: boolean): string {
  if (optional) return `up to ${plural(count, "card")}`;
  return count === 1 ? "a card" : plural(count, "card");
}

function conditionText(cond: Condition): string {
  switch (cond.kind) {
    case "workload":
      return `If the workload is ${cond.is}-heavy`;
    case "hasInfra":
      return `If you have a working ${INFRA_NAMES[cond.infra]}`;
    case "enemyIntends":
      return `If an enemy intends to ${INTENT_WORDS[cond.intent]}`;
    case "budgetBelowPct":
      return `If your Error Budget is below ${cond.pct}%`;
    case "handEmpty":
      return "If your hand is empty";
  }
}

function effectText(effect: Effect, env: TextEnv): string {
  const { combat } = env;
  switch (effect.op) {
    case "serve": {
      // With a target, show what that enemy takes; a random target can't be known.
      const exposed = effect.target === "randomEnemy" ? undefined : env.target;
      const [n, note] = numberText(effect.amount, env, (v) => serveValue(combat, v, exposed));
      const to = effect.target === "allEnemies" ? " to all enemies" : effect.target === "randomEnemy" ? " to a random enemy" : "";
      return `Serve ${n}${to}${timesText(effect.times ?? 1)}${note}.`;
    }
    case "capacity": {
      const [n, note] = numberText(effect.amount, env, (v) => cardCapacityValue(combat, v));
      return `Gain ${n} Capacity${note}.`;
    }
    case "reject": {
      const [n, note] = numberText(effect.amount, env, (v) => cardCapacityValue(combat, v));
      return `Reject ${n}${note}.`;
    }
    case "draw":
      return effect.amount === 1 ? "Draw a card." : `Draw ${effect.amount} cards.`;
    case "engineers":
      return `${effect.amount < 0 ? "Lose" : "Gain"} ${plural(Math.abs(effect.amount), "Engineer")}.`;
    case "recover": {
      const [n, note] = numberText(effect.amount, env, (v) => v);
      return `Recover ${n} Error Budget${note}.`;
    }
    case "loseBudget":
      return `Lose ${effect.amount} Error Budget.`;
    case "status": {
      const name = STATUS_NAMES[effect.status];
      if (effect.target === "self") return `Gain ${effect.amount} ${name}.`;
      const to = effect.target === "allEnemies" ? " to all enemies" : effect.target === "randomEnemy" ? " to a random enemy" : "";
      return `Apply ${effect.amount} ${name}${to}.`;
    }
    case "removeStatus":
      return effect.status === "debuffs" ? "Remove your debuffs." : `Remove your ${STATUS_NAMES[effect.status]}.`;
    case "infra":
      return effect.stacks === 1 ? `Install ${INFRA_NAMES[effect.infra]}.` : `Install ${effect.stacks} stacks of ${INFRA_NAMES[effect.infra]}.`;
    case "repair":
      return "Repair all disabled infrastructure.";
    case "warmCache":
      return `Warm the Read Cache by ${effect.amount}.`;
    case "addCard": {
      const name = `${env.names[effect.card]?.name ?? humanize(effect.card)}${effect.upgraded ? "+" : ""}`;
      const what = effect.count === 1 ? article(name) : `${effect.count} ${name} cards`;
      if (effect.zone === "draw") return `Shuffle ${what} into your draw pile.`;
      return `Add ${what} to your ${effect.zone === "hand" ? "hand" : "discard pile"}.`;
    }
    case "choose": {
      const cards = cardsText(effect.count, effect.optional ?? false);
      switch (effect.action) {
        case "decommission":
          return `Decommission ${cards} ${ZONE_FROM[effect.from]}.`;
        case "discard":
          return effect.from === "hand" ? `Discard ${cards}.` : `Discard ${cards} ${ZONE_FROM[effect.from]}.`;
        case "toHand":
          return `Put ${cards} ${ZONE_FROM[effect.from]} into your hand.`;
        case "toTopOfDraw":
          return `Put ${cards} ${ZONE_FROM[effect.from]} on top of your draw pile.`;
        case "upgrade":
          return `Upgrade ${cards} ${ZONE_IN[effect.from]}.`;
        case "retain":
          return `Retain ${cards} ${ZONE_IN[effect.from]} this turn.`;
      }
      break;
    }
    case "reveal":
      return `See enemy intents ${plural(effect.turns, "more turn")} ahead.`;
    case "cash":
      return `Gain ${effect.amount} cash.`;
    case "if":
      return `${conditionText(effect.cond)}: ${effectsText(effect.then, env)}`;
  }
  return "";
}

function effectsText(effects: Effect[], env: TextEnv): string {
  return effects.map((e) => effectText(e, env)).join(" ");
}

export function describeCard(
  card: CardDef,
  upgraded: boolean,
  combat: CombatState | undefined,
  target: number | undefined,
  names: Record<string, CardDef>,
): string {
  const stats = cardStats(card, upgraded);
  const inHand = combat?.hand.some((h) => h.id === card.id) ?? false;
  const env: TextEnv = {
    combat,
    target: combat?.enemies.find((e) => e.key === target && !e.resolved),
    amountEnv: combat ? { c: combat, missingBudget: null, handSize: Math.max(0, combat.hand.length - (inHand ? 1 : 0)) } : null,
    names,
  };
  const parts: string[] = [];
  for (const [keyword, word] of [["unplayable", "Unplayable."], ["innate", "Innate."], ["retain", "Retain."], ["volatile", "Volatile."]] as const) {
    if (hasKeyword(stats, keyword)) parts.push(word);
  }
  const body = effectsText(stats.effects, env);
  if (body) parts.push(stats.cost === "x" ? `Once per Engineer spent: ${body}` : body);
  if (stats.onDraw?.length) parts.push(`When you draw it, ${lowerFirst(effectsText(stats.onDraw, env))}`);
  if (stats.endOfTurnInHand?.length) parts.push(`If it is still in your hand at the end of the turn, ${lowerFirst(effectsText(stats.endOfTurnInHand, env))}`);
  if (hasKeyword(stats, "decommission")) parts.push("Decommission.");
  return parts.join(" ");
}
