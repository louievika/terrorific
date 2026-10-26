# Phase A - playable game

- A-Frame **1.8.0** (released 2026-06-23, latest stable per github.com/aframevr/aframe releases), CDN `https://aframe.io/releases/1.8.0/aframe.min.js`. Verified via web search and HTTP 200.
- Flow: `index.html` (title, unchanged) -> `game.html` login -> game scene -> lore -> win / game over / bad ending.
- Scene: room plate a-sky, swinging bulb, Art overlay, power HUD, 4-feed camera monitor, night counter, countdown timer, 10-min cap.
- `game.js`: nights 1-5 (60-100 s), power drain, Art graph AI frozen while observed, night-3 'appears in room just checked', 3-beat scares (peek, lights-out at 10%, attack), lore screens, win.

## Headless self-test (a2.js): 23/23 PASS, no console errors
night start, art frozen while observed, moves unobserved, camera drains more, night-3 appear, locked door holds, lights-out beat, scare ends, open door -> jumpscare -> game over, retry, power 0 -> dead -> attack, nights 1-5 -> lore -> win, 10-min cap bad ending.
Bug found+fixed by the tests: stale scare callbacks leaking across `startNight` (generation token `S.gen`).

## Screenshots (`docs/phase-A/`)
login, game, monitor, scare-beat1, scare-payoff, jumpscare, gameover, powerdead, lore1, lore3, win, bad.

## Known placeholders
Procedural plates, cut-out Art from reference image, synthesized audio. Next: Phase B refactor.
