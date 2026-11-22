/* A grid of cards, for the deck and pile viewers and anywhere a card is picked from a list. */
import type { CardInstance, CombatState } from "../engine/types";
import { cardText } from "../engine";
import { baseCost, cardLabel } from "./cards";
import { CardView } from "./CardView";
import { cardDef, useContent } from "./content";
import { Dialog } from "./Dialog";

export function CardGrid({
  cards,
  combat,
  selected = [],
  onPick,
  disabledReason,
  empty = "No cards.",
}: {
  cards: CardInstance[];
  combat?: CombatState;
  selected?: number[];
  onPick?: (card: CardInstance) => void;
  disabledReason?: (card: CardInstance) => string | null;
  empty?: string;
}) {
  const content = useContent();
  if (cards.length === 0) return <p className="muted center">{empty}</p>;
  return (
    <ul className="card-grid">
      {cards.map((c) => {
        const def = cardDef(content, c.id);
        const text = cardText(def, c.upgraded, combat, undefined, content);
        const face = <CardView def={def} upgraded={c.upgraded} text={text} small />;
        const label = cardLabel(def, c.upgraded, baseCost(def, c.upgraded), text);
        if (!onPick) {
          return (
            <li key={c.uid} aria-label={label}>
              {face}
            </li>
          );
        }
        const reason = disabledReason?.(c) ?? null;
        return (
          <li key={c.uid}>
            <button
              type="button"
              className={`card-btn${selected.includes(c.uid) ? " is-selected" : ""}`}
              aria-label={reason ? `${label} ${reason}` : label}
              aria-pressed={selected.includes(c.uid)}
              disabled={reason !== null}
              onClick={() => onPick(c)}
            >
              {face}
              {reason && <span className="card-btn__reason">{reason}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function PileDialog({ title, cards, combat, onClose, note }: { title: string; cards: CardInstance[]; combat?: CombatState; onClose: () => void; note?: string }) {
  return (
    <Dialog title={`${title} (${cards.length})`} onClose={onClose} wide>
      {note && <p className="muted">{note}</p>}
      <div className="scroll-area">
        <CardGrid cards={cards} combat={combat} />
      </div>
    </Dialog>
  );
}
