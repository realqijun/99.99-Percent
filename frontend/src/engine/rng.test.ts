import { describe, expect, it } from "vitest";
import { normaliseSeed, pick, rand } from "./rng";

describe("rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = { rngState: normaliseSeed("run-1") };
    const b = { rngState: normaliseSeed("run-1") };
    const seqA = Array.from({ length: 5 }, () => rand(a));
    expect(Array.from({ length: 5 }, () => rand(b))).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("differs between seeds", () => {
    expect(rand({ rngState: normaliseSeed("a") })).not.toBe(rand({ rngState: normaliseSeed("b") }));
  });

  it("picks inside the list", () => {
    const s = { rngState: 1 };
    for (let i = 0; i < 50; i++) expect(["x", "y", "z"]).toContain(pick(s, ["x", "y", "z"]));
  });
});
