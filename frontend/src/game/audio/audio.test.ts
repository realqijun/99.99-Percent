import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEvent } from "../../engine/types";
import { cueFor, type Cue } from "./index";
import { AHEAD, createPlayer, GAP_MS, MAX_VOICES, SLEEP_MS, TICK_MS, type Player } from "./player";
import { CUES } from "./sfx";
import { loudness } from "./synth";
import { FakeAudioContext } from "./testing/fakeAudio";

const press = (type = "pointerdown") => window.dispatchEvent(new Event(type));
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const LOUD = { music: 0.8, sfx: 0.8, muted: false };

/** One of every engine event, and the cue each should make. */
const EVENTS: { [K in GameEvent["type"]]: [Extract<GameEvent, { type: K }>, Cue | null][] } = {
  combatStart: [[{ type: "combatStart", encounter: "e" }, null]],
  turnStart: [[{ type: "turnStart", turn: 2 }, null]],
  draw: [[{ type: "draw", uids: [1, 2] }, "draw"]],
  shuffle: [[{ type: "shuffle" }, "shuffle"]],
  cardPlayed: [[{ type: "cardPlayed", uid: 1, card: "serve", upgraded: false }, "cardPlay"]],
  cardDecommissioned: [[{ type: "cardDecommissioned", uid: 1 }, null]],
  serve: [[{ type: "serve", enemy: 0, amount: 6, absorbed: 0 }, "serve"]],
  capacity: [
    [{ type: "capacity", amount: 5 }, "capacity"],
    [{ type: "capacity", amount: 0 }, null],
  ],
  engineers: [[{ type: "engineers", amount: 1 }, null]],
  enemyMove: [[{ type: "enemyMove", enemy: 0, move: "spike" }, null]],
  hit: [
    [{ type: "hit", enemy: 0, amount: 8, absorbed: 3, budgetLost: 5 }, "budgetLoss"],
    [{ type: "hit", enemy: 0, amount: 8, absorbed: 8, budgetLost: 0 }, "hit"],
  ],
  budget: [
    [{ type: "budget", amount: 4 }, "recover"],
    [{ type: "budget", amount: -3 }, "budgetLoss"],
    [{ type: "budget", amount: 0 }, null],
  ],
  status: [
    [{ type: "status", target: "player", status: "latency", amount: 2 }, "status"],
    [{ type: "status", target: 0, status: "exposed", amount: 0 }, null],
  ],
  infra: [[{ type: "infra", infra: "readCache", stacks: 1 }, "infra"]],
  nodeFailure: [
    [{ type: "nodeFailure", infra: "appServer", prevented: false }, "nodeFailure"],
    [{ type: "nodeFailure", infra: "appServer", prevented: true }, "hit"],
    [{ type: "nodeFailure", infra: null, prevented: false }, null],
  ],
  enemyResolved: [[{ type: "enemyResolved", enemy: 0 }, "enemyResolved"]],
  summon: [[{ type: "summon", enemy: 1, id: "bot" }, null]],
  relic: [[{ type: "relic", relic: "monitoring" }, "relic"]],
  runbook: [[{ type: "runbook", runbook: "rollback" }, "runbook"]],
  cash: [
    [{ type: "cash", amount: 25 }, "cash"],
    [{ type: "cash", amount: -50 }, "cash"],
    [{ type: "cash", amount: 0 }, null],
  ],
  cardAdded: [[{ type: "cardAdded", card: "pager", to: "discard" }, "draw"]],
  cardRemoved: [[{ type: "cardRemoved", card: "serve" }, "cardPlay"]],
  cardUpgraded: [[{ type: "cardUpgraded", uid: 3 }, "relic"]],
  combatWon: [[{ type: "combatWon" }, "combatWon"]],
  actComplete: [[{ type: "actComplete", act: 1 }, "actComplete"]],
  runWon: [[{ type: "runWon" }, "runWon"]],
  runLost: [[{ type: "runLost" }, "runLost"]],
};

