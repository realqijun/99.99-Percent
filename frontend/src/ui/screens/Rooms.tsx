/* The Retro (rest or refactor) and colleague events. */
import { useLayoutEffect, useRef, useState } from "react";
import { cantChoose, cantRetro, retroRecoverAmount } from "../../engine";
import type { RunState } from "../../engine/types";
import { useGame } from "../../game/store";
import { Icon } from "../art";
import { useContent } from "../content";
import { COLLEAGUE_NAMES, portrait } from "../labels";

export function Retro({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  if (run.screen.kind !== "retro") return null;
  const recover = retroRecoverAmount(run, content);
  const cantRest = cantRetro(run, { type: "rest" }, content);
  const cantRefactor = cantRetro(run, { type: "refactor" }, content);
  return (
    <main className="room">
      <div className="room__panel panel">
        <h1>Retro</h1>
        <p className="muted">A quiet hour to look back. Pick one.</p>
        {run.screen.done ? (
          <p className="room__done">Done. Back to work.</p>
        ) : (
          <div className="retro-choices">
            <button type="button" className="big-choice" disabled={cantRest !== null} onClick={() => dispatch({ type: "rest" })}>
              <Icon name="budget" size={32} />
              <strong>Rest</strong>
              <span>{recover > 0 ? `Recover ${recover} Error Budget.` : "Your Error Budget is already full."}</span>
              {cantRest && <span className="bad small">{cantRest}</span>}
            </button>
            <button type="button" className="big-choice" disabled={cantRefactor !== null} onClick={() => dispatch({ type: "refactor" })}>
              <Icon name="type-skill" size={32} />
              <strong>Refactor</strong>
              <span>Upgrade a card in your deck.</span>
              {cantRefactor && <span className="bad small">{cantRefactor}</span>}
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
  const actions = useRef<HTMLDivElement>(null);
  const step = `${shown.lines}:${run.screen.kind === "event" ? run.screen.chosen : ""}`;
  // Next and the choices replace each other; keep keyboard focus on whatever comes next.
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    actions.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, [step]);
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
  const blocked = event.choices.map((_, i) => cantChoose(run, i, content));

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
        <div className="event__actions" ref={actions}>
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
            <>
              <ul className="event__choices">
                {event.choices.map((c, i) => (
                  <li key={i}>
                    <button type="button" className="event-choice" disabled={blocked[i] !== null} onClick={() => dispatch({ type: "eventChoice", index: i })}>
                      <strong>{c.label}</strong>
                      <span>{c.detail}</span>
                      {blocked[i] && <span className="bad small">{blocked[i]}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {blocked.every((reason) => reason !== null) && (
                <div className="row row--end event__leave">
                  <button type="button" className="btn" onClick={() => dispatch({ type: "leave" })}>
                    Leave
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
