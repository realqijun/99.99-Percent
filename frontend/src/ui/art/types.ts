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
