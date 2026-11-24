/*
 * The contract between the engine, the content tables and the UI.
 * Rules are in docs/GAMEPLAY.md. Everything here is plain JSON so a run can be saved as is.
 */

export type CharacterId = "jordan" | "taylor";
export type ColleagueId = "maya" | "alex" | "jordan" | "sam" | "taylor";
export type Act = 1 | 2 | 3;
/** 0 = 99%, 1 = 99.9%, 2 = 99.99%, 3 = 99.999%. */
export type Difficulty = 0 | 1 | 2 | 3;
export type Workload = "read" | "write";
export type Tier = "normal" | "elite" | "boss";

// ---------- statuses and infrastructure ----------

export type PlayerStatusId = "backlog" | "latency" | "degraded" | "optimized" | "hardened" | "reserved";
export type EnemyStatusId = "throttled" | "exposed" | "scaling" | "retries";
export type StatusId = PlayerStatusId | EnemyStatusId;
export type Statuses = Partial<Record<StatusId, number>>;

export type InfraId =
  | "readCache"
  | "cacheTuning"
  | "loadBalancer"
  | "appServer"
  | "autoscaler"
  | "cdn"
  | "messageQueue"
  | "readReplica"
  | "healthChecks"
  | "failover"
  | "circuitBreaker"
  | "autoRemediation"
  | "onCall";

export interface InfraState {
  stacks: number;
  /** Turns left disabled by a Node Failure; 0 when working. */
  disabled: number;
  /** Read Cache only. */
  warmth?: number;
}

// ---------- effects (cards, runbooks, relics) ----------

/** A number, or one that scales with combat state: base + per * value. */
export type Amount =
  | number
  | {
      base?: number;
      per: number;
      of: "infraKinds" | "infraStacks" | "handSize" | "cardsPlayedThisTurn" | "capacity" | "backlog" | "missingBudget" | "enemyCount";
    };

export type EffectTarget = "enemy" | "allEnemies" | "randomEnemy";
export type CardZone = "hand" | "draw" | "discard";

export type Effect =
  | { op: "serve"; amount: Amount; times?: number; target: EffectTarget }
  | { op: "capacity"; amount: Amount }
  | { op: "reject"; amount: Amount }
  | { op: "draw"; amount: number }
  | { op: "engineers"; amount: number }
  | { op: "recover"; amount: Amount }
  | { op: "loseBudget"; amount: number }
  | { op: "status"; status: StatusId; amount: number; target: "self" | EffectTarget }
  | { op: "removeStatus"; status: StatusId | "debuffs"; target: "self" }
  | { op: "infra"; infra: InfraId; stacks: number }
  | { op: "repair" } // re-enable all disabled infrastructure
  | { op: "warmCache"; amount: number }
  | { op: "addCard"; card: string; zone: CardZone; count: number; upgraded?: boolean }
  /** Asks the player to pick cards; the rest of the card's effects resolve after the choice. */
  | { op: "choose"; from: CardZone; count: number; action: "decommission" | "discard" | "toHand" | "toTopOfDraw" | "upgrade" | "retain"; optional?: boolean }
  | { op: "reveal"; turns: number }
  | { op: "cash"; amount: number }
  /** Only resolves the nested effects when the condition holds. */
  | { op: "if"; cond: Condition; then: Effect[] };

export type Condition =
  | { kind: "workload"; is: Workload }
  | { kind: "hasInfra"; infra: InfraId }
  | { kind: "enemyIntends"; intent: IntentKind }
  | { kind: "budgetBelowPct"; pct: number }
  | { kind: "handEmpty" };

// ---------- cards ----------

export type CardType = "attack" | "skill" | "power" | "status";
export type CardRarity = "starter" | "common" | "uncommon" | "rare" | "special";
export type CardPool = CharacterId | "neutral" | "status";
export type Keyword = "decommission" | "retain" | "volatile" | "innate" | "unplayable";

export interface CardStats {
  /** Engineers; "x" spends all of them, null means unplayable. */
  cost: number | "x" | null;
  target: "enemy" | "none";
  effects: Effect[];
  keywords?: Keyword[];
  /** Resolves if the card is in hand at the end of the turn (Pager). */
  endOfTurnInHand?: Effect[];
  /** Resolves when the card is drawn (Config Drift). */
  onDraw?: Effect[];
}

export interface CardDef extends CardStats {
  id: string;
  name: string;
  pool: CardPool;
  rarity: CardRarity;
  type: CardType;
  /** Fields that change when upgraded. Status cards have none. */
  upgrade?: Partial<CardStats>;
  /** Short flavour line under the rules text. Rules text itself is generated from effects. */
  flavor?: string;
}

