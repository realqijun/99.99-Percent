/* The bar above every in-run screen: Error Budget, cash, where you are, relics, runbooks, deck and settings. */
import { useEffect, useRef, useState } from "react";
import type { RunState } from "../engine/types";
import { useGame } from "../game/store";
import { Icon } from "./art";
import { relicDef, runbookDef, useContent } from "./content";
import { FullscreenButton } from "./controls";
import { ACT_NAMES, plural } from "./labels";
import { Tip } from "./Tip";

function floorLabel(run: RunState): string {
  const node = run.position ? run.map.nodes[run.position] : null;
  if (!node) return "Start";
  return node.kind === "boss" ? "Boss" : `Floor ${node.floor}`;
}

export function TopBar({
  run,
  onDeck,
  onSettings,
  onUseRunbook,
}: {
  run: RunState;
  onDeck: () => void;
  onSettings: () => void;
  /** Use the runbook in a slot; only offered in combat. */
  onUseRunbook?: (slot: number) => void;
}) {
  const content = useContent();
  return (
    <header className="topbar">
      <div className="topbar__group">
        <span className="stat stat--budget" aria-label={`Error Budget ${run.budget} of ${run.maxBudget}`}>
          <Icon name="budget" size={20} />
          <span aria-hidden="true">
            {run.budget}
            <small>/{run.maxBudget}</small>
          </span>
        </span>
        <span className="stat stat--cash" aria-label={`${run.cash} cash`}>
          <Icon name="cash" size={20} />
          <span aria-hidden="true">{run.cash}</span>
        </span>
        <span className="topbar__where">
          <strong>Act {run.act}</strong> {ACT_NAMES[run.act]} <span className="sep">|</span> {floorLabel(run)}
        </span>
      </div>

      <ul className="topbar__relics" aria-label="Relics">
        {run.relics.map((r, i) => {
          const def = relicDef(content, r.id);
          return (
            <li key={`${r.id}-${i}`}>
              <Tip
                content={
                  <>
                    <strong>{def.name}</strong>
                    <span>{def.text}</span>
                  </>
                }
              >
                <span className="relic" tabIndex={0} role="img" aria-label={def.name}>
                  <Icon name={`tech-${def.icon}`} size={24} />
                  {def.every ? <span className="relic__count">{r.counter}</span> : null}
                </span>
              </Tip>
            </li>
          );
        })}
      </ul>

      <div className="topbar__group">
        <Runbooks run={run} onUse={onUseRunbook} />
        <button type="button" className="btn btn--ghost btn--small" onClick={onDeck} aria-label={`Deck, ${plural(run.deck.length, "card")}`}>
          <Icon name="deck" size={18} />
          <span aria-hidden="true">{run.deck.length}</span>
        </button>
        <button type="button" className="icon-btn" onClick={onSettings} aria-label="Settings">
          <Icon name="settings" size={20} />
        </button>
        <FullscreenButton />
      </div>
    </header>
  );
}

function Runbooks({ run, onUse }: { run: RunState; onUse?: (slot: number) => void }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <ul className="runbooks" aria-label="Runbooks" ref={ref}>
      {run.runbooks.map((id, slot) => {
        if (!id) {
          return (
            <li key={slot}>
              <span className="runbook runbook--empty" role="img" aria-label="Empty runbook slot" />
            </li>
          );
        }
        const def = runbookDef(content, id);
        return (
          <li key={slot} className="runbook-slot">
            <Tip content={open === slot ? null : <><strong>{def.name}</strong><span>{def.text}</span></>}>
              <button type="button" className="runbook" aria-label={`Runbook: ${def.name}`} aria-expanded={open === slot} onClick={() => setOpen(open === slot ? null : slot)}>
                <Icon name={`tech-${def.icon}`} size={22} />
              </button>
            </Tip>
            {open === slot && (
              <div className="runbook-menu panel" role="group" aria-label={def.name}>
                <strong>{def.name}</strong>
                <p>{def.text}</p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={!onUse}
                    onClick={() => {
                      setOpen(null);
                      onUse?.(slot);
                    }}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      setOpen(null);
                      dispatch({ type: "discardRunbook", slot });
                    }}
                  >
                    Discard
                  </button>
                </div>
                {!onUse && <p className="muted small">Runbooks are used in combat.</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
