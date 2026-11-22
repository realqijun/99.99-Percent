import type { CSSProperties } from "react";
import { cardText } from "../../engine";
import { CardView } from "../CardView";
import { cardDef, useContent } from "../content";
import type { FxItem } from "./useFx";

export function FxLayer({ items }: { items: FxItem[] }) {
  const content = useContent();
  return (
    <div className="fx" aria-hidden="true">
      {items.map((item) => {
        if (item.kind === "number") {
          return (
            <span key={item.id} className={`fx-number fx-number--${item.tone}`} style={{ left: item.x, top: item.y, animationDuration: `${item.ms}ms` }}>
              {item.text}
            </span>
          );
        }
        const def = cardDef(content, item.card.id);
        const style = {
          left: item.from.x,
          top: item.from.y,
          animationDuration: `${item.ms}ms`,
          "--dx": `${item.dx}px`,
          "--dy": `${item.dy}px`,
        } as CSSProperties;
        return (
          <div key={item.id} className="fx-ghost" style={style}>
            <CardView def={def} upgraded={item.card.upgraded} text={cardText(def, item.card.upgraded, undefined, undefined, content)} />
          </div>
        );
      })}
    </div>
  );
}
