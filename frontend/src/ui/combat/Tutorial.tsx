/* The guided first combat: Maya points at one thing per step. */
import { useLayoutEffect, useRef, useState } from "react";
import { useGame } from "../../game/store";
import { portrait } from "../labels";
import { useStage, type StageRect } from "../stageContext";

const STEPS: { target: string; line: string }[] = [
  { target: "hand", line: "This is your hand. Each card costs Engineers, shown in its corner." },
  { target: "intent", line: "This is what the incident does next. The number is requests per hit." },
  { target: "capacity", line: "Capacity soaks up requests before they burn your Error Budget." },
  { target: "endTurn", line: "Out of Engineers? End your turn, and the incidents act." },
];

/** The bubble always sits at the top left of the field, clear of the hand, the enemies and End turn; a ring marks the target. */
const BUBBLE = { left: 320, top: 56, width: 360 };
/** Room for the fanned cards' tilt around their resting boxes. */
const FAN = 12;

/** `handSize` re-measures the ring when cards are played or drawn. */
export function Tutorial({ step, handSize }: { step: number; handSize: number }) {
  const dispatch = useGame((s) => s.dispatch);
  const stage = useStage();
  const ref = useRef<HTMLElement>(null);
  const [rect, setRect] = useState<StageRect | null>(null);
  const info = STEPS[Math.min(step, STEPS.length - 1)];

  // Measure before paint so the ring never flashes at the previous target.
  /* oxlint-disable react/set-state-in-effect */
  useLayoutEffect(() => {
    const root = ref.current?.closest(".combat");
    const el = root?.querySelector(`[data-tutorial="${info.target}"]`);
    if (!root || !el) {
      setRect(null);
      return;
    }
    const origin = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const s = stage.scale || 1;
    const box = { x: (r.left - origin.left) / s, y: (r.top - origin.top) / s, width: r.width / s, height: r.height / s };
    // The hand ring hugs the cards' resting places (layout offsets, so the deal animation doesn't matter).
    const cards = [...el.querySelectorAll<HTMLElement>("[data-uid]")];
    if (cards.length > 0) {
      const left = Math.min(...cards.map((c) => c.offsetLeft)) - FAN;
      const right = Math.max(...cards.map((c) => c.offsetLeft + c.offsetWidth)) + FAN;
      const top = Math.min(...cards.map((c) => c.offsetTop)) - FAN;
      box.x += left;
      box.width = right - left;
      box.y += top;
      box.height -= top;
    }
    setRect(box);
  }, [info.target, stage.scale, handSize]);
  /* oxlint-enable react/set-state-in-effect */

  const last = step >= STEPS.length - 1;

  return (
    <>
      {rect && <div className="tutorial-ring" style={{ left: rect.x - 6, top: rect.y - 6, width: rect.width + 12, height: rect.height + 12 }} aria-hidden="true" />}
      <section ref={ref} className="tutorial panel" style={BUBBLE} aria-label={`Tutorial, step ${step + 1} of ${STEPS.length}`}>
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
