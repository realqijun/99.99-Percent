/*
 * Sound effects and music, synthesised with Web Audio. Stub until the audio module lands; keep this API.
 * Everything is silent and harmless where Web Audio is missing, as in tests.
 */
import type { GameEvent } from "../../engine/types";

export type Cue =
  | "click" | "cardPlay" | "serve" | "hit" | "capacity" | "budgetLoss" | "recover" | "status" | "infra"
  | "nodeFailure" | "enemyResolved" | "draw" | "shuffle" | "cash" | "relic" | "runbook" | "combatWon"
  | "actComplete" | "runWon" | "runLost" | "error";
export type Track = "title" | "map" | "combat" | "boss";
export interface Volumes { music: number; sfx: number; muted: boolean }

export function cueFor(event: GameEvent): Cue | null { void event; return null; }
export function playCue(cue: Cue): void { void cue; }
export function setTrack(track: Track | null): void { void track; }
export function setVolumes(volumes: Volumes): void { void volumes; }
