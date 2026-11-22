/* The pieces of the combat screen that only show state: you, the enemies, statuses and infrastructure. */
import type { CombatState, EnemyState, InfraId, Intent, RunState, Statuses as StatusMap, StatusId } from "../../engine/types";
import { Icon, Sprite } from "../art";
import { enemyDef, useContent } from "../content";
import { INFRA, STATUSES, intentText, portrait } from "../labels";
import { Tip } from "../Tip";

/** The attack, with its numbers, leads; the move's other kinds follow as small icons. */
export function IntentBadge({ intent, small = false }: { intent: Intent; small?: boolean }) {
  const kinds = intent.kinds.length > 0 ? intent.kinds : (["unknown"] as const);
  const kind = intent.hit ? "attack" : kinds[0];
  const others = kinds.filter((k) => k !== kind);
  return (
    <span className={`intent-badge intent-badge--${kind}${small ? " intent-badge--small" : ""}`}>
      <Icon name={`intent-${kind}`} size={small ? 16 : 26} />
      {intent.hit && (
        <span className="intent-badge__num">
          {intent.hit.amount}
          {intent.hit.times > 1 && <small>x{intent.hit.times}</small>}
        </span>
      )}
      {others.map((k) => (
        <Icon key={k} name={`intent-${k}`} size={small ? 12 : 18} />
      ))}
    </span>
  );
}

