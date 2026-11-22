/*
 * Dev only (imported from main.tsx behind import.meta.env.DEV, so builds leave it out):
 * console helpers to jump ahead in a real run. They edit the saved run directly, then the
 * game carries on through the real engine. Type `debug.help()` in the console.
 */
import type { StoreApi } from "zustand";
import { CONTENT } from "../content";
import { generateMap } from "../engine/map";
import type { Act, NodeKind, RunState } from "../engine/types";
import type { GameState } from "../game/store";
import * as storage from "../game/storage";

export function installDebug(store: StoreApi<GameState>): void {
  const edit = (fn: (run: RunState) => void) => {
    const run = store.getState().run;
    if (!run) return console.warn("No run in progress.");
    const next = structuredClone(run);
    fn(next);
    store.setState({ run: next });
    if (store.getState().persist) storage.saveRun(next);
  };

  const debug = {
    help: () =>
      console.info(
        [
          "debug.budget(n)  set Error Budget and max to n",
          "debug.cash(n)    set cash",
          "debug.weaken()   every enemy in this combat drops to 1 Load",
          "debug.next(kind) make every node you can move to a kind: incident, major, event, vendor, retro, treasure",
          "debug.floor(n)   stand on floor n of the map (15 puts the boss next)",
          "debug.act(n)     start act n on a fresh map",
        ].join("\n"),
      ),
    budget: (n: number) => edit((r) => ((r.budget = n), (r.maxBudget = n))),
    cash: (n: number) => edit((r) => (r.cash = n)),
    weaken: () =>
      edit((r) => {
        if (r.screen.kind !== "combat") return console.warn("Not in combat.");
        for (const e of r.screen.combat.enemies) if (!e.resolved) e.load = 1;
      }),
    next: (kind: NodeKind) =>
      edit((r) => {
        if (r.screen.kind !== "map") return console.warn("Not on the map.");
        const ids = r.position === null ? Object.values(r.map.nodes).filter((n) => n.floor === 1).map((n) => n.id) : r.map.nodes[r.position].next;
        for (const id of ids) if (id !== "boss") r.map.nodes[id].kind = kind;
      }),
    floor: (floor: number) =>
      edit((r) => {
        const node = Object.values(r.map.nodes).find((n) => n.floor === floor);
        if (!node) return console.warn(`No floor ${floor}.`);
        r.position = node.id;
        r.path = [...r.path, node.id];
        r.screen = { kind: "map" };
      }),
    act: (act: Act) =>
      edit((r) => {
        r.act = act;
        r.map = generateMap(r.rng, CONTENT, act);
        r.position = null;
        r.path = [];
        r.screen = { kind: "map" };
      }),
  };
  (window as unknown as { debug: typeof debug }).debug = debug;
}
