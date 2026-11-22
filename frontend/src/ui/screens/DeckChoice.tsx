/* Pick a card from the deck outside combat: remove, upgrade (with a preview) or duplicate. */
import { useState } from "react";
import type { RunState } from "../../engine/types";
import { cardTextOf, useGame } from "../../game/store";
import { CardGrid } from "../CardGrid";
import { sortCards } from "../cards";
import { CardView } from "../CardView";
import { cardDef, useContent } from "../content";

const TITLES = { remove: "Remove a card", upgrade: "Refactor a card", duplicate: "Duplicate a card" };
const CONFIRM = { remove: "Remove", upgrade: "Upgrade", duplicate: "Duplicate" };

export function DeckChoice({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const [uid, setUid] = useState<number | null>(null);
  if (run.screen.kind !== "deckChoice") return null;
  const { action } = run.screen;
  const cards = sortCards(run.deck, content);
  const picked = run.deck.find((c) => c.uid === uid) ?? null;
  const def = picked ? cardDef(content, picked.id) : null;
  const disabledReason =
    action === "upgrade"
      ? (c: { id: string; upgraded: boolean }) => (c.upgraded ? "Already upgraded" : !cardDef(content, c.id).upgrade ? "Can't be upgraded" : null)
      : undefined;

  return (
    <main className="deck-choice">
      <header className="screen-head">
        <h1>{TITLES[action]}</h1>
        <p className="muted">{picked && def ? `${def.name} selected.` : "Pick one card from your deck."}</p>
        <button type="button" className="btn" disabled={!picked} onClick={() => picked && dispatch({ type: "chooseCards", uids: [picked.uid] })}>
          {CONFIRM[action]}
        </button>
      </header>
      <div className="deck-choice__body">
        <div className="scroll-area deck-choice__grid">
          <CardGrid cards={cards} selected={uid === null ? [] : [uid]} onPick={(c) => setUid(c.uid === uid ? null : c.uid)} disabledReason={disabledReason} />
        </div>
        {action === "upgrade" && (
          <aside className="preview panel" aria-label="Upgrade preview" aria-live="polite">
            {picked && def ? (
              <>
                <CardView def={def} upgraded={false} text={cardTextOf(def, false)} />
                <span className="preview__arrow" aria-hidden="true">
                  &darr;
                </span>
                <CardView def={def} upgraded text={cardTextOf(def, true)} />
              </>
            ) : (
              <p className="muted center">Pick a card to see it upgraded.</p>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
