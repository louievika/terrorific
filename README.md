# ART // LOGIN

A Terrifier 2-themed, FNAF-style horror game for iPhone Safari (touch + gyroscope), built with plain HTML/JS and [A-Frame](https://aframe.io) 1.8.0. MIT licensed.

**Status:** Phase A done: title -> login -> 5-night playable game (`game.html` + `game.js`). Phase B (modular refactor), C (studio assets), D (Art voice) next. See `status/`.

## Title screen
- Animated Art (breathing, irregular blinks, micro-twitches), studio/set aesthetic (letterbox, timecode, REC, slate-style ENTER).
- Swinging bulb. Light-out scare = 3 beats: flicker trigger -> 500 ms total silence -> payoff (Art creeps closer + sting).
- Original synthesized audio only (Web Audio API oscillators/noise): breathing loop, drone, heartbeat, violin-ish stabs, sting.
- iOS Safari: AudioContext created/resumed inside the first tap; silent buffer played; `navigator.audioSession` set to `playback` when available.

## Config
Everything is driven from `assets/manifest.json` (`title` block: image slots, ENTER delay, slate text, scare timings). Add `?fast=1` for quick testing.

## Assets and licenses
- `assets/art/art-title.png` / `art-title-source.jpg`: **user-supplied reference image (not original art)** kept as a placeholder until final assets arrive. Swap it by replacing the file, then run `python3 scripts/make_title_assets.py` to rebuild the derived files (`art-title-m.jpg`, `art-title-blink.png`, `art-title.webp`). Eye/jaw regions in that script are tuned to the current image.
- All code, UI, and synthesized audio: MIT (original).
- No Terrifier audio/video is used.

## Run locally
`python3 -m http.server 8000` then open `http://localhost:8000/` (use HTTPS in production: iOS requires it for motion sensors).

## Game (Phase A)
Flow: title ENTER -> `game.html` login (AUTHENTICATE requests motion permission inside the tap and unlocks audio) -> nights 1-5 -> lore screens between nights -> win. 10-minute session cap -> bad ending.
- Look: gyro (iOS `DeviceOrientationEvent.requestPermission`) with drag-look fallback.
- CAMERAS: 4 feeds (basement, kitchen, front door, hallway). Power drains faster with cameras/door. Art never moves while you watch his room. Night 3+ he can pop up in the room you just stopped checking.
- DOOR: lock it when he reaches the hallway (costs power). At 10% power: forced light-out scare. At 0%: he attacks.
- Every scare has 3 beats: visual trigger -> 500 ms silence (ambient ducked to 0) -> payoff (Art scale-up + sting).
- Debug: `?debug=1` panel, `?fast=N` speeds game time.
- Save: localStorage `art_login_save_v1`.

### Manifest `game` block (`assets/manifest.json`)
`sessionCapSec`, `powerStartPct`, `lightsOutAtPct`, `deadAttackDelaySec`, `drain{idle,camera,door,doorHitPenaltyPct}`, `graph{room:[next rooms]}`, `nights[5]{len,start,moveMin,moveMax,aggro,attackSec,drainMul,appearP,peeks}`.

### Assets
- `assets/rooms/*.jpg`: procedural equirect room plates (`scripts/make_rooms.py`, numpy/Pillow) - placeholders until Phase C Blender plates.
- `assets/art/art.png`: cut-out of Art made by `scripts/make_art.py` **from the user-supplied reference image (not original art)**. The title art derives from the same reference.
- Audio: Web Audio synthesis only (`assets/ui/audio-engine.js`), no Terrifier audio.

### Tests
`node scripts/a2.js <url> <screenshot-dir>` (puppeteer-core, headless Chrome 390x844): 23 logic checks. `scripts/a1.js` is the smoke test.
