/*
 * Dev only (imported from main.tsx behind import.meta.env.DEV, so builds leave it out): the itch.io
 * key art, drawn from the game's own logo, sprites and cards so it stays in sync with them.
 * `?cover` shows the 630x500 cover and `?banner` the 960x250 page banner; `npm run itch:media`
 * screenshots them.
 */
import { CONTENT } from "../content";
import { cardText, type Intent } from "../engine";
import { Sprite } from "../ui/art";
import { CardView } from "../ui/CardView";
import { IntentBadge } from "../ui/combat/parts";
import { cardDef } from "../ui/content";
import "../ui/ui.css";
import "./StoreArt.css";

export type StoreArtKind = "cover" | "banner";

const SIZES: Record<StoreArtKind, { width: number; height: number }> = {
  cover: { width: 630, height: 500 },
  banner: { width: 960, height: 250 },
};

/** Sprites are 32 pixels square, so whole multiples of 32 keep every pixel the same size. */
const PIXEL = 32;

const attack = (amount: number, times = 1): Intent => ({ move: "", kinds: ["attack"], hit: { amount, times } });

function Card({ id, upgraded = false }: { id: string; upgraded?: boolean }) {
  const def = cardDef(CONTENT, id);
  return <CardView def={def} upgraded={upgraded} text={cardText(def, upgraded)} />;
}

/** A flat shadow with stepped ends, in whole sprite pixels, as a clip-path. */
function shadowShape(width: number, step: number): string {
  const insets = [2, 0, 0, 2].map((n) => n * step);
  const left = insets.flatMap((inset, row) => [`${inset}px ${row * step}px`, `${inset}px ${(row + 1) * step}px`]);
  const right = insets.map((inset, row) => [`${width - inset}px ${(row + 1) * step}px`, `${width - inset}px ${row * step}px`]).reverse().flat();
  return `polygon(${[...left, ...right].join(", ")})`;
}

/** An enemy standing on a stepped pixel shadow, with its intent above it. */
function Enemy({ name, scale, intent, x, y }: { name: string; scale: number; intent?: Intent; x: number; y: number }) {
  const size = PIXEL * scale;
  const shadow = scale * 22;
  return (
    <div className="store-art__enemy" style={{ left: x, top: y, width: size }}>
      {intent && <IntentBadge intent={intent} />}
      <div className="store-art__sprite" style={{ height: size }}>
        <span className="store-art__shadow" style={{ width: shadow, height: scale * 4, clipPath: shadowShape(shadow, scale) }} />
        <Sprite name={name} size={size} />
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="store-art__brand">
      <h1 className="logo store-art__logo">99.99 Percent</h1>
      <p className="store-art__tagline">A roguelike deckbuilder about keeping the servers up.</p>
    </div>
  );
}

export function StoreArt({ kind }: { kind: StoreArtKind }) {
  const { width, height } = SIZES[kind];
  return (
    <div className={`store-art store-art--${kind}`} style={{ width, height }} data-store-art={kind}>
      <Logo />
      {kind === "cover" ? (
        <>
          <div className="store-art__hand">
            <Card id="serve" upgraded />
            <Card id="loadBalancer" />
          </div>
          <Enemy name="launchDay" scale={6} intent={attack(8, 3)} x={404} y={150} />
          <Enemy name="trafficSpike" scale={4} x={322} y={346} />
          <Enemy name="cacheStampede" scale={3} x={510} y={378} />
        </>
      ) : (
        <>
          <Enemy name="trafficSpike" scale={4} intent={attack(6)} x={560} y={52} />
          <Enemy name="launchDay" scale={5} intent={attack(8, 3)} x={694} y={20} />
          <Enemy name="cacheStampede" scale={3} intent={attack(4, 4)} x={850} y={84} />
        </>
      )}
    </div>
  );
}
