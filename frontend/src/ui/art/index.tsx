/*
 * Pixel art for enemies and icons.
 * Art is stored as rows of palette characters and drawn as crisp SVG rects,
 * one rect per horizontal run of a colour, memoised per picture.
 */
import type { ReactElement } from "react";
import { ICON_NAMES, SPRITE_NAMES } from "./catalog";
import { ICONS } from "./icons";
import { PALETTE } from "./palette";
import { PLACEHOLDER, SPRITES } from "./sprites";
import type { IconName } from "./types";

export type { IconName } from "./types";
export { ICON_NAMES, SPRITE_NAMES } from "./catalog";

const rendered = new Map<string, ReactElement[]>();

function pixels(key: string, rows: readonly string[]): ReactElement[] {
  let rects = rendered.get(key);
  if (rects) return rects;
  rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const ch = row[x];
      let end = x + 1;
      while (row[end] === ch) end++;
      if (ch !== ".") rects!.push(<rect key={`${x},${y}`} x={x} y={y} width={end - x} height={1} fill={PALETTE[ch]} />);
      x = end;
    }
  });
  rendered.set(key, rects);
  return rects;
}

function PixelArt({ id, rows, size, label }: { id: string; rows: readonly string[]; size: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      {pixels(id, rows)}
    </svg>
  );
}

/** An enemy picture by EnemyDef.sprite. Unknown names draw a placeholder. */
export function Sprite({ name, size = 128 }: { name: string; size?: number }) {
  const known = Object.hasOwn(SPRITES, name);
  return <PixelArt id={known ? `sprite:${name}` : "sprite:?"} rows={known ? SPRITES[name] : PLACEHOLDER} size={size} label={name} />;
}

/** A small icon. Decorative unless `label` is given. */
export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return <PixelArt id={`icon:${name}`} rows={ICONS[name]} size={size} label={label} />;
}

const cell = { display: "grid", justifyItems: "center", gap: 4, margin: 0, font: "12px monospace", color: "#f4f1ff", whiteSpace: "nowrap" } as const;

/** Every sprite and icon with its name, at 1x and `scale`x. Dev only. */
export function ArtGallery({ scale = 3 }: { scale?: number }) {
  return (
    <div style={{ background: "#1d1834", padding: 16, display: "grid", gap: 24 }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {[...SPRITE_NAMES, "unknown"].map((name) => (
          <figure key={name} style={cell}>
            <Sprite name={name} size={32 * scale} />
            <Sprite name={name} size={32} />
            <figcaption>{name}</figcaption>
          </figure>
        ))}
      </section>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {ICON_NAMES.map((name) => (
          <figure key={name} style={{ ...cell, minWidth: 16 * scale }}>
            <Icon name={name} size={16 * scale} />
            <Icon name={name} />
            <figcaption>{name}</figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}
