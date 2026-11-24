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
| Taylor | Site Reliability Engineer | 70 | Postmortem Culture: recover 3 Error Budget after each combat | Health Checks, Failover, Pager control, recovery |

Each character has their own card pool and also draws from the neutral pool.
Caching and database cards are neutral, so both characters use them.

Starter decks have 10 cards:
- Jordan: 5 Serve, 4 Provision, 1 Inspect.
- Taylor: 5 Serve, 4 Provision, 1 Triage.

## Combat

At the start of combat, the deck is shuffled into the draw pile.

Each player turn:
1. Capacity resets to 0, unless you have Reserved.
2. Backlog, then infrastructure, resolve.
3. You get 3 Engineers. Unspent Engineers are lost at the end of the turn.
4. Start-of-turn relics resolve.
5. You draw 5 cards. When the draw pile is empty, the discard pile is shuffled to form a new one.
6. You play cards. Each card costs Engineers.
7. You end the turn. End-of-turn relics and card effects resolve, then your hand is discarded, except cards with Retain.

Then each enemy acts on its intent, in order, and picks its next intent.

- You can hold up to 10 cards. Draws past that are skipped, and cards added to a full hand go to the discard pile instead.
- A played card stays in your hand until its effects finish, so it can't pick itself in a choice. Then it goes to the discard pile.
- Power cards are removed for the rest of the combat once played.
- X cost cards spend all your Engineers and resolve their effects once per Engineer spent. With 0 Engineers nothing happens.
- Counts of cards played this turn don't include the card being played.
- Enemy effects on allies reach the other living enemies, not the one using the move.
- An enemy summoned during the enemies' turn first acts on the next one. There are never more than 5 enemies at once.
- Relic drawbacks resolve at the start of each combat. Starting Capacity from relics is there on turn 1.

### Intents

Each enemy shows its intent: the move it will make next.
An attack intent shows the requests each hit will send if you end the turn now, after every status, including statuses the enemies' turn adds before that enemy acts.
Revealing N turns (Monitoring reveals 2) also shows each enemy's next N moves.
Revealed moves are picked in advance and always happen.
An enemy with phases picks its phase from its Load when it picks a move, and a new phase starts its moves from the beginning.

- **Incoming requests** go to Capacity first. Whatever Capacity can't absorb burns Error Budget.
- **Serve** reduces an enemy's Load. An enemy whose Load reaches 0 is resolved.
- Combat is won when every enemy is resolved.
- An enemy's **Buffer** absorbs Serve before its Load does, and resets when the enemies' turn starts, so Buffer gained during the enemies' turn lasts through your next turn.

### Workload

Every encounter is **read-heavy** or **write-heavy**, and the combat screen shows which.
Writes bypass the cache, so Read Cache Capacity and Read Replica Serve are halved (rounded down) in write-heavy encounters.

### Keywords

| Keyword | Meaning |
| --- | --- |
| Decommission | Removed from the deck for the rest of the combat after it is played. |
| Retain | Not discarded at the end of the turn. |
| Volatile | Decommissioned if it is still in your hand at the end of the turn. |
| Innate | Starts the combat in your opening hand. With more than 5, the opening hand draws them all, up to the hand limit of 10. |
| Unplayable | Can't be played. |
| Reject N | Gain N Capacity. Each Reject played cuts that combat's cash reward by 15% of what is left, because rejected traffic earns nothing. |

### Statuses

Statuses on you:

| Status | Effect |
| --- | --- |
| Backlog N | At the start of your turn, lose N Error Budget, then Backlog drops by 1. |
| Latency N | Your Serve does 25% less, for N turns. |
| Degraded N | You take 50% more from incoming requests, for N turns. |
| Optimized N | Each Serve hit does N more. |
| Hardened N | Each card that gives Capacity (including Reject) gives N more. |
| Reserved N | Capacity doesn't reset at the start of your next N turns. |

Statuses on enemies:

| Status | Effect |
| --- | --- |
| Throttled N | The enemy sends 25% fewer requests, for N turns. |
| Exposed N | The enemy takes 50% more Serve, for N turns. |
| Scaling N | Each of the enemy's hits sends N more requests. |
| Retries N | At the end of its turn, the enemy regains N Load. |

Backlog, Latency and Degraded are debuffs.
Optimized, Hardened, Scaling and Retries last the whole combat.
Latency and Reserved drop by 1 at the end of your turn, and Reserved keeps your Capacity at the next reset while it is above 0 then.
Throttled and Exposed drop by 1 at the end of that enemy's turn.
Degraded drops by 1 at the end of the enemies' turn, since that is when it matters.
A status gained during an enemy turn doesn't drop at the end of that turn, so it still covers the next one.

Serve is worked out as its number plus Optimized, then 25% less for Latency, then 50% more for the target's Exposed, rounding down at each step.
Incoming hits are worked out as their number plus Scaling, then 25% less for Throttled, then 50% more for your Degraded, rounding down at each step.

### Infrastructure

Infrastructure cards install a piece of infrastructure that stays for the whole combat.
Playing the same infrastructure again adds a stack.
At the start of your turn the pieces resolve in this order: Auto Remediation, Read Cache, App Servers, Autoscaler, CDN, Read Replica.

