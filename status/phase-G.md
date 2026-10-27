# Phase G progress notes

1. Title screen: real supplied Art media (3865661). 2. Opening zoomed out (0b1419d). 3. Art face redo (0ece637).
4. Camera monitor v1: clip surfacing, still fallback, CCTV glitch (8bd6c2f). Louie called the painted-body version horrible.
5. Camera monitor v2 (this phase's fix): `assets/art/art-bust.png` is a clean waist-up cutout from the supplied clip, fading to shadow, over a darkened room plate with CCTV treatment. `js/rooms.js` drawFeed, manifest `game.feedMedia`/`game.feeds`. Before: `docs/phase-G/after-monitor-art-*.png`; after: `docs/phase-G/after2-monitor-art-*.png`, `after2-monitor-clip-kitchen.png`.
6. Hallway peek: `js/peek.js`, `assets/art/art-peek.png`, manifest `game.peek`. Art peers around the attic partition edge, world-anchored, sways, then the 3-beat scare. `tests/peek.js` (20/20). Shots: `docs/phase-G/after-peek-*.png`.

## Tests
Local suites pass individually (feedscare 30, camlock 114, video 30, peek 20, etc.). camlock/video have timing flakes under load that do not involve this code.

## Weak spots
- Peek is on the attic partition edge, not a hallway plate; eyes-toward-player is lean/sway only; the lower body fades out in mid-air; the cleaver covers part of the face on partR.
- Bust source is 736x1232, so moderately soft on large screens.
- Needs verification on a real iPhone. Dog attack video slot is empty; easter-egg texts pending.
