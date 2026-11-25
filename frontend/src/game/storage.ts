/*
 * Browser storage. Every itch.io HTML game shares one origin, so all keys start with `n9999.`.
 * Storage can be missing, full, blocked or corrupt: nothing here throws, and everything read is validated.
 */
import { validateRun } from "../engine";
import type { Act, CharacterId, Difficulty, RunState, RunStats } from "../engine/types";

export const KEYS = {
  run: "n9999.run",
  profile: "n9999.profile",
  settings: "n9999.settings",
  broken: "n9999.run.broken",
} as const;

export const HISTORY_LIMIT = 20;
const CHARACTER_IDS: CharacterId[] = ["jordan", "taylor"];

export interface RunRecord {
  seed: string;
  character: CharacterId;
  difficulty: Difficulty;
  result: "won" | "lost";
  act: Act;
  stats: RunStats;
  /** Milliseconds since the epoch. */
  endedAt: number;
}

export interface Profile {
  /** Highest difficulty unlocked per character. */
  unlocked: Record<CharacterId, Difficulty>;
  /** Newest first. */
  history: RunRecord[];
  tutorialDone: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
  speed: "normal" | "fast";
  reducedMotion: boolean;
}

export const DEFAULT_PROFILE: Profile = { unlocked: { jordan: 0, taylor: 0 }, history: [], tutorialDone: false };

export function defaultSettings(): Settings {
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia (tests, old browsers): keep motion on.
  }
  return { music: 0.6, sfx: 0.8, muted: false, speed: "normal", reducedMotion };
}

// ---------- raw access ----------

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Full or blocked: play goes on without saving.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Blocked storage has nothing to remove.
  }
}

function readJson(key: string): unknown {
  const raw = read(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// ---------- run ----------

export interface LoadedRun {
  run: RunState | null;
  /** The saved run failed validation and was moved to the broken key. */
  broken: boolean;
}

export function loadRun(): LoadedRun {
  const raw = read(KEYS.run);
  if (raw === null) return { run: null, broken: false };
  let run: RunState | null = null;
  try {
    run = validateRun(JSON.parse(raw));
  } catch {
    run = null;
  }
  if (run) return { run, broken: false };
  write(KEYS.broken, raw);
  remove(KEYS.run);
  return { run: null, broken: true };
}

export function saveRun(run: RunState | null): void {
  if (run) write(KEYS.run, JSON.stringify(run));
  else remove(KEYS.run);
}

export function readBrokenSave(): string | null {
  return read(KEYS.broken);
}

export function clearBrokenSave(): void {
  remove(KEYS.broken);
}

// ---------- profile ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isDifficulty = (v: unknown): v is Difficulty => v === 0 || v === 1 || v === 2 || v === 3;
const isCharacter = (v: unknown): v is CharacterId => CHARACTER_IDS.includes(v as CharacterId);

const STAT_KEYS: (keyof RunStats)[] = ["floorsClimbed", "combatsWon", "elitesWon", "bossesWon", "budgetLost", "cashEarned", "cardsPlayed", "turns"];

function toRecord(v: unknown): RunRecord | null {
  if (!isObject(v)) return null;
  const { seed, character, difficulty, result, act, stats, endedAt } = v;
  if (typeof seed !== "string" || !isCharacter(character) || !isDifficulty(difficulty)) return null;
  if (result !== "won" && result !== "lost") return null;
  if (act !== 1 && act !== 2 && act !== 3) return null;
  if (!isObject(stats) || !STAT_KEYS.every((k) => isCount(stats[k]))) return null;
  if (typeof endedAt !== "number" || !Number.isFinite(endedAt)) return null;
  const cleanStats = Object.fromEntries(STAT_KEYS.map((k) => [k, stats[k]])) as unknown as RunStats;
  return { seed, character, difficulty, result, act, stats: cleanStats, endedAt };
}

export function loadProfile(): Profile {
  const data = readJson(KEYS.profile);
  if (!isObject(data)) return structuredClone(DEFAULT_PROFILE);
  const unlocked = { ...DEFAULT_PROFILE.unlocked };
  if (isObject(data.unlocked)) {
    for (const id of CHARACTER_IDS) {
      const level = data.unlocked[id];
      if (isDifficulty(level)) unlocked[id] = level;
    }
  }
  const history = Array.isArray(data.history)
    ? data.history.map(toRecord).filter((r): r is RunRecord => r !== null).slice(0, HISTORY_LIMIT)
    : [];
  return { unlocked, history, tutorialDone: data.tutorialDone === true };
}

export function saveProfile(profile: Profile): void {
  write(KEYS.profile, JSON.stringify(profile));
}

// ---------- settings ----------

const isVolume = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

export function loadSettings(): Settings {
  const base = defaultSettings();
  const data = readJson(KEYS.settings);
  if (!isObject(data)) return base;
  return {
    music: isVolume(data.music) ? data.music : base.music,
    sfx: isVolume(data.sfx) ? data.sfx : base.sfx,
    muted: typeof data.muted === "boolean" ? data.muted : base.muted,
    speed: data.speed === "fast" || data.speed === "normal" ? data.speed : base.speed,
    reducedMotion: typeof data.reducedMotion === "boolean" ? data.reducedMotion : base.reducedMotion,
  };
}

export function saveSettings(settings: Settings): void {
  write(KEYS.settings, JSON.stringify(settings));
}
