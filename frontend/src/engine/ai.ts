/*
 * Enemy move picking and intents. Each enemy keeps a queue: `intent` is the move it makes next
 * and `upcoming` the moves after it, picked ahead of time as far as the reveal reaches,
 * so a revealed intent is always what actually happens.
 */
import { weightedPick } from "./rng";
import type { CombatState, Content, EnemyAi, EnemyMove, EnemyState, Intent, IntentKind, RngStreams } from "./types";

/** Requests per hit after the enemy's Scaling and Throttled and your Degraded. */
export function hitAmount(enemy: EnemyState, combat: CombatState, base: number): number {
  let amount = base + (enemy.statuses.scaling ?? 0);
  if ((enemy.statuses.throttled ?? 0) > 0) amount = Math.floor(amount * 0.75);
  if ((combat.statuses.degraded ?? 0) > 0) amount = Math.floor(amount * 1.5);
  return Math.max(0, amount);
}

export function moveKinds(move: EnemyMove | undefined): IntentKind[] {
  if (!move) return ["unknown"];
  const kinds: IntentKind[] = [];
  const add = (k: IntentKind) => {
    if (!kinds.includes(k)) kinds.push(k);
  };
  for (const e of move.effects) {
    if (e.op === "hit") add("attack");
    else if (e.op === "buffer") add("defend");
    else if (e.op === "status") add(e.target === "player" ? "debuff" : "buff");
    else if (e.op === "addCard") add("debuff");
    else if (e.op === "nodeFailure") add("failure");
    else if (e.op === "summon") add("summon");
    else add("buff");
  }
  return kinds.length > 0 ? kinds : ["unknown"];
}

function intentOf(moveName: string, enemy: EnemyState, combat: CombatState, content: Content): Intent {
  const move = content.enemies[enemy.id]?.moves[moveName];
  const hit = move?.effects.find((e) => e.op === "hit");
  return {
    move: moveName,
    kinds: moveKinds(move),
    hit: hit ? { amount: hitAmount(enemy, combat, hit.amount), times: hit.times ?? 1 } : null,
  };
}

function pickMove(ai: EnemyAi, history: string[], loadPct: number, rng: RngStreams, enemy: EnemyState | null): string {
  switch (ai.kind) {
    case "cycle":
      return ai.moves[history.length % ai.moves.length];
    case "script":
      if (history.length < ai.opening.length) return ai.opening[history.length];
      return pickMove(ai.then, history.slice(ai.opening.length), loadPct, rng, enemy);
    case "weighted": {
      const entries = Object.entries(ai.weights);
      const max = ai.maxRepeat;
      const tail = max ? history.slice(-max) : [];
      const allowed = entries.filter(([name]) => !(max && tail.length === max && tail.every((m) => m === name)));
      return weightedPick(rng, "ai", allowed) ?? weightedPick(rng, "ai", entries) ?? entries[0][0];
    }
    case "phases": {
      let index = ai.phases.findIndex((p) => loadPct <= p.atOrBelowPct);
      if (index < 0) index = ai.phases.length - 1;
      let sub = history;
      // Only the outermost phases AI is tracked, so a new phase starts its moves from the beginning.
      if (enemy) {
        if (!enemy.phase || enemy.phase.index !== index) enemy.phase = { index, since: history.length };
        sub = history.slice(enemy.phase.since);
      }
      return pickMove(ai.phases[index].ai, sub, loadPct, rng, null);
    }
  }
}

/** Fills the enemy's queue so it holds the current intent plus `revealTurns` more. */
export function fillIntents(enemy: EnemyState, combat: CombatState, content: Content, rng: RngStreams, needCurrent: boolean): void {
  const def = content.enemies[enemy.id];
  if (!def) return;
  const loadPct = enemy.maxLoad > 0 ? (enemy.load / enemy.maxLoad) * 100 : 0;
  const planned = () => [...enemy.history, ...(needCurrent ? [] : [enemy.intent.move]), ...enemy.upcoming.map((i) => i.move)];
  if (needCurrent) {
    enemy.intent = intentOf(pickMove(def.ai, planned(), loadPct, rng, enemy), enemy, combat, content);
    needCurrent = false;
  }
  while (enemy.upcoming.length < combat.revealTurns) {
    enemy.upcoming.push(intentOf(pickMove(def.ai, planned(), loadPct, rng, enemy), enemy, combat, content));
  }
}

/** After an enemy acts: the next queued move becomes its intent. */
export function advanceIntent(enemy: EnemyState, combat: CombatState, content: Content, rng: RngStreams): void {
  enemy.history.push(enemy.intent.move);
  const nextIntent = enemy.upcoming.shift();
  if (nextIntent) enemy.intent = nextIntent;
  fillIntents(enemy, combat, content, rng, !nextIntent);
}

/** Recomputes intent numbers from the current statuses. Called after every combat command. */
export function refreshIntents(combat: CombatState, content: Content): void {
  for (const e of combat.enemies) {
    if (e.resolved) continue;
    e.intent = intentOf(e.intent.move, e, combat, content);
    e.upcoming = e.upcoming.map((i) => intentOf(i.move, e, combat, content));
  }
}
