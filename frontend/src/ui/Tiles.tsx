/* Relic and runbook faces for rewards, the shop and boss relic choices. */
import type { ReactNode } from "react";
import { Icon } from "./art";
import { relicDef, runbookDef, useContent } from "./content";

export function RelicTile({ id, children }: { id: string; children?: ReactNode }) {
  const def = relicDef(useContent(), id);
  return (
    <div className={`tile tile--relic tile--${def.rarity}`}>
      <span className="tile__icon">
        <Icon name={`tech-${def.icon}`} size={36} />
      </span>
      <span className="tile__body">
        <strong className="tile__name">{def.name}</strong>
        <span className="tile__kind">{def.rarity === "boss" ? "Boss relic" : "Relic"}</span>
        <span className="tile__text">{def.text}</span>
        {def.flavor && <em className="tile__flavor">{def.flavor}</em>}
      </span>
      {children}
    </div>
  );
}

export function RunbookTile({ id, children }: { id: string; children?: ReactNode }) {
  const def = runbookDef(useContent(), id);
  return (
    <div className="tile tile--runbook">
      <span className="tile__icon">
        <Icon name={`tech-${def.icon}`} size={36} />
      </span>
      <span className="tile__body">
        <strong className="tile__name">{def.name}</strong>
        <span className="tile__kind">Runbook, single use</span>
        <span className="tile__text">{def.text}</span>
      </span>
      {children}
    </div>
  );
}
