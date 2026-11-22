# Working on 99.99 Percent

## Product and boundaries

This repository holds 99.99 Percent, a turn-based card game about keeping servers online, built for itch.io as an HTML5 game.
It runs offline in the browser and saves to localStorage.
It is being rebuilt from an earlier tycoon version; see `docs/ROADMAP.md`.
`backend/` and `shared/` are the old version's API; the game does not use them. Do not change them as part of frontend work.

Read the relevant files first:

- `frontend/src/engine/`: pure, seeded game rules.
- `backend/src/`, `backend/drizzle/`, `shared/`: the old API, database and shared types.
- `README.md`: the documentation map. Read the doc for the area you change, for example `docs/GAMEPLAY.md` for rules and `docs/testing.md` for test commands.

## Implementation rules

Keep the engine independent of React, browser storage and network access. Keep it seeded and its state serializable; never use the clock or `Math.random()` in it. Test an observable outcome and a failure case when changing behavior.

The game must work from a sub-path inside an iframe, as itch.io serves it: use relative asset URLs and make no network requests. Storage can be corrupt or unavailable. Clean up timers and event listeners; React StrictMode must not start anything twice.

Preserve backend deployment configuration, environment names and migrations unless the task changes them. Never rewrite merged migrations. Schema changes require a new generated migration and an in-memory database test. Review changes to `shared/` as changes to a frontend/backend handoff.

When behavior changes, update the one document that owns it in the same PR. Put validation results and change history in the PR description, not in new files under `docs/`.

Secrets stay server-side. Never commit environment files, connection strings or tokens. Use isolated local data for tests. Production migrations and merges deploy automatically, so creating a PR does not authorize applying production migrations or merging it.

## Validation and PRs

At the start of each coding chat, before creating a branch, and immediately before pushing or creating/updating a PR, run `git fetch origin main` and compare the working branch with the freshly fetched `origin/main`. If the branch is behind, rebase it onto `origin/main` with `git rebase origin/main`; resolve any conflicts and rerun the relevant checks before pushing. Use rebase instead of merging `main` into the working branch, even when Git could merge without conflicts.

Preserve uncommitted work before rebasing and never discard others' changes to resolve conflicts. If an authorized push requires updating a rebased remote branch, use `--force-with-lease`, never plain `--force`. If fetching or rebasing cannot be completed, report the blocker and do not claim the branch is current or conflict-free.

Use Node 22 (see `.nvmrc`) and install separately with `npm ci` in `frontend/` and `backend/`. There is no root npm workspace.

For changed packages run `npm run lint`, `npm run typecheck` and the relevant tests. Before a PR run `npm run test:coverage` and `npm run test:e2e` for changed packages. For schema changes include `npm run db:generate` and verify only intentional new migration files appear. See `docs/testing.md` for the browser installation and commands.

Both required CI checks, `frontend` and `backend`, must pass. Browser tests run inside `frontend`, so existing branch protection also gates them. Report failed, skipped or unavailable verification honestly. A coverage percentage does not establish correctness; investigate relevant uncovered behavior.

Follow the branch, PR title and review conventions in `README.md` (Contributing), and never push directly to `main`. Describe the resulting behavior, validation and remaining limitations. Keep generated reports and browser binaries out of Git.

## Focused skills

Repo skills live in `.agents/skills/`. Load the skill that fits the task, not every skill:

| Skill | Use for |
| --- | --- |
| `browser-e2e` | Playwright tests and browser failures |
| `backend-testing` | API contracts, HTTP failures and CORS |
| `database-migrations` | Schema changes and migration verification |
| `release-check` | CI failures, PR readiness and deployment verification |
