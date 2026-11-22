/*
 * The combat screen. Pick a card (click or 1-9), then an enemy if it needs one (click, Tab or arrows), then
 * play it (click again, Enter, or drag up). E ends the turn, Esc cancels.
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { CombatState, RunState } from "../../engine/types";
import { cantPlay } from "../../engine";
import { useGame } from "../../game/store";
import { Icon } from "../art";
import { PileDialog } from "../CardGrid";
import { sortCards } from "../cards";
import { cardDef, runbookDef, useContent } from "../content";
import { WORKLOADS, plural } from "../labels";
import type { StageRect } from "../stageContext";
import { Tip } from "../Tip";
import { ChoiceDialog } from "./ChoiceDialog";
import { FxLayer } from "./FxLayer";
import { Hand } from "./Hand";
import { EnemyView, InfraTray, PlayerPanel } from "./parts";
import { Tutorial } from "./Tutorial";
import { useFx } from "./useFx";

export type Selection = { kind: "card"; uid: number } | { kind: "runbook"; slot: number } | null;

type Pile = "draw" | "discard" | "decommissioned";

export function Combat({ run, combat, selection, onSelect }: { run: RunState; combat: CombatState; selection: Selection; onSelect: (s: Selection) => void }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const root = useRef<HTMLDivElement>(null);
  const [rects] = useState(() => new Map<number, StageRect>());
  const [pile, setPile] = useState<Pile | null>(null);
  const [targetKey, setTargetKey] = useState<number | null>(null);
  const fx = useFx(root, rects);

  const alive = combat.enemies.filter((e) => !e.resolved);
  const playerTurn = combat.phase === "player" && !combat.pending;

  // Drop a selection that no longer points at anything (the card left the hand, the runbook was used).
  const card = selection?.kind === "card" ? combat.hand.find((c) => c.uid === selection.uid) : undefined;
  const runbook = selection?.kind === "runbook" ? run.runbooks[selection.slot] : null;
  const sel: Selection = playerTurn && (card || runbook) ? selection : null;
  const needsTarget = card ? cardDef(content, card.id).target === "enemy" : runbook ? runbookDef(content, runbook).target === "enemy" : false;
  const target = needsTarget ? (alive.find((e) => e.key === targetKey) ?? alive[0]) : undefined;

  const play = (s: NonNullable<Selection>, enemy?: number) => {
    onSelect(null);
    if (s.kind === "card") dispatch({ type: "playCard", uid: s.uid, target: enemy });
    else dispatch({ type: "useRunbook", slot: s.slot, target: enemy });
  };

  const pick = (uid: number) => {
    if (!playerTurn) return;
    const reason = cantPlay(run, uid, content);
    if (reason) return;
    const def = cardDef(content, combat.hand.find((c) => c.uid === uid)!.id);
    if (sel?.kind === "card" && sel.uid === uid) {
      if (def.target === "enemy") onSelect(null);
      else play(sel);
      return;
    }
    onSelect({ kind: "card", uid });
  };

  const drop = (uid: number, enemy: number | undefined) => {
    if (!playerTurn || cantPlay(run, uid, content)) return;
    const def = cardDef(content, combat.hand.find((c) => c.uid === uid)!.id);
    const s = { kind: "card", uid } as const;
    if (def.target !== "enemy") play(s);
    else if (enemy !== undefined && alive.some((e) => e.key === enemy)) play(s, enemy);
    else onSelect(s);
  };

  const endTurn = () => {
    if (!playerTurn) return;
    onSelect(null);
    dispatch({ type: "endTurn" });
  };

  // Keyboard play. Ignored while a dialog is open or a field has focus.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
    if (/^[1-9]$/.test(e.key)) {
      const c = combat.hand[Number(e.key) - 1];
      if (c && playerTurn && !cantPlay(run, c.uid, content)) onSelect({ kind: "card", uid: c.uid });
      e.preventDefault();
    } else if ((e.key === "Tab" || e.key.startsWith("Arrow")) && sel && needsTarget && alive.length > 0) {
      const back = e.key === "ArrowLeft" || e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey);
      const i = Math.max(0, alive.findIndex((x) => x.key === target?.key));
      setTargetKey(alive[(i + (back ? alive.length - 1 : 1)) % alive.length].key);
      e.preventDefault();
    } else if (e.key === "Enter" && sel) {
      if (!needsTarget || target) play(sel, target?.key);
      e.preventDefault();
    } else if (e.key === "e" || e.key === "E") {
      endTurn();
      e.preventDefault();
    } else if (e.key === "Escape" && sel) {
      onSelect(null);
      e.preventDefault();
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const workload = WORKLOADS[combat.workload];
  const piles: { id: Pile; label: string; icon: "drawPile" | "discardPile" | "decommissioned"; cards: typeof combat.hand }[] = [
    { id: "draw", label: "Draw pile", icon: "drawPile", cards: combat.drawPile },
    { id: "discard", label: "Discard pile", icon: "discardPile", cards: combat.discardPile },
    { id: "decommissioned", label: "Decommissioned", icon: "decommissioned", cards: combat.decommissioned },
  ];
  const pileButton = (p: (typeof piles)[number]) => (
    <button key={p.id} type="button" className={`pile pile--${p.id}`} data-fx={p.id === "draw" ? "draw" : undefined} onClick={() => setPile(p.id)} aria-label={`${p.label}, ${plural(p.cards.length, "card")}`}>
      <Icon name={p.icon} size={22} />
      <span className="pile__count" aria-hidden="true">
        {p.cards.length}
      </span>
      <span className="pile__label" aria-hidden="true">
        {p.label}
      </span>
    </button>
  );
  const shown = piles.find((p) => p.id === pile);
  const selName = card ? cardDef(content, card.id).name : runbook ? runbookDef(content, runbook).name : "";

  return (
    <main className={`combat${sel && needsTarget ? " is-targeting" : ""}`} ref={root} aria-label="Combat">
      <div className="combat__left">
        <PlayerPanel run={run} combat={combat} />
        <InfraTray combat={combat} />
      </div>

      <section className="combat__field" aria-label="Incidents">
        <div className="combat__info">
          <Tip content={<><strong>{workload.name}</strong><span>{workload.text}</span></>}>
            <span className={`workload workload--${combat.workload}`} tabIndex={0} role="img" aria-label={`${workload.name}. ${workload.text}`}>
              <Icon name={`workload-${combat.workload}`} size={18} />
              <span aria-hidden="true">{workload.name}</span>
            </span>
          </Tip>
          <span className="turn">Turn {combat.turn}</span>
          <p className="combat__hint" aria-live="polite">
            {sel && needsTarget ? `Pick a target for ${selName}. Enter plays, Esc cancels.` : sel ? `Click ${selName} again or press Enter to play it.` : ""}
          </p>
        </div>
        <div className="enemies">
          {combat.enemies.map((e, i) => (
            <EnemyView
              key={e.key}
              enemy={e}
              first={i === combat.enemies.findIndex((x) => !x.resolved)}
              targetable={Boolean(sel && needsTarget && !e.resolved)}
              isTarget={Boolean(sel && target?.key === e.key)}
              onTarget={() => sel && play(sel, e.key)}
            />
          ))}
        </div>
      </section>

      <div className="combat__bottom">
        <div className="combat__pilesLeft">
          <div className="engineers" role="img" aria-label={`Engineers ${combat.engineers} of ${combat.engineersPerTurn}`}>
            <Icon name="engineers" size={26} />
            <strong aria-hidden="true">
              {combat.engineers}
              <small>/{combat.engineersPerTurn}</small>
            </strong>
            <span aria-hidden="true">Engineers</span>
          </div>
          {pileButton(piles[0])}
        </div>
        <Hand run={run} combat={combat} selected={sel?.kind === "card" ? sel.uid : null} target={target?.key} onPick={pick} onDrop={drop} rects={rects} />
        <div className="combat__pilesRight">
          <button type="button" className="btn btn--end" onClick={endTurn} disabled={!playerTurn} data-tutorial="endTurn">
            End turn <kbd>E</kbd>
          </button>
          <div className="row">
            {pileButton(piles[1])}
            {pileButton(piles[2])}
          </div>
        </div>
      </div>

      {combat.phase !== "player" && (
        <div className={`combat__banner combat__banner--${combat.phase}`} role="status">
          {combat.phase === "won" ? "Incident resolved" : "SLA breached"}
        </div>
      )}
      <FxLayer items={fx} />
      {combat.tutorial !== null && !combat.pending && <Tutorial step={combat.tutorial} handSize={combat.hand.length} />}
      {combat.pending && <ChoiceDialog key={JSON.stringify(combat.pending.source)} run={run} combat={combat} pending={combat.pending} />}
      {shown && (
        <PileDialog
          title={shown.label}
          cards={shown.id === "draw" ? sortCards(shown.cards, content) : shown.cards}
          combat={combat}
          onClose={() => setPile(null)}
          note={shown.id === "draw" ? "Shown in deck order, not draw order." : shown.id === "decommissioned" ? "Gone for the rest of this combat." : undefined}
        />
      )}
    </main>
  );
}
