import type {
  CardDef,
  CardInstance,
  CardStats,
  Content,
  GameEvent,
  Keyword,
  RelicPassive,
  RunState,
} from "./types";

export const clone = <T>(value: T): T => structuredClone(value);

export const BASE_RUNBOOK_SLOTS = 3;
export const STARTING_CASH = 99;

/** A card's stats with its upgrade applied. */
export function cardStats(def: CardDef, upgraded: boolean): CardStats {
  return upgraded && def.upgrade ? { ...def, ...def.upgrade } : def;
}

export function hasKeyword(stats: CardStats, keyword: Keyword): boolean {
  return stats.keywords?.includes(keyword) ?? false;
}

export function canUpgrade(card: CardInstance, content: Content): boolean {
  return !card.upgraded && content.cards[card.id]?.upgrade !== undefined;
}

export function newCard(run: RunState, id: string, upgraded = false): CardInstance {
  return { uid: run.nextUid++, id, upgraded };
}

type PassiveKind = RelicPassive["kind"];

export function passives(run: RunState, content: Content): RelicPassive[] {
  return run.relics.flatMap((r) => content.relics[r.id]?.passive ?? []);
}

/** Sum of a numeric passive across all relics (amount, pct or turns). */
export function passiveSum(run: RunState, content: Content, kind: PassiveKind): number {
  let total = 0;
  for (const p of passives(run, content)) {
    if (p.kind !== kind) continue;
    if ("amount" in p) total += p.amount;
    else if ("pct" in p) total += p.pct;
    else if ("turns" in p) total += p.turns;
  }
  return total;
}

export function hasPassive(run: RunState, content: Content, kind: PassiveKind): boolean {
  return passives(run, content).some((p) => p.kind === kind);
}

export function gainCash(run: RunState, amount: number, events: GameEvent[]): void {
  const change = Math.max(-run.cash, amount);
  if (change === 0) return;
  run.cash += change;
  if (change > 0) run.stats.cashEarned += change;
  events.push({ type: "cash", amount: change });
}

export function recoverBudget(run: RunState, amount: number, events: GameEvent[]): void {
  const gained = Math.min(Math.max(0, amount), run.maxBudget - run.budget);
  if (gained <= 0) return;
  run.budget += gained;
  events.push({ type: "budget", amount: gained });
}

/** Loses Error Budget outside combat rules (combat goes through effects.loseBudget). Returns the amount lost. */
export function spendBudget(run: RunState, amount: number, events: GameEvent[]): number {
  const lost = Math.min(Math.max(0, amount), run.budget);
  if (lost <= 0) return 0;
  run.budget -= lost;
  run.stats.budgetLost += lost;
  events.push({ type: "budget", amount: -lost });
  return lost;
}

export function changeMaxBudget(run: RunState, amount: number, events: GameEvent[]): void {
  const before = run.maxBudget;
  run.maxBudget = Math.max(1, run.maxBudget + amount);
  if (run.maxBudget > before) recoverBudget(run, run.maxBudget - before, events);
  run.budget = Math.min(run.budget, run.maxBudget);
}

export function acquireRelic(run: RunState, id: string, content: Content, events: GameEvent[]): void {
  const def = content.relics[id];
  if (!def) return;
  run.relics.push({ id, counter: 0 });
  events.push({ type: "relic", relic: id });
  for (const p of def.passive ?? []) {
    if (p.kind === "maxBudget") changeMaxBudget(run, p.amount, events);
    if (p.kind === "runbookSlots") for (let i = 0; i < p.amount; i++) run.runbooks.push(null);
  }
}

/** Puts a runbook in the first free slot; false when all slots are full. */
export function addRunbook(run: RunState, id: string, events: GameEvent[]): boolean {
  const slot = run.runbooks.indexOf(null);
  if (slot < 0) return false;
  run.runbooks[slot] = id;
  events.push({ type: "runbook", runbook: id });
  return true;
}

export function addToDeck(run: RunState, card: CardInstance, events: GameEvent[]): void {
  run.deck.push(card);
  events.push({ type: "cardAdded", card: card.id, to: "deck" });
}
