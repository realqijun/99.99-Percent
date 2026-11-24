/*
 * The engine's public API. Everything is pure: inputs are never mutated.
 * The UI and the store use only these functions and the types in ./types.
 */
import { CONTENT } from "../content";
import { cantPlayReason, cardCost } from "./combat";
import { choiceCandidates } from "./effects";
import { reachableNodes as reachable } from "./map";
import { shopPrice as discountedPrice } from "./rewards";
import { applyRunCommand, createRun, deckChoiceCancellable, eventChoiceBlocked, retroBlocked, retroRecoverAmount as retroAmount, RUN_VERSION, shopBlocked } from "./run";
import { describeCard } from "./text";
import type { CardDef, CardInstance, CombatState, CommandResult, Command, Content, NewRunOptions, RetroCommand, RunState, ShopCommand } from "./types";
import { checkRun } from "./validate";

export * from "./types";
export { RUN_VERSION };
export { INFRA_NAMES, STATUS_NAMES } from "./text";

export function newRun(opts: NewRunOptions, content: Content = CONTENT): RunState {
  return createRun(opts, content);
}

export function applyCommand(run: RunState, cmd: Command, content: Content = CONTENT): CommandResult {
  return applyRunCommand(run, cmd, content);
}

/** Rules text generated from a card's effects. With a combat, numbers include your statuses (and the target's, if given). */
export function cardText(card: CardDef, upgraded: boolean, combat?: CombatState, target?: number, content: Content = CONTENT): string {
  return describeCard(card, upgraded, combat, target, content.cards);
}

/** Why a card in hand can't be played right now, or null if it can. */
export function cantPlay(run: RunState, uid: number, content: Content = CONTENT): string | null {
  if (run.screen.kind !== "combat") return "Not in combat";
  return cantPlayReason(run.screen.combat, uid, content);
}

/** Engineers a card in hand costs right now. */
export function costNow(run: RunState, uid: number, content: Content = CONTENT): number | "x" | null {
  if (run.screen.kind !== "combat") return null;
  return cardCost(run.screen.combat, uid, content);
}

/** Error Budget a Retro rest would recover right now, after difficulty and relics. */
export function retroRecoverAmount(run: RunState, content: Content = CONTENT): number {
  return retroAmount(run, content);
}

/** The cards the pending in-combat choice can pick, in pile order; empty when nothing is pending. */
export function choiceCards(run: RunState, content: Content = CONTENT): CardInstance[] {
  if (run.screen.kind !== "combat" || !run.screen.combat.pending) return [];
  const c = run.screen.combat;
  const { from, action, source } = c.pending!;
  return choiceCandidates({ run, c, content, events: [] }, from, action, source.kind === "card" ? source.uid : null);
}

/** Whether the deck choice on screen can be backed out of with `cancel` (a Refactor or a card removal). */
export function canCancelDeckChoice(run: RunState): boolean {
  return deckChoiceCancellable(run);
}

/** What a Vendor base price costs right now, after discounts. */
export function shopPrice(run: RunState, basePrice: number, content: Content = CONTENT): number {
  return discountedPrice(run, content, basePrice);
}

/** Why an event choice can't be made now (not enough cash or Error Budget, or it would do nothing), or null if it can. */
export function cantChoose(run: RunState, index: number, content: Content = CONTENT): string | null {
  return eventChoiceBlocked(run, index, content);
}

/** Why a Vendor purchase can't be made now (sold, not enough cash, slots full, removal used), or null if it can. */
export function cantBuy(run: RunState, cmd: ShopCommand, content: Content = CONTENT): string | null {
  return shopBlocked(run, cmd, content);
}

/** Why a Retro option can't be taken now (no card left to refactor), or null if it can. */
export function cantRetro(run: RunState, cmd: RetroCommand, content: Content = CONTENT): string | null {
  return retroBlocked(run, cmd, content);
}

/** Map nodes the player can move to now. */
export function reachableNodes(run: RunState): string[] {
  return reachable(run);
}

/** A saved run if `data` is a valid one of this version, else null. */
export function validateRun(data: unknown, content: Content = CONTENT): RunState | null {
  return checkRun(data, RUN_VERSION, content);
}
