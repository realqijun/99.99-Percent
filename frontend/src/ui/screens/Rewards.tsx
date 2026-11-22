/* After a fight: rewards. Also the treasure room and the boss relic choice. */
import { useState } from "react";
import type { RewardItem, RunState } from "../../engine/types";
import { cardTextOf, useGame } from "../../game/store";
import { Icon } from "../art";
import { cardLabel, baseCost } from "../cards";
import { CardView } from "../CardView";
import { cardDef, relicDef, runbookDef, useContent } from "../content";
import { Dialog } from "../Dialog";
import { RelicTile } from "../Tiles";

function rewardLabel(item: RewardItem, names: { relic: (id: string) => string; runbook: (id: string) => string }): string {
  switch (item.kind) {
    case "cash": return `${item.amount} cash`;
    case "cards": return "Add a card to your deck";
    case "relic": return `Relic: ${names.relic(item.relic)}`;
    case "runbook": return `Runbook: ${names.runbook(item.runbook)}`;
  }
}

const REWARD_ICON = { cash: "cash", cards: "deck", relic: "tech-gear", runbook: "runbook" } as const;

export function Reward({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const [cardsAt, setCardsAt] = useState<number | null>(null);
  if (run.screen.kind !== "reward") return null;
  const items = run.screen.items;
  const names = { relic: (id: string) => relicDef(content, id).name, runbook: (id: string) => runbookDef(content, id).name };
  const open = cardsAt !== null ? items[cardsAt] : null;
  const fullRunbooks = run.runbooks.every(Boolean);

  return (
    <main className="room">
      <div className="room__panel panel">
        <h1>Rewards</h1>
        <ul className="rewards">
          {items.map((item, i) => {
            const label = rewardLabel(item, names);
            const icon = item.kind === "relic" ? (`tech-${relicDef(content, item.relic).icon}` as const) : REWARD_ICON[item.kind];
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`reward${item.taken ? " is-taken" : ""}`}
                  disabled={item.taken}
                  onClick={() => (item.kind === "cards" ? setCardsAt(i) : dispatch({ type: "takeReward", index: i }))}
                  aria-label={item.taken ? `${label}, taken` : label}
                >
                  <Icon name={icon} size={24} />
                  <span>{label}</span>
                  {item.kind === "runbook" && !item.taken && fullRunbooks && <span className="muted small">Slots full</span>}
                  {item.taken && <span className="muted small">Taken</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="row row--end">
          <button type="button" className="btn" onClick={() => dispatch({ type: "leave" })}>
            {items.every((i) => i.taken) ? "Continue" : "Leave the rest"}
          </button>
        </div>
      </div>
      {open?.kind === "cards" && cardsAt !== null && (
        <Dialog title="Choose a card" onClose={() => setCardsAt(null)} wide>
          <ul className="choice-row">
            {open.choices.map((c, i) => {
              const def = cardDef(content, c.id);
              const text = cardTextOf(def, c.upgraded);
              return (
                <li key={c.uid}>
                  <button
                    type="button"
                    className="card-btn card-btn--big"
                    aria-label={`Take ${cardLabel(def, c.upgraded, baseCost(def, c.upgraded), text)}`}
                    onClick={() => {
                      setCardsAt(null);
                      dispatch({ type: "takeReward", index: cardsAt, card: i });
                    }}
                  >
                    <CardView def={def} upgraded={c.upgraded} text={text} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="row row--end">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setCardsAt(null);
                dispatch({ type: "skipCards", index: cardsAt });
              }}
            >
              Skip
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}

export function Treasure({ run }: { run: RunState }) {
  const dispatch = useGame((s) => s.dispatch);
  if (run.screen.kind !== "treasure") return null;
  const { relic, taken } = run.screen;
  return (
    <main className="room">
      <div className="room__panel panel">
        <h1>Treasure</h1>
        <p className="muted">Someone left this in the server room.</p>
        <RelicTile id={relic} />
        <div className="row row--end">
          {!taken && (
            <button type="button" className="btn" onClick={() => dispatch({ type: "takeTreasure" })}>
              Take it
            </button>
          )}
          <button type="button" className={`btn${taken ? "" : " btn--ghost"}`} onClick={() => dispatch({ type: "leave" })}>
            {taken ? "Continue" : "Leave it"}
          </button>
        </div>
      </div>
    </main>
  );
}

export function BossRelic({ run }: { run: RunState }) {
  const dispatch = useGame((s) => s.dispatch);
  const content = useContent();
  if (run.screen.kind !== "bossRelic") return null;
  return (
    <main className="room">
      <div className="room__panel room__panel--wide panel">
        <h1>Pick a boss relic</h1>
        <p className="muted">Strong, and some come with a cost. You can take one.</p>
        <ul className="boss-relics">
          {run.screen.choices.map((id, i) => (
            <li key={id}>
              <button type="button" className="tile-btn" onClick={() => dispatch({ type: "pickBossRelic", index: i })} aria-label={`Take ${relicDef(content, id).name}`}>
                <RelicTile id={id} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
