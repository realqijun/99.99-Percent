# 99.99 Percent - itch.io page

The game's user-facing name is "99.99 Percent".
Use it for the page title and everywhere else on the page.
The images in this folder come from `npm run itch:media` in `frontend/`.

## Page settings

- Title: 99.99 Percent
- Short description: A roguelike deckbuilder about keeping a startup's service online.
- Kind of project: HTML
- Upload: `frontend/release/99.99-percent-html5.zip` from `npm run package:itch`, with "This file will be played in the browser" ticked
- Embed size: 1280x720
- Fullscreen button: on
- Mobile friendly: off
- Genre: Card Game
- Tags: deckbuilder, roguelike, card-game, turn-based, pixel-art, programming, singleplayer
- Cover image: `cover.png` (630x500)
- Banner: `banner.png` (960x250)
- Screenshots, in order: `screenshot-1-combat.png`, `screenshot-2-map.png`, `screenshot-3-vendor.png`, `screenshot-4-event.png`, `screenshot-5-boss.png`

## Page text

You are on call at a startup that just launched.
Play cards to serve the traffic, keep the service up and climb from seed stage to IPO.

### How it plays

- Your Error Budget is your health.
  Requests your Capacity can't absorb burn it, and at 0 the SLA is breached.
- Each turn you spend Engineers to play cards: Serve works down an incident's Load, Ops cards mostly add Capacity, and Infrastructure stays for the whole fight.
- Infrastructure pays off over time.
  The Read Cache warms up turn by turn, App Servers do nothing until a Load Balancer routes them, and a Node Failure can knock a piece offline.
- Climb three acts of branching maps with incidents, colleagues, vendors and retros.
  Each act ends in a boss: Launch Day, Black Friday and Region Outage.
- Play as Jordan, a platform engineer who builds capacity, or Taylor, a site reliability engineer who keeps things running when they break.
- Difficulty is measured in nines, from 99% up to 99.999%.
  Winning a run unlocks the next nine for that character.

### Controls

- Mouse: click a card, then click an incident to play it on, or drag the card onto the incident.
- 1-9: pick a card from your hand, then Enter to play it.
- E: end the turn.
- Esc: put a picked card back or close a window.

### Saves

It runs offline and saves in your browser after every action, so you can close the tab and carry on later.
Saves stay in that browser only.

### Credits

Made by CS3216 Group 5.
