import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandResult, GameEvent, RunState } from "../engine/types";
import { CONTENT } from "../content";
import { FIXTURES } from "../ui/__fixtures__";

const engine = vi.hoisted(() => ({
  applyCommand: vi.fn(),
  newRun: vi.fn(),
  validateRun: vi.fn(),
}));
vi.mock("../engine", async (original) => ({ ...(await original<typeof import("../engine")>()), ...engine }));

const audio = vi.hoisted(() => ({
  cueFor: vi.fn((e: { type: string }) => (e.type === "hit" ? "hit" : e.type === "draw" ? "draw" : null)),
  playCue: vi.fn(),
  setTrack: vi.fn(),
  setVolumes: vi.fn(),
}));
vi.mock("./audio", () => audio);

const { createGameStore } = await import("./store");
const { KEYS } = await import("./storage");

const clone = (run: RunState): RunState => structuredClone(run);
const mapRun = () => clone(FIXTURES.map.run);
const combatRun = () => clone(FIXTURES.combat.run);

function storeWith(run: RunState | null) {
  if (run) localStorage.setItem(KEYS.run, JSON.stringify(run));
  return createGameStore();
}

const saved = () => JSON.parse(localStorage.getItem(KEYS.run) ?? "null") as RunState | null;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  engine.validateRun.mockImplementation((data: unknown) => (data && typeof data === "object" && "seed" in data ? data : null));
});

describe("dispatch", () => {
  it("applies the command, saves the run, queues events, plays cues and sets the track", () => {
    const store = storeWith(mapRun());
    const next = combatRun();
    const events: GameEvent[] = [
      { type: "combatStart", encounter: "bots" },
      { type: "draw", uids: [1, 2] },
      { type: "draw", uids: [3] },
      { type: "hit", enemy: 1, amount: 4, absorbed: 0, budgetLost: 4 },
    ];
    engine.applyCommand.mockReturnValue({ run: next, events } satisfies CommandResult);
    store.getState().resume();

    expect(store.getState().dispatch({ type: "chooseNode", node: "f4c1" })).toBe(true);

    expect(engine.applyCommand).toHaveBeenCalledWith(expect.objectContaining({ seed: next.seed }), { type: "chooseNode", node: "f4c1" }, CONTENT);
    expect(store.getState().run).toBe(next);
    expect(saved()).toEqual(next);
    expect(store.getState().events.map((q) => q.event)).toEqual(events);
    expect(new Set(store.getState().events.map((q) => q.id)).size).toBe(4);
    // One of each cue per command.
    expect(audio.playCue.mock.calls).toEqual([["draw"], ["hit"]]);
    expect(audio.setTrack).toHaveBeenLastCalledWith("combat");
  });

  it("keeps the run and shows the error when the engine refuses", () => {
    const run = mapRun();
    const store = storeWith(run);
    engine.applyCommand.mockImplementation((r: RunState) => ({ run: r, events: [], error: "Not reachable" }));
    localStorage.removeItem(KEYS.run);

    expect(store.getState().dispatch({ type: "chooseNode", node: "nowhere" })).toBe(false);

    expect(store.getState().run).toEqual(run);
    expect(store.getState().error?.message).toBe("Not reachable");
    expect(audio.playCue).toHaveBeenCalledWith("error");
    expect(saved()).toBeNull();
    expect(store.getState().events).toEqual([]);
  });

  it("survives an engine that throws", () => {
    const store = storeWith(mapRun());
    engine.applyCommand.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(store.getState().dispatch({ type: "endTurn" })).toBe(false);
    expect(store.getState().error?.message).toContain("boom");
    expect(store.getState().run).not.toBeNull();
  });

  it("saves after every command", () => {
    const store = storeWith(mapRun());
    const first = { ...combatRun(), cash: 1 };
    const second = { ...combatRun(), cash: 2 };
    engine.applyCommand.mockReturnValueOnce({ run: first, events: [] }).mockReturnValueOnce({ run: second, events: [] });
    store.getState().dispatch({ type: "endTurn" });
    expect(saved()?.cash).toBe(1);
    store.getState().dispatch({ type: "endTurn" });
    expect(saved()?.cash).toBe(2);
  });

  it("records a win and unlocks the next difficulty for that character", () => {
    const store = storeWith(combatRun());
    const won: RunState = { ...combatRun(), screen: { kind: "summary" }, result: "won", difficulty: 1 };
    engine.applyCommand.mockReturnValue({ run: won, events: [{ type: "runWon" }] });

    store.getState().dispatch({ type: "endTurn" });

    const { profile } = store.getState();
    expect(profile.unlocked).toEqual({ jordan: 2, taylor: 0 });
    expect(profile.history).toHaveLength(1);
    expect(profile.history[0]).toMatchObject({ seed: won.seed, character: "jordan", difficulty: 1, result: "won" });
    expect(JSON.parse(localStorage.getItem(KEYS.profile)!).unlocked.jordan).toBe(2);
    expect(audio.setTrack).toHaveBeenLastCalledWith("title");

    // A finished run isn't recorded twice.
    engine.applyCommand.mockReturnValue({ run: won, events: [] });
    store.getState().dispatch({ type: "leave" });
    expect(store.getState().profile.history).toHaveLength(1);
  });

  it("records a loss without unlocking anything", () => {
    const store = storeWith(combatRun());
    engine.applyCommand.mockReturnValue({ run: { ...combatRun(), screen: { kind: "summary" }, result: "lost" }, events: [{ type: "runLost" }] });
    store.getState().dispatch({ type: "endTurn" });
    expect(store.getState().profile.unlocked).toEqual({ jordan: 0, taylor: 0 });
    expect(store.getState().profile.history[0].result).toBe("lost");
  });

  it("marks the tutorial done once the guided combat moves on", () => {
    const store = storeWith(clone(FIXTURES["combat-tutorial-3"].run));
    engine.applyCommand.mockReturnValue({ run: combatRun(), events: [] });
    store.getState().dispatch({ type: "advanceTutorial" });
    expect(store.getState().profile.tutorialDone).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEYS.profile)!).tutorialDone).toBe(true);
  });
});

