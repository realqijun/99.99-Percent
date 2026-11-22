/* Small shared controls: fullscreen, the error toast and a confirm dialog. */
import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { Icon } from "./art";
import { Dialog } from "./Dialog";

export function FullscreenButton() {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => {
    const request = on ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    request.catch(() => {});
  };
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={on ? "Exit fullscreen" : "Fullscreen"} aria-pressed={on}>
      <Icon name="fullscreen" size={20} />
    </button>
  );
}

const TOAST_MS = 2600;

export function Toast() {
  const error = useGame((s) => s.error);
  const dismiss = useGame((s) => s.dismissError);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => dismiss(error.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [error, dismiss]);
  return (
    <div className="toast-slot" role="alert">
      {error && (
        <p className="toast" key={error.id}>
          {error.message}
        </p>
      )}
    </div>
  );
}

export function Confirm({ title, text, yes, onYes, onNo }: { title: string; text: string; yes: string; onYes: () => void; onNo: () => void }) {
  return (
    <Dialog title={title} onClose={onNo}>
      <p className="dialog__text">{text}</p>
      <div className="row row--end">
        <button type="button" className="btn btn--ghost" onClick={onNo} data-autofocus>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={onYes}>
          {yes}
        </button>
      </div>
    </Dialog>
  );
}
