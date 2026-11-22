import { useId, useState } from "react";
import { useGame } from "../game/store";
import { Confirm } from "./controls";
import { Dialog } from "./Dialog";

function Volume({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="setting">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={0} max={100} step={5} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <output htmlFor={id}>{Math.round(value * 100)}%</output>
    </div>
  );
}

export function SettingsDialog({ onClose, inRun = false }: { onClose: () => void; inRun?: boolean }) {
  const settings = useGame((s) => s.settings);
  const update = useGame((s) => s.updateSettings);
  const toTitle = useGame((s) => s.toTitle);
  const abandon = useGame((s) => s.abandon);
  const finished = useGame((s) => Boolean(s.run?.result));
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Confirm
        title="Abandon this run?"
        text="The run ends as a loss and can't be resumed."
        yes="Abandon run"
        onNo={() => setConfirming(false)}
        onYes={() => {
          abandon();
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog title="Settings" onClose={onClose}>
      <fieldset className="settings-group">
        <legend>Sound</legend>
        <Volume label="Music" value={settings.music} disabled={settings.muted} onChange={(music) => update({ music })} />
        <Volume label="Sound effects" value={settings.sfx} disabled={settings.muted} onChange={(sfx) => update({ sfx })} />
        <label className="check">
          <input type="checkbox" checked={settings.muted} onChange={(e) => update({ muted: e.target.checked })} />
          Mute all
        </label>
      </fieldset>
      <fieldset className="settings-group">
        <legend>Animation</legend>
        <div className="segmented" role="radiogroup" aria-label="Animation speed">
          {(["normal", "fast"] as const).map((speed) => (
            <label key={speed} className={settings.speed === speed ? "is-on" : ""}>
              <input type="radio" name="speed" value={speed} checked={settings.speed === speed} onChange={() => update({ speed })} />
              {speed === "normal" ? "Normal" : "Fast"}
            </label>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => update({ reducedMotion: e.target.checked })} />
          Reduce motion
        </label>
      </fieldset>
      {inRun && (
        <div className="row row--end">
          {!finished && (
            <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
              Abandon run
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              onClose();
              toTitle();
            }}
          >
            Save and quit
          </button>
        </div>
      )}
    </Dialog>
  );
}
