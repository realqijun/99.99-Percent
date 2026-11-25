/* The Vendor: cards, relics and runbooks for cash, and a card removal service. */
import type { RunState } from "../../engine/types";
import { cantBuy, cardText, shopPrice } from "../../engine";
import { useGame } from "../../game/store";
import { Icon } from "../art";
import { baseCost, cardLabel } from "../cards";
import { CardView } from "../CardView";
import { cardDef, relicDef, runbookDef, useContent } from "../content";
import { RelicTile, RunbookTile } from "../Tiles";

/** The price, dimmed when the item can't be bought now. */
function Price({ price, blocked, sold }: { price: number; blocked: boolean; sold: boolean }) {
  if (sold) return <span className="price is-sold">Sold</span>;
  return (
    <span className={`price${blocked ? " is-blocked" : ""}`}>
      <Icon name="cash" size={14} />
      {price}
    </span>
  );
}

/** An item's price, with the reason it can't be bought under it. */
function Offer({ price, reason, sold }: { price: number; reason: string | null; sold: boolean }) {
  return (
    <span className="offer">
      <Price price={price} blocked={reason !== null} sold={sold} />
      {reason && !sold && <span className="bad small">{reason}</span>}
    </span>
  );
}

export function Shop({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  if (run.screen.kind !== "shop") return null;
  const shop = run.screen.shop;
  const priceOf = (basePrice: number) => shopPrice(run, basePrice, content);
  const removalPrice = priceOf(shop.removalBasePrice);
  const removalReason = cantBuy(run, { type: "buyRemoval" }, content);

  return (
    <main className="shop">
      <header className="screen-head">
        <h1>Vendor</h1>
        <p className="muted">Everything has a price. You have {run.cash} cash.</p>
        <button type="button" className="btn" onClick={() => dispatch({ type: "leave" })}>
          Leave
        </button>
      </header>

      <section aria-label="Cards for sale">
        <ul className="shop__cards">
          {shop.cards.map((item, i) => {
            const def = cardDef(content, item.card.id);
            const text = cardText(def, item.card.upgraded, undefined, undefined, content);
            const price = priceOf(item.basePrice);
            const reason = cantBuy(run, { type: "buyCard", index: i }, content);
            return (
              <li key={item.card.uid}>
                <button
                  type="button"
                  className={`card-btn${item.sold ? " is-sold" : ""}`}
                  disabled={reason !== null}
                  onClick={() => dispatch({ type: "buyCard", index: i })}
                  aria-label={`Buy ${cardLabel(def, item.card.upgraded, baseCost(def, item.card.upgraded), text)} Price ${price}${reason ? `. ${reason}` : ""}.`}
                >
                  <CardView def={def} upgraded={item.card.upgraded} text={text} small />
                </button>
                <Offer price={price} reason={reason} sold={item.sold} />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="shop__lower">
        <section aria-label="Relics for sale" className="shop__tiles">
          {shop.relics.map((item, i) => {
            const price = priceOf(item.basePrice);
            const reason = cantBuy(run, { type: "buyRelic", index: i }, content);
            return (
              <button
                key={item.relic}
                type="button"
                className="tile-btn"
                disabled={reason !== null}
                onClick={() => dispatch({ type: "buyRelic", index: i })}
                aria-label={`Buy ${relicDef(content, item.relic).name}, price ${price}${reason ? `. ${reason}` : ""}`}
              >
                <RelicTile id={item.relic}>
                  <Offer price={price} reason={reason} sold={item.sold} />
                </RelicTile>
              </button>
            );
          })}
        </section>
        <section aria-label="Runbooks for sale" className="shop__tiles">
          {shop.runbooks.map((item, i) => {
            const price = priceOf(item.basePrice);
            const reason = cantBuy(run, { type: "buyRunbook", index: i }, content);
            return (
              <button
                key={`${item.runbook}-${i}`}
                type="button"
                className="tile-btn"
                disabled={reason !== null}
                onClick={() => dispatch({ type: "buyRunbook", index: i })}
                aria-label={`Buy ${runbookDef(content, item.runbook).name}, price ${price}${reason ? `. ${reason}` : ""}`}
              >
                <RunbookTile id={item.runbook}>
                  <Offer price={price} reason={reason} sold={item.sold} />
                </RunbookTile>
              </button>
            );
          })}
        </section>
        <section className="removal panel" aria-labelledby="removal-title">
          <h2 id="removal-title">Remove a card</h2>
          <p className="muted small">Take one card out of your deck for good.</p>
          <button type="button" className="btn btn--small" disabled={removalReason !== null} onClick={() => dispatch({ type: "buyRemoval" })}>
            {shop.removalUsed ? "Done for this visit" : `Remove for ${removalPrice}`}
          </button>
          {removalReason && !shop.removalUsed && <p className="bad small">{removalReason}</p>}
        </section>
      </div>
    </main>
  );
}
