/*
 * Card offers, relic and runbook picks, combat rewards and the shop.
 */
import { chance, intRange, next, shuffled, weightedPick, type StreamName } from "./rng";
import type { CardDef, CardInstance, Content, RelicDef, RelicRarity, RewardItem, RunState, ShopState, Tier } from "./types";
import { newCard, passiveSum } from "./util";

type Rarity = "common" | "uncommon" | "rare";
const RARITIES: Rarity[] = ["common", "uncommon", "rare"];

export const CARD_WEIGHTS: Record<"normal" | "elite" | "shop", Record<Rarity, number>> = {
  normal: { common: 60, uncommon: 35, rare: 5 },
  elite: { common: 50, uncommon: 40, rare: 10 },
  shop: { common: 55, uncommon: 35, rare: 10 },
};
/** Percentage points the rare chance rises per combat since a rare was offered. */
export const RARE_PITY_STEP = 2;
export const RELIC_WEIGHTS: Record<Rarity, number> = { common: 50, uncommon: 33, rare: 17 };
export const RUNBOOK_WEIGHTS: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10 };
export const RUNBOOK_DROP_CHANCE = 0.4;
export const CASH_REWARD: Record<Tier, [number, number]> = { normal: [10, 20], elite: [25, 35], boss: [95, 105] };
export const CARD_PRICE: Record<Rarity, number> = { common: 50, uncommon: 75, rare: 150 };
export const RELIC_PRICE: Partial<Record<RelicRarity, number>> = { common: 150, uncommon: 250, rare: 300, shop: 150 };
export const RUNBOOK_PRICE: Record<Rarity, number> = { common: 50, uncommon: 75, rare: 100 };
export const REMOVAL_BASE = 75;
export const REMOVAL_STEP = 25;
export const REJECT_CASH_CUT = 0.15;

function rewardPool(run: RunState, content: Content, pool: "character" | "neutral" | "both"): CardDef[] {
  return Object.values(content.cards).filter(
    (c) =>
      RARITIES.includes(c.rarity as Rarity) &&
      (pool === "both" ? c.pool === run.character || c.pool === "neutral" : pool === "neutral" ? c.pool === "neutral" : c.pool === run.character),
  );
}

/** Rolls a rarity, then a card of it not already in `exclude`, falling back to the other rarities. */
function rollCard(run: RunState, pool: CardDef[], weights: Record<Rarity, number>, exclude: Set<string>, stream: StreamName): CardDef | undefined {
  const rarity = weightedPick(run.rng, stream, RARITIES.map((r) => [r, weights[r]] as const)) ?? "common";
  const order = [rarity, ...RARITIES.filter((r) => r !== rarity)];
  for (const r of order) {
    const options = pool.filter((c) => c.rarity === r && !exclude.has(c.id));
    if (options.length > 0) return options[intRange(run.rng, stream, 0, options.length - 1)];
  }
  return undefined;
}

export function cardChoices(run: RunState, content: Content, tier: Tier): CardInstance[] {
  const pool = rewardPool(run, content, "both");
  const count = 3 + passiveSum(run, content, "cardChoices");
  const base = tier === "elite" ? CARD_WEIGHTS.elite : CARD_WEIGHTS.normal;
  const bonus = Math.min(base.common, RARE_PITY_STEP * run.rarePity);
  const weights = tier === "boss" ? { common: 0, uncommon: 0, rare: 1 } : { ...base, common: base.common - bonus, rare: base.rare + bonus };
  const picked = new Set<string>();
  const out: CardInstance[] = [];
  for (let i = 0; i < count; i++) {
    const def = rollCard(run, pool, weights, picked, "cards");
    if (!def) break;
    picked.add(def.id);
    out.push(newCard(run, def.id));
  }
  if (out.some((c) => content.cards[c.id].rarity === "rare")) run.rarePity = 0;
  else run.rarePity += 1;
  return out;
}

/** A random card of a rarity from the player's pools, for events. */
export function randomCardOf(run: RunState, content: Content, rarity: Rarity): CardDef | undefined {
  const weights = { common: 0, uncommon: 0, rare: 0, [rarity]: 1 };
  return rollCard(run, rewardPool(run, content, "both"), weights, new Set(), "events");
}

function relicPool(run: RunState, content: Content, rarities: RelicRarity[], exclude: string[] = []): RelicDef[] {
  const owned = new Set([...run.relics.map((r) => r.id), ...exclude]);
  return Object.values(content.relics).filter(
    (r) => rarities.includes(r.rarity) && (r.pool === "neutral" || r.pool === run.character) && !owned.has(r.id),
  );
}

