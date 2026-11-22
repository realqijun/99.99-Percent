import { describe, expect, it } from "vitest";
import { compose, PITCHED, secondsOf, TRACKS } from "./score";

describe("the score", () => {
  it("writes each track as a short loop of 8 to 16 bars, every note inside it", () => {
    for (const track of TRACKS) {
      const score = compose(track);
      expect(score.track).toBe(track);
      expect(score.beats / 4, track).toBeGreaterThanOrEqual(8);
      expect(score.beats / 4, track).toBeLessThanOrEqual(16);
      for (const n of score.notes) {
        expect(n.beat, track).toBeGreaterThanOrEqual(0);
        expect(n.beat, track).toBeLessThan(score.beats);
        expect(n.beats, track).toBeGreaterThan(0);
        expect(n.gain, track).toBeGreaterThan(0);
        expect(n.gain, track).toBeLessThanOrEqual(1);
        if (PITCHED.includes(n.voice)) {
          expect(n.midi, track).toBeGreaterThanOrEqual(28);
          expect(n.midi, track).toBeLessThanOrEqual(108);
        }
      }
    }
  });

  it("makes the boss the most intense: fastest, busiest and with the alarm", () => {
    const rate = (track: (typeof TRACKS)[number]) => compose(track).notes.length / secondsOf(compose(track));
    const boss = compose("boss");
    for (const track of TRACKS.filter((t) => t !== "boss")) {
      expect(boss.bpm, track).toBeGreaterThan(compose(track).bpm);
      expect(rate("boss"), track).toBeGreaterThan(rate(track));
    }
    expect(boss.notes.some((n) => n.voice === "alarm")).toBe(true);
  });

  it("gives every track its own tune", () => {
    const tunes = TRACKS.map((track) => JSON.stringify(compose(track).notes.filter((n) => PITCHED.includes(n.voice))));
    expect(new Set(tunes).size).toBe(TRACKS.length);
  });
});