export interface CardInstance {
  uid: number;
  id: string;
  upgraded: boolean;
}

// ---------- enemies and encounters ----------

export type IntentKind = "attack" | "defend" | "buff" | "debuff" | "failure" | "summon" | "unknown";

export type EnemyEffect =
  | { op: "hit"; amount: number; times?: number }
  | { op: "buffer"; amount: number; target?: "self" | "allies" }
  | { op: "status"; status: StatusId; amount: number; target: "player" | "self" | "allies" }
  | { op: "addCard"; card: string; zone: CardZone; count: number }
  | { op: "nodeFailure" }
  | { op: "summon"; enemy: string; count: number }
  | { op: "heal"; amount: number };

export interface EnemyMove {
  name: string;
  effects: EnemyEffect[];
}

export type EnemyAi =
  /** Repeats the moves in order. */
  | { kind: "cycle"; moves: string[] }
  /** Weighted random pick; maxRepeat stops the same move more than that many times in a row. */
  | { kind: "weighted"; weights: Record<string, number>; maxRepeat?: number }
  /** Plays `opening` once, in order, then follows `then`. */
  | { kind: "script"; opening: string[]; then: EnemyAi }
  /** Uses the first phase whose threshold the current Load is at or below (as a % of max). */
  | { kind: "phases"; phases: { atOrBelowPct: number; ai: EnemyAi }[] };

export interface EnemyDef {
  id: string;
  name: string;
  tier: Tier;
  /** Starting Load is a seeded pick in [min, max]. */
  load: [number, number];
  moves: Record<string, EnemyMove>;
  ai: EnemyAi;
  /** One line shown when inspecting the enemy. */
  description: string;
  /** Key into the UI's sprite table. */
  sprite: string;
}

export interface EncounterDef {
  id: string;
  act: Act;
  tier: Tier;
  enemies: string[];
  workload: Workload;
  /** Relative chance among encounters of the same act and tier. */
  weight: number;
}

// ---------- relics, runbooks, events, characters ----------

export type RelicTrigger =
  | "combatStart"
  | "firstTurnStart"
  | "turnStart"
  | "turnEnd"
  | "combatEnd"
  | "attackPlayed"
  | "skillPlayed"
  | "powerPlayed"
  | "budgetLost"
  | "enemyResolved"
  | "shuffle";

export type RelicPassive =
  | { kind: "engineersPerTurn"; amount: number }
  | { kind: "drawPerTurn"; amount: number }
  | { kind: "maxBudget"; amount: number }
  | { kind: "shopDiscountPct"; pct: number }
  | { kind: "cardChoices"; amount: number }
  | { kind: "restRecoverPct"; pct: number }
  | { kind: "cashRewardPct"; pct: number }
  | { kind: "runbookSlots"; amount: number }
  | { kind: "noCacheHalving" }
  | { kind: "revealTurns"; turns: number }
  | { kind: "startingCapacity"; amount: number };

export type RelicRarity = "starter" | "common" | "uncommon" | "rare" | "boss" | "shop";

/** Pictures for relics and runbooks; the UI's art module draws one for each. */
export type TechIcon =
  | "server" | "database" | "shield" | "pager" | "chart" | "gear" | "cloud" | "lock" | "bolt" | "coffee"
  | "book" | "globe" | "key" | "bug" | "rocket" | "clock" | "terminal" | "network" | "flask" | "scroll";

export interface RelicDef {
  id: string;
  name: string;
  rarity: RelicRarity;
  pool: CharacterId | "neutral";
  icon: TechIcon;
  /** Rules text, hand written because relics mix triggers and passives. */
  text: string;
  flavor?: string;
  trigger?: RelicTrigger;
  /** For triggered relics: only fire every Nth time the trigger happens. */
  every?: number;
  effects?: Effect[];
  passive?: RelicPassive[];
  /** Boss relics may carry a cost, e.g. a status card added each combat. */
  drawback?: Effect[];
}

export interface RelicInstance {
  id: string;
  /** For `every` relics. */
  counter: number;
}

export interface RunbookDef {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare";
  icon: TechIcon;
  target: "enemy" | "none";
  effects: Effect[];
  text: string;
}

