# Phase B status - modular refactor, puzzles, no helpers

**Done.** Live: https://terrifier-game.vercel.app (game at `/game.html`). Headless: 23/23 logic + 38/38 UI/puzzle checks pass locally and on the live URL.

## What changed
1. `game.js` (monolith) replaced by `js/`: `config, audio, rooms, art, ui, puzzles, nights, main` on one `window.ART` namespace (classic scripts, no build step). Map in README.
2. Everything tunable is in `assets/manifest.json` (`game` block): nights, drain, graph, clock, feeds, lore, boot copy, door button position, auto-pan, puzzle hotspots/types/options. `?fast` / `?debug` still work.
3. Puzzles: `keypad`, `wires`, `tiles` registered through `ART.puzzles.register(name, fn)`; picked per night per hotspot in the manifest. Always solvable by construction.
4. Gameplay hooks: **fuse box** (left wall) adds 25% power or revives a dead house at 15%; **door bolt** (right wall, nights 2-5) holds the next attack once. Cooldowns 35 s / 50 s, status LED on each panel.
5. **No helpers**: help button, help menu, idle tips, subtitle bar, voice/mute/quit controls and the always-on HUD are gone (code, CSS, manifest, README, tests). A test asserts none exist.
6. **Diegetic affordances**: glowing door button on the wall; monitor lip with chevron at the bottom edge (tap or swipe up/down); natural drag (content follows the finger); a one-time first-run auto-pan sway reveals the side walls; all targets >= 44 px; HUD only flashes briefly when something changes.
7. Title screen: studio/clapper/timecode/REC look removed; plain ENTER.
8. Bug fixed on the way: view-yaw sign (hotspots anchored to the wrong side), wires puzzle layout.
9. Tests moved to `tests/` (`run-all.js`, `logic.js`, `ui.js`, `lib.js`), docs in `README.md` + `TEST.md`.

## Files
`js/*.js`, `game.html`, `index.html`, `assets/manifest.json` (v2), `assets/ui/{style,title}.{css,js}`, `tests/`, `TEST.md`, `README.md`. Removed: `game.js`, `scripts/a1.js`, `scripts/a2.js`.

## Screenshots (`docs/phase-B/`)
`b-title-screen`, `b-login`, `b-night1-office` (door button), `b-autopan-mid` / `b-autopan-right` (fuse box revealed), `b-door-locked`, `b-monitor-open`, `b-puzzle-keypad|wires|tiles`, `b-dead-fusebox`, `a-scare-beat1`, `a-scare-payoff`, `a-gameover`, `a-lore1`, `a-win`, `a-bad`.

## Real-iPhone-only (see TEST.md section 2)
Gyro permission + direction, audio unlock / silent switch, safe areas, bottom-edge swipe vs Safari gesture, thumb comfort, long-session heat.

## Next
Phase C (studio assets) - **not started**, waiting for go.
