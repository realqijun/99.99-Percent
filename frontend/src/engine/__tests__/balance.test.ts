/*
 * Balance simulation: the heuristic bot plays seeded runs of the real content at every difficulty,
 * prints a table and checks the results stay inside the target bands. Run it with `npm run balance`;
 * `npm test` leaves it out because it takes a while. Rules for the bands are in docs/testing.md.
 */
import { describe, expect, it } from "vitest";
import { botCommand } from "../bot";
import { applyCommand, newRun } from "../index";
import type { Act, CharacterId, Difficulty, RunState, Tier } from "../types";

/** Runs per character at each difficulty: enough at 99% to measure, fewer above to stay quick. */
const SCALE = Number(process.env.BALANCE_SCALE ?? 1);
const RUNS: Record<Difficulty, number> = { 0: 200 * SCALE, 1: 100 * SCALE, 2: 80 * SCALE, 3: 60 * SCALE };
const CHARACTERS: CharacterId[] = ["jordan", "taylor"];
const DIFFICULTIES: Difficulty[] = process.env.BALANCE_LEVELS ? (process.env.BALANCE_LEVELS.split(",").map(Number) as Difficulty[]) : [0, 1, 2, 3];
const LABELS = ["99%", "99.9%", "99.99%", "99.999%"];
/** A combat still going after this many turns counts as stuck, and the run as lost. */
const TURN_CAP = 60;
const FLOORS_PER_ACT = 16;

/** Card reward offers and picks by card id, for spotting cards the bot never wants. */
const picks = new Map<string, { offered: number; taken: number }>();
function notePick(run: RunState, cmd: { type: string; index?: number; card?: number }): void {
  if (run.screen.kind !== "reward" || (cmd.type !== "takeReward" && cmd.type !== "skipCards")) return;
  const item = run.screen.items[cmd.index ?? -1];
  if (item?.kind !== "cards") return;
  item.choices.forEach((card, i) => {
    const entry = picks.get(card.id) ?? { offered: 0, taken: 0 };
    entry.offered += 1;
    if (cmd.type === "takeReward" && cmd.card === i) entry.taken += 1;
    picks.set(card.id, entry);
  });
}

interface CombatLog {
  act: Act;
  encounter: string;
  tier: Tier;
  turns: number;
  budgetLost: number;
}

interface RunLog {
  seed: string;
  result: "won" | "lost" | "stuck";
  /** The act the run ended in. */
  act: Act;
  /** Floors from the start of the run, counting each boss as floor 16 of its act. */
  floor: number;
  killer: string | null;
  combats: CombatLog[];
}

function floorOf(run: RunState): number {
  const node = run.position ? run.map.nodes[run.position] : undefined;
  return (run.act - 1) * FLOORS_PER_ACT + (node?.floor ?? 0);
}

function playBotRun(seed: string, character: CharacterId, difficulty: Difficulty): RunLog {
  let run = newRun({ seed, character, difficulty, tutorial: false });
  const combats: CombatLog[] = [];
  let open: (CombatLog & { lostBefore: number }) | null = null;
  const close = (current: RunState) => {
    if (!open) return;
    const { lostBefore, ...log } = open;
    combats.push({ ...log, budgetLost: current.stats.budgetLost - lostBefore });
    open = null;
  };
  for (let step = 0; run.result === null; step++) {
    if (step > 50_000) throw new Error(`run never ended (${seed}, ${character}, ${difficulty})`);
    if (run.screen.kind === "combat") {
      const c = run.screen.combat;
      open ??= { act: run.act, encounter: c.encounter, tier: c.tier, turns: 0, budgetLost: 0, lostBefore: run.stats.budgetLost };
      open.turns = c.turn;
      if (c.turn > TURN_CAP) {
        const encounter = c.encounter;
        close(run);
        return { seed, result: "stuck", act: run.act, floor: floorOf(run), killer: encounter, combats };
      }
    } else close(run);
    const cmd = botCommand(run);
    notePick(run, cmd);
    const result = applyCommand(run, cmd);
    if (result.error) throw new Error(`bot move refused: ${JSON.stringify(cmd)} on ${run.screen.kind}: ${result.error} (${seed}, ${character}, ${difficulty})`);
    run = result.run;
  }
  const killer = run.result === "lost" ? (open as CombatLog | null)?.encounter ?? null : null;
  close(run);
  return { seed, result: run.result, act: run.act, floor: floorOf(run), killer, combats };
}

interface Row {
  character: CharacterId;
  difficulty: Difficulty;
  runs: RunLog[];
  win: number;
  clearAct1: number;
  clearAct2: number;
  avgAct: number;
  avgDeathFloor: number;
  stuck: number;
  killers: [string, number][];
  turnsPerCombat: number;
  lostPerAct: number[];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function summarize(character: CharacterId, difficulty: Difficulty, runs: RunLog[]): Row {
  const n = runs.length;
  const deaths = runs.filter((r) => r.result !== "won");
  const killers = new Map<string, number>();
  for (const r of deaths) if (r.killer) killers.set(r.killer, (killers.get(r.killer) ?? 0) + 1);
  const combats = runs.flatMap((r) => r.combats);
  return {
    character,
    difficulty,
    runs,
    win: runs.filter((r) => r.result === "won").length / n,
    clearAct1: runs.filter((r) => r.act > 1 || r.result === "won").length / n,
    clearAct2: runs.filter((r) => r.act > 2 || r.result === "won").length / n,
    avgAct: mean(runs.map((r) => r.act)),
    avgDeathFloor: mean(deaths.map((r) => r.floor)),
    stuck: runs.filter((r) => r.result === "stuck").length,
    killers: [...killers.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id, k]) => [id, k / Math.max(1, deaths.length)]),
    turnsPerCombat: mean(combats.map((c) => c.turns)),
    lostPerAct: ([1, 2, 3] as Act[]).map((act) => {
      const reached = runs.filter((r) => r.act >= act);
      return mean(reached.map((r) => r.combats.filter((c) => c.act === act).reduce((sum, c) => sum + c.budgetLost, 0)));
    }),
  };
}

