/*
 * The game store: the run, the profile, settings and the events of the last commands for animation.
 * All rules come from the engine; this file only sequences commands, saving and sound.
 */
import { createStore, useStore } from "zustand";
import { CONTENT } from "../content";
import { applyCommand, newRun as engineNewRun } from "../engine";
import type { CharacterId, Command, Difficulty, GameEvent, RunState } from "../engine/types";
import { cueFor, playCue, setTrack, setVolumes, type Cue, type Track } from "./audio";
import * as storage from "./storage";
import type { Profile, Settings } from "./storage";

export type { Profile, RunRecord, Settings } from "./storage";

export const EVENT_LIMIT = 60;

export interface QueuedEvent {
  id: number;
  event: GameEvent;
}

export interface GameError {
  id: number;
  message: string;
}

export type View = "title" | "game";

export interface GameState {
  run: RunState | null;
  view: View;
  profile: Profile;
  settings: Settings;
  /** Recent events, oldest first, with increasing ids. */
  events: QueuedEvent[];
  error: GameError | null;
  /** A saved run failed validation and is kept under the broken key. */
  brokenSave: boolean;
  /** False for dev fixtures, which must never overwrite a real save. */
  persist: boolean;

  newRun(options: { character: CharacterId; difficulty: Difficulty; seed?: string }): boolean;
  dispatch(command: Command): boolean;
  abandon(): void;
  clearFinished(): void;
  resume(): void;
  toTitle(): void;
  updateSettings(patch: Partial<Settings>): void;
  dismissError(id: number): void;
  exportBrokenSave(): void;
  /** Dev only: show a hand-made run without saving it. */
  loadFixture(run: RunState): void;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function randomSeed(): string {
  // The seed is picked outside the engine; the engine itself never uses Math.random().
  return Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, "0");
}

export function trackFor(view: View, run: RunState | null): Track {
  if (view === "title" || !run || run.screen.kind === "summary") return "title";
  if (run.screen.kind === "combat") return run.screen.combat.tier === "boss" ? "boss" : "combat";
  return "map";
}

function inTutorial(run: RunState): boolean {
  return run.screen.kind === "combat" && run.screen.combat.tutorial !== null;
}

function recordEnd(profile: Profile, run: RunState): Profile {
  if (!run.result) return profile;
  const record = { seed: run.seed, character: run.character, difficulty: run.difficulty, result: run.result, act: run.act, stats: { ...run.stats }, endedAt: Date.now() };
  const unlocked = { ...profile.unlocked };
  if (run.result === "won") unlocked[run.character] = Math.max(unlocked[run.character], Math.min(3, run.difficulty + 1)) as Difficulty;
  return { ...profile, unlocked, history: [record, ...profile.history].slice(0, storage.HISTORY_LIMIT) };
}

function playCues(events: GameEvent[]): void {
  const played = new Set<Cue>();
  for (const event of events) {
    try {
      const cue = cueFor(event);
      // One of each cue per command, so five draws don't play five overlapping sounds.
      if (cue && !played.has(cue)) {
        played.add(cue);
        playCue(cue);
      }
    } catch {
      // Sound never stops play.
    }
  }
}

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Audio is optional.
  }
}

export function createGameStore() {
  const loaded = storage.loadRun();
  const settings = storage.loadSettings();
  let track: Track | null = null;
  let nextId = 1;

  const syncTrack = (view: View, run: RunState | null) => {
    const next = trackFor(view, run);
    if (next !== track) {
      track = next;
      safely(() => setTrack(next));
    }
  };
  const volumes = ({ music, sfx, muted }: Settings) => safely(() => setVolumes({ music, sfx, muted }));
  volumes(settings);
  syncTrack("title", loaded.run);

  return createStore<GameState>()((set, get) => {
    const fail = (text: string) => {
      safely(() => playCue("error"));
      set({ error: { id: nextId++, message: text } });
    };

    const commit = (prev: RunState | null, next: RunState, events: GameEvent[]) => {
      const { persist, profile } = get();
      if (persist) storage.saveRun(next);
      let nextProfile = profile;
      if (prev && !prev.result && next.result) nextProfile = recordEnd(nextProfile, next);
      if (prev && inTutorial(prev) && !inTutorial(next) && !nextProfile.tutorialDone) nextProfile = { ...nextProfile, tutorialDone: true };
      if (nextProfile !== profile && persist) storage.saveProfile(nextProfile);
      const queued = events.map((event) => ({ id: nextId++, event }));
      set({ run: next, profile: nextProfile, events: [...get().events, ...queued].slice(-EVENT_LIMIT) });
      playCues(events);
      syncTrack(get().view, next);
    };

    return {
      run: loaded.run,
      view: "title",
      profile: storage.loadProfile(),
      settings,
      events: [],
      error: null,
      brokenSave: loaded.broken || storage.readBrokenSave() !== null,
      persist: true,

      newRun({ character, difficulty, seed }) {
        let run: RunState;
        try {
          // Seeds are shown in capitals, so typed ones are case-insensitive.
          run = engineNewRun({ seed: seed?.trim().toUpperCase() || randomSeed(), character, difficulty, tutorial: !get().profile.tutorialDone }, CONTENT);
        } catch (e) {
          fail(`Couldn't start the run: ${message(e)}`);
          return false;
        }
        set({ view: "game", events: [], persist: true });
        commit(null, run, []);
        return true;
      },

      dispatch(command) {
        const { run } = get();
        if (!run) return false;
        let result;
        try {
          result = applyCommand(run, command, CONTENT);
        } catch (e) {
          fail(`Something went wrong: ${message(e)}`);
          return false;
        }
        if (result.error) {
          fail(result.error);
          return false;
        }
        commit(run, result.run, result.events);
        return true;
      },

      abandon() {
        const { run, dispatch, persist } = get();
        if (!run || run.result) return;
        if (dispatch({ type: "abandon" })) return;
        // The engine couldn't end it; drop the run so the player is never stuck.
        if (persist) storage.saveRun(null);
        set({ run: null, view: "title", error: null });
        syncTrack("title", null);
      },

      clearFinished() {
        const { run, persist } = get();
        if (!run?.result) return;
        if (persist) storage.saveRun(null);
        set({ run: null, view: "title", events: [] });
        syncTrack("title", null);
      },

      resume() {
        const { run } = get();
        if (!run) return;
        set({ view: "game", events: [] });
        syncTrack("game", run);
      },

      toTitle() {
        set({ view: "title", events: [] });
        syncTrack("title", get().run);
      },

      updateSettings(patch) {
        const next = { ...get().settings, ...patch };
        set({ settings: next });
        storage.saveSettings(next);
        volumes(next);
      },

      dismissError(id) {
        if (get().error?.id === id) set({ error: null });
      },

      exportBrokenSave() {
        const raw = storage.readBrokenSave();
        if (raw === null) return;
        try {
          const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "99.99-percent-broken-save.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (e) {
          fail(`Couldn't export the save: ${message(e)}`);
        }
      },

      loadFixture(run) {
        set({ run, view: "game", persist: false, events: [] });
        syncTrack("game", run);
      },
    };
  });
}

export const gameStore = createGameStore();

export function useGame<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
