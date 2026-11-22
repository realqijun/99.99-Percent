import { describe, expect, it } from "vitest";
import { applyCommand, validateRun } from "./index";
import { FIXTURE, playRandomly } from "./__fixtures__/helpers";
import type { CharacterId, Difficulty, RunState } from "./types";

function check(run: RunState): void {
  expect(run.result).not.toBeNull();
  expect(run.screen.kind).toBe("summary");
  expect(validateRun(JSON.parse(JSON.stringify(run)), FIXTURE)).not.toBeNull();
}

// Whole runs take a while; the default 5 second timeout is too tight on slow machines.
describe("random legal play", { timeout: 120_000 }, () => {
  it("never throws and always ends the run, over many seeds", () => {
    let lost = 0;
    for (let i = 0; i < 150; i++) {
      const character: CharacterId = i % 2 === 0 ? "jordan" : "taylor";
      const { run } = playRandomly(`fuzz-${i}`, character, (i % 4) as Difficulty);
      check(run);
      if (run.result === "lost") lost += 1;
    }
    expect(lost).toBeGreaterThan(0);
  });

  it("reaches the IPO with a huge Error Budget, through every act", () => {
    let won = 0;
    for (let i = 0; i < 30; i++) {
      const { run } = playRandomly(`tank-${i}`, i % 2 === 0 ? "jordan" : "taylor", (i % 4) as Difficulty, { budget: 5000 });
      check(run);
      if (run.result === "won") {
        won += 1;
        expect(run.act).toBe(3);
        expect(run.stats.bossesWon).toBe(3);
      }
    }
    expect(won).toBeGreaterThan(20);
  });

  it("replays the same commands to the same state", () => {
    const { run, commands, start } = playRandomly("replay", "taylor", 1, { budget: 400 });
    let again = start;
    for (const cmd of commands) again = applyCommand(again, cmd, FIXTURE).run;
    expect(again).toEqual(run);
  });
});
