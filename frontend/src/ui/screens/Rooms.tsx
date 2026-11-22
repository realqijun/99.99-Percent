/* The Retro (rest or refactor) and colleague events. */
import { useState } from "react";
import type { RunState } from "../../engine/types";
import { useGame } from "../../game/store";
import { Icon } from "../art";
import { useContent } from "../content";
import { COLLEAGUE_NAMES, portrait } from "../labels";

export function Retro({ run }: { run: RunState }) {
  const dispatch = useGame((s) => s.dispatch);
  if (run.screen.kind !== "retro") return null;
  const pct = run.difficulty >= 3 ? 20 : 30;
  return (
    <main className="room">
      <div className="room__panel panel">
        <h1>Retro</h1>
        <p className="muted">A quiet hour to look back. Pick one.</p>
        {run.screen.done ? (
          <p className="room__done">Done. Back to work.</p>
        ) : (
          <div className="retro-choices">
            <button type="button" className="big-choice" onClick={() => dispatch({ type: "rest" })}>
              <Icon name="budget" size={32} />
              <strong>Rest</strong>
              <span>Recover {pct}% of your max Error Budget.</span>
            </button>
            <button type="button" className="big-choice" onClick={() => dispatch({ type: "refactor" })}>
              <Icon name="type-skill" size={32} />
              <strong>Refactor</strong>
              <span>Upgrade a card in your deck.</span>
            </button>
          </div>
        )}
        <div className="row row--end">
          <button type="button" className={`btn${run.screen.done ? "" : " btn--ghost"}`} onClick={() => dispatch({ type: "leave" })}>
            {run.screen.done ? "Continue" : "Skip"}
          </button>
        </div>
      </div>
    </main>
  );
}

export function EventScreen({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const eventId = run.screen.kind === "event" ? run.screen.event : "";
  const [shown, setShown] = useState({ event: eventId, lines: 1 });
  if (run.screen.kind !== "event") return null;
  const event = content.events[eventId];
  const { chosen } = run.screen;
  if (!event) {
    return (
      <main className="room">
        <div className="room__panel panel">
          <h1>Nothing here</h1>
          <button type="button" className="btn" onClick={() => dispatch({ type: "leave" })}>
            Continue
          </button>
        </div>
      </main>
    );
  }
  const lines = chosen !== null ? event.lines.length : shown.event === eventId ? shown.lines : 1;
  const allShown = lines >= event.lines.length;
  const speaker = COLLEAGUE_NAMES[event.speaker];
  const choice = chosen !== null ? event.choices[chosen] : null;

  return (
    <main className="event">
      <img className="event__portrait" src={portrait(event.speaker, chosen !== null)} alt={speaker} width={420} height={420} />
      <section className="event__talk panel" aria-labelledby="event-title">
        <h1 id="event-title">{event.title}</h1>
        <p className="event__speaker">{speaker}</p>
        <div className="event__lines" aria-live="polite">
          {event.lines.slice(0, lines).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {choice && (
            <>
              <p className="event__you">You: {choice.label}</p>
              <p>{choice.reply}</p>
            </>
          )}
        </div>
        {choice ? (
          <div className="row row--end">
            <button type="button" className="btn" onClick={() => dispatch({ type: "leave" })}>
              Continue
            </button>
          </div>
        ) : !allShown ? (
          <div className="row row--end">
            <button type="button" className="btn" onClick={() => setShown({ event: eventId, lines: lines + 1 })}>
              Next
            </button>
          </div>
        ) : (
          <ul className="event__choices">
            {event.choices.map((c, i) => {
              const short = c.requires?.cash !== undefined && run.cash < c.requires.cash ? `Needs ${c.requires.cash} cash` : c.requires?.budget !== undefined && run.budget < c.requires.budget ? `Needs ${c.requires.budget} Error Budget` : null;
              return (
                <li key={i}>
                  <button type="button" className="event-choice" disabled={short !== null} onClick={() => dispatch({ type: "eventChoice", index: i })}>
                    <strong>{c.label}</strong>
                    <span>{c.detail}</span>
                    {short && <span className="bad small">{short}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
