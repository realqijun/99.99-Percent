# Architecture

The game is a static Vite + React + TypeScript app in `frontend/`.
It makes no network requests and works from a sub-path inside an iframe, as itch.io serves it.

| Folder | Holds |
| --- | --- |
| `src/engine/` | Pure, seeded rules. `index.ts` is the public API and `types.ts` the shared types. No React, DOM or storage. |
| `src/content/` | Cards, enemies, encounters, relics, runbooks, events and characters, as data. |
| `src/game/` | The Zustand store, browser storage and audio. |
| `src/ui/` | React screens and components. `ui/art/` draws the pixel art. |
| `public/characters/` | Colleague portraits. |

## How a turn flows

1. The UI sends a `Command` to the store.
2. The store calls `applyCommand(run, command)`, which returns the new `RunState` and a list of `GameEvent`s.
3. The store saves the new state, then hands the events to the UI for animation and to audio for sound.

The UI never computes an outcome.
Card text, costs, playability and reachable map nodes all come from the engine.

## Rules for the engine

- All randomness comes from the seeded streams in `RunState.rng`, through `engine/rng.ts`. Never `Math.random()` or the clock.
- There are separate streams for the map, shuffles, random enemy targets, card rewards, enemy AI, events and other rewards, so a choice in one place can't change the luck in another.
- The map stream is only used when an act's map is made, which rolls the layout, the boss and every Incident and Major Incident encounter at once, so the path taken can't change a later act.
- `applyCommand` never mutates its input. A refused command returns the input unchanged with an `error`.
- Content is passed in as a `Content` object, which defaults to `src/content`. Engine tests use their own fixtures.

## Browser storage

All keys start with `n9999.`, because every itch.io HTML game shares one origin.
Every read is validated, and storage errors never stop play.

| Key | Holds |
| --- | --- |
| `n9999.run` | The run in progress: a `RunState` with its `version` |
| `n9999.profile` | Unlocked difficulties per character, the last 20 run results, whether the tutorial is done |
| `n9999.settings` | Volumes, mute, animation speed, reduced motion |

A saved run that fails validation is kept under `n9999.run.broken` and the title screen offers to export it.

## The backend

`backend/` and `shared/` hold the API from the earlier tycoon version (accounts, cloud saves, feedback, leaderboard).
The card game doesn't use them.
