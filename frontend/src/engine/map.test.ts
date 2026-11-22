import { describe, expect, it } from "vitest";
import { reachableNodes } from "./index";
import { BOSS_NODE, COLUMNS, FLOORS, generateMap, NO_REPEAT } from "./map";
import { seedStreams } from "./rng";
import { FIXTURE, fixtureRun } from "./__fixtures__/helpers";
import type { ActMap } from "./types";

function parentsOf(map: ActMap): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const node of Object.values(map.nodes)) for (const child of node.next) parents.set(child, [...(parents.get(child) ?? []), node.id]);
  return parents;
}

describe("map generation", () => {
  it("obeys the placement rules and always reaches the boss, over 200 seeds", () => {
    for (let i = 0; i < 200; i++) {
      const map = generateMap(seedStreams(`map-${i}`), FIXTURE, ((i % 3) + 1) as 1 | 2 | 3);
      const nodes = Object.values(map.nodes);
      const parents = parentsOf(map);
      expect(map.nodes[BOSS_NODE]).toMatchObject({ floor: FLOORS + 1, kind: "boss", next: [] });
      expect(FIXTURE.encounters[map.boss].tier).toBe("boss");
      expect(FIXTURE.encounters[map.boss].act).toBe(map.act);
      for (const node of nodes) {
        expect(node.col).toBeGreaterThanOrEqual(0);
        expect(node.col).toBeLessThan(COLUMNS);
        if (node.floor === 1) expect(node.kind).toBe("incident");
        if (node.floor === 9) expect(node.kind).toBe("treasure");
        if (node.floor === FLOORS) {
          expect(node.kind).toBe("retro");
          expect(node.next).toEqual([BOSS_NODE]);
        }
        if (node.floor === FLOORS - 1) expect(node.kind).not.toBe("retro");
        if (node.floor < 6) expect(node.kind).not.toBe("major");
        if (node.floor <= FLOORS && node.kind === "boss") throw new Error("boss below the top");
        for (const child of node.next) {
          const c = map.nodes[child];
          expect(c.floor).toBe(node.floor + 1);
          if (c.kind !== "boss") expect(Math.abs(c.col - node.col)).toBeLessThanOrEqual(1);
          if (NO_REPEAT.includes(node.kind)) expect(c.kind).not.toBe(node.kind);
        }
        // Every node is on a path: it has a parent (or is on floor 1) and leads on (or is the boss).
        if (node.floor > 1) expect(parents.get(node.id)?.length).toBeGreaterThan(0);
        if (node.kind !== "boss") expect(node.next.length).toBeGreaterThan(0);
      }
      // Edges between the same two floors never cross.
      for (const a of nodes) {
        for (const b of nodes) {
          if (a.floor !== b.floor || a.floor >= FLOORS || a.col >= b.col) continue;
          for (const ta of a.next) for (const tb of b.next) expect(map.nodes[ta].col).toBeLessThanOrEqual(map.nodes[tb].col);
        }
      }
      // The boss is reachable from every floor 1 node.
      for (const start of nodes.filter((n) => n.floor === 1)) {
        const seen = new Set([start.id]);
        const queue = [start.id];
        while (queue.length) {
          for (const n of map.nodes[queue.shift()!].next) {
            if (seen.has(n)) continue;
            seen.add(n);
            queue.push(n);
          }
        }
        expect(seen.has(BOSS_NODE)).toBe(true);
      }
      expect(nodes.filter((n) => n.floor === 1).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is the same for the same seed", () => {
    expect(generateMap(seedStreams("x"), FIXTURE, 1)).toEqual(generateMap(seedStreams("x"), FIXTURE, 1));
    expect(generateMap(seedStreams("x"), FIXTURE, 1)).not.toEqual(generateMap(seedStreams("y"), FIXTURE, 1));
  });
});

describe("reachable nodes", () => {
  it("starts on floor 1, then follows the edges", () => {
    const run = fixtureRun();
    const first = reachableNodes(run);
    expect(first.every((id) => run.map.nodes[id].floor === 1)).toBe(true);
    run.position = first[0];
    expect(reachableNodes(run)).toEqual(run.map.nodes[first[0]].next);
    run.screen = { kind: "retro", done: false };
    expect(reachableNodes(run)).toEqual([]);
  });
});
