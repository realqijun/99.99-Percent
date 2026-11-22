import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../engine", async (original) => ({
  ...(await original<typeof import("../engine")>()),
  validateRun: (data: unknown) => (data && typeof data === "object" && "seed" in data ? data : null),
}));

const { KEYS, loadProfile, loadRun, loadSettings, saveRun, saveSettings } = await import("./storage");

const record = (i: number) => ({
  seed: `S${i}`,
  character: "taylor",
  difficulty: 2,
  result: "lost",
  act: 2,
  stats: { floorsClimbed: i, combatsWon: 1, elitesWon: 0, bossesWon: 0, budgetLost: 3, cashEarned: 4, cardsPlayed: 5, turns: 6 },
  endedAt: 1_700_000_000_000 + i,
});

beforeEach(() => localStorage.clear());

describe("profile", () => {
  it("defaults when nothing is saved", () => {
    expect(loadProfile()).toEqual({ unlocked: { jordan: 0, taylor: 0 }, history: [], tutorialDone: false });
  });

  it("keeps valid fields and drops bad ones", () => {
    localStorage.setItem(
      KEYS.profile,
      JSON.stringify({ unlocked: { jordan: 3, taylor: 9 }, history: [record(1), { seed: 4 }, null, { ...record(2), result: "draw" }], tutorialDone: "yes" }),
    );
    const profile = loadProfile();
    expect(profile.unlocked).toEqual({ jordan: 3, taylor: 0 });
    expect(profile.history).toEqual([record(1)]);
    expect(profile.tutorialDone).toBe(false);
  });

  it("keeps at most 20 results", () => {
    localStorage.setItem(KEYS.profile, JSON.stringify({ history: Array.from({ length: 25 }, (_, i) => record(i)) }));
    expect(loadProfile().history).toHaveLength(20);
  });

  it("survives corrupt JSON", () => {
    localStorage.setItem(KEYS.profile, "{");
    expect(loadProfile().history).toEqual([]);
  });
});

describe("settings", () => {
  it("round-trips and rejects out-of-range values", () => {
    saveSettings({ music: 0.3, sfx: 1, muted: true, speed: "fast", reducedMotion: true });
    expect(loadSettings()).toEqual({ music: 0.3, sfx: 1, muted: true, speed: "fast", reducedMotion: true });
    localStorage.setItem(KEYS.settings, JSON.stringify({ music: 40, sfx: -1, speed: "warp", muted: 1 }));
    expect(loadSettings()).toMatchObject({ music: 0.6, sfx: 0.8, speed: "normal", muted: false });
  });
});

describe("run", () => {
  it("loads a valid run and clears it on null", () => {
    saveRun({ seed: "A" } as never);
    expect(loadRun()).toEqual({ run: { seed: "A" }, broken: false });
    saveRun(null);
    expect(loadRun()).toEqual({ run: null, broken: false });
  });

  it("returns nothing when storage itself throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    expect(loadRun()).toEqual({ run: null, broken: false });
  });
});
