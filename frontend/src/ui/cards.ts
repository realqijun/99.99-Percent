import type { CardDef, CardInstance, Content } from "../engine/types";
import { cardDef } from "./content";
import { CARD_TYPES } from "./labels";

export type Cost = number | "x" | null;

export const baseCost = (def: CardDef, upgraded: boolean): Cost =>
  upgraded && def.upgrade?.cost !== undefined ? def.upgrade.cost : def.cost;

export const costLabel = (cost: Cost) => (cost === null ? "Unplayable" : cost === "x" ? "costs X" : `costs ${cost}`);

export const cardName = (def: CardDef, upgraded: boolean) => `${def.name}${upgraded ? "+" : ""}`;

export function cardLabel(def: CardDef, upgraded: boolean, cost: Cost, text: string): string {
  return `${cardName(def, upgraded)}, ${CARD_TYPES[def.type]}, ${costLabel(cost)}. ${text}`;
}

const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3 };

/** Deck order for viewers: by type, then name. Draw piles are shown this way too, so they don't give away the order. */
export function sortCards(cards: CardInstance[], content: Content): CardInstance[] {
  return [...cards].sort((a, b) => {
    const da = cardDef(content, a.id);
    const db = cardDef(content, b.id);
    return TYPE_ORDER[da.type] - TYPE_ORDER[db.type] || da.name.localeCompare(db.name) || Number(a.upgraded) - Number(b.upgraded) || a.uid - b.uid;
  });
}
