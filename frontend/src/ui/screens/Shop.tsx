/* The Vendor: cards, relics and runbooks for cash, and a card removal service. */
import type { RunState } from "../../engine/types";
import { cardText } from "../../engine";
import { useGame } from "../../game/store";
import { Icon } from "../art";
import { baseCost, cardLabel } from "../cards";
import { CardView } from "../CardView";
import { cardDef, relicDef, runbookDef, useContent } from "../content";
import { RelicTile, RunbookTile } from "../Tiles";

function Price({ price, cash, sold }: { price: number; cash: number; sold: boolean }) {
  if (sold) return <span className="price is-sold">Sold</span>;
  return (
    <span className={`price${price > cash ? " is-short" : ""}`}>
      <Icon name="cash" size={14} />
      {price}
    </span>
  );
}

export function Shop({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  if (run.screen.kind !== "shop") return null;
  const shop = run.screen.shop;
  const cash = run.cash;
  const slotsFull = run.runbooks.every(Boolean);
  const why = (price: number, sold: boolean) => (sold ? "sold" : price > cash ? "not enough cash" : "");

  return (
    <main className="shop">
      <header className="screen-head">
        <h1>Vendor</h1>
        <p className="muted">Everything has a price. You have {cash} cash.</p>
        <button type="button" className="btn" onClick={() => dispatch({ type: "leave" })}>
          Leave
        </button>
      </header>

      <section aria-label="Cards for sale">
        <ul className="shop__cards">
          {shop.cards.map((item, i) => {
            const def = cardDef(content, item.card.id);
            const text = cardText(def, item.card.upgraded, undefined, undefined, content);
            const reason = why(item.price, item.sold);
            return (
              <li key={item.card.uid}>
                <button
                  type="button"
                  className={`card-btn${item.sold ? " is-sold" : ""}`}
                  disabled={Boolean(reason)}
                  onClick={() => dispatch({ type: "buyCard", index: i })}
                  aria-label={`Buy ${cardLabel(def, item.card.upgraded, baseCost(def, item.card.upgraded), text)} Price ${item.price}${reason ? `, ${reason}` : ""}.`}
                >
                  <CardView def={def} upgraded={item.card.upgraded} text={text} small />
                </button>
                <Price price={item.price} cash={cash} sold={item.sold} />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="shop__lower">
        <section aria-label="Relics for sale" className="shop__tiles">
          {shop.relics.map((item, i) => {
            const reason = why(item.price, item.sold);
            return (
              <button
                key={item.relic}
                type="button"
                className="tile-btn"
                disabled={Boolean(reason)}
                onClick={() => dispatch({ type: "buyRelic", index: i })}
                aria-label={`Buy ${relicDef(content, item.relic).name}, price ${item.price}${reason ? `, ${reason}` : ""}`}
              >
                <RelicTile id={item.relic}>
                  <Price price={item.price} cash={cash} sold={item.sold} />
                </RelicTile>
              </button>
            );
          })}
        </section>
        <section aria-label="Runbooks for sale" className="shop__tiles">
          {shop.runbooks.map((item, i) => {
            const reason = why(item.price, item.sold) || (slotsFull ? "runbook slots full" : "");
            return (
              <button
                key={`${item.runbook}-${i}`}
                type="button"
                className="tile-btn"
                disabled={Boolean(reason)}
                onClick={() => dispatch({ type: "buyRunbook", index: i })}
                aria-label={`Buy ${runbookDef(content, item.runbook).name}, price ${item.price}${reason ? `, ${reason}` : ""}`}
              >
                <RunbookTile id={item.runbook}>
                  <Price price={item.price} cash={cash} sold={item.sold} />
                </RunbookTile>
              </button>
            );
          })}
        </section>
        <section className="removal panel" aria-labelledby="removal-title">
          <h2 id="removal-title">Remove a card</h2>
          <p className="muted small">Take one card out of your deck for good.</p>
          <button
            type="button"
            className="btn btn--small"
            disabled={shop.removalUsed || shop.removalPrice > cash}
            onClick={() => dispatch({ type: "buyRemoval" })}
          >
            {shop.removalUsed ? "Done for this visit" : `Remove for ${shop.removalPrice}`}
          </button>
          {!shop.removalUsed && shop.removalPrice > cash && <p className="bad small">Not enough cash</p>}
        </section>
      </div>
    </main>
  );
}
