# Phase C status - room plates + original audio (done)

## Tooling
- Blender 4.3.2 (official portable build, headless, Cycles CPU, OIDN denoise). The apt Blender here has no OIDN, hence the portable one.
- Kdenlive 24.12.3 and Audacity 3.7.3 installed from apt, MLT `melt` 7.30.0; both GUIs launch under xvfb. Not needed to build Phase C (audio is numpy-generated); ready for Phase D.

## Room plates (`assets/rooms/*.jpg`, 3072x1536 equirectangular, 40 samples, single hard tungsten bulb, wood floors, plaster walls)
| room | size | script |
|---|---|---|
| attic (the office; door dead ahead, desk+CRT+phone left, fuse box right wall, bolt hatch left wall) | 510,741 B | scripts/blender/room_attic.py |
| kitchen | 594,753 B | room_kitchen.py |
| mortuary | 546,038 B | room_mortuary.py |
| hallway | 445,558 B | room_hallway.py |
| basement | 407,379 B | room_basement.py |
| frontdoor | 558,894 B | room_frontdoor.py |
All under 1.5 MB. Shared materials/props: `scripts/blender/common.py`. Rebuild with `scripts/blender/render_all.sh`. Plates are full 360x180; the game pans a window across them (office) and crops a 70 degree window (camera feeds). The mortuary has a plate and is in Art's graph but has no camera feed in the manifest.
Previews: `docs/phase-C/room-plates-overview.png`, `view-<room>.png` (perspective at yaw 0), `game-office.png`, `game-cam-*.png` (390x844 game screenshots).

## Audio (`assets/audio/`, original, `scripts/make_audio.py`, numpy/scipy)
hum.wav 8 s seamless sub-bass loop | stinger.wav 2.6 s violin-ish cluster + impact | breathing.wav 4.8 s one breath cycle | creak.wav 1.9 s hinge | static.wav 4 s phone static with a true 500 ms digital-silence gap.
Wired via `manifest.audio` and `js/audio.js`: fetched on the tap, decoded in the unlocked AudioContext, overrides check the buffer first and otherwise call the original oscillator sound. Hum replaces the oscillator drone as the main bed; stinger replaces sting/scream impact; breathing, camera static, phone call static, door creak (door toggle, Art arriving in the hallway). Ambient samples use the ducked bus so the 500 ms silence beat stays silent. iOS unlock path unchanged. No new UI, no helpers.

## Art silhouette
Existing `assets/art/art.png` kept (a Blender silhouette would not improve on it); `art-title*` untouched.

## Tests
logic 23/23, ui/puzzle 38/38, new audio 10/10 (samples decode; 404 fallback works), all local and against the live URL (see commit/report).