function table(rows: Row[]): string {
  const head = ["character", "level", "runs", "win", "act 1", "act 2", "avg act", "death floor", "stuck", "turns/combat", "lost A1/A2/A3", "top killers"];
  const body = rows.map((r) => [
    r.character,
    LABELS[r.difficulty],
    String(r.runs.length),
    pct(r.win),
    pct(r.clearAct1),
    pct(r.clearAct2),
    r.avgAct.toFixed(2),
    r.avgDeathFloor.toFixed(1),
    String(r.stuck),
    r.turnsPerCombat.toFixed(1),
    r.lostPerAct.map((x) => x.toFixed(0)).join("/"),
    r.killers.slice(0, 3).map(([id, share]) => `${id} ${pct(share)}`).join(", "),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

interface EncounterStats {
  id: string;
  combats: number;
  turns: number;
  budgetLost: number;
}

function byEncounter(rows: Row[]): EncounterStats[] {
  const logs = new Map<string, CombatLog[]>();
  for (const c of rows.flatMap((r) => r.runs.flatMap((run) => run.combats))) logs.set(c.encounter, [...(logs.get(c.encounter) ?? []), c]);
  return [...logs.entries()]
    .map(([id, list]) => ({ id, combats: list.length, turns: mean(list.map((c) => c.turns)), budgetLost: mean(list.map((c) => c.budgetLost)) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe("balance", () => {
  it("keeps the bot's results inside the target bands", () => {
    const started = performance.now();
    const rows: Row[] = [];
    for (const difficulty of DIFFICULTIES) {
      for (const character of CHARACTERS) {
        const runs = Array.from({ length: RUNS[difficulty] }, (_, i) => playBotRun(`balance-${i}`, character, difficulty));
        rows.push(summarize(character, difficulty, runs));
      }
    }
    const encounters = byEncounter(rows);
    const top = (key: "turns" | "budgetLost") =>
      encounters
        .slice()
        .sort((a, b) => b[key] - a[key])
        .slice(0, 6)
        .map((e) => `${e.id} ${e[key].toFixed(1)}`)
        .join(", ");
    process.stdout.write(
      `\n${table(rows)}\n\nLongest combats (average turns): ${top("turns")}\nCostliest combats (average Error Budget lost): ${top("budgetLost")}\n` +
        `Took ${((performance.now() - started) / 1000).toFixed(1)} s\n\n`,
    );
    for (const r of rows) {
      for (const run of r.runs.filter((x) => x.result === "stuck")) {
        process.stdout.write(`Stuck: ${run.seed}, ${r.character} at ${LABELS[r.difficulty]}, in ${run.killer}\n`);
      }
    }
    if (process.env.BALANCE_CARDS) {
      const list = [...picks.entries()].sort((a, b) => a[1].taken / a[1].offered - b[1].taken / b[1].offered);
      for (const [id, p] of list) process.stdout.write(`${id.padEnd(22)} ${String(p.offered).padStart(5)} ${pct(p.taken / p.offered).padStart(7)}\n`);
    }
    if (process.env.BALANCE_ENCOUNTERS) {
      for (const r of rows) {
        const tiers = { normal: 0, elite: 0, boss: 0 };
        for (const run of r.runs) {
          const last = run.combats.at(-1);
          if (run.result !== "won" && last) tiers[last.tier] += 1;
        }
        process.stdout.write(`${r.character} ${LABELS[r.difficulty]} deaths by tier ${JSON.stringify(tiers)}: ${r.killers.map(([id, k]) => `${id} ${pct(k)}`).join(", ")}\n`);
      }
      for (const e of encounters) process.stdout.write(`${e.id.padEnd(18)} ${String(e.combats).padStart(5)} ${e.turns.toFixed(1).padStart(5)} ${e.budgetLost.toFixed(1).padStart(6)}\n`);
    }

    for (const r of rows) {
      const name = `${r.character} at ${LABELS[r.difficulty]}`;
      expect.soft(r.stuck, `${name}: stuck runs`).toBe(0);
      if (r.difficulty === 0) {
        expect.soft(r.clearAct1, `${name}: clears Act 1`).toBeGreaterThanOrEqual(0.25);
        expect.soft(r.clearAct1, `${name}: clears Act 1`).toBeLessThanOrEqual(0.5);
        expect.soft(r.win, `${name}: wins`).toBeGreaterThanOrEqual(0.05);
        expect.soft(r.win, `${name}: wins`).toBeLessThanOrEqual(0.2);
        expect.soft(r.killers[0]?.[1] ?? 0, `${name}: top killer ${r.killers[0]?.[0]}`).toBeLessThanOrEqual(0.25);
      } else {
        const below = rows.find((x) => x.character === r.character && x.difficulty === r.difficulty - 1)!;
        expect.soft(r.avgDeathFloor, `${name}: dies sooner than one level down`).toBeLessThan(below.avgDeathFloor);
        expect.soft(r.win, `${name}: wins no more than one level down`).toBeLessThanOrEqual(below.win);
      }
    }
    for (const e of encounters) expect.soft(e.turns, `${e.id}: average turns`).toBeLessThanOrEqual(12);
  });
});