/** A relic rolled by rarity (common, uncommon or rare), or undefined when none are left. */
export function rollRelic(run: RunState, content: Content, stream: StreamName, rarity?: Rarity, exclude: string[] = []): string | undefined {
  const first = rarity ?? weightedPick(run.rng, stream, RARITIES.map((r) => [r, RELIC_WEIGHTS[r]] as const)) ?? "common";
  for (const r of [first, ...RARITIES.filter((x) => x !== first)]) {
    const options = relicPool(run, content, [r], exclude);
    if (options.length > 0) return options[intRange(run.rng, stream, 0, options.length - 1)].id;
  }
  return undefined;
}

/** Whether `rollRelic` can still find a relic. */
export function relicLeft(run: RunState, content: Content): boolean {
  return relicPool(run, content, RARITIES).length > 0;
}

export function bossRelicChoices(run: RunState, content: Content): string[] {
  return shuffled(run.rng, "rewards", relicPool(run, content, ["boss"]).map((r) => r.id)).slice(0, 3);
}

export function rollRunbook(run: RunState, content: Content, stream: StreamName, exclude: string[] = []): string | undefined {
  const all = Object.values(content.runbooks);
  const rarity = weightedPick(run.rng, stream, RARITIES.map((r) => [r, RUNBOOK_WEIGHTS[r]] as const)) ?? "common";
  for (const r of [rarity, ...RARITIES.filter((x) => x !== rarity)]) {
    const options = all.filter((b) => b.rarity === r && !exclude.includes(b.id));
    if (options.length > 0) return options[intRange(run.rng, stream, 0, options.length - 1)].id;
  }
  return undefined;
}

export function combatRewards(run: RunState, content: Content, tier: Tier, rejects: number): RewardItem[] {
  const [min, max] = CASH_REWARD[tier];
  const multiplier = (1 + passiveSum(run, content, "cashRewardPct") / 100) * (1 - REJECT_CASH_CUT) ** rejects;
  const items: RewardItem[] = [];
  const cash = Math.round(intRange(run.rng, "rewards", min, max) * multiplier);
  if (cash > 0) items.push({ kind: "cash", amount: cash, taken: false });
  if (tier === "elite") {
    const relic = rollRelic(run, content, "rewards");
    if (relic) items.push({ kind: "relic", relic, taken: false });
  }
  if (tier !== "boss" && chance(run.rng, "rewards", RUNBOOK_DROP_CHANCE)) {
    const runbook = rollRunbook(run, content, "rewards");
    if (runbook) items.push({ kind: "runbook", runbook, taken: false });
  }
  const choices = cardChoices(run, content, tier);
  if (choices.length > 0) items.push({ kind: "cards", choices, taken: false });
  return items;
}

/** What a shop's base price costs now: the shop discount applied, rounded to the nearest. */
export function shopPrice(run: RunState, content: Content, basePrice: number): number {
  return Math.max(0, Math.round((basePrice * (100 - passiveSum(run, content, "shopDiscountPct"))) / 100));
}

/** Prices vary by up to 5% either way. */
function jitter(run: RunState, price: number): number {
  return Math.round(price * (0.95 + next(run.rng, "rewards") * 0.1));
}

export function makeShop(run: RunState, content: Content): ShopState {
  const cards: ShopState["cards"] = [];
  for (const [pool, count] of [["character", 5], ["neutral", 2]] as const) {
    const options = rewardPool(run, content, pool);
    const picked = new Set<string>();
    for (let i = 0; i < count; i++) {
      const def = rollCard(run, options, CARD_WEIGHTS.shop, picked, "cards");
      if (!def) break;
      picked.add(def.id);
      cards.push({ card: newCard(run, def.id), basePrice: jitter(run, CARD_PRICE[def.rarity as Rarity]), sold: false });
    }
  }
  const relicOptions = shuffled(run.rng, "rewards", relicPool(run, content, ["common", "uncommon", "rare", "shop"]));
  const relics = relicOptions.slice(0, 3).map((r) => ({ relic: r.id, basePrice: jitter(run, RELIC_PRICE[r.rarity] ?? 150), sold: false }));
  const runbooks: ShopState["runbooks"] = [];
  for (let i = 0; i < 3; i++) {
    const id = rollRunbook(run, content, "rewards", runbooks.map((b) => b.runbook));
    if (!id) break;
    runbooks.push({ runbook: id, basePrice: jitter(run, RUNBOOK_PRICE[content.runbooks[id].rarity]), sold: false });
  }
  return { cards, relics, runbooks, removalBasePrice: REMOVAL_BASE + REMOVAL_STEP * run.removals, removalUsed: false };
}
