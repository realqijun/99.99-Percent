import { createContext, useContext, type ReactNode, type RefObject } from "react";

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

export interface Stage {
  /** The 1280x720 stage element; positions inside it are in design pixels. */
  ref: RefObject<HTMLDivElement | null>;
  scale: number;
  showTip(anchor: HTMLElement, content: ReactNode): void;
  hideTip(anchor: HTMLElement): void;
}

export const StageContext = createContext<Stage>({
  ref: { current: null },
  scale: 1,
  showTip: () => {},
  hideTip: () => {},
});

export const useStage = () => useContext(StageContext);

export interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An element's position in design pixels relative to the stage. */
export function stageRect(stage: Pick<Stage, "ref" | "scale">, el: Element): StageRect {
  const rect = el.getBoundingClientRect();
  const origin = stage.ref.current?.getBoundingClientRect();
  const s = stage.scale || 1;
  return {
    x: (rect.left - (origin?.left ?? 0)) / s,
    y: (rect.top - (origin?.top ?? 0)) / s,
    width: rect.width / s,
    height: rect.height / s,
  };
}
