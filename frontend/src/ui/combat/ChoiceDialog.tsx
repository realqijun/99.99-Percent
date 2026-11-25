/* A card asked the player to pick cards; the rest of its effects resolve after the answer. */
import { useState } from "react";
import { choiceCards } from "../../engine";
import type { CombatState, PendingChoice, RunState } from "../../engine/types";
import { useGame } from "../../game/store";
import { CardGrid } from "../CardGrid";
import { sortCards } from "../cards";
import { useContent } from "../content";
import { Dialog } from "../Dialog";

const VERBS: Record<PendingChoice["action"], string> = {
  decommission: "decommission",
  discard: "discard",
  toHand: "put into your hand",
  toTopOfDraw: "put on top of your draw pile",
  upgrade: "upgrade",
  retain: "keep in your hand",
};

const ZONES = { hand: "your hand", draw: "your draw pile", discard: "your discard pile" };

export function ChoiceDialog({ run, combat, pending }: { run: RunState; combat: CombatState; pending: PendingChoice }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const [picked, setPicked] = useState<number[]>([]);
  // The draw pile is shown in deck order so the choice doesn't give away what comes next.
  const candidates = choiceCards(run, content);
  const cards = pending.from === "draw" ? sortCards(candidates, content) : candidates;
  const need = pending.optional ? 0 : Math.min(pending.count, cards.length);
  const ready = picked.length >= need && picked.length <= pending.count;
  const title = `Choose ${pending.count === 1 ? "a card" : `${pending.count} cards`} to ${VERBS[pending.action]}`;

  const toggle = (uid: number) =>
    setPicked((p) => (p.includes(uid) ? p.filter((u) => u !== uid) : pending.count === 1 ? [uid] : p.length < pending.count ? [...p, uid] : p));

  return (
    <Dialog title={title} wide>
      <p className="muted">
        From {ZONES[pending.from]}. {pending.optional ? "You can skip this." : ""}
      </p>
      <div className="scroll-area">
        <CardGrid cards={cards} combat={combat} selected={picked} onPick={(c) => toggle(c.uid)} empty="There are no cards to choose from." />
      </div>
      <div className="row row--end">
        {pending.optional && (
          <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: "chooseCards", uids: [] })}>
            Skip
          </button>
        )}
        <button type="button" className="btn" disabled={!ready} onClick={() => dispatch({ type: "chooseCards", uids: picked })}>
          Confirm{pending.count > 1 ? ` (${picked.length}/${pending.count})` : ""}
        </button>
      </div>
    </Dialog>
  );
}
