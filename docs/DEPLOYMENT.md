# Deployment, CI and database

This is the source of truth for hosting, environment settings, the CI/CD pipeline and the production database.
Test commands are in [testing.md](testing.md); account-specific provider setup is in [AUTHENTICATION.md](AUTHENTICATION.md#deployment).

## Hosting

Two Vercel projects deploy from this repository, in the `hoo-di-hengs-projects` team.
Each rebuilds only when its own folder changed (`ignoreCommand` in its `vercel.json`).

| Project | Root | Production URL | Notes |
| --- | --- | --- | --- |
| `frontend` | `frontend/` | [99-99-percent-web.vercel.app](https://99-99-percent-web.vercel.app) | Static Vite build |
| `lingoquest-backend` | `backend/` | [99-99-percent-backend.vercel.app](https://99-99-percent-backend.vercel.app) | Express as a Vercel Function in Singapore (`sin1`), next to the database |

Merges to `main` deploy both projects to production, and every pull request gets preview URLs.
Changing a domain or setting does not update a running deployment; redeploy after changing environment variables.

## itch.io

The game ships to itch.io as an HTML5 build.

1. `cd frontend && npm run package:itch` builds and writes `release/99.99-percent-html5.zip`.
2. On the itch.io page, set Kind of project to HTML, upload the zip and tick "This file will be played in the browser".
3. Set the embed size to 1280x720 and turn on the fullscreen button.

To upload from the command line instead, use [butler](https://itch.io/docs/butler/): `butler push frontend/dist <user>/<game>:html5 --userversion <version>`.

## Environment variables

The frontend has none.
Local defaults for the backend are in `backend/.env.example`.

| Project | Variable | Kind | Purpose |
| --- | --- | --- | --- |
| backend | `CORS_ORIGINS` | Config | Allowed browser origins, comma-separated; `*` matches letters, digits and dashes |
| backend | `DATABASE_URL` | Secret | Neon pooled connection string for runtime queries |
| backend | `OPENAI_API_KEY` | Secret | Retained dialogue endpoint |
| backend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_ORIGIN` | Secret / Config | Google sign-in and the browser-facing origin for cookies and CSRF |

Set the backend's `CORS_ORIGINS` to `https://99-99-percent-web.vercel.app,https://frontend-*-hoo-di-hengs-projects.vercel.app`.
The preview pattern follows the Vercel project name, not its production domain.

GitHub Actions needs these under Settings > Secrets and variables > Actions:

| Name | Kind | Value |
| --- | --- | --- |
| `DATABASE_URL_UNPOOLED` | Secret | Neon's direct connection string, used by the migration |
| `API_URL` | Variable, optional | API for the smoke test; defaults to `https://99-99-percent-backend.vercel.app` |

## Pipeline

| Stage | When | Where | What |
| --- | --- | --- | --- |
| CI `frontend` | Every PR | `ci.yml` | Gate over `frontend-checks`: lint, typecheck, coverage, the itch.io zip and the Playwright tests |
| CI `backend` | Every PR | `ci.yml` | Lint, typecheck, coverage including every migration on in-memory Postgres, migrations match the schema |
| Preview deploy | Every PR | Vercel | Preview URL for each project |
| Production deploy | Push to `main` | Vercel | Both projects |
| Migrate database | Push to `main` | `cd.yml` | `npm run db:migrate` on the production Neon database |
| Smoke test | After the migration | `cd.yml` | `/api/health` and `/api/health/db` on the live API, retried while Vercel deploys |

The `frontend` and `backend` checks must pass on a branch that is up to date with `main` before merging.
CI does not rerun after the merge.

## Database

Postgres on [Neon](https://neon.tech) in Singapore, queried with [Drizzle](https://orm.drizzle.team).
Tables are defined in `backend/src/db/schema.ts`.

| Table | Holds |
| --- | --- |
| `game_accounts` | Verified identity (Google issuer and subject, or `email` and the address) and display name |
| `game_email_credentials` | scrypt password hashes and lockout state for email accounts |
| `game_sessions` | Hashed opaque session tokens, CSRF token and expiry |
| `game_auth_attempts` | Short-lived, browser-bound OAuth state, nonce and PKCE verifier |
| `game_runs` | Owner-scoped Guided Mode cloud saves and revisions |
| `game_feedback` | Anonymous player feedback: submission ID, message, mode and time |
| `players`, `sessions`, `dialogue_turns`, `mission_reports` | Retained tables from the earlier LingoQuest project, unused by the game |

To change the schema, edit `schema.ts`, run `npm run db:generate` in `backend/` and commit the new files in `backend/drizzle/`.
Never edit a merged migration.
The migration runs on production automatically after the merge, at the same moment Vercel deploys the new code, so keep migrations backward-compatible: add first, then drop or rename in a later PR.
Use `npm run db:studio` to browse a database, and your own Neon branch for local work that needs one.