export function Statuses({ statuses, label }: { statuses: StatusMap; label: string }) {
  const list = (Object.entries(statuses) as [StatusId, number][]).filter(([, n]) => n);
  if (list.length === 0) return null;
  return (
    <ul className="statuses" aria-label={label}>
      {list.map(([id, n]) => {
        const s = STATUSES[id];
        return (
          <li key={id}>
            <Tip content={<><strong>{s.name} {n}</strong><span>{s.text}</span></>}>
              <span className={`status ${s.bad ? "status--bad" : "status--good"}`} tabIndex={0} role="img" aria-label={`${s.name} ${n}`}>
                <Icon name={`status-${id}`} size={16} />
                <span aria-hidden="true">{n}</span>
              </span>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}

export function Meter({ value, max, tone, label }: { value: number; max: number; tone: "budget" | "load"; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter meter--${tone}${tone === "budget" && pct <= 25 ? " is-low" : ""}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="meter__fill" style={{ width: `${pct}%` }} />
      <span className="meter__text" aria-hidden="true">
        {value}/{max}
      </span>
    </div>
  );
}

export function PlayerPanel({ run, combat }: { run: RunState; combat: CombatState }) {
  const content = useContent();
  const who = content.characters[run.character];
  return (
    <section className="player panel" data-fx="player" aria-label="You">
      <div className="player__who">
        <img src={portrait(run.character)} alt="" width={44} height={44} />
        <div>
          <strong>{who.name}</strong>
          <span className="muted small">{who.role}</span>
        </div>
      </div>
      <div className="player__budget" data-fx="budget">
        <span className="label">Error Budget</span>
        <Meter value={run.budget} max={run.maxBudget} tone="budget" label="Error Budget" />
      </div>
      <div className="player__row">
        <Tip content={<><strong>Capacity</strong><span>Absorbs incoming requests before they burn Error Budget. Resets each turn.</span></>}>
          <div className="capacity" data-fx="capacity" data-tutorial="capacity" tabIndex={0} role="group" aria-label={`Capacity ${combat.capacity}`}>
            <Icon name="capacity" size={28} />
            <strong aria-hidden="true">{combat.capacity}</strong>
            <span aria-hidden="true">Capacity</span>
          </div>
        </Tip>
        <Statuses statuses={combat.statuses} label="Your statuses" />
      </div>
    </section>
  );
}

export function InfraTray({ combat }: { combat: CombatState }) {
  const list = (Object.entries(combat.infra) as [InfraId, NonNullable<CombatState["infra"][InfraId]>][]).filter(([, s]) => s.stacks > 0);
  return (
    <section className="infra panel" aria-labelledby="infra-title">
      <h2 id="infra-title" className="panel-title">
        Infrastructure
      </h2>
      {list.length === 0 ? (
        <p className="muted small">Nothing installed yet. Infrastructure cards add to it.</p>
      ) : (
        <ul className="infra__list">
          {list.map(([id, s]) => {
            const info = INFRA[id];
            const parts = [`${info.name}, ${s.stacks} ${s.stacks === 1 ? "stack" : "stacks"}`];
            if (s.warmth !== undefined) parts.push(`warmth ${s.warmth}`);
            if (s.disabled > 0) parts.push(`down for ${s.disabled} ${s.disabled === 1 ? "turn" : "turns"}`);
            return (
              <li key={id}>
                <Tip content={<><strong>{info.name}</strong><span>{info.text}</span>{s.disabled > 0 && <span className="bad">Disabled by a Node Failure.</span>}</>}>
                  <span className={`infra-chip${s.disabled > 0 ? " is-down" : ""}`} data-infra={id} tabIndex={0} role="img" aria-label={parts.join(", ")}>
                    <Icon name={`infra-${id}`} size={20} />
                    <span className="infra-chip__name" aria-hidden="true">{info.name}</span>
                    <span className="infra-chip__meta" aria-hidden="true">
                      {s.stacks > 1 && <b>x{s.stacks}</b>}
                      {s.warmth !== undefined && <span className="warm">{s.warmth} warm</span>}
                      {s.disabled > 0 && <span className="down">Down {s.disabled}</span>}
                    </span>
                  </span>
                </Tip>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function EnemyView({
  enemy,
  first,
  targetable,
  isTarget,
  onTarget,
}: {
  enemy: EnemyState;
  first: boolean;
  targetable: boolean;
  isTarget: boolean;
  onTarget: () => void;
}) {
  const content = useContent();
  const def = enemyDef(content, enemy.id);
  const moveName = (intent: Intent) => def.moves[intent.move]?.name ?? intent.move;
  const describe = `${def.name}, Load ${enemy.load} of ${enemy.maxLoad}${enemy.buffer ? `, Buffer ${enemy.buffer}` : ""}`;
  const cls = ["enemy", enemy.resolved && "is-resolved", targetable && "is-targetable", isTarget && "is-target"].filter(Boolean).join(" ");
  return (
    <div className={cls} data-enemy-key={enemy.key}>
      <div className="enemy__intent" data-tutorial={first ? "intent" : undefined}>
        {!enemy.resolved && (
          <>
            <Tip content={<><strong>Next: {moveName(enemy.intent)}</strong><span>{intentText(enemy.intent)}</span></>}>
              <span className="intent" tabIndex={0} role="img" aria-label={`Intent: ${moveName(enemy.intent)}. ${intentText(enemy.intent)}`}>
                <IntentBadge intent={enemy.intent} />
              </span>
            </Tip>
            {enemy.upcoming.length > 0 && (
              <ol className="intent__next" aria-label={`Then: ${enemy.upcoming.map((u) => `${moveName(u)}. ${intentText(u)}`).join("; ")}`}>
                {enemy.upcoming.map((u, i) => (
                  <li key={i} aria-hidden="true">
                    <IntentBadge intent={u} small />
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
      <Tip content={enemy.resolved ? null : <><strong>{def.name}</strong><span>{def.description}</span></>}>
        <button
          type="button"
          className="enemy__body"
          aria-disabled={!targetable}
          aria-label={targetable ? `Target ${describe}` : enemy.resolved ? `${def.name}, resolved` : describe}
          tabIndex={targetable ? 0 : -1}
          onClick={() => targetable && onTarget()}
        >
          <span className="enemy__sprite">
            <Sprite name={def.sprite} size={120} />
          </span>
        </button>
      </Tip>
      <div className="enemy__name">{def.name}</div>
      {enemy.resolved ? (
        <div className="enemy__resolved">Resolved</div>
      ) : (
        <>
          <div className="enemy__bars">
            {enemy.buffer > 0 && (
              <span className="buffer" aria-label={`Buffer ${enemy.buffer}`} role="img">
                <Icon name="capacity" size={14} />
                <span aria-hidden="true">{enemy.buffer}</span>
              </span>
            )}
            <Meter value={enemy.load} max={enemy.maxLoad} tone="load" label={`${def.name} Load`} />
          </div>
          {/* Always there, so enemies with and without statuses line up. */}
          <div className="enemy__statuses">
            <Statuses statuses={enemy.statuses} label={`${def.name} statuses`} />
          </div>
        </>
      )}
    </div>
  );
}
