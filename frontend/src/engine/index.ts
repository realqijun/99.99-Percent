/*
 * The engine's public API. Everything is pure: inputs are never mutated.
 * The UI and the store use only these functions and the types in ./types.
 */
import { CONTENT } from "../content";
import { cantPlayReason, cardCost } from "./combat";
import { reachableNodes as reachable } from "./map";
import { applyRunCommand, createRun, retroRecoverAmount as retroAmount, RUN_VERSION } from "./run";
import { describeCard } from "./text";
import type { CardDef, CombatState, CommandResult, Command, Content, NewRunOptions, RunState } from "./types";
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

/** Map nodes the player can move to now. */
export function reachableNodes(run: RunState): string[] {
  return reachable(run);
}

/** A saved run if `data` is a valid one of this version, else null. */
export function validateRun(data: unknown, content: Content = CONTENT): RunState | null {
  return checkRun(data, RUN_VERSION, content);
}
