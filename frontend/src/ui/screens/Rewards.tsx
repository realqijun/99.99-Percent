/* After a fight: rewards. Also the treasure room and the boss relic choice. */
import { useState } from "react";
import type { Content, RewardItem, RunState } from "../../engine/types";
import { cardText } from "../../engine";
import { useGame } from "../../game/store";
import { Icon } from "../art";
import { cardLabel, baseCost } from "../cards";
import { CardView } from "../CardView";
import { cardDef, enemyDef, relicDef, runbookDef, useContent } from "../content";
import { Dialog } from "../Dialog";
import { RelicTile } from "../Tiles";

function rewardLabel(item: RewardItem, content: Content): { name: string; text: string } {
  switch (item.kind) {
    case "cash": return { name: `${item.amount} cash`, text: "" };
    case "cards": return { name: "Add a card to your deck", text: "" };
    case "relic": return { name: `Relic: ${relicDef(content, item.relic).name}`, text: relicDef(content, item.relic).text };
    case "runbook": return { name: `Runbook: ${runbookDef(content, item.runbook).name}`, text: runbookDef(content, item.runbook).text };
  }
}

/** What the fight was, for the line above the rewards. */
function resolvedLine(run: RunState, content: Content): string | null {
  const node = run.position ? run.map.nodes[run.position] : undefined;
  if (node?.kind === "boss") {
    const boss = content.encounters[run.map.boss]?.enemies[0];
    return `${boss ? enemyDef(content, boss).name : "The boss"} is resolved. Error Budget restored.`;
  }
  if (node?.kind === "major") return "Major Incident resolved.";
  if (node?.kind === "incident" || node?.kind === "event") return "Incident resolved.";
  return null;
}

const REWARD_ICON = { cash: "cash", cards: "deck", relic: "tech-gear", runbook: "runbook" } as const;

export function Reward({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const [cardsAt, setCardsAt] = useState<number | null>(null);
  if (run.screen.kind !== "reward") return null;
  const items = run.screen.items;
  const resolved = resolvedLine(run, content);
  const open = cardsAt !== null ? items[cardsAt] : null;
  const fullRunbooks = run.runbooks.every(Boolean);

  return (
    <main className="room">
      <div className="room__panel panel">
        <h1>Rewards</h1>
        {resolved && <p className="muted">{resolved}</p>}
        <ul className="rewards">
          {items.map((item, i) => {
            const { name, text } = rewardLabel(item, content);
            const icon = item.kind === "relic" ? (`tech-${relicDef(content, item.relic).icon}` as const) : item.kind === "runbook" ? (`tech-${runbookDef(content, item.runbook).icon}` as const) : REWARD_ICON[item.kind];
            const full = item.kind === "runbook" && !item.taken && fullRunbooks;
            const status = item.taken ? "Taken" : full ? "Runbook slots full. Discard one from the top bar first." : "";
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`reward${item.taken ? " is-taken" : ""}`}
                  disabled={item.taken || full}
                  onClick={() => (item.kind === "cards" ? setCardsAt(i) : dispatch({ type: "takeReward", index: i }))}
                  aria-label={[name, text, status].filter(Boolean).join(". ")}
                >
                  <Icon name={icon} size={24} />
                  <span className="reward__body">
                    <span className="reward__name">{name}</span>
                    {text && <span className="reward__text">{text}</span>}
                    {status && <span className="reward__status">{status}</span>}
                  </span>
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
              const text = cardText(def, c.upgraded, undefined, undefined, content);
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
        <p className="muted">Strong, and some come with a cost. Take one, or skip them all.</p>
        <ul className="boss-relics">
          {run.screen.choices.map((id, i) => (
            <li key={id}>
              <button type="button" className="tile-btn" onClick={() => dispatch({ type: "pickBossRelic", index: i })} aria-label={`Take ${relicDef(content, id).name}`}>
                <RelicTile id={id} />
              </button>
            </li>
          ))}
        </ul>
        <div className="row row--end">
          <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: "leave" })}>
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}
