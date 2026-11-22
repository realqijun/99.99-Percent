/* A tooltip on hover and focus. The text is also the control's accessible description. */
import { cloneElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { useStage } from "./stageContext";

export function Tip({ content, children }: { content: ReactNode; children: ReactElement<{ "aria-describedby"?: string }> }) {
  const id = useId();
  const { showTip, hideTip } = useStage();
  const wrapper = useRef<HTMLSpanElement>(null);
  const anchor = () => (wrapper.current?.firstElementChild as HTMLElement | null) ?? null;
  const show = () => {
    const el = anchor();
    if (el && content) showTip(el, content);
  };
  const hide = () => {
    const el = anchor();
    if (el) hideTip(el);
  };

  // Hide when the text goes away (a menu opened) or the anchor does (a card was played).
  const hasContent = Boolean(content);
  useEffect(() => {
    const el = (wrapper.current?.firstElementChild as HTMLElement | null) ?? null;
    if (el && !hasContent) hideTip(el);
    return () => {
      if (el) hideTip(el);
    };
  }, [hideTip, hasContent]);

  return (
    <span ref={wrapper} className="tip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {hasContent ? cloneElement(children, { "aria-describedby": id }) : children}
      {hasContent && (
        <span id={id} className="sr-only">
          {content}
        </span>
      )}
    </span>
  );
}
