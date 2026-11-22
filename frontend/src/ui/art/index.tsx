/*
 * Pixel art for enemies and icons. Stub until the art module lands; keep this API.
 */
import type { CardType, IntentKind, InfraId, NodeKind, StatusId, TechIcon } from "../../engine/types";

export type IconName =
  | `intent-${IntentKind}`
  | `status-${StatusId}`
  | `infra-${InfraId}`
  | `type-${CardType}`
  | `node-${NodeKind}`
  | `tech-${TechIcon}`
  | "engineers" | "capacity" | "budget" | "cash" | "deck" | "drawPile" | "discardPile" | "decommissioned"
  | "runbook" | "map" | "settings" | "sound" | "mute" | "fullscreen" | "close" | "seed" | "workload-read" | "workload-write";

/** An enemy picture by EnemyDef.sprite. Unknown names draw a placeholder. */
export function Sprite({ name, size = 128 }: { name: string; size?: number }) {
  return <div role="img" aria-label={name} style={{ width: size, height: size, background: "#3a3366" }} />;
}

/** A small icon. Decorative unless `label` is given. */
export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-icon={name} style={{ display: "inline-block", width: size, height: size, background: "currentColor" }} />;
}
