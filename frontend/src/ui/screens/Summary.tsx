/* The end of a run: result, stats, seed and the final deck. */
import type { CardType, RunState } from "../../engine/types";
import { useGame } from "../../game/store";
import { cardName, sortCards } from "../cards";
import { cardDef, useContent } from "../content";
import { ACT_NAMES, difficultyLabel, portrait } from "../labels";

export function Summary({ run }: { run: RunState }) {
  const content = useContent();
  const clear = useGame((s) => s.clearFinished);
  const won = run.result === "won";
  const s = run.stats;
  const who = content.characters[run.character];
  const stats: [string, number][] = [
    ["Floors climbed", s.floorsClimbed],
    ["Combats won", s.combatsWon],
    ["Major Incidents", s.elitesWon],
    ["Bosses", s.bossesWon],
    ["Turns", s.turns],
    ["Cards played", s.cardsPlayed],
    ["Error Budget lost", s.budgetLost],
    ["Cash earned", s.cashEarned],
  ];

  // The deck as "name xN" lines.
  const deck: { key: string; name: string; type: CardType; count: number }[] = [];
  for (const c of sortCards(run.deck, content)) {
    const def = cardDef(content, c.id);
    const key = `${c.id}${c.upgraded ? "+" : ""}`;
    const last = deck[deck.length - 1];
    if (last?.key === key) last.count++;
    else deck.push({ key, name: cardName(def, c.upgraded), type: def.type, count: 1 });
  }

  return (
    <main className={`summary summary--${won ? "won" : "lost"}`}>
      <section className="summary__result">
        <img src={portrait(run.character, won)} alt={who.name} width={240} height={240} />
        <h1>{won ? "IPO! You made it." : "SLA breached"}</h1>
        <p className="muted">
          {who.name} at {difficultyLabel(run.difficulty)}, {won ? "through all three acts" : `in Act ${run.act}, ${ACT_NAMES[run.act]}`}.
        </p>
        <p className="summary__seed">
          Seed <span className="mono">{run.seed}</span>
        </p>
        <button type="button" className="btn btn--big" onClick={clear}>
          Back to title
        </button>
      </section>
      <section className="summary__stats panel" aria-labelledby="stats-title">
        <h2 id="stats-title">Stats</h2>
        <dl>
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="summary__deck panel" aria-labelledby="deck-title">
        <h2 id="deck-title">Final deck ({run.deck.length})</h2>
        <ul>
          {deck.map((d) => (
            <li key={d.key} className={`deck-line deck-line--${d.type}`}>
              <span>{d.name}</span>
              {d.count > 1 && <span className="muted">x{d.count}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