describe("runs", () => {
  it("starts a run with the tutorial until it is done, with the typed seed in capitals", () => {
    const store = createGameStore();
    engine.newRun.mockReturnValue(mapRun());
    expect(store.getState().newRun({ character: "taylor", difficulty: 0, seed: " abc " })).toBe(true);
    expect(engine.newRun).toHaveBeenCalledWith({ seed: "ABC", character: "taylor", difficulty: 0, tutorial: true }, CONTENT);
    expect(store.getState().view).toBe("game");
    expect(saved()?.seed).toBe(FIXTURES.map.run.seed);
  });

  it("reports a run that fails to start", () => {
    const store = createGameStore();
    engine.newRun.mockImplementation(() => {
      throw new Error("not implemented");
    });
    expect(store.getState().newRun({ character: "jordan", difficulty: 0 })).toBe(false);
    expect(store.getState().view).toBe("title");
    expect(store.getState().error?.message).toContain("not implemented");
  });

  it("abandons through the engine, then clears the finished run", () => {
    const store = storeWith(mapRun());
    engine.applyCommand.mockReturnValue({ run: { ...mapRun(), screen: { kind: "summary" }, result: "lost" }, events: [{ type: "runLost" }] });
    store.getState().abandon();
    expect(engine.applyCommand).toHaveBeenCalledWith(expect.anything(), { type: "abandon" }, CONTENT);
    expect(store.getState().profile.history).toHaveLength(1);
    store.getState().clearFinished();
    expect(store.getState().run).toBeNull();
    expect(saved()).toBeNull();
  });

  it("drops the run when the engine can't abandon it", () => {
    const store = storeWith(mapRun());
    engine.applyCommand.mockImplementation(() => {
      throw new Error("broken");
    });
    store.getState().abandon();
    expect(store.getState().run).toBeNull();
    expect(saved()).toBeNull();
  });

  it("never saves a dev fixture", () => {
    const store = createGameStore();
    store.getState().loadFixture(mapRun());
    engine.applyCommand.mockReturnValue({ run: combatRun(), events: [] });
    store.getState().dispatch({ type: "endTurn" });
    expect(saved()).toBeNull();
  });
});

describe("storage problems", () => {
  it("moves a run that fails validation to the broken key", () => {
    localStorage.setItem(KEYS.run, '{"not":"a run"}');
    const store = createGameStore();
    expect(store.getState().run).toBeNull();
    expect(store.getState().brokenSave).toBe(true);
    expect(localStorage.getItem(KEYS.run)).toBeNull();
    expect(localStorage.getItem(KEYS.broken)).toBe('{"not":"a run"}');
  });

  it("treats unparseable JSON as a broken save", () => {
    localStorage.setItem(KEYS.run, "{oops");
    const store = createGameStore();
    expect(store.getState().brokenSave).toBe(true);
    expect(localStorage.getItem(KEYS.broken)).toBe("{oops");
  });

  it("exports the broken save as a download", () => {
    localStorage.setItem(KEYS.broken, "{oops");
    const store = createGameStore();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    store.getState().exportBrokenSave();
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("plays on when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const store = createGameStore();
    expect(store.getState().run).toBeNull();
    expect(store.getState().profile.history).toEqual([]);
    store.getState().loadFixture(mapRun());
    store.setState({ persist: true });
    engine.applyCommand.mockReturnValue({ run: { ...combatRun(), result: "won", screen: { kind: "summary" } }, events: [] });
    expect(store.getState().dispatch({ type: "endTurn" })).toBe(true);
    store.getState().updateSettings({ muted: true });
    expect(store.getState().settings.muted).toBe(true);
  });
});

describe("settings", () => {
  it("persists settings and passes volumes to audio", () => {
    const store = createGameStore();
    store.getState().updateSettings({ music: 0.25, speed: "fast" });
    expect(audio.setVolumes).toHaveBeenLastCalledWith({ music: 0.25, sfx: 0.8, muted: false });
    const again = createGameStore();
    expect(again.getState().settings).toMatchObject({ music: 0.25, speed: "fast" });
  });
});