export type EventOutcome =
  | { op: "cash"; amount: number }
  | { op: "budget"; amount: number }
  | { op: "maxBudget"; amount: number }
  | { op: "addCard"; card: string; upgraded?: boolean }
  | { op: "randomCard"; rarity: "common" | "uncommon" | "rare" }
  | { op: "chooseCard"; action: "remove" | "upgrade" | "duplicate" }
  | { op: "relic"; relic?: string; rarity?: "common" | "uncommon" | "rare" }
  | { op: "runbook"; runbook?: string }
  | { op: "fight"; encounter: string };

export interface EventChoice {
  label: string;
  /** What the choice does, shown under the label. */
  detail: string;
  outcomes: EventOutcome[];
  requires?: { cash?: number; budget?: number };
  /** Line the colleague says after the choice. */
  reply: string;
}

export interface EventDef {
  id: string;
  title: string;
  acts: Act[];
  speaker: ColleagueId;
  lines: string[];
  choices: EventChoice[];
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  role: string;
  maxBudget: number;
  starterDeck: string[];
  starterRelic: string;
  blurb: string;
}

export interface Content {
  cards: Record<string, CardDef>;
  enemies: Record<string, EnemyDef>;
  encounters: Record<string, EncounterDef>;
  relics: Record<string, RelicDef>;
  runbooks: Record<string, RunbookDef>;
  events: Record<string, EventDef>;
  characters: Record<CharacterId, CharacterDef>;
}

// ---------- combat state ----------

export interface Intent {
  move: string;
  kinds: IntentKind[];
  /** Requests per hit after the enemy's and your statuses, or null for no attack. */
  hit: { amount: number; times: number } | null;
}

export interface EnemyState {
  /** Stable within a combat; summoned enemies get new ones. */
  key: number;
  id: string;
  load: number;
  maxLoad: number;
  buffer: number;
  statuses: Statuses;
  intent: Intent;
  /** Following intents, filled as far as the player's reveal reaches. */
  upcoming: Intent[];
  history: string[];
  resolved: boolean;
  /** Engine bookkeeping for `phases` AI: the active phase and the history length when it began. */
  phase?: { index: number; since: number };
}

export interface PendingChoice {
  source: { kind: "card"; uid: number } | { kind: "runbook"; id: string };
  from: CardZone;
  count: number;
  action: "decommission" | "discard" | "toHand" | "toTopOfDraw" | "upgrade" | "retain";
  optional: boolean;
  /** Effects left to resolve after the choice. */
  rest: Effect[];
  target?: number;
}

export interface CombatState {
  encounter: string;
  tier: Tier;
  workload: Workload;
  turn: number;
  phase: "player" | "won" | "lost";
  engineers: number;
  engineersPerTurn: number;
  capacity: number;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  decommissioned: CardInstance[];
  statuses: Statuses;
  infra: Partial<Record<InfraId, InfraState>>;
  enemies: EnemyState[];
  pending: PendingChoice | null;
  rejects: number;
  cardsPlayedThisTurn: number;
  budgetLostLastRound: number;
  budgetLostThisRound: number;
  revealTurns: number;
  nextEnemyKey: number;
  /** Tutorial step while the guided first combat runs, else null. */
  tutorial: number | null;
  /** Hand cards picked by a `retain` choice; they stay in hand at the end of this turn. */
  retained?: number[];
}

// ---------- map ----------

export type NodeKind = "incident" | "major" | "event" | "vendor" | "retro" | "treasure" | "boss";

export interface MapNode {
  id: string;
  floor: number; // 1..15, boss is 16
  col: number; // 0..6
  kind: NodeKind;
  next: string[];
  /** Incident and Major Incident nodes: the encounter, rolled with the map. */
  encounter?: string;
}

export interface ActMap {
  act: Act;
  nodes: Record<string, MapNode>;
  boss: string; // boss encounter id
}

// ---------- run state ----------

export type RewardItem =
  | { kind: "cash"; amount: number; taken: boolean }
  | { kind: "cards"; choices: CardInstance[]; taken: boolean }
  | { kind: "relic"; relic: string; taken: boolean }
  | { kind: "runbook"; runbook: string; taken: boolean };

export interface ShopState {
  cards: { card: CardInstance; price: number; sold: boolean }[];
  relics: { relic: string; price: number; sold: boolean }[];
  runbooks: { runbook: string; price: number; sold: boolean }[];
  removalPrice: number;
  removalUsed: boolean;
}

export type Screen =
  | { kind: "map" }
  | { kind: "combat"; combat: CombatState }
  | { kind: "reward"; items: RewardItem[] }
  | { kind: "shop"; shop: ShopState }
  | { kind: "retro"; done: boolean }
  | { kind: "event"; event: string; chosen: number | null }
  | { kind: "treasure"; relic: string; taken: boolean }
  | { kind: "bossRelic"; choices: string[] }
  /** Pick a card from the deck outside combat. `then` is the screen to return to. */
  | { kind: "deckChoice"; action: "remove" | "upgrade" | "duplicate"; then: Screen }
  | { kind: "summary" };

