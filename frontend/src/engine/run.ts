/*
 * Runs and screens: a new run, the command dispatcher and every screen outside combat.
 */
import { activateRunbook, chooseInCombat, endTurn, playCard, settleCombat, startCombat, TUTORIAL_STEPS } from "./combat";
import { fireRelics, type Ctx } from "./effects";
import { BOSS_NODE, generateMap, pickEncounter, reachableNodes } from "./map";
import { bossRelicChoices, combatRewards, makeShop, randomCardOf, rollRelic, rollRunbook } from "./rewards";
import { seedStreams, weightedPick } from "./rng";
import type {
  Act,
  CombatState,
  Command,
  CommandResult,
  Content,
  EventDef,
  GameEvent,
  NewRunOptions,
  RunState,
  Screen,
} from "./types";
import {
  acquireRelic,
  addRunbook,
  addToDeck,
  BASE_RUNBOOK_SLOTS,
  canUpgrade,
  changeMaxBudget,
  clone,
  gainCash,
  newCard,
  passiveSum,
  recoverBudget,
  spendBudget,
  STARTING_CASH,
} from "./util";

export const RUN_VERSION = 2;
export const TUTORIAL_ENCOUNTER = "tutorial";

export function createRun(opts: NewRunOptions, content: Content): RunState {
  const character = content.characters[opts.character];
  const rng = seedStreams(opts.seed);
  const run: RunState = {
    version: RUN_VERSION,
    seed: opts.seed,
    character: opts.character,
    difficulty: opts.difficulty,
    rng,
    act: 1,
    map: generateMap(rng, content, 1),
    position: null,
    path: [],
    budget: character.maxBudget,
    maxBudget: character.maxBudget,
    cash: STARTING_CASH,
    deck: [],
    relics: [],
    runbooks: Array.from({ length: BASE_RUNBOOK_SLOTS }, () => null),
    screen: { kind: "map" },
    nextUid: 1,
    removals: 0,
    rarePity: 0,
    seenEvents: [],
    stats: { floorsClimbed: 0, combatsWon: 0, elitesWon: 0, bossesWon: 0, budgetLost: 0, cashEarned: 0, cardsPlayed: 0, turns: 0 },
    result: null,
    ...(opts.tutorial ? { tutorial: true } : {}),
  };
  for (const id of character.starterDeck) run.deck.push(newCard(run, id));
  if (opts.difficulty >= 2) run.deck.push(newCard(run, "techDebt"));
  acquireRelic(run, character.starterRelic, content, []);
  return run;
}

function combatOf(run: RunState): CombatState | null {
  return run.screen.kind === "combat" ? run.screen.combat : null;
}

function endRun(run: RunState, result: "won" | "lost", events: GameEvent[]): void {
  run.result = result;
  run.screen = { kind: "summary" };
  events.push({ type: result === "won" ? "runWon" : "runLost" });
}

/** After a combat command: settles intents, or moves on when the combat is won or lost. */
function afterCombat(run: RunState, content: Content, events: GameEvent[]): void {
  const c = combatOf(run);
  if (!c) return;
  const ctx: Ctx = { run, c, content, events };
  if (c.phase === "lost" || run.budget <= 0) return endRun(run, "lost", events);
  if (c.phase === "player") return settleCombat(ctx);

  events.push({ type: "combatWon" });
  fireRelics(ctx, "combatEnd");
  if (run.budget <= 0) return endRun(run, "lost", events);
  run.stats.combatsWon += 1;
  if (c.tier === "elite") run.stats.elitesWon += 1;
  if (c.tier === "boss") {
    run.stats.bossesWon += 1;
    recoverBudget(run, run.maxBudget - run.budget, events);
    if (run.act === 3) return endRun(run, "won", events);
  }
  run.screen = { kind: "reward", items: combatRewards(run, content, c.tier, c.rejects) };
}

function startAct(run: RunState, act: Act, content: Content, events: GameEvent[]): void {
  events.push({ type: "actComplete", act: run.act });
  run.act = act;
  run.map = generateMap(run.rng, content, act);
  run.position = null;
  run.path = [];
  run.screen = { kind: "map" };
}

/** An event for the act not seen yet this run, or undefined when none is left. */
function pickEvent(run: RunState, content: Content): EventDef | undefined {
  const fresh = Object.values(content.events).filter((e) => e.acts.includes(run.act) && !run.seenEvents.includes(e.id));
  const id = weightedPick(run.rng, "events", fresh.map((e) => [e.id, 1] as const));
  return id ? content.events[id] : undefined;
}

