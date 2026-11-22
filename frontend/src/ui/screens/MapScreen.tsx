/* The act map: 15 floors and the boss, scrolled so the current floor is in view. */
import { useLayoutEffect, useRef } from "react";
import type { MapNode, NodeKind, RunState } from "../../engine/types";
import { reachableOf, useGame } from "../../game/store";
import { Icon } from "../art";
import { enemyDef, useContent } from "../content";
import { ACT_NAMES, NODE_KINDS } from "../labels";

const ROW = 88;
const COL = 92;
const PAD_Y = 70;
const WIDTH = COL * 7;
const FLOORS = 16;
const HEIGHT = PAD_Y * 2 + ROW * (FLOORS - 1);

const pos = (n: MapNode) => ({ x: COL / 2 + n.col * COL, y: PAD_Y + (FLOORS - n.floor) * ROW });

const LEGEND: NodeKind[] = ["incident", "major", "event", "vendor", "retro", "treasure", "boss"];

export function MapScreen({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const trail = useGame((s) => s.trail);
  const scroller = useRef<HTMLDivElement>(null);
  const reachable = new Set(reachableOf(run));
  const nodes = Object.values(run.map.nodes);
  const visited = new Set(trail);
  const current = run.position ? run.map.nodes[run.position] : null;
  const bossEnemies = content.encounters[run.map.boss]?.enemies.map((id) => enemyDef(content, id).name).join(", ") || "The boss";
  const trailEdges = new Set(trail.slice(1).map((id, i) => `${trail[i]}>${id}`));

  // Keep the next floor in view: scroll so the current floor sits low on the screen.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const floor = current?.floor ?? 0;
    el.scrollTop = Math.max(0, PAD_Y + (FLOORS - floor) * ROW - el.clientHeight * 0.7);
  }, [current?.floor]);

  return (
    <main className="map-screen">
      <aside className="map-side panel">
        <h1 className="map-side__act">Act {run.act}</h1>
        <p className="map-side__name">{ACT_NAMES[run.act]}</p>
        <p className="muted">Boss: {bossEnemies}</p>
        <p className="map-side__hint">{reachable.size ? "Pick where to go next." : "No moves left."}</p>
      </aside>

      <div className="map-scroll" ref={scroller} tabIndex={-1}>
        <div className="map" style={{ width: WIDTH, height: HEIGHT }}>
          <svg className="map__lines" width={WIDTH} height={HEIGHT} aria-hidden="true">
            {nodes.flatMap((n) =>
              n.next.map((id) => {
                const to = run.map.nodes[id];
                if (!to) return null;
                const a = pos(n);
                const b = pos(to);
                const taken = trailEdges.has(`${n.id}>${id}`);
                const open = n.id === run.position && reachable.has(id);
                return <line key={`${n.id}>${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={taken ? "is-taken" : open ? "is-open" : ""} />;
              }),
            )}
          </svg>
          <ol className="map__nodes" aria-label={`Act ${run.act} map`}>
            {[...nodes]
              .sort((a, b) => a.floor - b.floor || a.col - b.col)
              .map((n) => {
                const { x, y } = pos(n);
                const can = reachable.has(n.id);
                const kind = NODE_KINDS[n.kind];
                const state = n.id === run.position ? "is-current" : visited.has(n.id) ? "is-visited" : can ? "is-reachable" : n.floor <= (current?.floor ?? 0) ? "is-past" : "";
                const where = n.kind === "boss" ? "Boss" : `Floor ${n.floor}`;
                return (
                  <li key={n.id} className={`map-node map-node--${n.kind} ${state}`} style={{ left: x, top: y }}>
                    <button
                      type="button"
                      disabled={!can}
                      onClick={() => dispatch({ type: "chooseNode", node: n.id })}
                      aria-label={`${where}: ${kind.name}${n.id === run.position ? ", you are here" : visited.has(n.id) ? ", visited" : ""}`}
                    >
                      <Icon name={`node-${n.kind}`} size={n.kind === "boss" ? 40 : 26} />
                    </button>
                  </li>
                );
              })}
          </ol>
        </div>
      </div>

      <aside className="map-legend panel" aria-labelledby="legend-title">
        <h2 id="legend-title">Legend</h2>
        <ul>
          {LEGEND.map((k) => (
            <li key={k}>
              <span className={`legend-dot map-node--${k}`}>
                <Icon name={`node-${k}`} size={20} />
              </span>
              <span>
                <strong>{NODE_KINDS[k].name}</strong>
                <span className="muted small">{NODE_KINDS[k].text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
