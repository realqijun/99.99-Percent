---
name: browser-e2e
description: Add or debug Playwright tests for the 99.99 Percent frontend.
---

# Browser tests

Read `frontend/playwright.config.ts` and `docs/testing.md`.
Run `npm run test:e2e` from `frontend/`.
The game is served from the sub-path in `GAME_PATH` and loaded in an iframe, as on itch.io.

- Use roles, accessible names and web-first assertions. No sleeps or forced clicks.
- Fail the test on failed requests and console errors.
- On failure read the report, screenshot and trace before changing an assertion.
