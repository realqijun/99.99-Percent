# Testing

Run these in `frontend/` with Node 22.

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | oxlint and TypeScript |
| `npm test` / `npm run test:coverage` | Vitest unit tests |
| `npm run balance` | The balance simulation, described below |
| `npx playwright install chromium` | Install the test browser once |
| `npm run test:e2e` | Build, then run the Playwright tests against the build |

The Playwright tests serve `dist/` from a sub-path and load it in a 1280x720 iframe, the way itch.io does.
This catches absolute asset paths and failed requests.
Every test fails on a console error, a page error or a failed request (`e2e/support.ts`).

The host page around the iframe has the game's origin, so a test can write localStorage before the game loads.
Advanced states are built with the engine in Node (`import` from `../src/engine`) and saved that way, never through test hooks in the game.

## Browser journeys

| File | Journey |
| --- | --- |
| `itch.spec.ts` | The game loads from the sub-path in 1280x720 and 960x540 iframes and fills each. |
| `first-combat.spec.ts` | A new run with a fixed seed: the tutorial, the first combat with the mouse, the reward and the map. |
| `first-combat.spec.ts` | The same first combat with the keyboard only. |
| `first-combat.spec.ts` | Reloading mid-combat resumes the same hand, intents, Load and Error Budget. |
| `saves.spec.ts` | Losing all Error Budget shows the summary with the result and seed; the title offers a new run and the history lists it. |
| `saves.spec.ts` | With localStorage blocked the game still starts and plays. |
| `saves.spec.ts` | A corrupt saved run moves to the broken-save slot and the title exports it. |
| `rooms.spec.ts` | The Vendor sells a card and removes one. |
| `rooms.spec.ts` | A Retro rest recovers the amount shown; a Refactor upgrades a card with a preview. |
| `rooms.spec.ts` | An event plays its lines, takes a choice and shows the reply. |
| `rooms.spec.ts` | Beating a boss offers boss relics, then the next act's map. |
| `settings.spec.ts` | Settings persist across a reload, and mute puts the audio to sleep. |

## Balance simulation

`npm run balance` runs `src/engine/__tests__/balance.test.ts`, which `npm test` leaves out because it takes about 45 seconds.
A heuristic bot (`src/engine/bot.ts`) plays seeded runs with the real content: 200 per character at 99%, then 100, 80 and 60 at the higher levels.
It prints a table of win rate, Act 1 and Act 2 clears, the average act and floor of death, the top killer encounters, turns per combat and Error Budget lost per act.
The bot is weaker than a good player, so the bands are set for it:

- At 99%, each character clears Act 1 in 25-50% of runs and wins 5-20% of them.
- At 99%, no encounter causes more than 25% of a character's deaths.
  Above 99% each character has too few deaths to judge alone, so the share is checked on both characters together.
- Each level up, the average floor of death is lower and the win rate is no higher, give or take one run of seed noise.
- No encounter averages more than 12 turns.
- No run gets stuck: a combat past 60 turns counts as a loss and fails the check.

Set `BALANCE_SCALE=0.25` for fewer runs, `BALANCE_LEVELS=0` for one level, `BALANCE_ENCOUNTERS=1` for per-encounter numbers and `BALANCE_CARDS=1` for card pick rates.
After changing content numbers, run it and keep the bands passing.

## CI

CI runs the checks above, plus `npm run package:itch`, in the `frontend-checks` job, and the balance simulation in the `frontend-balance` job.
The required `frontend` check passes only if both jobs do.
The backend's tests are described in [DEPLOYMENT.md](DEPLOYMENT.md).
