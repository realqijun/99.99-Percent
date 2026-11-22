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

CI runs all of this, plus `npm run package:itch`, in the `frontend-checks` job.
The required `frontend` check passes only if that job does.
The backend's tests are described in [DEPLOYMENT.md](DEPLOYMENT.md).
