/* The content tables the screens read. Defaults to the game's content; dev fixtures and tests supply their own. */
import { createContext, useContext } from "react";
import { CONTENT } from "../content";
import type { CardDef, Content, EnemyDef, RelicDef, RunbookDef } from "../engine/types";

export const ContentContext = createContext<Content>(CONTENT);

export function useContent(): Content {
  return useContext(ContentContext);
}

// Missing ids draw as placeholders instead of crashing a screen.

export function cardDef(content: Content, id: string): CardDef {
  return content.cards[id] ?? { id, name: id, pool: "status", rarity: "special", type: "status", cost: null, target: "none", effects: [] };
}

export function enemyDef(content: Content, id: string): EnemyDef {
  return content.enemies[id] ?? { id, name: id, tier: "normal", load: [1, 1], moves: {}, ai: { kind: "cycle", moves: [] }, description: "", sprite: id };
}

export function relicDef(content: Content, id: string): RelicDef {
  return content.relics[id] ?? { id, name: id, rarity: "common", pool: "neutral", icon: "gear", text: "" };
}

export function runbookDef(content: Content, id: string): RunbookDef {
  return content.runbooks[id] ?? { id, name: id, rarity: "common", icon: "book", target: "none", effects: [], text: "" };
}
