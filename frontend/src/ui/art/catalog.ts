import { ICONS } from "./icons";
import { SPRITES } from "./sprites";
import type { IconName } from "./types";

export const SPRITE_NAMES: string[] = Object.keys(SPRITES);
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
