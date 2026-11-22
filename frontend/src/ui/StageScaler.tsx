/* Draws the game at a fixed 1280x720 design size, scaled to fit the window with letterboxing. */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { playCue } from "../game/audio";
import { useGame } from "../game/store";
import { STAGE_HEIGHT, STAGE_WIDTH, StageContext, stageRect, type Stage, type StageRect } from "./stageContext";

interface TipState {
  anchor: HTMLElement;
  content: ReactNode;
  rect: StageRect;
}

const TIP_WIDTH = 280;

/** Every enabled button clicks. Refused commands play "error" from the store instead. */
function clickCue(e: MouseEvent) {
  const button = (e.target as HTMLElement).closest?.("button");
  if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
    try {
      playCue("click");
    } catch {
      // Sound never stops play.
    }
  }
}

export function StageScaler({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tip, setTip] = useState<TipState | null>(null);
  const settings = useGame((s) => s.settings);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT) || 1);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const showTip = useCallback(
    (anchor: HTMLElement, content: ReactNode) => setTip({ anchor, content, rect: stageRect({ ref, scale }, anchor) }),
    [scale],
  );
  const hideTip = useCallback((anchor: HTMLElement) => setTip((t) => (t?.anchor === anchor ? null : t)), []);

  const stage = useMemo<Stage>(() => ({ ref, scale, showTip, hideTip }), [scale, showTip, hideTip]);

  return (
    <div className="viewport">
      <div
        ref={ref}
        className="stage"
        style={{ transform: `scale(${scale})` }}
        data-motion={settings.reducedMotion ? "reduced" : settings.speed}
        onClickCapture={clickCue}
      >
        <StageContext.Provider value={stage}>
          {children}
          {tip && <TipBubble tip={tip} />}
        </StageContext.Provider>
      </div>
    </div>
  );
}

function TipBubble({ tip }: { tip: TipState }) {
  const { rect } = tip;
  const above = rect.y > STAGE_HEIGHT / 2;
  const left = Math.max(8, Math.min(STAGE_WIDTH - TIP_WIDTH - 8, rect.x + rect.width / 2 - TIP_WIDTH / 2));
  const style = above ? { left, bottom: STAGE_HEIGHT - rect.y + 8 } : { left, top: rect.y + rect.height + 8 };
  return (
    <div className="tip" style={{ ...style, width: TIP_WIDTH }} aria-hidden="true">
      {tip.content}
    </div>
  );
}