function enterNode(run: RunState, nodeId: string, content: Content, events: GameEvent[]): string | null {
  const node = run.map.nodes[nodeId];
  const fight = (tier: "normal" | "elite", rolled: string | undefined) => {
    const tutorial = tier === "normal" && run.tutorial === true;
    delete run.tutorial;
    const encounter = tutorial && content.encounters[TUTORIAL_ENCOUNTER] ? TUTORIAL_ENCOUNTER : rolled;
    if (!encounter) return "No encounter available";
    startCombat(run, encounter, content, events, tutorial);
    return null;
  };
  switch (node.kind) {
    case "incident":
      return fight("normal", node.encounter);
    case "major":
      return fight("elite", node.encounter);
    case "boss":
      if (!content.encounters[run.map.boss]) return "No boss encounter";
      startCombat(run, run.map.boss, content, events, false);
      return null;
    case "event": {
      const event = pickEvent(run, content);
      if (!event) return fight("normal", pickEncounter(run.rng, "events", content, run.act, "normal"));
      run.seenEvents.push(event.id);
      run.screen = { kind: "event", event: event.id, chosen: null };
      return null;
    }
    case "vendor":
      run.screen = { kind: "shop", shop: makeShop(run, content) };
      return null;
    case "retro":
      run.screen = { kind: "retro", done: false };
      return null;
    case "treasure": {
      const relic = rollRelic(run, content, "rewards");
      run.screen = relic ? { kind: "treasure", relic, taken: false } : { kind: "reward", items: [{ kind: "cash", amount: 50, taken: false }] };
      return null;
    }
  }
}

/** Why an event choice can't be made now, or null if it can. A choice needing N budget needs more than N. */
export function eventChoiceBlocked(run: RunState, index: number, content: Content): string | null {
  if (run.screen.kind !== "event" || run.screen.chosen !== null) return "No choice to make";
  const choice = content.events[run.screen.event]?.choices[index];
  if (!choice) return "No such choice";
  if (choice.requires?.cash !== undefined && run.cash < choice.requires.cash) return `Needs ${choice.requires.cash} cash`;
  if (choice.requires?.budget !== undefined && run.budget <= choice.requires.budget) return `Needs more than ${choice.requires.budget} Error Budget`;
  return null;
}

function eventChoice(run: RunState, index: number, content: Content, events: GameEvent[]): string | null {
  const blocked = eventChoiceBlocked(run, index, content);
  if (blocked || run.screen.kind !== "event") return blocked ?? "No choice to make";
  const event = content.events[run.screen.event];
  const choice = event.choices[index];
  const screen: Screen = { kind: "event", event: event.id, chosen: index };
  run.screen = screen;
  let deckChoice: "remove" | "upgrade" | "duplicate" | null = null;
  let encounter: string | null = null;
  for (const outcome of choice.outcomes) {
    switch (outcome.op) {
      case "cash":
        gainCash(run, outcome.amount, events);
        break;
      case "budget":
        if (outcome.amount >= 0) recoverBudget(run, outcome.amount, events);
        else spendBudget(run, -outcome.amount, events);
        break;
      case "maxBudget":
        changeMaxBudget(run, outcome.amount, events);
        break;
      case "addCard":
        if (content.cards[outcome.card]) addToDeck(run, newCard(run, outcome.card, outcome.upgraded ?? false), events);
        break;
      case "randomCard": {
        const def = randomCardOf(run, content, outcome.rarity);
        if (def) addToDeck(run, newCard(run, def.id), events);
        break;
      }
      case "chooseCard":
        deckChoice = outcome.action;
        break;
      case "relic": {
        const relic = outcome.relic && !run.relics.some((r) => r.id === outcome.relic) ? outcome.relic : rollRelic(run, content, "events", outcome.rarity);
        if (relic) acquireRelic(run, relic, content, events);
        break;
      }
      case "runbook": {
        const runbook = outcome.runbook ?? rollRunbook(run, content, "events");
        if (runbook) addRunbook(run, runbook, events);
        break;
      }
      case "fight":
        encounter = outcome.encounter;
        break;
    }
  }
  if (run.budget <= 0) {
    endRun(run, "lost", events);
    return null;
  }
  if (encounter && content.encounters[encounter]) {
    startCombat(run, encounter, content, events, false);
  }
  if (deckChoice) openDeckChoice(run, deckChoice, content);
  return null;
}

function eligibleForDeckChoice(run: RunState, action: "remove" | "upgrade" | "duplicate", content: Content): number[] {
  return run.deck.filter((card) => action !== "upgrade" || canUpgrade(card, content)).map((card) => card.uid);
}

