/*
 * The engine's public API. Everything is pure: inputs are never mutated.
 * The UI and the store use only these functions and the types in ./types.
 */
import { CONTENT } from "../content";
import type { CardDef, CombatState, CommandResult, Command, Content, NewRunOptions, RunState } from "./types";

export * from "./types";

export const RUN_VERSION = 1;

export function newRun(opts: NewRunOptions, content: Content = CONTENT): RunState {
  void opts; void content;
  throw new Error("not implemented");
}

export function applyCommand(run: RunState, cmd: Command, content: Content = CONTENT): CommandResult {
  void run; void cmd; void content;
  throw new Error("not implemented");
}

/** Rules text generated from a card's effects. With a combat, numbers include your statuses (and the target's, if given). */
export function cardText(card: CardDef, upgraded: boolean, combat?: CombatState, target?: number): string {
  void card; void upgraded; void combat; void target;
  throw new Error("not implemented");
}

/** Why a card in hand can't be played right now, or null if it can. */
export function cantPlay(run: RunState, uid: number, content: Content = CONTENT): string | null {
  void run; void uid; void content;
  throw new Error("not implemented");
}

/** Engineers a card in hand costs right now. */
export function costNow(run: RunState, uid: number, content: Content = CONTENT): number | "x" | null {
  void run; void uid; void content;
  throw new Error("not implemented");
}

/** Map nodes the player can move to now. */
export function reachableNodes(run: RunState): string[] {
  void run;
  throw new Error("not implemented");
}

/** A saved run if `data` is a valid one of this version, else null. */
export function validateRun(data: unknown, content: Content = CONTENT): RunState | null {
  void data; void content;
  throw new Error("not implemented");
}
