# Gameplay rules

99.99 Percent is a turn-based card game about keeping a startup's service online.
This file is the source of truth for the rules.
The code wins any disagreement; fix this file when it does.
Card, enemy, relic, runbook and event lists live in `frontend/src/content/`.

## A run

Pick a character and a difficulty, then climb three acts.
Each act is a 15-floor map followed by a boss.
Beat the Act 3 boss to win the run (the IPO).
If Error Budget reaches 0, the SLA is breached and the run is lost.

| Act | Name | Boss |
| --- | --- | --- |
| 1 | Seed Stage | Launch Day |
| 2 | Series A | Black Friday |
| 3 | Hypergrowth | Region Outage |

Beating a boss restores Error Budget to full, then offers a choice of 3 boss relics.

## Characters

| Character | Role | Error Budget | Starter relic | Plays around |
| --- | --- | --- | --- | --- |
| Jordan | Platform Engineer | 72 | Monitoring: draw 1 more card on turn 1, and see enemy intents 2 turns ahead | App Servers, Load Balancers, Autoscaling |
| Taylor | Site Reliability Engineer | 70 | Postmortem Culture: recover 4 Error Budget after each combat | Health Checks, Failover, Pager control, recovery |

Each character has their own card pool and also draws from the neutral pool.
Caching and database cards are neutral, so both characters use them.

Starter decks have 10 cards:
- Jordan: 5 Serve, 4 Provision, 1 Inspect.
- Taylor: 5 Serve, 4 Provision, 1 Triage.

## Combat

At the start of combat, the deck is shuffled into the draw pile.

Each player turn:
1. Capacity resets to 0, unless you have Reserved.
2. Infrastructure and start-of-turn effects resolve.
3. You get 3 Engineers. Unspent Engineers are lost at the end of the turn.
4. You draw 5 cards. When the draw pile is empty, the discard pile is shuffled to form a new one.
5. You play cards. Each card costs Engineers.
6. You end the turn. Your hand is discarded, except cards with Retain.

Then each enemy acts on its intent, in order, and picks its next intent.

- **Incoming requests** go to Capacity first. Whatever Capacity can't absorb burns Error Budget.
- **Serve** reduces an enemy's Load. An enemy whose Load reaches 0 is resolved.
- Combat is won when every enemy is resolved.
- An enemy's **Buffer** absorbs Serve before its Load does, and resets at the start of that enemy's turn.

### Workload

Every encounter is **read-heavy** or **write-heavy**, and the combat screen shows which.
Writes bypass the cache, so cache effects are halved (rounded down) in write-heavy encounters.

### Keywords

| Keyword | Meaning |
| --- | --- |
| Decommission | Removed from the deck for the rest of the combat after it is played. |
| Retain | Not discarded at the end of the turn. |
| Volatile | Decommissioned if it is still in your hand at the end of the turn. |
| Innate | Starts the combat in your opening hand. |
| Unplayable | Can't be played. |
| Reject N | Gain N Capacity. Each Reject card played cuts that combat's cash reward by 15%, because rejected traffic earns nothing. |

### Statuses

Statuses on you:

| Status | Effect |
| --- | --- |
| Backlog N | At the start of your turn, lose N Error Budget, then Backlog drops by 1. |
| Latency N | Your Serve does 25% less, for N turns. |
| Degraded N | You take 50% more from incoming requests, for N turns. |
| Optimized N | Each Serve hit does N more. |
| Hardened N | Each card that gives Capacity gives N more. |
| Reserved N | Capacity doesn't reset at the start of your next N turns. |

Statuses on enemies:

| Status | Effect |
| --- | --- |
| Throttled N | The enemy sends 25% fewer requests, for N turns. |
| Exposed N | The enemy takes 50% more Serve, for N turns. |
| Scaling N | Each of the enemy's hits sends N more requests. |
| Retries N | At the end of its turn, the enemy regains N Load. |

Turn-counted statuses drop by 1 at the end of the owner's turn.

### Infrastructure

Infrastructure cards install a piece of infrastructure that stays for the whole combat.
Playing the same infrastructure again adds a stack.

