/* The first screen, and the new-run and history pages reached from it. */
import { useRef, useState } from "react";
import type { CharacterId, Difficulty } from "../../engine/types";
import { useGame, type RunRecord } from "../../game/store";
import { relicDef, useContent } from "../content";
import { Confirm, FullscreenButton } from "../controls";
import { Dialog } from "../Dialog";
import { ACT_NAMES, DIFFICULTIES, difficultyLabel, portrait } from "../labels";
import { SettingsDialog } from "../SettingsDialog";

type Page = "menu" | "newRun";

export function Title() {
  const [page, setPage] = useState<Page>("menu");
  return page === "newRun" ? <NewRun onBack={() => setPage("menu")} /> : <Menu onNewRun={() => setPage("newRun")} />;
}

function Menu({ onNewRun }: { onNewRun: () => void }) {
  const run = useGame((s) => s.run);
  const brokenSave = useGame((s) => s.brokenSave);
  const { resume, abandon, clearFinished, exportBrokenSave, discardBrokenSave } = useGame((s) => s);
  const historyCount = useGame((s) => s.profile.history.length);
  const [dialog, setDialog] = useState<"settings" | "history" | "replace" | null>(null);
  const menu = useRef<HTMLElement>(null);
  const inProgress = Boolean(run && !run.result);

  const discard = () => {
    discardBrokenSave();
    // The focused button goes away with the notice, so move focus to the menu.
    menu.current?.querySelector("button")?.focus();
  };

  const startNew = () => {
    if (inProgress) return setDialog("replace");
    clearFinished();
    onNewRun();
  };

  return (
    <main className="title-screen">
      <div className="title-screen__corner">
        <FullscreenButton />
      </div>
      <img className="title-screen__hero title-screen__hero--left" src={portrait("jordan")} alt="" />
      <img className="title-screen__hero title-screen__hero--right" src={portrait("taylor")} alt="" />
      <div className="title-screen__center">
        <h1 className="logo">99.99 Percent</h1>
        <p className="tagline">Keep the servers up. Keep the users happy.</p>
        <nav className="menu" aria-label="Main menu" ref={menu}>
          {run && (
            <button type="button" className="btn btn--big" onClick={resume}>
              Continue
            </button>
          )}
          <button type="button" className={`btn btn--big${run ? " btn--ghost" : ""}`} onClick={startNew}>
            New run
          </button>
          <button type="button" className="btn btn--big btn--ghost" onClick={() => setDialog("history")}>
            Run history{historyCount ? ` (${historyCount})` : ""}
          </button>
          <button type="button" className="btn btn--big btn--ghost" onClick={() => setDialog("settings")}>
            Settings
          </button>
        </nav>
        {brokenSave && (
          <div className="broken-save panel">
            <p>A saved run couldn't be loaded.</p>
            <button type="button" className="btn btn--small btn--ghost" onClick={exportBrokenSave}>
              Export broken save
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={discard}>
              Discard
            </button>
          </div>
        )}
      </div>
      {dialog === "settings" && <SettingsDialog onClose={() => setDialog(null)} />}
      {dialog === "history" && <History onClose={() => setDialog(null)} />}
      {dialog === "replace" && (
        <Confirm
          title="Start a new run?"
          text="Your current run will end as a loss."
          yes="Abandon and start"
          onNo={() => setDialog(null)}
          onYes={() => {
            abandon();
            clearFinished();
            setDialog(null);
            onNewRun();
          }}
        />
      )}
    </main>
  );
}

function NewRun({ onBack }: { onBack: () => void }) {
  const content = useContent();
  const unlocked = useGame((s) => s.profile.unlocked);
  const newRun = useGame((s) => s.newRun);
  const [character, setCharacter] = useState<CharacterId>("jordan");
  const [difficulty, setDifficulty] = useState<Difficulty>(0);
  const [seed, setSeed] = useState("");
  const level = Math.min(difficulty, unlocked[character]) as Difficulty;
  const name = content.characters[character].name;

  return (
    <main className="new-run">
      <header className="screen-head">
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          Back
        </button>
        <h1>New run</h1>
        <FullscreenButton />
      </header>

      <section aria-labelledby="pick-character">
        <h2 id="pick-character" className="section-title">
          Pick an engineer
        </h2>
        <div className="characters">
          {(["jordan", "taylor"] as const).map((id) => {
            const c = content.characters[id];
            const relic = relicDef(content, c.starterRelic);
            return (
              <button
                key={id}
                type="button"
                className={`character panel${character === id ? " is-selected" : ""}`}
                aria-pressed={character === id}
                onClick={() => setCharacter(id)}
              >
                <img src={portrait(id)} alt="" width={168} height={168} />
                <span className="character__body">
                  <span className="character__name">{c.name}</span>
                  <span className="character__role">{c.role}</span>
                  <span className="character__blurb">{c.blurb}</span>
                  <span className="character__facts">
                    <span>Error Budget {c.maxBudget}</span>
                    <span>
                      Starts with <strong>{relic.name}</strong>
                      {relic.text ? `: ${relic.text}` : ""}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="pick-difficulty" className="difficulty">
        <h2 id="pick-difficulty" className="section-title">
          Uptime target
        </h2>
        <div className="difficulty__levels" role="radiogroup" aria-labelledby="pick-difficulty">
          {DIFFICULTIES.map((d) => {
            const locked = d.level > unlocked[character];
            return (
              <button
                key={d.level}
                type="button"
                role="radio"
                aria-checked={level === d.level}
                className={`level${level === d.level ? " is-selected" : ""}`}
                disabled={locked}
                onClick={() => setDifficulty(d.level)}
              >
                <span className="level__label">{d.label}</span>
                <span className="level__note">{locked ? `Win at ${difficultyLabel((d.level - 1) as Difficulty)} with ${name}` : d.adds}</span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="new-run__foot">
        <label className="seed">
          <span>Seed</span>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random" maxLength={24} spellCheck={false} />
        </label>
        <button type="button" className="btn btn--big" onClick={() => newRun({ character, difficulty: level, seed })}>
          Start run
        </button>
      </footer>
    </main>
  );
}

function History({ onClose }: { onClose: () => void }) {
  const history = useGame((s) => s.profile.history);
  const content = useContent();
  return (
    <Dialog title="Run history" onClose={onClose} wide>
      {history.length === 0 ? (
        <p className="muted center">No finished runs yet.</p>
      ) : (
        <div className="scroll-area">
          <table className="history">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Engineer</th>
                <th scope="col">Target</th>
                <th scope="col">Result</th>
                <th scope="col">Reached</th>
                <th scope="col">Floors</th>
                <th scope="col">Seed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r: RunRecord, i) => (
                <tr key={`${r.endedAt}-${i}`}>
                  <td>{new Date(r.endedAt).toLocaleDateString()}</td>
                  <td>{content.characters[r.character]?.name ?? r.character}</td>
                  <td>{difficultyLabel(r.difficulty)}</td>
                  <td className={r.result === "won" ? "good" : "bad"}>{r.result === "won" ? "IPO" : "Breached"}</td>
                  <td>
                    Act {r.act} {ACT_NAMES[r.act]}
                  </td>
                  <td>{r.stats.floorsClimbed}</td>
                  <td className="mono">{r.seed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
