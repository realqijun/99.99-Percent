/* One card face. Interactive wrappers (hand, rewards, viewers) put it inside a button. */
import type { CardDef } from "../engine/types";
import { Icon } from "./art";
import { baseCost, cardName, type Cost } from "./cards";
import { CARD_TYPES } from "./labels";

export function CardView({
  def,
  upgraded,
  text,
  cost = baseCost(def, upgraded),
  small = false,
}: {
  def: CardDef;
  upgraded: boolean;
  text: string;
  /** Cost right now, when it differs from the printed one. */
  cost?: Cost;
  small?: boolean;
}) {
  const printed = baseCost(def, upgraded);
  const delta = typeof cost === "number" && typeof printed === "number" ? cost - printed : 0;
  return (
    <div className={`card card--${def.type}${upgraded ? " card--upgraded" : ""}${small ? " card--small" : ""}`} aria-hidden="true">
      <div className="card__head">
        <span className={`card__cost${delta < 0 ? " is-cheaper" : delta > 0 ? " is-dearer" : ""}`}>{cost === null ? "-" : cost === "x" ? "X" : cost}</span>
        <span className="card__name">{cardName(def, upgraded)}</span>
      </div>
      <div className="card__art">
        <Icon name={`type-${def.type}`} size={small ? 28 : 36} />
      </div>
      <div className="card__type">{CARD_TYPES[def.type]}</div>
      <p className="card__text">{text}</p>
    </div>
  );
}
