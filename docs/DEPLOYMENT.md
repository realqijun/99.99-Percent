# Deployment, CI and database

This is the source of truth for hosting, environment settings, CI and the database.
Test commands are in [testing.md](testing.md); account-specific provider setup is in [AUTHENTICATION.md](AUTHENTICATION.md#deployment).

## Hosting

The game ships only to itch.io.
This repository is a fork of `CS3216-Final-Project/99.9-Percent`, whose Vercel projects host the earlier tycoon version.
Git deploys are off in `frontend/vercel.json` and `backend/vercel.json`, so Vercel builds nothing from this fork, even if a project is linked to it.
There is no CD workflow.

## itch.io

The game ships to itch.io as an HTML5 build.

1. `cd frontend && npm run package:itch` builds and writes `release/99.99-percent-html5.zip`.
2. On the itch.io page, set Kind of project to HTML, upload the zip and tick "This file will be played in the browser".
3. Set the embed size to 1280x720 and turn on the fullscreen button.

To upload from the command line instead, use [butler](https://itch.io/docs/butler/): `butler push frontend/dist <user>/<game>:html5 --userversion <version>`.

The store page's assets live in `itch/` at the repository root.
`itch/page.md` holds the page text and the rest of the page settings: genre, tags, mobile and the order of the images.
`cd frontend && npm run itch:media` redraws the images in that folder: `cover.png` (630x500), `banner.png` (960x250) and five 1280x720 screenshots.
It starts the dev server and photographs the dev-only key art (`?cover`, `?banner`) and fixture runs (`?screen=<name>`) with Playwright, so rerun it and commit the images after changing the art, the cards or a screen they show.

## Environment variables

The frontend has none.
Local defaults for the backend are in `backend/.env.example`.

| Project | Variable | Kind | Purpose |
| --- | --- | --- | --- |
| backend | `CORS_ORIGINS` | Config | Allowed browser origins, comma-separated; `*` matches letters, digits and dashes |
| backend | `DATABASE_URL` | Secret | Neon pooled connection string for runtime queries |
| backend | `OPENAI_API_KEY` | Secret | Retained dialogue endpoint |
| backend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_ORIGIN` | Secret / Config | Google sign-in and the browser-facing origin for cookies and CSRF |

## Pipeline

| Stage | When | Where | What |
| --- | --- | --- | --- |
| CI `frontend` | Every PR | `ci.yml` | Gate over `frontend-checks` (lint, typecheck, coverage, the itch.io zip, the Playwright tests) and `frontend-balance` (the balance simulation) |
| CI `backend` | Every PR | `ci.yml` | Lint, typecheck, coverage including every migration on in-memory Postgres, migrations match the schema |

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
Nothing runs migrations on a live database from this fork.
Keep migrations backward-compatible anyway: add first, then drop or rename in a later PR.
Use `npm run db:studio` to browse a database, and your own Neon branch for local work that needs one.