/** Opens a deck choice over the current screen, or does nothing if no card qualifies. */
function openDeckChoice(run: RunState, action: "remove" | "upgrade" | "duplicate", content: Content): void {
  if (eligibleForDeckChoice(run, action, content).length === 0) return;
  run.screen = { kind: "deckChoice", action, then: run.screen };
}

function deckChoice(run: RunState, uids: number[], content: Content, events: GameEvent[]): string | null {
  if (run.screen.kind !== "deckChoice") return "Nothing to choose";
  const { action, then } = run.screen;
  if (uids.length !== 1 || !eligibleForDeckChoice(run, action, content).includes(uids[0])) return "Choose one card";
  const index = run.deck.findIndex((card) => card.uid === uids[0]);
  const card = run.deck[index];
  if (action === "remove") {
    run.deck.splice(index, 1);
    events.push({ type: "cardRemoved", card: card.id });
  } else if (action === "upgrade") {
    card.upgraded = true;
    events.push({ type: "cardUpgraded", uid: card.uid });
  } else addToDeck(run, newCard(run, card.id, card.upgraded), events);
  run.screen = then;
  return null;
}

/** A Refactor or a card removal can be backed out of; an event's card choice comes after its cost is paid. */
export function deckChoiceCancellable(run: RunState): boolean {
  return run.screen.kind === "deckChoice" && (run.screen.then.kind === "retro" || run.screen.then.kind === "shop");
}

function cancelDeckChoice(run: RunState, events: GameEvent[]): string | null {
  if (run.screen.kind !== "deckChoice") return "Nothing to cancel";
  if (!deckChoiceCancellable(run)) return "This choice can't be cancelled";
  const then = run.screen.then;
  if (then.kind === "retro") then.done = false;
  if (then.kind === "shop") {
    // A refund, not earnings: the stats don't count it.
    run.cash += then.shop.removalPrice;
    events.push({ type: "cash", amount: then.shop.removalPrice });
    run.removals -= 1;
    then.shop.removalUsed = false;
  }
  run.screen = then;
  return null;
}

function leave(run: RunState, content: Content, events: GameEvent[]): string | null {
  switch (run.screen.kind) {
    case "reward":
      if (run.position === BOSS_NODE) run.screen = { kind: "bossRelic", choices: bossRelicChoices(run, content) };
      else run.screen = { kind: "map" };
      return null;
    case "bossRelic":
      startAct(run, (run.act + 1) as Act, content, events);
      return null;
    case "shop":
    case "retro":
    case "event":
    case "treasure":
      run.screen = { kind: "map" };
      return null;
    default:
      return "Nothing to leave";
  }
}

function takeReward(run: RunState, index: number, card: number | undefined, content: Content, events: GameEvent[]): string | null {
  if (run.screen.kind !== "reward") return "No reward here";
  const item = run.screen.items[index];
  if (!item || item.taken) return "Reward already taken";
  switch (item.kind) {
    case "cash":
      gainCash(run, item.amount, events);
      break;
    case "cards": {
      const choice = card === undefined ? undefined : item.choices[card];
      if (!choice) return "Choose a card";
      addToDeck(run, choice, events);
      break;
    }
    case "relic":
      acquireRelic(run, item.relic, content, events);
      break;
    case "runbook":
      if (!addRunbook(run, item.runbook, events)) return "Runbook slots are full";
      break;
  }
  item.taken = true;
  return null;
}

function shopCommand(run: RunState, cmd: Command, content: Content, events: GameEvent[]): string | null {
  if (run.screen.kind !== "shop") return "Not in a shop";
  const shop = run.screen.shop;
  const pay = (price: number) => {
    if (run.cash < price) return false;
    gainCash(run, -price, events);
    return true;
  };
  switch (cmd.type) {
    case "buyCard": {
      const offer = shop.cards[cmd.index];
      if (!offer || offer.sold) return "Not for sale";
      if (!pay(offer.price)) return "Not enough cash";
      offer.sold = true;
      addToDeck(run, offer.card, events);
      return null;
    }
    case "buyRelic": {
      const offer = shop.relics[cmd.index];
      if (!offer || offer.sold) return "Not for sale";
      if (!pay(offer.price)) return "Not enough cash";
      offer.sold = true;
      acquireRelic(run, offer.relic, content, events);
      return null;
    }
    case "buyRunbook": {
      const offer = shop.runbooks[cmd.index];
      if (!offer || offer.sold) return "Not for sale";
      if (!run.runbooks.includes(null)) return "Runbook slots are full";
      if (!pay(offer.price)) return "Not enough cash";
      offer.sold = true;
      addRunbook(run, offer.runbook, events);
      return null;
    }
    case "buyRemoval": {
      if (shop.removalUsed) return "Already used";
      if (run.deck.length === 0) return "No cards to remove";
      if (!pay(shop.removalPrice)) return "Not enough cash";
      // The shop keeps the price paid, so backing out can refund it; the next shop charges more.
      run.removals += 1;
      shop.removalUsed = true;
      openDeckChoice(run, "remove", content);
      return null;
    }
    default:
      return "Not in a shop";
  }
}

