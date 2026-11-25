/*
 * The engine moves straight from the winning blow to the reward screen. This keeps the combat on screen,
 * frozen, for as long as that blow's animation runs, then lets the next screen show. UI only: the run in
 * the store is already on the next screen, and nothing here changes it. Off with Reduce motion.
 */
import { useEffect, useState } from "react";
import type { GameEvent, RunState } from "../../engine/types";
import { useGame } from "../../game/store";

/** Long enough for the flying card, the number over the enemy and its fade; the fast setting halves it. */
export const VICTORY_HOLD_MS = 900;

/** The last combat frame: the cards just played have left the hand, and every enemy is resolved, since that is what winning means. */
function finalFrame(before: RunState, events: GameEvent[]): RunState | null {
  if (before.screen.kind !== "combat") return null;
  const played = new Set(events.flatMap((e) => (e.type === "cardPlayed" ? [e.uid] : [])));
  const c = before.screen.combat;
  const combat = {
    ...c,
    pending: null,
    tutorial: null,
    hand: c.hand.filter((card) => !played.has(card.uid)),
    enemies: c.enemies.map((e) => ({ ...e, load: 0, buffer: 0, resolved: true, upcoming: [] })),
  };
  return { ...before, screen: { kind: "combat", combat } };
}

interface Tracked {
  run: RunState;
  /** The newest event already looked at. */
  seen: number;
  held: RunState | null;
}

/** The combat to keep showing after a win, or null to show `run` as it is. */
export function useVictoryHold(run: RunState): RunState | null {
  const events = useGame((s) => s.events);
  const settings = useGame((s) => s.settings);
  const [tracked, setTracked] = useState<Tracked>(() => ({ run, seen: events.at(-1)?.id ?? 0, held: null }));

  // Worked out while rendering, so the combat screen stays mounted and its animations see the winning events.
  if (tracked.run !== run) {
    const fresh = events.filter((q) => q.id > tracked.seen).map((q) => q.event);
    const before = tracked.run;
    const won = before.screen.kind === "combat" && run.screen.kind !== "combat" && fresh.some((e) => e.type === "combatWon");
    setTracked({ run, seen: events.at(-1)?.id ?? tracked.seen, held: won && !settings.reducedMotion ? finalFrame(before, fresh) : null });
  }

  const { held } = tracked;
  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setTracked((t) => (t.held === held ? { ...t, held: null } : t)), VICTORY_HOLD_MS * (settings.speed === "fast" ? 0.5 : 1));
    return () => clearTimeout(timer);
  }, [held, settings.speed]);

  return tracked.run === run ? held : null;
}
