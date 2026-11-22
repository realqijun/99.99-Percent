# UI design

How the game looks and how to review a UI change.
The code is in `frontend/src/ui/`, the styles in `frontend/src/ui/ui.css` and `frontend/src/index.css`.

## Visual language

- Dark navy background (`#1d1834`) with gold (`#ffd84a`) for the brand, primary buttons, selection and anything you can act on now.
- Pixel flavour: square corners, 3px dark outlines, hard drop shadows with no blur, no gradients on controls.
- Pixelify Sans (regular weight only) for the logo, headings and the large buttons.
  Its bold weight makes `c` look like `o`, and its small digits are hard to tell apart.
- Source Sans 3 for everything else, including every number (costs, Load, Error Budget, prices).
- Colours carry meaning and are always paired with a word or a number:
  red is Error Budget and danger, teal is Capacity and runbooks, purple is Infrastructure, green is good statuses and upgrades.
- Card frames by type: Serve (coral), Ops (blue), Infrastructure (purple, with an inner line), Status (grey, striped).
  Upgraded cards show a `+` and a green name.
- Copy is short and plain.
  Use the game's terms (Error Budget, Capacity, Engineers, Load, Buffer) exactly as in `docs/GAMEPLAY.md`.

## Layout

- Everything is laid out at a fixed 1280x720 design size and scaled to fit the window by `StageScaler`, with letterboxing.
  Use design pixels; never size things by the window.
- In a run, a 56px top bar sits over a 664px screen.
- Combat: you and your infrastructure on the left, incidents in the middle, the hand fanned along the bottom, Engineers and the draw pile bottom left, End turn and the other piles bottom right.
- Dialogs, tooltips and the error toast render inside the stage so they scale with it.
- The UI shows only engine state.
  Card text, costs, playability, reachable nodes, choice candidates, event requirements and the Retro amount come from the engine's API in `engine/index.ts`.
- Animation comes from the store's event queue, 100-350 ms per effect, halved on Fast, and off with Reduce motion.
- After the winning blow the combat stays on screen, frozen, for 900 ms (450 ms on Fast, none with Reduce motion) so the blow plays out before the rewards show.
  The engine's run is already on the reward screen; the hold is UI only.

## Review checklist

Run `npm run dev` and open each fixture with `?screen=<name>` (the list is in `src/ui/__fixtures__/runs.ts`; `?screen=title` shows the title).
The fixtures are real runs built with the engine and the game's content, so names and card text are the real ones.
`?gallery` shows every sprite and icon, and `?cover` and `?banner` the itch.io key art.
In dev, `debug.help()` in the console lists helpers that jump a real run ahead, such as `debug.floor(15)` before a boss or `debug.next("vendor")`.
None of this is in the build.
Check each screen at 1280x720 and inside a 960x540 iframe.

- Nothing overlaps, clips or runs off the stage, including the longest names (about 22 characters), the longest card text, a 10-card hand, five enemies (`combat-five`) and a full infrastructure list.
- Text is readable at 960x540: body text at least 13px at design size, numbers in Source Sans.
- Every control has an accessible name, a visible focus ring and works from the keyboard.
- Dialogs are labelled by their title, trap focus and close with Esc unless they must be answered.
- Disabled things say why (a tooltip, a label or the button text).
- No console errors or failed requests, and no em dashes in copy.
