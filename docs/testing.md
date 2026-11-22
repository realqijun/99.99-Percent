# Testing

Run these in `frontend/` with Node 22.

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | oxlint and TypeScript |
| `npm test` / `npm run test:coverage` | Vitest unit tests |
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

CI runs all of this, plus `npm run package:itch`, in the `frontend-checks` job.
The required `frontend` check passes only if that job does.
The backend's tests are described in [DEPLOYMENT.md](DEPLOYMENT.md).
