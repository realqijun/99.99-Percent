/*
 * Sound effects and music, synthesised with Web Audio: no files, no network.
 * Nothing to set up: the audio starts on the player's first click or key press,
 * and anything asked for before then is dropped. Everything is silent and
 * harmless where Web Audio is missing, as in tests.
 */
import type { GameEvent } from "../../engine/types";
import { createPlayer, type Player } from "./player";

export type Cue =
  | "click" | "cardPlay" | "serve" | "hit" | "capacity" | "budgetLoss" | "recover" | "status" | "infra"
  | "nodeFailure" | "enemyResolved" | "draw" | "shuffle" | "cash" | "relic" | "runbook" | "combatWon"
  | "actComplete" | "runWon" | "runLost" | "error";
export type Track = "title" | "map" | "combat" | "boss";
/** Music and sfx run from 0 (silent) to 1 (full); muted silences both. */
export interface Volumes { music: number; sfx: number; muted: boolean }

/** The sound for an engine event, or null for events that are heard through others or not at all. */
export function cueFor(event: GameEvent): Cue | null {
  switch (event.type) {
    case "draw":
    case "cardAdded":
      return "draw";
    case "shuffle":
      return "shuffle";
    case "cardPlayed":
    case "cardRemoved":
      return "cardPlay";
    case "serve":
      return "serve";
    case "hit":
      return event.budgetLost > 0 ? "budgetLoss" : "hit";
    case "capacity":
      return event.amount > 0 ? "capacity" : null;
    case "budget":
      return event.amount > 0 ? "recover" : event.amount < 0 ? "budgetLoss" : null;
    case "status":
      return event.amount !== 0 ? "status" : null;
    case "infra":
      return "infra";
    // A prevented failure sounds like a blocked hit; with nothing to fail, nothing happens.
    case "nodeFailure":
      return event.prevented ? "hit" : event.infra ? "nodeFailure" : null;
    case "enemyResolved":
      return "enemyResolved";
    case "cash":
      return event.amount !== 0 ? "cash" : null;
    case "relic":
    case "cardUpgraded":
      return "relic";
    case "runbook":
      return "runbook";
    case "combatWon":
    case "actComplete":
    case "runWon":
    case "runLost":
      return event.type;
    // Heard through the music, the cards that follow, or the effects of the move.
    case "combatStart":
    case "turnStart":
    case "engineers":
    case "enemyMove":
    case "summon":
    case "cardDecommissioned":
      return null;
  }
}

// Listens for the first press from the moment the game loads; the audio itself waits for it.
const player: Player = createPlayer();

export function playCue(cue: Cue): void {
  player.playCue(cue);
}

/** Loop a track, crossfading from the last; null fades the music out. The same track again does nothing. */
export function setTrack(track: Track | null): void {
  player.setTrack(track);
}

export function setVolumes(volumes: Volumes): void {
  player.setVolumes(volumes);
}
