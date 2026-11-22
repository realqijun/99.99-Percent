/*
 * Combat animation from the store's event queue. The state is already final when events arrive,
 * so this only decorates: a played card flies to its target, numbers float up, things shake and flash.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { CardInstance, GameEvent } from "../../engine/types";
import { useGame } from "../../game/store";
import type { StageRect } from "../stageContext";
import { useStage } from "../stageContext";

export type FxTone = "serve" | "loss" | "capacity" | "recover" | "absorb";

export type FxItem =
  | { id: number; kind: "number"; x: number; y: number; text: string; tone: FxTone; ms: number }
  | { id: number; kind: "ghost"; from: StageRect; dx: number; dy: number; card: CardInstance; ms: number };

/** Base durations in ms, within the 100-350 ms range; the fast setting halves them. */
const MS = { step: 90, ghost: 300, number: 350, shake: 220, flash: 260, pulse: 180 };

const ANIMATED = new Set<GameEvent["type"]>(["cardPlayed", "serve", "hit", "capacity", "budget", "shuffle", "nodeFailure", "enemyResolved"]);

export function useFx(root: RefObject<HTMLElement | null>, rects: Map<number, StageRect>): FxItem[] {
  const events = useGame((s) => s.events);
  const settings = useGame((s) => s.settings);
  const stage = useStage();
  const [items, setItems] = useState<FxItem[]>([]);
  // Events already in the queue when combat mounts are old news.
  const seen = useRef(events.at(-1)?.id ?? 0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    const fresh = events.filter((q) => q.id > seen.current);
    if (fresh.length === 0) return;
    seen.current = fresh[fresh.length - 1].id;
    if (settings.reducedMotion) return;
    const k = settings.speed === "fast" ? 0.5 : 1;
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.current.delete(t);
        fn();
      }, ms);
      timers.current.add(t);
    };
    const s = stage.scale || 1;
    const find = (selector: string) => root.current?.querySelector<HTMLElement>(selector) ?? null;
    const place = (el: HTMLElement | null): StageRect | null => {
      const origin = root.current?.getBoundingClientRect();
      if (!el || !origin) return null;
      const r = el.getBoundingClientRect();
      return { x: (r.left - origin.left) / s, y: (r.top - origin.top) / s, width: r.width / s, height: r.height / s };
    };
    const add = (item: FxItem) => {
      setItems((list) => [...list, item]);
      later(item.ms + 20, () => setItems((list) => list.filter((i) => i.id !== item.id)));
    };
    const float = (el: HTMLElement | null, text: string, tone: FxTone) => {
      const r = place(el);
      if (r) add({ id: nextId.current++, kind: "number", x: r.x + r.width / 2, y: r.y + r.height / 3, text, tone, ms: MS.number * k });
    };
    const animate = (el: HTMLElement | null, frames: Keyframe[], ms: number) => {
      if (el && typeof el.animate === "function") el.animate(frames, { duration: ms * k, easing: "ease-out" });
    };
    const shake = (el: HTMLElement | null) =>
      animate(el, [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], MS.shake);
    const flash = (el: HTMLElement | null, color: string) =>
      animate(el, [{ boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 0 6px ${color}` }, { boxShadow: `0 0 0 0 ${color}` }], MS.flash);
    const enemy = (key: number) => find(`[data-enemy-key="${key}"] .enemy__sprite`);

    const visible = fresh.filter((q) => ANIMATED.has(q.event.type));
    visible.forEach((q, i) => {
      const e = q.event;
      later(i * MS.step * k, () => {
        switch (e.type) {
          case "cardPlayed": {
            const from = rects.get(e.uid);
            if (!from) return;
            // Fly to the enemy the card served, else up into the middle of the board.
            const target = fresh.find((f) => f.id > q.id && f.event.type === "serve")?.event;
            const to = target?.type === "serve" ? place(enemy(target.enemy)) : null;
            const dx = to ? to.x + to.width / 2 - (from.x + from.width / 2) : 640 - (from.x + from.width / 2);
            const dy = to ? to.y + to.height / 2 - (from.y + from.height / 2) : -200;
            add({ id: nextId.current++, kind: "ghost", from, dx, dy, card: { uid: e.uid, id: e.card, upgraded: false }, ms: MS.ghost * k });
            return;
          }
          case "serve":
            float(enemy(e.enemy), `-${e.amount}`, "serve");
            if (e.absorbed > 0) float(find(`[data-enemy-key="${e.enemy}"] .buffer`), `-${e.absorbed}`, "absorb");
            shake(enemy(e.enemy));
            return;
          case "hit":
            animate(enemy(e.enemy), [{ transform: "translateY(0)" }, { transform: "translateY(14px)" }, { transform: "translateY(0)" }], MS.pulse);
            if (e.absorbed > 0) {
              flash(find('[data-fx="capacity"]'), "rgba(74, 217, 200, 0.75)");
              float(find('[data-fx="capacity"]'), `-${e.absorbed}`, "absorb");
            }
            if (e.budgetLost > 0) {
              shake(find('[data-fx="player"]'));
              float(find('[data-fx="budget"]'), `-${e.budgetLost}`, "loss");
            }
            return;
          case "capacity":
            if (e.amount) float(find('[data-fx="capacity"]'), `${e.amount > 0 ? "+" : ""}${e.amount}`, "capacity");
            return;
          case "budget":
            if (e.amount > 0) float(find('[data-fx="budget"]'), `+${e.amount}`, "recover");
            return;
          case "shuffle":
            animate(find('[data-fx="draw"]'), [{ transform: "scale(1)" }, { transform: "scale(1.12) rotate(-3deg)" }, { transform: "scale(1)" }], MS.pulse);
            return;
          case "nodeFailure":
            if (e.infra) flash(find(`[data-infra="${e.infra}"]`), "rgba(255, 107, 107, 0.85)");
            return;
          case "enemyResolved":
            animate(find(`[data-enemy-key="${e.enemy}"]`), [{ opacity: 1, filter: "brightness(2)" }, { opacity: 0.35, filter: "brightness(1)" }], MS.ghost);
            return;
        }
      });
    });
  }, [events, settings, stage.scale, root, rects]);

  return items;
}
