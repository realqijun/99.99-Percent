/* An in-progress run: the top bar over the screen the engine says we are on. */
import { useState } from "react";
import type { RunState } from "../engine/types";
import { useGame } from "../game/store";
import { PileDialog } from "./CardGrid";
import { sortCards } from "./cards";
import { Combat, type Selection } from "./combat/Combat";
import { runbookDef, useContent } from "./content";
import { DeckChoice } from "./screens/DeckChoice";
import { MapScreen } from "./screens/MapScreen";
import { BossRelic, Reward, Treasure } from "./screens/Rewards";
import { EventScreen, Retro } from "./screens/Rooms";
import { Shop } from "./screens/Shop";
import { Summary } from "./screens/Summary";
import { SettingsDialog } from "./SettingsDialog";
import { TopBar } from "./TopBar";

function Screen({ run, selection, onSelect }: { run: RunState; selection: Selection; onSelect: (s: Selection) => void }) {
  const screen = run.screen;
  switch (screen.kind) {
    case "map": return <MapScreen run={run} />;
    case "combat": return <Combat run={run} combat={screen.combat} selection={selection} onSelect={onSelect} />;
    case "reward": return <Reward run={run} />;
    case "shop": return <Shop run={run} />;
    case "retro": return <Retro run={run} />;
    case "event": return <EventScreen key={screen.event} run={run} />;
    case "treasure": return <Treasure run={run} />;
    case "bossRelic": return <BossRelic run={run} />;
    case "deckChoice": return <DeckChoice key={screen.action} run={run} />;
    case "summary": return <Summary run={run} />;
  }
}

export function Game({ run }: { run: RunState }) {
  const content = useContent();
  const dispatch = useGame((s) => s.dispatch);
  const [dialog, setDialog] = useState<"deck" | "settings" | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const combat = run.screen.kind === "combat" && run.screen.combat.phase === "player" && !run.screen.combat.pending;

  const useRunbook = (slot: number) => {
    const id = run.runbooks[slot];
    if (!id) return;
    if (runbookDef(content, id).target === "enemy") setSelection({ kind: "runbook", slot });
    else dispatch({ type: "useRunbook", slot });
  };

  return (
    <div className={`game game--${run.screen.kind}`}>
      <TopBar run={run} onDeck={() => setDialog("deck")} onSettings={() => setDialog("settings")} onUseRunbook={combat ? useRunbook : undefined} />
      <div className="game__screen">
        <Screen run={run} selection={selection} onSelect={setSelection} />
      </div>
      {dialog === "deck" && <PileDialog title="Deck" cards={sortCards(run.deck, content)} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SettingsDialog inRun onClose={() => setDialog(null)} />}
    </div>
  );
}
