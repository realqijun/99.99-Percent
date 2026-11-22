/* The hand, fanned along the bottom. Click to pick a card, or drag it up to play it. */
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CardInstance, CombatState, RunState } from "../../engine/types";
import { cantPlay, cardText, costNow } from "../../engine";
import { cardLabel } from "../cards";
import { CardView } from "../CardView";
import { cardDef, useContent } from "../content";
import { useStage, type StageRect } from "../stageContext";
import { Tip } from "../Tip";

export const HAND_WIDTH = 800;
const CARD_W = 160;
/** Room each side for the outer cards' tilt, so a full hand stays clear of the piles. */
const TILT_ROOM = 40;
const DRAG_PLAY = 110;

interface Drag {
  uid: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  moved: boolean;
}

export function Hand({
  run,
  combat,
  selected,
  target,
  onPick,
  onDrop,
  rects,
}: {
  run: RunState;
  combat: CombatState;
  selected: number | null;
  /** The enemy the selected card would hit, for its text. */
  target?: number;
  onPick: (uid: number) => void;
  /** A card dragged up and let go, over an enemy or not. */
  onDrop: (uid: number, enemy: number | undefined) => void;
  /** Last known position of each card, for the play animation. */
  rects: Map<number, StageRect>;
}) {
  const content = useContent();
  const stage = useStage();
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A drag ends with a click event; this stops that click from also picking the card.
  const dragged = useRef(false);
  const n = combat.hand.length;
  const spacing = n > 1 ? Math.min(CARD_W - 8, (HAND_WIDTH - CARD_W - 2 * TILT_ROOM) / (n - 1)) : 0;

  useLayoutEffect(() => {
    const root = ref.current?.closest(".combat");
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const s = stage.scale || 1;
    for (const el of ref.current!.querySelectorAll<HTMLElement>("[data-uid]")) {
      const r = el.getBoundingClientRect();
      rects.set(Number(el.dataset.uid), { x: (r.left - origin.left) / s, y: (r.top - origin.top) / s, width: r.width / s, height: r.height / s });
    }
  });

  const down = (e: ReactPointerEvent, card: CardInstance) => {
    if (e.button !== 0) return;
    dragged.current = false;
    setDrag({ uid: card.uid, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const s = stage.scale || 1;
    const dx = (e.clientX - drag.x) / s;
    const dy = (e.clientY - drag.y) / s;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) + Math.abs(dy) > 8 });
  };
  const up = (e: ReactPointerEvent) => {
    if (!drag) return;
    const { uid, dy, moved } = drag;
    setDrag(null);
    dragged.current = moved;
    if (!moved || dy > -DRAG_PLAY) return;
    const over = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el instanceof HTMLElement && el.dataset.enemyKey);
    onDrop(uid, over instanceof HTMLElement ? Number(over.dataset.enemyKey) : undefined);
  };

  return (
    <div className="hand" ref={ref} data-tutorial="hand" role="group" aria-label={`Hand, ${n} ${n === 1 ? "card" : "cards"}`}>
      {combat.hand.map((card, i) => {
        const def = cardDef(content, card.id);
        const reason = cantPlay(run, card.uid, content);
        const cost = costNow(run, card.uid, content);
        const isSel = selected === card.uid;
        const text = cardText(def, card.upgraded, combat, isSel ? target : undefined, content);
        const mid = (n - 1) / 2;
        const off = i - mid;
        const x = HAND_WIDTH / 2 - CARD_W / 2 + off * spacing;
        const dragging = drag?.uid === card.uid && drag.moved;
        const style = dragging
          ? { left: x, transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 60 }
          : { left: x, transform: `translateY(${isSel ? -34 : mid ? (off / mid) ** 2 * 22 : 0}px) rotate(${isSel ? 0 : off * Math.min(3, 18 / n)}deg)`, zIndex: isSel ? 50 : i + 1 };
        return (
          <Tip key={card.uid} content={reason}>
            <button
              type="button"
              data-uid={card.uid}
              className={`hand-card${isSel ? " is-selected" : ""}${reason ? " is-unplayable" : ""}${dragging ? " is-dragging" : ""}`}
              style={style}
              aria-label={`${i < 9 ? `${i + 1}: ` : ""}${cardLabel(def, card.upgraded, cost, text)}${reason && cost !== null ? ` Can't play: ${reason}.` : ""}`}
              aria-pressed={isSel}
              aria-disabled={reason !== null}
              onClick={() => {
                if (!dragged.current) onPick(card.uid);
                dragged.current = false;
              }}
              onPointerDown={(e) => !reason && down(e, card)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => setDrag(null)}
            >
              <CardView def={def} upgraded={card.upgraded} text={text} cost={cost} />
              {i < 9 && <kbd className="hand-card__key">{i + 1}</kbd>}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
