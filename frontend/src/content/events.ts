import type { EventDef } from "../engine/types";
import { byId } from "./byId";

/*
 * Short scenes with colleagues between combats.
 * Maya (Customer Support) is warm and customer-focused.
 * Alex (CEO) is a dragon chasing growth.
 * Sam (Marketing) is a fire imp who never puts the phone down.
 */

const LIST: EventDef[] = [
  {
    id: "ticketQueue", title: "The Ticket Queue", acts: [1], speaker: "maya",
    lines: [
      "Morning! The support queue tripled overnight.",
      "Most of them are the same bug, honestly.",
      "Could you take a look before lunch? I'll bring muffins.",
    ],
    choices: [
      {
        label: "Fix the root cause", detail: "Lose 6 Error Budget. Upgrade a card.",
        outcomes: [{ op: "budget", amount: -6 }, { op: "chooseCard", action: "upgrade" }],
        requires: { budget: 6 },
        reply: "You're a hero. I'll tell them it's fixed for real.",
      },
      {
        label: "Write a macro reply", detail: "Gain a random common card.",
        outcomes: [{ op: "randomCard", rarity: "common" }],
        reply: "Templates! Kind ones, though. I'll check the wording.",
      },
      {
        label: "Not today", detail: "Nothing happens.",
        outcomes: [],
        reply: "No worries. I've got snacks and patience.",
      },
    ],
  },
  {
    id: "goingViral", title: "Going Viral", acts: [1, 2], speaker: "sam",
    lines: [
      "Huge news! A thread about us is trending!",
      "Less huge news: it's about the outage.",
      "I can spin this. Probably. Give me a direction.",
    ],
    choices: [
      {
        label: "Lean into the meme", detail: "Gain 40 cash. Add a Pager to your deck.",
        outcomes: [{ op: "cash", amount: 40 }, { op: "addCard", card: "pager" }],
        reply: "Engagement is engagement! Phone's already buzzing.",
      },
      {
        label: "Post an honest status update", detail: "Recover 10 Error Budget.",
        outcomes: [{ op: "budget", amount: 10 }],
        reply: "Bold. Boring. Weirdly, people like it.",
      },
    ],
  },
  {
    id: "thePivot", title: "The Pivot", acts: [1, 2], speaker: "alex",
    lines: [
      "I've been thinking. Big thoughts. Dragon-sized thoughts.",
      "What if we were also an AI company? And a marketplace?",
      "The investors would breathe fire. In a good way.",
    ],
    choices: [
      {
        label: "Humor the pivot", detail: "Gain 60 cash. Add a Tech Debt to your deck.",
        outcomes: [{ op: "cash", amount: 60 }, { op: "addCard", card: "techDebt" }],
        reply: "Visionary. I'll tell the board you're on board.",
      },
      {
        label: "Talk Alex down", detail: "Lose 5 Error Budget. Remove a card from your deck.",
        outcomes: [{ op: "budget", amount: -5 }, { op: "chooseCard", action: "remove" }],
        requires: { budget: 5 },
        reply: "Fine. Focus. But I'm keeping the slide deck.",
      },
    ],
  },
  {
    id: "swagDrop", title: "Swag Drop", acts: [1, 2, 3], speaker: "sam",
    lines: [
      "I ordered 500 hoodies. Sizes are a surprise.",
      "There's also a limited run with actual gear inside. Don't ask.",
    ],
    choices: [
      {
        label: "Buy the limited edition", detail: "Pay 50 cash. Gain a random common relic.",
        outcomes: [{ op: "cash", amount: -50 }, { op: "relic", rarity: "common" }],
        requires: { cash: 50 },
        reply: "Great choice! It's a tiny bit on fire. That's the brand.",
      },
      {
        label: "Sell the spare hoodies", detail: "Gain 25 cash.",
        outcomes: [{ op: "cash", amount: 25 }],
        reply: "Posted them already. Sold out in four minutes!",
      },
    ],
  },
  {
    id: "vendorPitch", title: "Vendor Pitch", acts: [1, 3], speaker: "sam",
    lines: [
      "A cloud vendor wants to sponsor our next launch!",
      "All we do is say their name on stage. Twelve times.",
    ],
    choices: [
      {
        label: "Take the sponsorship", detail: "Gain 75 cash. Add a Config Drift to your deck.",
        outcomes: [{ op: "cash", amount: 75 }, { op: "addCard", card: "configDrift" }],
        reply: "Deal signed! They're sending a new config template, too.",
      },
      {
        label: "Ask for gear instead", detail: "Gain a random common relic.",
        outcomes: [{ op: "relic", rarity: "common" }],
        reply: "Less flashy, but I can post an unboxing.",
      },
    ],
  },
  {
    id: "userInterview", title: "User Interview", acts: [1, 3], speaker: "maya",
    lines: [
      "I set up a chat with a customer who really loves us.",
      "She has notes. Lots of notes. Colour-coded.",
    ],
    choices: [
      {
        label: "Listen to all of it", detail: "Gain a random uncommon card.",
        outcomes: [{ op: "randomCard", rarity: "uncommon" }],
        reply: "She said you were a great listener. I agree!",
      },
      {
        label: "Ask what to cut", detail: "Remove a card from your deck.",
        outcomes: [{ op: "chooseCard", action: "remove" }],
        reply: "Simpler is kinder. She'll be thrilled.",
      },
    ],
  },
  {
    id: "enterpriseCall", title: "Enterprise Customer", acts: [2], speaker: "maya",
    lines: [
      "A big customer wants a call about their dashboard.",
      "They're lovely, but they type in all caps.",
      "Would you join? Even ten minutes helps.",
    ],
    choices: [
      {
        label: "Join the call", detail: "Lose 8 Error Budget. Gain a random rare card.",
        outcomes: [{ op: "budget", amount: -8 }, { op: "randomCard", rarity: "rare" }],
        requires: { budget: 8 },
        reply: "They switched to lowercase by the end. Progress!",
      },
      {
        label: "Send them a runbook", detail: "Gain a random runbook.",
        outcomes: [{ op: "runbook" }],
        reply: "I'll walk them through it. Gently.",
      },
    ],
  },
  {
    id: "hackathon", title: "Hackathon Weekend", acts: [2, 3], speaker: "alex",
    lines: [
      "Weekend hackathon! Attendance is optional. Strongly encouraged. Mandatory.",
      "The winner gets equity. The loser gets the pager.",
    ],
    choices: [
      {
        label: "Build something wild", detail: "Fight a Flaky Deploy. Gain a random uncommon relic.",
        outcomes: [{ op: "fight", encounter: "a2FlakyDeploy" }, { op: "relic", rarity: "uncommon" }],
        reply: "It crashed twice and I love it. Ship it Monday.",
      },
      {
        label: "Judge instead", detail: "Duplicate a card in your deck.",
        outcomes: [{ op: "chooseCard", action: "duplicate" }],
        reply: "A fair judge. Boring, but fair.",
      },
    ],
  },
  {
    id: "longWeek", title: "Long Week", acts: [2, 3], speaker: "maya",
    lines: [
      "You look tired. Server-room-at-3am tired.",
      "I brought soup. Take the afternoon? The customers will wait.",
    ],
    choices: [
      {
        label: "Take the afternoon", detail: "Recover 20 Error Budget.",
        outcomes: [{ op: "budget", amount: 20 }],
        reply: "Good. Rest is part of the job, too.",
      },
      {
        label: "Push through", detail: "Lose 8 Error Budget. Upgrade a card.",
        outcomes: [{ op: "budget", amount: -8 }, { op: "chooseCard", action: "upgrade" }],
        requires: { budget: 8 },
        reply: "Okay. At least finish the soup.",
      },
    ],
  },
  {
    id: "bigGameAd", title: "Big Game Ad", acts: [2, 3], speaker: "sam",
    lines: [
      "We got an ad slot during the big game! Well, the pre-game.",
      "Traffic will be massive. That's good, right? Right?",
    ],
    choices: [
      {
        label: "Run the ad", detail: "Fight a Cache Stampede. Gain 80 cash.",
        outcomes: [{ op: "fight", encounter: "a2CacheStampede" }, { op: "cash", amount: 80 }],
        reply: "Trending again, and this time for good reasons!",
      },
      {
        label: "Pull the ad", detail: "Gain 20 cash from the refund.",
        outcomes: [{ op: "cash", amount: 20 }],
        reply: "Fine. I'll make a meme about pulling it.",
      },
    ],
  },
  {
    id: "boardMeeting", title: "Board Meeting", acts: [3], speaker: "alex",
    lines: [
      "The board wants to hear about reliability.",
      "Say five nines a lot. They love that. I love that.",
      "Or show them the real graphs. Your call. Mine, really.",
    ],
    choices: [
      {
        label: "Promise five nines", detail: "Gain 10 max Error Budget. Add a Pager to your deck.",
        outcomes: [{ op: "maxBudget", amount: 10 }, { op: "addCard", card: "pager" }],
        reply: "They roared with approval. You're on call for it now.",
      },
      {
        label: "Show the real graphs", detail: "Lose 12 Error Budget. Gain a random rare relic.",
        outcomes: [{ op: "budget", amount: -12 }, { op: "relic", rarity: "rare" }],
        requires: { budget: 12 },
        reply: "Painful. But they approved the budget for real tooling.",
      },
    ],
  },
  {
    id: "ipoRehearsal", title: "IPO Rehearsal", acts: [3], speaker: "alex",
    lines: [
      "IPO practice run! Ring the bell, smile, don't crash.",
      "I want a load test at bell-ringing scale. Dragon scale.",
    ],
    choices: [
      {
        label: "Run the load test", detail: "Fight a Cascading Failure. Gain a random rare card.",
        outcomes: [{ op: "fight", encounter: "a3Cascading" }, { op: "randomCard", rarity: "rare" }],
        reply: "Still standing! The bankers will love this.",
      },
      {
        label: "Skip the rehearsal", detail: "Recover 15 Error Budget.",
        outcomes: [{ op: "budget", amount: 15 }],
        reply: "Fine. We'll rehearse it live. Like real founders.",
      },
    ],
  },
];

export const EVENTS: Record<string, EventDef> = byId(LIST);