/** Error Budget a Retro rest would recover now: 30% of max (20% at 99.999%) plus relics, capped at what is missing. */
export function retroRecoverAmount(run: RunState, content: Content): number {
  const pct = (run.difficulty >= 3 ? 20 : 30) + passiveSum(run, content, "restRecoverPct");
  return Math.min(run.maxBudget - run.budget, Math.round((run.maxBudget * pct) / 100));
}

function retroCommand(run: RunState, cmd: Command, content: Content, events: GameEvent[]): string | null {
  if (run.screen.kind !== "retro" || run.screen.done) return "Not at a retro";
  if (cmd.type === "rest") {
    recoverBudget(run, retroRecoverAmount(run, content), events);
    run.screen = { kind: "retro", done: true };
    return null;
  }
  if (eligibleForDeckChoice(run, "upgrade", content).length === 0) return "No card to refactor";
  run.screen = { kind: "retro", done: true };
  openDeckChoice(run, "upgrade", content);
  return null;
}

function dispatch(run: RunState, cmd: Command, content: Content, events: GameEvent[]): string | null {
  if (run.result || run.screen.kind === "summary") return "The run is over";
  const c = combatOf(run);
  const ctx: Ctx | null = c ? { run, c, content, events } : null;
  switch (cmd.type) {
    case "chooseNode":
      if (!reachableNodes(run).includes(cmd.node)) return "Can't move there";
      run.position = cmd.node;
      run.path.push(cmd.node);
      run.stats.floorsClimbed += 1;
      return enterNode(run, cmd.node, content, events);
    case "playCard":
      return ctx ? playCard(ctx, cmd.uid, cmd.target) : "Not in combat";
    case "endTurn":
      return ctx ? endTurn(ctx) : "Not in combat";
    case "useRunbook":
      return ctx ? activateRunbook(ctx, cmd.slot, cmd.target) : "Not in combat";
    case "discardRunbook":
      if (!run.runbooks[cmd.slot]) return "No runbook in that slot";
      run.runbooks[cmd.slot] = null;
      return null;
    case "chooseCards":
      return ctx ? chooseInCombat(ctx, cmd.uids) : deckChoice(run, cmd.uids, content, events);
    case "takeReward":
      return takeReward(run, cmd.index, cmd.card, content, events);
    case "skipCards": {
      if (run.screen.kind !== "reward") return "No reward here";
      const item = run.screen.items[cmd.index];
      if (!item || item.kind !== "cards" || item.taken) return "No cards to skip";
      item.taken = true;
      return null;
    }
    case "buyCard":
    case "buyRelic":
    case "buyRunbook":
    case "buyRemoval":
      return shopCommand(run, cmd, content, events);
    case "rest":
    case "refactor":
      return retroCommand(run, cmd, content, events);
    case "eventChoice":
      return eventChoice(run, cmd.index, content, events);
    case "takeTreasure":
      if (run.screen.kind !== "treasure" || run.screen.taken) return "No treasure here";
      acquireRelic(run, run.screen.relic, content, events);
      run.screen.taken = true;
      return null;
    case "pickBossRelic": {
      if (run.screen.kind !== "bossRelic") return "No boss relic to pick";
      const relic = run.screen.choices[cmd.index];
      if (!relic) return "No such relic";
      acquireRelic(run, relic, content, events);
      startAct(run, (run.act + 1) as Act, content, events);
      return null;
    }
    case "advanceTutorial":
    case "skipTutorial":
      if (!c || c.tutorial === null) return "No tutorial running";
      c.tutorial = cmd.type === "skipTutorial" || c.tutorial + 1 >= TUTORIAL_STEPS ? null : c.tutorial + 1;
      return null;
    case "leave":
      return leave(run, content, events);
    case "cancel":
      return cancelDeckChoice(run, events);
    case "abandon":
      endRun(run, "lost", events);
      return null;
  }
}

export function applyRunCommand(input: RunState, cmd: Command, content: Content): CommandResult {
  const run = clone(input);
  const events: GameEvent[] = [];
  const error = dispatch(run, cmd, content, events);
  if (error) return { run: input, events: [], error };
  if (!run.result) afterCombat(run, content, events);
  return { run, events };
}