describe("cueFor", () => {
  it("gives every engine event its sound, or none", () => {
    for (const [event, cue] of Object.values(EVENTS).flat()) expect(cueFor(event), JSON.stringify(event)).toBe(cue);
  });

  it("reaches every cue but the interface's own", () => {
    const heard = new Set(Object.values(EVENTS).flat().map(([event]) => cueFor(event)));
    expect(CUES.filter((cue) => !heard.has(cue))).toEqual(["click", "error"]);
  });
});

describe("audio without Web Audio", () => {
  it("stays silent and harmless, as in a browser with audio disabled", async () => {
    // jsdom has no AudioContext.
    vi.resetModules();
    const audio = await import("./index");
    const player = createPlayer();
    expect(() => {
      for (const p of [audio, player]) {
        p.setVolumes(LOUD);
        p.setTrack("boss");
        press();
        for (const cue of CUES) p.playCue(cue);
        p.setTrack(null);
      }
      player.dispose();
    }).not.toThrow();
  });
});

describe("audio", () => {
  let t = 0;
  let visibility: DocumentVisibilityState = "visible";
  let player: Player;
  const make = () => (player = createPlayer(() => t));
  const ctx = () => FakeAudioContext.made[0];
  const sfxBus = () => ctx().gains[0];
  const musicBus = () => ctx().gains[1];
  /** The tracks' lanes: the gains feeding the music's compressor. */
  const lanes = () => ctx().gains.filter((g) => g.outputs.includes(ctx().compressors[1]));
  /** Move the audio clock and the page's clock on together. */
  const advance = (seconds: number) => {
    ctx().currentTime += seconds;
    t += seconds * 1000;
    vi.advanceTimersByTime(seconds * 1000);
  };
  const setVisibility = (v: DocumentVisibilityState) => {
    visibility = v;
    document.dispatchEvent(new Event("visibilitychange"));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudioContext.reset();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    t = 1000;
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  });
  afterEach(() => {
    player?.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("makes no sound before the first press, and drops what was asked for before it", async () => {
    make();
    player.setVolumes(LOUD);
    for (const cue of CUES) player.playCue(cue);
    expect(FakeAudioContext.made).toHaveLength(0);
    press();
    await settle();
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(ctx().resumes).toBe(1);
    expect(ctx().voices).toBe(0);
    t += 1000;
    player.playCue("serve");
    expect(ctx().voices).toBeGreaterThan(0);
  });

  it("listens for the first press once, and stops once the audio runs", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    // The first press does not wake the audio: keep listening for the next.
    FakeAudioContext.resume = (c) => ((c.state = "suspended"), Promise.reject(new Error("not allowed")));
    make();
    expect(add.mock.calls.map(([e]) => e)).toEqual(["pointerdown", "keydown", "touchend"]);
    press("keydown");
    await settle();
    expect(remove).not.toHaveBeenCalled();
    FakeAudioContext.resume = (c) => ((c.state = "running"), Promise.resolve());
    press();
    await settle();
    expect(remove.mock.calls.map(([e]) => e)).toEqual(["pointerdown", "keydown", "touchend"]);
    press();
    expect(ctx().resumes).toBe(2);
    expect(FakeAudioContext.made).toHaveLength(1);
  });

  it("gives every cue a voice", async () => {
    make();
    player.setVolumes(LOUD);
    press();
    await settle();
    for (const cue of CUES) {
      advance(5);
      const before = ctx().voices;
      player.playCue(cue);
      expect(ctx().voices, cue).toBeGreaterThan(before);
    }
  });

  it("follows the volumes on the sliders' curve, and silences and sleeps while muted or at zero", async () => {
    make();
    player.setVolumes(LOUD);
    player.setTrack("map");
    press();
    await settle();
    expect(sfxBus().gain.ramps.at(-1)).toBeCloseTo(loudness(0.8, 0.9));
    expect(musicBus().gain.ramps.at(-1)).toBeCloseTo(loudness(0.8, 0.4));

    player.setVolumes({ ...LOUD, muted: true });
    expect(sfxBus().gain.ramps.at(-1)).toBe(0);
    expect(musicBus().gain.ramps.at(-1)).toBe(0);
    const quiet = ctx().voices;
    t += 1000;
    player.playCue("serve");
    expect(ctx().voices).toBe(quiet);
    // A quick mute and unmute stays awake; a longer one sleeps, timers and all.
    vi.advanceTimersByTime(SLEEP_MS - 100);
    expect(ctx().state).toBe("running");
    vi.advanceTimersByTime(100);
    expect(ctx().state).toBe("suspended");
    expect(vi.getTimerCount()).toBe(0);

    player.setVolumes(LOUD);
    expect(ctx().state).toBe("running");
    expect(vi.getTimerCount()).toBe(1);

    // Music at zero keeps playing effects, and schedules no notes.
    player.setVolumes({ ...LOUD, music: 0 });
    const before = ctx().oscillators.length;
    advance(2);
    expect(ctx().oscillators.length).toBe(before);
    expect(ctx().state).toBe("running");
    player.playCue("cash");
    expect(ctx().oscillators.length).toBeGreaterThan(before);

    // Both at zero sleeps.
    player.setVolumes({ music: 0, sfx: 0, muted: false });
    vi.advanceTimersByTime(SLEEP_MS);
    expect(ctx().state).toBe("suspended");
  });

  it("plays a cue asked for while the audio wakes, if it wakes promptly", async () => {
    make();
    player.setVolumes({ ...LOUD, muted: true });
    press();
    await settle();
    vi.advanceTimersByTime(SLEEP_MS);
    expect(ctx().state).toBe("suspended");
    let wake = () => {};
    FakeAudioContext.resume = (c) => new Promise((resolve) => (wake = () => ((c.state = "running"), resolve())));
    player.setVolumes(LOUD);
    player.playCue("click");
    expect(ctx().voices).toBe(0);
    wake();
    await settle();
    expect(ctx().voices).toBeGreaterThan(0);
    // Woken too late: the cue is stale and dropped.
    player.setVolumes({ ...LOUD, muted: true });
    vi.advanceTimersByTime(SLEEP_MS);
    player.setVolumes(LOUD);
    t += 100;
    player.playCue("cash");
    const before = ctx().voices;
    t += 2000;
    wake();
    await settle();
    expect(ctx().voices).toBe(before);
  });

  it("plays the same cue at most once in its gap, and caps the voices ringing at once", async () => {
    make();
    press();
    await settle();
    player.playCue("serve");
    const once = ctx().voices;
    t += GAP_MS - 10;
    player.playCue("serve");
    expect(ctx().voices).toBe(once);
    player.playCue("hit");
    expect(ctx().voices).toBeGreaterThan(once);
    t += 10;
    const both = ctx().voices;
    player.playCue("serve");
    expect(ctx().voices).toBeGreaterThan(both);

    advance(5);
    let played = 0;
    for (const cue of CUES) {
      const before = ctx().voices;
      player.playCue(cue);
      if (ctx().voices > before) played++;
    }
    expect(played).toBe(MAX_VOICES);
    // Once they have rung out, there is room again.
    advance(3);
    const after = ctx().voices;
    player.playCue("runWon");
    expect(ctx().voices).toBeGreaterThan(after);
  });

  it("lets a bigger stinger cut a smaller one short, and drops a smaller one under a bigger", async () => {
    make();
    press();
    await settle();
    // Each stinger plays through a gain of its own, made before its voice.
    const first = ctx().gains.length;
    player.playCue("combatWon");
    const small = ctx().gains[first];
    player.playCue("actComplete");
    expect(small.gain.ramps.at(-1)).toBe(0);
    player.playCue("runWon");
    t += 1000;
    const before = ctx().voices;
    player.playCue("actComplete");
    player.playCue("combatWon");
    expect(ctx().voices).toBe(before);
  });

  it("starts the wanted track on the first press, scheduling only a little ahead", async () => {
    make();
    player.setVolumes(LOUD);
    player.setTrack("title");
    expect(FakeAudioContext.made).toHaveLength(0);
    press();
    await settle();
    expect(lanes()).toHaveLength(1);
    expect(lanes()[0].gain.ramps.at(-1)).toBe(1);
    const ahead = () => Math.max(...ctx().oscillators.map((o) => o.at), ...ctx().sources.map((s) => s.at));
    expect(ctx().oscillators.length).toBeGreaterThan(0);
    expect(ahead()).toBeLessThanOrEqual(ctx().currentTime + AHEAD);
    for (let i = 0; i < 100; i++) advance(TICK_MS / 1000);
    expect(ahead()).toBeGreaterThan(4);
    expect(ahead()).toBeLessThanOrEqual(ctx().currentTime + AHEAD);
    // Past the end of the loop, it starts again.
    const before = ctx().oscillators.length;
    for (let i = 0; i < 400; i++) advance(TICK_MS / 1000);
    expect(ctx().oscillators.length).toBeGreaterThan(before);
  });

  it("crossfades between tracks, ignores the same track again, and fades out to nothing", async () => {
    make();
    player.setVolumes(LOUD);
    press();
    await settle();
    player.setTrack("map");
    player.setTrack("map");
    expect(lanes()).toHaveLength(1);
    const map = lanes()[0];
    advance(1);
    player.setTrack("combat");
    player.setTrack("combat");
    expect(lanes()).toHaveLength(2);
    const combat = lanes()[1];
    expect(map.gain.ramps.at(-1)).toBe(0);
    expect(combat.gain.ramps.at(-1)).toBe(1);
    // Once faded, the old track is let go; the new one plays on.
    advance(2);
    advance(TICK_MS / 1000);
    expect(map.disconnected).toBe(true);
    expect(combat.disconnected).toBe(false);

    player.setTrack("boss");
    player.setTrack(null);
    expect(lanes()).toHaveLength(3);
    for (const lane of lanes().slice(1)) expect(lane.gain.ramps.at(-1)).toBe(0);
    advance(2);
    advance(TICK_MS / 1000);
    expect(lanes().every((lane) => lane.disconnected)).toBe(true);
    // Effects still on: the audio stays awake, but the music's timer is gone.
    expect(vi.getTimerCount()).toBe(0);
    expect(ctx().state).toBe("running");
    const quiet = ctx().voices;
    advance(1);
    expect(ctx().voices).toBe(quiet);
  });

  it("suspends while the tab is hidden and wakes when it is shown", async () => {
    make();
    player.setVolumes(LOUD);
    player.setTrack("combat");
    press();
    await settle();
    setVisibility("hidden");
    expect(ctx().state).toBe("suspended");
    expect(vi.getTimerCount()).toBe(0);
    const quiet = ctx().voices;
    t += 1000;
    player.playCue("serve");
    expect(ctx().voices).toBe(quiet);
    setVisibility("visible");
    expect(ctx().state).toBe("running");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("cleans up its listeners, timers and audio when disposed", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    make();
    player.setTrack("boss");
    press();
    await settle();
    player.setVolumes({ ...LOUD, muted: true });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    player.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(ctx().state).toBe("closed");
    player.playCue("serve");
    player.setTrack("map");
    press();
    expect(FakeAudioContext.made).toHaveLength(1);
  });

  it("keeps a failing voice from breaking the game", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    make();
    press();
    await settle();
    ctx().createOscillator = () => {
      throw new Error("no oscillators");
    };
    expect(() => {
      player.playCue("click");
      player.playCue("cash");
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("works through the module's own functions with no setup", async () => {
    vi.resetModules();
    const audio = await import("./index");
    audio.setVolumes(LOUD);
    audio.setTrack("title");
    audio.playCue("click");
    expect(FakeAudioContext.made).toHaveLength(0);
    press();
    await settle();
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(lanes()).toHaveLength(1);
    t += 1000;
    const before = ctx().voices;
    audio.playCue("click");
    expect(ctx().voices).toBeGreaterThan(before);
    // Leave it asleep for the next test.
    setVisibility("hidden");
  });
});