export interface RunStats {
  floorsClimbed: number;
  combatsWon: number;
  elitesWon: number;
  bossesWon: number;
  budgetLost: number;
  cashEarned: number;
  cardsPlayed: number;
  turns: number;
}

export interface RngStreams {
  map: number;
  shuffle: number;
  targets: number;
  cards: number;
  ai: number;
  events: number;
  rewards: number;
}

export interface RunState {
  version: number;
  seed: string;
  character: CharacterId;
  difficulty: Difficulty;
  rng: RngStreams;
  act: Act;
  map: ActMap;
  /** Current node, or null before the first move of an act. */
  position: string | null;
  /** Node ids visited in the current act, in order. */
  path: string[];
  budget: number;
  maxBudget: number;
  cash: number;
  deck: CardInstance[];
  relics: RelicInstance[];
  runbooks: (string | null)[];
  screen: Screen;
  nextUid: number;
  removals: number;
  /** Combats since a rare card was offered; raises the rare chance. */
  rarePity: number;
  seenEvents: string[];
  stats: RunStats;
  result: "won" | "lost" | null;
  /** True until the first Incident starts; that combat runs the guided tutorial. */
  tutorial?: boolean;
}

// ---------- commands and events ----------

export type Command =
  | { type: "chooseNode"; node: string }
  | { type: "playCard"; uid: number; target?: number }
  | { type: "endTurn" }
  | { type: "useRunbook"; slot: number; target?: number }
  | { type: "discardRunbook"; slot: number }
  | { type: "chooseCards"; uids: number[] }
  | { type: "takeReward"; index: number; card?: number }
  | { type: "skipCards"; index: number }
  | { type: "buyCard"; index: number }
  | { type: "buyRelic"; index: number }
  | { type: "buyRunbook"; index: number }
  | { type: "buyRemoval" }
  | { type: "rest" }
  | { type: "refactor" }
  | { type: "eventChoice"; index: number }
  | { type: "takeTreasure" }
  | { type: "pickBossRelic"; index: number }
  | { type: "skipTutorial" }
  | { type: "advanceTutorial" }
  /** Leave the current reward, shop, retro, event or treasure screen for the map. */
  | { type: "leave" }
  /** Back out of a Refactor or a card removal before picking a card: the Retro is open again, the removal refunded. */
  | { type: "cancel" }
  | { type: "abandon" };

/** What happened, in order, for animation and sound. The state is already final. */
export type GameEvent =
  | { type: "combatStart"; encounter: string }
  | { type: "turnStart"; turn: number }
  | { type: "draw"; uids: number[] }
  | { type: "shuffle" }
  | { type: "cardPlayed"; uid: number; card: string; upgraded: boolean }
  | { type: "cardDecommissioned"; uid: number }
  | { type: "serve"; enemy: number; amount: number; absorbed: number }
  | { type: "capacity"; amount: number }
  | { type: "engineers"; amount: number }
  | { type: "enemyMove"; enemy: number; move: string }
  | { type: "hit"; enemy: number; amount: number; absorbed: number; budgetLost: number }
  | { type: "budget"; amount: number } // positive is recovery, negative is loss
  | { type: "status"; target: "player" | number; status: StatusId; amount: number }
  | { type: "infra"; infra: InfraId; stacks: number }
  | { type: "nodeFailure"; infra: InfraId | null; prevented: boolean }
  | { type: "enemyResolved"; enemy: number }
  | { type: "summon"; enemy: number; id: string }
  | { type: "relic"; relic: string }
  | { type: "runbook"; runbook: string }
  | { type: "cash"; amount: number }
  | { type: "cardAdded"; card: string; to: CardZone | "deck" }
  | { type: "cardRemoved"; card: string }
  | { type: "cardUpgraded"; uid: number }
  | { type: "combatWon" }
  | { type: "actComplete"; act: Act }
  | { type: "runWon" }
  | { type: "runLost" };

export interface CommandResult {
  run: RunState;
  events: GameEvent[];
  /** Set when the command was refused; `run` is then the unchanged input. */
  error?: string;
}

export interface NewRunOptions {
  seed: string;
  character: CharacterId;
  difficulty: Difficulty;
  /** Start the first combat with the guided tutorial. */
  tutorial: boolean;
}
