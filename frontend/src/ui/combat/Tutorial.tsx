/* The guided first combat: Maya points at one thing per step. */
import { useEffect, useState, type RefObject } from "react";
import { useGame } from "../../game/store";
import { portrait } from "../labels";
import { useStage, type StageRect } from "../stageContext";

type Side = "above" | "left" | "right";

const STEPS: { target: string; side: Side; line: string }[] = [
  { target: "hand", side: "above", line: "This is your hand. Each card costs Engineers, shown in its corner." },
  { target: "intent", side: "left", line: "This is what the incident does next. The number is requests per hit." },
  { target: "capacity", side: "right", line: "Capacity soaks up requests before they burn your Error Budget." },
  { target: "endTurn", side: "above", line: "Out of Engineers? End your turn, and the incidents act." },
];

const GAP = 16;

function place(rect: StageRect | null, side: Side): { left: number; top: number } {
  if (!rect) return { left: AREA_W / 2 - BUBBLE_W / 2, top: 200 };
  const midX = rect.x + rect.width / 2 - BUBBLE_W / 2;
  const midY = rect.y + rect.height / 2 - BUBBLE_H / 2;
  const at =
    side === "above" ? { left: midX, top: rect.y - BUBBLE_H - GAP }
    : side === "left" ? { left: rect.x - BUBBLE_W - GAP, top: midY }
    : { left: rect.x + rect.width + GAP, top: midY };
  return {
    left: Math.max(12, Math.min(AREA_W - BUBBLE_W - 12, at.left)),
    top: Math.max(12, Math.min(AREA_H - BUBBLE_H - 12, at.top)),
  };
}

const BUBBLE_W = 400;
const BUBBLE_H = 128;
const AREA_W = 1280;
const AREA_H = 664;

export function Tutorial({ step, root }: { step: number; root: RefObject<HTMLElement | null> }) {
  const dispatch = useGame((s) => s.dispatch);
  const stage = useStage();
  const [rect, setRect] = useState<StageRect | null>(null);
  const info = STEPS[Math.min(step, STEPS.length - 1)];

  // Measures the target after the whole screen is laid out (a layout effect here would run before the parent's ref is set).
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    const el = root.current?.querySelector(`[data-tutorial="${info.target}"]`);
    const origin = root.current?.getBoundingClientRect();
    if (!el || !origin) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const s = stage.scale || 1;
    setRect({ x: (r.left - origin.left) / s, y: (r.top - origin.top) / s, width: r.width / s, height: r.height / s });
  }, [info.target, root, stage.scale]);
  /* oxlint-enable react/set-state-in-effect */

  const { left, top } = place(rect, info.side);
  const last = step >= STEPS.length - 1;

  return (
    <>
      {rect && <div className="tutorial-ring" style={{ left: rect.x - 6, top: rect.y - 6, width: rect.width + 12, height: rect.height + 12 }} aria-hidden="true" />}
      <section className="tutorial panel" style={{ left, top, width: BUBBLE_W, minHeight: BUBBLE_H }} aria-label={`Tutorial, step ${step + 1} of ${STEPS.length}`}>
        <img src={portrait("maya")} alt="" width={72} height={72} />
        <div className="tutorial__body">
          <p className="tutorial__who">
            Maya <span className="muted small">{step + 1}/{STEPS.length}</span>
          </p>
          <p aria-live="polite">{info.line}</p>
          <div className="row row--end">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => dispatch({ type: "skipTutorial" })}>
              Skip tutorial
            </button>
            <button type="button" className="btn btn--small" onClick={() => dispatch({ type: "advanceTutorial" })}>
              {last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