| Infrastructure | Effect per turn start (unless noted) |
| --- | --- |
| Read Cache | Gain Capacity equal to its warmth, then warmth rises by 1, up to 6. Warmth starts at 1. |
| Cache Tuning | Raises the Read Cache warmth limit by 2 per stack. |
| Load Balancer | Routes App Servers. Without it they do nothing. |
| App Server | With a Load Balancer, gain 4 Capacity per stack. Without one, it is Unrouted and gives nothing. |
| Autoscaler | Gain Capacity equal to the Error Budget you lost last round, up to 6 per stack. |
| CDN | Gain 2 Capacity per stack. |
| Message Queue | At the end of your turn, keep up to 5 per stack of your unused Capacity for the next turn. |
| Read Replica | Serve a random enemy for 3 per stack (cache halving applies). |
| Health Checks | Node Failures you suffer last 1 turn instead of 2. |
| Failover | Ignores the next Node Failure, once per stack. |
| Circuit Breaker | When an enemy burns your Error Budget, it gets Throttled 1 per stack. |
| Auto Remediation | Remove 1 stack of one debuff from yourself, per stack. |
| On-Call Rotation | Whenever you draw a Pager, draw 1 card and gain 3 Capacity, per stack. |

**Node Failure** is an enemy move that disables one of your installed infrastructure pieces, chosen at random, for 2 turns.
A disabled piece does nothing, and it keeps its stacks and warmth.

### Status cards

| Card | Effect |
| --- | --- |
| Tech Debt | Unplayable. |
| Pager | Unplayable. If it is still in your hand at the end of the turn, lose 2 Error Budget. |
| Config Drift | Unplayable. Volatile. When you draw it, lose 1 Engineer. |

## Between combats

The map is a branching graph of 15 floors.
You start on floor 1 and move one floor up at a time along a path.

| Node | What happens |
| --- | --- |
| Incident | A normal combat. |
| Major Incident | An elite combat. Not before floor 6. Drops a relic. |
| Event | A short scene with a colleague, with choices. |
| Vendor | The shop. |
| Retro | Rest: recover 30% of max Error Budget, or Refactor (upgrade) one card. |
| Treasure | A relic. Always on floor 9. |
| Boss | After floor 15. Floor 15 is always a Retro. |

Floor 1 is always an Incident.
There is no Retro on floor 14, and no two Major Incidents, Vendors or Retros in a row on a path.

### Rewards

| Combat | Cash | Also |
| --- | --- | --- |
| Incident | 10-20 | A choice of 3 cards, 40% chance of a runbook |
| Major Incident | 25-35 | A choice of 3 cards, a relic, 40% chance of a runbook |
| Boss | 95-105 | A choice of 3 rare cards, then a choice of 3 boss relics |

Card choices can be skipped.
The chance of a rare card rises the longer you go without seeing one.

### Cards, relics and runbooks

- Upgraded cards show a `+` after their name. A card can be upgraded once.
- Relics (tech) last for the whole run.
- Runbooks are single-use and can be used in combat. You can hold 3.

### Vendor

The shop sells 5 cards from your pool, 2 neutral cards, 3 relics and 3 runbooks.
Removing a card costs 75 cash, and 25 more each time you do it.
You start the run with 99 cash.

## Difficulty

Difficulty is measured in nines.
Each level adds to the ones below it.

| Level | Adds |
| --- | --- |
| 99% | Base rules |
| 99.9% | Major Incidents have 25% more Load. |
| 99.99% | Incidents have 10% more Load, and you start with a Tech Debt in your deck. |
| 99.999% | Bosses have 20% more Load, and a Retro recovers 20% instead of 30%. |

Winning a run with a character unlocks the next level for that character.

## Tutorial

Your first run opens with a guided first combat: Maya points out the hand, an enemy's intent, Capacity and End Turn.
It can be skipped, and it doesn't come back once it is finished or skipped.

## Saves

The run in progress is saved after every action, so closing the tab and coming back resumes at the same point.
The browser also keeps unlocked difficulties, the last 20 run results, settings and whether the tutorial is done.
Saves only live in this browser.
