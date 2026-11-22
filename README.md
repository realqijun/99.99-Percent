# 99.99 Percent

A turn-based card game about keeping a startup's servers online, made for itch.io.
CS3216 Final Project, Group 5.

It is being rebuilt from an earlier infrastructure tycoon; [docs/ROADMAP.md](docs/ROADMAP.md) has the plan.

## Docs

| Topic | Document |
| --- | --- |
| Gameplay rules | [docs/GAMEPLAY.md](docs/GAMEPLAY.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Tests and CI | [docs/testing.md](docs/testing.md) |
| Hosting, itch.io, CI/CD and the database | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Status and plan | [docs/ROADMAP.md](docs/ROADMAP.md) |
| The old version's API and accounts | [docs/api.md](docs/api.md), [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| Course proposal | [docs/PROJECT_PROPOSAL.md](docs/PROJECT_PROPOSAL.md) |
| Instructions for coding agents | [AGENTS.md](AGENTS.md) and `.agents/skills/` |

## Structure

```
frontend/   the game: React + Vite + TypeScript
  src/engine/  pure, seeded game rules
backend/    the old version's Express API, unused by the game
shared/     types shared with the backend
docs/       documentation
```

## Getting started

Needs Node 22 (`nvm use`).

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

| Script (in `frontend/`) | What it does |
| --- | --- |
| `npm run dev` | Run locally with hot reload |
| `npm run lint` / `npm run typecheck` | oxlint and TypeScript |
| `npm test` / `npm run test:coverage` | Vitest |
| `npm run test:e2e` | Build, then run the Playwright tests |
| `npm run package:itch` | Build the zip to upload to itch.io |

## Contributing

- Never push to `main`. Branch, open a pull request and get one approval.
- Branch names: `fe/…`, `be/…`, `chore/…`, `rewrite/…`.
- PR titles: `type(area): summary`, for example `feat(ai): voice loop`. The title becomes the squash commit message.
- The `frontend` and `backend` CI checks must pass on a branch that is up to date with `main`.
- Secrets go in `.env` files or Vercel settings, never in code.
- Changing a file in `shared/` changes a frontend/backend handoff, so agree it with the other side first.
- Merging to `main` deploys to production and migrates the production database.