| Infrastructure | Effect per turn start (unless noted) |
| --- | --- |
| Read Cache | Gain Capacity equal to its warmth times its stacks, then warmth rises by 1, up to 6. Warmth starts at 1. |
| Cache Tuning | Raises the Read Cache warmth limit by 2 per stack. |
| Load Balancer | Routes App Servers. Without it they do nothing. |
| App Server | With a Load Balancer, gain 4 Capacity per stack. Without one, it is Unrouted and gives nothing. |
| Autoscaler | Gain Capacity equal to the Error Budget you lost since the start of your previous turn, up to 6 per stack. |
| CDN | Gain 2 Capacity per stack. |
| Message Queue | When Capacity resets, keep up to 5 per stack of what the enemies didn't use. |
| Read Replica | Serve a random enemy for 3 per stack (cache halving applies). |
| Health Checks | Node Failures you suffer last 1 turn instead of 2. |
| Failover | Ignores the next Node Failure, once per stack. Each failure it stops uses up a stack. |
| Circuit Breaker | Each time an enemy's hit burns your Error Budget, it gets Throttled 1 per stack as its turn ends, so it lasts through its next turn. |
| Auto Remediation | Remove 1 stack of your largest debuff, per stack. |
| On-Call Rotation | Whenever you draw a Pager, draw 1 card and gain 3 Capacity, per stack. |

**Node Failure** is an enemy move that disables one of your working infrastructure pieces, chosen at random, for your next 2 turns.
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

### Map generation

The map is a grid of 7 columns.
Six paths start on floor 1, the first two in different columns.
Each path climbs one floor at a time, moves at most one column left or right, and never crosses another path.
Every floor 15 node leads to the boss.
Nodes without a fixed kind are picked by weight: Incident 50, Event 22, Retro 12, Major Incident 10, Vendor 6, leaving out kinds the rules forbid there.
The boss and each Incident or Major Incident encounter are picked by weight from the act's encounters when the map is made, so the path you take doesn't change them or the next act's map.
An Event node holds an event for the act you haven't seen yet, if one is left; if the act has none, it is an Incident.

### Rewards

| Combat | Cash | Also |
| --- | --- | --- |
| Incident | 10-20 | A choice of 3 cards, 40% chance of a runbook |
| Major Incident | 25-35 | A choice of 3 cards, a relic, 40% chance of a runbook |
| Boss | 95-105 | A choice of 3 rare cards, then a choice of 3 boss relics |

Card choices can be skipped.
The chance of a rare card rises the longer you go without seeing one.

- Cash is rolled in the range, cut by Reject, raised by relics and rounded to the nearest.
- Offered cards come from your character's pool and the neutral pool, all different.
- Incident cards are 60% common, 35% uncommon and 5% rare. Major Incident cards are 50% common, 40% uncommon and 10% rare.
- Each combat whose cards had no rare raises the rare chance by 2 points, taken from common. A card offer with a rare in it resets this.
- Runbook drops are 60% common, 30% uncommon and 10% rare. With every slot full, discard a runbook to take it.
- Relics from Major Incidents, Treasure and events are 50% common, 33% uncommon and 17% rare, from your character's and neutral relics you don't own yet. When a rarity runs out, another one is used.
- Boss relics are 3 different boss relics you don't own. You can skip them.
- Beating the Act 3 boss wins the run at once.

### Cards, relics and runbooks

- Upgraded cards show a `+` after their name. A card can be upgraded once.
- Relics (tech) last for the whole run.
- Runbooks are single-use and can be used in combat. You can hold 3.

### Vendor

The shop sells 5 cards from your pool, 2 neutral cards, 3 relics and 3 runbooks.
Removing a card costs 75 cash, and 25 more each time you do it.
You can remove one card per visit.
You can back out of a removal before picking the card; the price is refunded and the removal doesn't count.
You start the run with 99 cash.

| Item | Common | Uncommon | Rare |
| --- | --- | --- | --- |
| Card | 50 | 75 | 150 |
| Relic | 150 | 250 | 300 |
| Runbook | 50 | 75 | 100 |

Shop relics cost 150.
Each price varies by up to 5% either way, and discounts apply to everything, removal included.
A discount bought at the Vendor applies to its other prices at once.
Shop cards are 55% common, 35% uncommon and 10% rare.

### Retro and events

A Retro rest recovers 30% of max Error Budget (20% at 99.999%), plus any relic bonus, rounded to the nearest.
You can back out of a Refactor before picking the card, and the Retro is open again.
A card an event asks you to pick can't be backed out of, since its cost is already paid.
A choice that needs N Error Budget needs more than N, so paying it can't breach the SLA.
A choice that needs N cash needs at least N.
A choice that would do nothing can't be made, for example upgrading a card with none left to upgrade, or gaining a runbook with every slot full.

## Difficulty

Difficulty is measured in nines.
Each level adds to the ones below it.

| Level | Adds |
| --- | --- |
| 99% | Base rules |
| 99.9% | Major Incidents have 25% more Load. |
| 99.99% | Incidents have 10% more Load, and you start with a Tech Debt in your deck. |
| 99.999% | Bosses have 15% more Load, and a Retro recovers 20% instead of 30%. |

Extra Load applies to every enemy in that kind of encounter, summoned ones included, and is rounded to the nearest.
Winning a run with a character unlocks the next level for that character.

## Tutorial

Your first run opens with a guided first combat: Maya points out the hand, an enemy's intent, Capacity and End Turn.
It can be skipped, and it doesn't come back once it is finished or skipped.
The steps are, in order: the hand, an enemy's intent, Capacity and End Turn.
The tutorial never blocks play, and it uses the tutorial encounter when the content has one.

## Saves

The run in progress is saved after every action, so closing the tab and coming back resumes at the same point.
The browser also keeps unlocked difficulties, the last 20 run results, settings and whether the tutorial is done.
Saves only live in this browser.
