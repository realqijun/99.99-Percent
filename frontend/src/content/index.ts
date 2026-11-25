import type { Content } from "../engine/types";
import { CARDS } from "./cards";
import { CHARACTERS } from "./characters";
import { ENCOUNTERS } from "./encounters";
import { ENEMIES } from "./enemies";
import { EVENTS } from "./events";
import { RELICS } from "./relics";
import { RUNBOOKS } from "./runbooks";

export const CONTENT: Content = {
  cards: CARDS,
  enemies: ENEMIES,
  encounters: ENCOUNTERS,
  relics: RELICS,
  runbooks: RUNBOOKS,
  events: EVENTS,
  characters: CHARACTERS,
};
