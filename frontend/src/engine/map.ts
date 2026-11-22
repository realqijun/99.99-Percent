/*
 * Act maps: 15 floors on a 7-column grid, then the boss. Rules are in docs/GAMEPLAY.md (Map generation).
 */
import { intRange, weightedPick } from "./rng";
import type { Act, ActMap, Content, MapNode, NodeKind, RngStreams, RunState, Tier } from "./types";

export const FLOORS = 15;
export const COLUMNS = 7;
export const PATHS = 6;
export const BOSS_NODE = "boss";
export const TREASURE_FLOOR = 9;
export const FIRST_MAJOR_FLOOR = 6;

const KIND_WEIGHTS: [NodeKind, number][] = [
  ["incident", 50],
  ["event", 22],
  ["retro", 12],
  ["major", 10],
  ["vendor", 6],
];
/** Kinds that never follow themselves on a path. */
export const NO_REPEAT: NodeKind[] = ["major", "vendor", "retro"];

const nodeId = (floor: number, col: number) => `${floor}-${col}`;

/** Picks an encounter of an act and tier by weight from the map stream. */
export function pickEncounter(rng: RngStreams, content: Content, act: Act, tier: Tier): string | undefined {
  const all = Object.values(content.encounters).filter((e) => e.tier === tier && e.id !== "tutorial");
  const inAct = all.filter((e) => e.act === act);
  return weightedPick(rng, "map", (inAct.length > 0 ? inAct : all).map((e) => [e.id, e.weight] as const));
}

export function generateMap(rng: RngStreams, content: Content, act: Act): ActMap {
  // Lay out paths that move up one floor at a time, one column at most, without crossing.
  const edges = new Map<string, Set<string>>();
  const cols = new Map<string, number>();
  const link = (floor: number, from: number, to: number) => {
    const key = nodeId(floor, from);
    if (!edges.has(key)) edges.set(key, new Set());
    edges.get(key)!.add(nodeId(floor + 1, to));
  };
  const crosses = (floor: number, from: number, to: number) => {
    for (let d = 0; d < COLUMNS; d++) {
      for (const target of edges.get(nodeId(floor, d)) ?? []) {
        const dt = cols.get(target)!;
        if ((d < from && dt > to) || (d > from && dt < to)) return true;
      }
    }
    return false;
  };
  let firstStart = -1;
  for (let p = 0; p < PATHS; p++) {
    let col = intRange(rng, "map", 0, COLUMNS - 1);
    if (p === 1) while (col === firstStart) col = intRange(rng, "map", 0, COLUMNS - 1);
    if (p === 0) firstStart = col;
    cols.set(nodeId(1, col), col);
    for (let floor = 1; floor < FLOORS; floor++) {
      const options = [col - 1, col, col + 1].filter((c) => c >= 0 && c < COLUMNS && !crosses(floor, col, c));
      const nextCol = options[intRange(rng, "map", 0, options.length - 1)];
      cols.set(nodeId(floor + 1, nextCol), nextCol);
      link(floor, col, nextCol);
      col = nextCol;
    }
  }

  const nodes: Record<string, MapNode> = {};
  const ids = [...cols.keys()].sort((a, b) => {
    const [fa, ca] = a.split("-").map(Number);
    const [fb, cb] = b.split("-").map(Number);
    return fa - fb || ca - cb;
  });
  for (const id of ids) {
    const [floor, col] = id.split("-").map(Number);
    nodes[id] = { id, floor, col, kind: "incident", next: floor === FLOORS ? [BOSS_NODE] : [...(edges.get(id) ?? [])].sort() };
  }
  nodes[BOSS_NODE] = { id: BOSS_NODE, floor: FLOORS + 1, col: Math.floor(COLUMNS / 2), kind: "boss", next: [] };

  // Assign kinds floor by floor, so each node only has to check its parents.
  const parents = new Map<string, MapNode[]>();
  for (const node of Object.values(nodes)) {
    for (const child of node.next) parents.set(child, [...(parents.get(child) ?? []), node]);
  }
  for (const id of ids) {
    const node = nodes[id];
    node.kind = kindFor(rng, node, parents.get(id) ?? []);
  }
  return { act, nodes, boss: pickEncounter(rng, content, act, "boss") ?? "" };
}

function kindFor(rng: RngStreams, node: MapNode, parents: MapNode[]): NodeKind {
  if (node.floor === 1) return "incident";
  if (node.floor === TREASURE_FLOOR) return "treasure";
  if (node.floor === FLOORS) return "retro";
  const allowed = KIND_WEIGHTS.filter(([kind]) => {
    if (kind === "major" && node.floor < FIRST_MAJOR_FLOOR) return false;
    if (kind === "retro" && node.floor === FLOORS - 1) return false;
    return !(NO_REPEAT.includes(kind) && parents.some((p) => p.kind === kind));
  });
  return weightedPick(rng, "map", allowed) ?? "incident";
}

export function reachableNodes(run: RunState): string[] {
  if (run.screen.kind !== "map" || run.result) return [];
  if (run.position === null) {
    return Object.values(run.map.nodes)
      .filter((n) => n.floor === 1)
      .sort((a, b) => a.col - b.col)
      .map((n) => n.id);
  }
  return run.map.nodes[run.position]?.next.slice() ?? [];
}
