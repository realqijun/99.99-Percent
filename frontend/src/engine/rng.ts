import type { RngStreams } from "./types";

/**
 * Seeded randomness (mulberry32). The generator state lives inside RunState,
 * so a saved run continues with exactly the same sequence after a refresh.
 */
export interface RngHolder {
  rngState: number;
}

export function rand(s: RngHolder): number {
  s.rngState = (s.rngState + 0x6d2b79f5) | 0;
  let t = s.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(s: RngHolder, min: number, max: number): number {
  return min + rand(s) * (max - min);
}

export function pick<T>(s: RngHolder, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rand(s) * items.length))];
}

/** Turn any integer or string into a usable 32-bit seed. */
export function normaliseSeed(input: number | string): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.floor(input) | 0;
  let h = 2166136261;
  const str = String(input);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// ---------- named streams in RunState.rng ----------
// map: map layout and the encounter a node holds. shuffle: draw pile order and the player's random targets.
// cards: card choices in rewards and the shop. ai: enemy Load, moves and Node Failure targets.
// events: which event a node holds and its random outcomes. rewards: cash, relics, runbooks and prices.

export type StreamName = keyof RngStreams;

export const STREAMS: readonly StreamName[] = ["map", "shuffle", "cards", "ai", "events", "rewards"];

export function seedStreams(seed: string): RngStreams {
  const rng = {} as RngStreams;
  for (const name of STREAMS) rng[name] = normaliseSeed(`${seed}:${name}`);
  return rng;
}

/** The next float in [0, 1) from one stream, advancing it in place. */
export function next(rng: RngStreams, stream: StreamName): number {
  const holder = { rngState: rng[stream] };
  const value = rand(holder);
  rng[stream] = holder.rngState;
  return value;
}

/** An integer in [min, max], both inclusive. */
export function intRange(rng: RngStreams, stream: StreamName, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(next(rng, stream) * (max - min + 1)));
}

export function chance(rng: RngStreams, stream: StreamName, p: number): boolean {
  return next(rng, stream) < p;
}

export function pickFrom<T>(rng: RngStreams, stream: StreamName, items: readonly T[]): T {
  return items[intRange(rng, stream, 0, items.length - 1)];
}

/** A shuffled copy (Fisher-Yates). */
export function shuffled<T>(rng: RngStreams, stream: StreamName, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = intRange(rng, stream, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks one item by weight; entries of weight 0 or less are never picked. Undefined when none can be. */
export function weightedPick<T>(rng: RngStreams, stream: StreamName, entries: readonly (readonly [T, number])[]): T | undefined {
  const live = entries.filter(([, w]) => w > 0);
  if (live.length === 0) return undefined;
  let roll = next(rng, stream) * live.reduce((sum, [, w]) => sum + w, 0);
  for (const [item, w] of live) {
    roll -= w;
    if (roll < 0) return item;
  }
  return live[live.length - 1][0];
}
