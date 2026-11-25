import { describe, expect, it } from "vitest";
import { botCommand } from "./bot";
import { applyCommand, newRun } from "./index";
import type { CharacterId, Command, RunState } from "./types";

/** Plays a whole run with the bot on the real content; every command must be accepted. */
function play(seed: string, character: CharacterId): { run: RunState; commands: Command[] } {
  let run = newRun({ seed, character, difficulty: 0, tutorial: false });
  const commands: Command[] = [];
  while (run.result === null) {
    expect(commands.length, seed).toBeLessThan(20_000);
    const cmd = botCommand(run);
    const result = applyCommand(run, cmd);
    expect(result.error, `${seed}: ${JSON.stringify(cmd)} on ${run.screen.kind}`).toBeUndefined();
    run = result.run;
    commands.push(cmd);
  }
  return { run, commands };
}

describe("balance bot", { timeout: 60_000 }, () => {
  it("plays whole runs with legal commands only", () => {
    for (const [i, character] of (["jordan", "taylor", "jordan", "taylor"] as CharacterId[]).entries()) {
      const { run } = play(`bot-${i}`, character);
      expect(run.screen.kind).toBe("summary");
      expect(run.stats.combatsWon).toBeGreaterThan(0);
    }
  });

  it("plays the same seed the same way", () => {
    expect(play("bot-same", "taylor").commands).toEqual(play("bot-same", "taylor").commands);
  });
});
