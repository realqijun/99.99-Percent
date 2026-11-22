/* Test helpers: runs on the fixture content and a few ways to set up a combat exactly. */
import { expect } from "vitest";
import { applyCommand, newRun, reachableNodes } from "../index";
import { rand, type RngHolder } from "../rng";
import { settleCombat, startCombat } from "../combat";
import type { CardInstance, CharacterId, CombatState, Command, Content, Difficulty, GameEvent, RunState } from "../types";
import { choiceCandidates } from "../effects";
import { FIXTURE } from "./content";

export { FIXTURE };

export function fixtureRun(opts: { seed?: string; character?: CharacterId; difficulty?: Difficulty; tutorial?: boolean } = {}): RunState {
  return newRun({ seed: opts.seed ?? "seed", character: opts.character ?? "jordan", difficulty: opts.difficulty ?? 0, tutorial: opts.tutorial ?? false }, FIXTURE);
}

/** Applies a command that must be accepted. */
export function apply(run: RunState, cmd: Command): { run: RunState; events: GameEvent[] } {
  const result = applyCommand(run, cmd, FIXTURE);
  expect(result.error, JSON.stringify(cmd)).toBeUndefined();
  return result;
}

export function combat(run: RunState): CombatState {
  if (run.screen.kind !== "combat") throw new Error(`not in combat: ${run.screen.kind}`);
  return run.screen.combat;
}

/** A run already inside a combat of this encounter. `edit` can change the run before the combat starts. */
export function inCombat(encounter: string, edit: (run: RunState) => void = () => {}, opts: Parameters<typeof fixtureRun>[0] = {}): RunState {
  const run = fixtureRun(opts);
  edit(run);
  const events: GameEvent[] = [];
  startCombat(run, encounter, FIXTURE, events, false);
  settleCombat({ run, c: combat(run), content: FIXTURE, events });
  return run;
}

/** Replaces the hand with fresh cards of these ids and empties the piles. Returns the new uids. */
export function setHand(run: RunState, ids: string[], drawIds: string[] = []): number[] {
  const c = combat(run);
  const make = (id: string): CardInstance => ({ uid: run.nextUid++, id, upgraded: false });
  c.hand = ids.map(make);
  c.drawPile = drawIds.map(make);
  c.discardPile = [];
  c.engineers = 10;
  return c.hand.map((h) => h.uid);
}

/** Makes an enemy's next move this one, with nothing queued after it. */
export function force(run: RunState, key: number, move: string): void {
  const enemy = combat(run).enemies.find((e) => e.key === key)!;
  enemy.intent = { move, kinds: ["unknown"], hit: null };
  enemy.upcoming = [];
}

export function ofType<T extends GameEvent["type"]>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

export function enemyKeys(run: RunState): number[] {
  return combat(run).enemies.filter((e) => !e.resolved).map((e) => e.key);
}

// ---------- random legal play, for fuzzing ----------

function randInt(rng: RngHolder, n: number): number {
  return Math.floor(rand(rng) * n);
}

function shuffle<T>(rng: RngHolder, items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Commands worth trying on this screen, most useful first after a shuffle within each group. */
export function candidateCommands(run: RunState, rng: RngHolder, content: Content = FIXTURE): Command[] {
  const s = run.screen;
  switch (s.kind) {
    case "map":
      return shuffle(rng, reachableNodes(run)).map((node) => ({ type: "chooseNode", node }));
    case "combat": {
      const c = s.combat;
      if (c.pending) {
        const p = c.pending;
        const source = p.source.kind === "card" ? p.source.uid : null;
        const uids = choiceCandidates({ run, c, content, events: [] }, p.from, p.action, source).map((h) => h.uid);
        const need = Math.min(p.count, uids.length);
        return [{ type: "chooseCards", uids: shuffle(rng, uids).slice(0, need) }, { type: "chooseCards", uids: [] }];
      }
      const targets = c.enemies.filter((e) => !e.resolved).map((e) => e.key);
      const plays: Command[] = shuffle(rng, c.hand).map((h) => ({ type: "playCard", uid: h.uid, target: targets[randInt(rng, targets.length)] }));
      const runbooks: Command[] = run.runbooks.flatMap((r, slot) => (r ? [{ type: "useRunbook", slot, target: targets[0] } as Command] : []));
      const extras: Command[] = c.tutorial !== null ? [{ type: rand(rng) < 0.5 ? "advanceTutorial" : "skipTutorial" }] : [];
      const end: Command = { type: "endTurn" };
      return rand(rng) < 0.15 ? [end, ...plays] : [...extras, ...plays, ...(rand(rng) < 0.3 ? runbooks : []), end];
    }
    case "reward":
      return [
        ...shuffle(
          rng,
          s.items.flatMap((item, index): Command[] =>
            item.taken ? [] : item.kind === "cards" ? [{ type: "takeReward", index, card: randInt(rng, item.choices.length) }, { type: "skipCards", index }] : [{ type: "takeReward", index }],
          ),
        ),
        { type: "discardRunbook", slot: 0 },
        { type: "leave" },
      ];
    case "shop":
      return [
        ...shuffle<Command>(rng, [
          ...s.shop.cards.map((_, index): Command => ({ type: "buyCard", index })),
          ...s.shop.relics.map((_, index): Command => ({ type: "buyRelic", index })),
          ...s.shop.runbooks.map((_, index): Command => ({ type: "buyRunbook", index })),
          { type: "buyRemoval" },
        ]).slice(0, randInt(rng, 3)),
        { type: "leave" },
      ];
    case "retro":
      return [...shuffle<Command>(rng, [{ type: "rest" }, { type: "refactor" }]), { type: "leave" }];
    case "event": {
      const event = content.events[s.event];
      return [...shuffle(rng, event.choices.map((_, index): Command => ({ type: "eventChoice", index }))), { type: "leave" }];
    }
    case "treasure":
      return [{ type: "takeTreasure" }, { type: "leave" }];
    case "bossRelic":
      return [...shuffle(rng, s.choices.map((_, index): Command => ({ type: "pickBossRelic", index }))), { type: "leave" }];
    case "deckChoice":
      return shuffle(rng, run.deck).map((card): Command => ({ type: "chooseCards", uids: [card.uid] }));
    case "summary":
      return [];
  }
}

/** Plays random legal commands until the run ends. Returns the final run and every command applied. */
export function playRandomly(
  seed: string,
  character: CharacterId,
  difficulty: Difficulty,
  opts: { budget?: number; maxSteps?: number; content?: Content } = {},
): { run: RunState; commands: Command[]; steps: number; start: RunState } {
  const content = opts.content ?? FIXTURE;
  let run = newRun({ seed, character, difficulty, tutorial: true }, content);
  if (opts.budget) run.budget = run.maxBudget = opts.budget;
  const start = run;
  const maxSteps = opts.maxSteps ?? 20000;
  const rng: RngHolder = { rngState: seed.length * 7919 + difficulty };
  const commands: Command[] = [];
  let steps = 0;
  while (run.result === null && steps < maxSteps) {
    steps++;
    let moved = false;
    for (const cmd of candidateCommands(run, rng, content)) {
      const result = applyCommand(run, cmd, content);
      if (result.error) {
        expect(result.run).toBe(run);
        continue;
      }
      run = result.run;
      commands.push(cmd);
      moved = true;
      break;
    }
    if (!moved) throw new Error(`stuck on ${run.screen.kind} (${seed})`);
  }
  return { run, commands, steps, start };
}
