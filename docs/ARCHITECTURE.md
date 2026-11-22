# Architecture

The game is a static Vite + React + TypeScript app in `frontend/`.
It makes no network requests.

| Folder | Holds |
| --- | --- |
| `frontend/src/engine/` | Pure, seeded game rules. No React, DOM or storage. |
| `frontend/src/` | The React app |

Rules:

- The engine is deterministic: all randomness comes from the seeded generator in `engine/rng.ts`, never `Math.random()` or the clock.
- The UI shows engine state and never computes an outcome itself.

`backend/` and `shared/` hold the API from the earlier tycoon version (accounts, cloud saves, feedback, leaderboard).
The card game does not use them.
