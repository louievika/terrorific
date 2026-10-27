# Terrorific

A Terrifier 2-themed, FNAF-style horror game for iPhone Safari (touch + gyroscope), built with plain HTML/JS and [A-Frame](https://aframe.io) 1.8.0. MIT licensed.

**Status:** Phase B done: modular `js/` code, manifest-driven, three swappable puzzles, headless self-tests. Phase C (studio assets) and D (Art voice) next. See `status/`.

## Title screen
- Animated Art (breathing, irregular blinks, micro-twitches), swinging bulb, one plain ENTER button.
- Light-out scare = 3 beats: flicker trigger -> 500 ms total silence -> payoff (Art creeps closer + sting).
- Original audio only: five WAVs synthesized with numpy (`scripts/make_audio.py`), plus the Web Audio oscillator synth as the always-available fallback.
- iOS Safari: AudioContext created/resumed inside the first tap; silent buffer played; `navigator.audioSession` set to `playback` when available.

## Assets and licenses
- `assets/art/art-title.png` / `art-title-source.jpg`: **user-supplied reference image (not original art)** kept as a placeholder until final assets arrive. Swap it by replacing the file, then run `python3 scripts/make_title_assets.py` to rebuild the derived files (`art-title-m.jpg`, `art-title-blink.png`, `art-title.webp`). Eye/jaw regions in that script are tuned to the current image.
- All code, UI, and synthesized audio: MIT (original).
- No Terrifier audio/video is used.

## Run locally
`python3 -m http.server 8000` then open `http://localhost:8000/` (use HTTPS in production: iOS requires it for motion sensors).

## Game
Flow: title ENTER -> `game.html` login (AUTHENTICATE requests motion permission inside the tap and unlocks audio) -> nights 1-5 -> lore screens between nights -> win. 10-minute session cap -> bad ending.

Everything is discoverable by sight, with no text prompts, no settings buttons and no always-on HUD:
- Look: gyro (iOS `DeviceOrientationEvent.requestPermission`), or drag. Dragging moves the room under your finger.
- The first time you ever play, the room sways left and right once by itself (`autoPan`) so the side walls reveal themselves. It never repeats (`localStorage art_login_seen_v1`).
- DOOR: a glowing button on the wall beside the doorway. Tap to lock / unlock (locking drains power).
- MONITOR: a lip at the bottom edge with a chevron. Tap it or swipe up to flip the monitor up, again to put it down. Four feeds (basement, kitchen, front door, hall); Art never moves while you watch his room. Night 3+ he can show up in the room you just stopped checking.
- FUSE BOX (left wall, nights 1-5): solve its puzzle to add power; if the house has gone dark it brings the lights back at 15% so Art does not get in.
- DOOR BOLT (right wall, nights 2-5): solve its puzzle to bolt the door shut once; it holds the next attack for free and then breaks. Each panel has a cooldown and a status LED.
- The power / night / clock readout appears only for a moment when it changes (night start, power warnings, after a puzzle).
- Power drains with camera and door use. At 10%: forced light-out scare. At 0%: the house dies, Art comes for you in 10-14 s unless the fuse box puzzle is solved.
- Every scare has 3 beats: visual trigger -> 500 ms silence (ambient ducked to 0) -> payoff (Art scale-up + sting).
- Debug: `?debug=1` panel, `?fast=N` speeds game time. Save: localStorage `art_login_save_v1`.

## Code map (`js/`, classic scripts on one `window.ART` namespace, no build step)
Load order is fixed in `game.html`: `config -> audio -> rooms -> art -> ui -> puzzles -> nights -> main`.

| file | owns |
|---|---|
| `config.js` | `ART.$`, flags (`?fast`, `?debug`), fallbacks `ART.CFG`, `ART.config.load()` (merges the manifest) |
| `voice.js` | Art's voice: loads `assets/voice/lines.json`, plays lines on the shared AudioContext (own bus + ambient duck), taunts, word-timed lore text |
| `audio.js` | `ART.A` (the synth in `assets/ui/audio-engine.js`) + puzzle sounds, `ART.audio.unlockInTap/resume/duck` |
| `rooms.js` | plates, preload, sky swap, camera-feed canvas (`ART.rooms.drawFeed`) |
| `art.js` | Art overlay, movement, `ART.art.scare(kind, done)` (the 3-beat scare), observation rule |
| `ui.js` | view (gyro/drag/auto-pan), world-anchored hotspots, monitor lip, transient HUD, lore, login terminal |
| `puzzles.js` | puzzle registry + the fuse box / door bolt hotspots |
| `nights.js` | state `ART.S`, night start/finish, per-tick rules, attacks, save |
| `main.js` | frame loop, AUTHENTICATE tap, boot, `window.__game` test hook |

### Swappable puzzles
A puzzle is a function `fn(root, opts, api) -> { destroy(), solution() }`; call `api.solved()` / `api.failed()` / `api.tap()`. Register it and name it in the manifest:
```js
ART.puzzles.register('mytype', function (root, opts, api) { /* build DOM in root */ return { destroy(){}, solution(){ return 42; } }; });
```
Built in: `keypad` (memorise the code on the note, key it in), `wires` (join matching colours), `tiles` (breaker grid, light-out style). Each is solvable by construction (random code; shuffled wires; tiles scrambled by real presses from the solved board).

## Manifest schema (`assets/manifest.json`)
Missing keys fall back to `js/config.js`. Unknown keys are ignored. `version` is 2.

| key | meaning |
|---|---|
| `title.*` | title image slots, ENTER delay, `nextUrl`, `scare{...}` timings (see file) |
| `art` | path of the Art cut-out |
| `rooms{id:path}` | equirect plates (`attic`, `kitchen`, `mortuary`, `hallway`, `basement`, `frontdoor`). Same-name drop-in swap. |
| `game.sessionCapSec`, `powerStartPct`, `lightsOutAtPct`, `deadAttackDelaySec[min,max]` | global rules |
| `game.drain{idle,camera,door,doorHitPenaltyPct}` | power per second / door hit penalty |
| `game.graph{room:[next]}` | Art's movement graph |
| `game.nights[5]{len,start,moveMin,moveMax,aggro,attackSec,drainMul,appearP,peeks}` | per-night tuning |
| `game.clock[]`, `game.feeds{id:{n,...}}` | hour labels, camera names / look |
| `game.lore[5]`, `game.boot[]`, `game.text{overDoor,overPower,overDead,win,bad}` | story and screen copy |
| `game.doorButton{yawDeg,topPct}` | where the door button sits (degrees from straight ahead, + = left) |
| `voice{lines,gain,duck,taunt{startNight,chance{peek,lightsout,attack},minGapSec,delayMs[]}}` | Art's voice (Phase D): lines.json path, level, ambient level while he speaks, taunt odds (payoff beat only) |
| `game.lore[i].voice/art/voiceMode` | line id + Art's text shown on that lore screen (`voiceMode:"call"` = he cuts in on the caretaker call) |
| `game.autoPan{startSec,durSec,ampDeg}` | the one-time sway on first play |
| `game.puzzles.hotspots.<fusebox\|doorbolt>{yawDeg,topPct,effect,amountPct,restoreDeadPct,cooldownSec,types[5]}` | wall panel placement, effect (`power` / `bolt`), and puzzle type per night (`null` disables that night) |
| `game.puzzles.<type>{...}` | options per puzzle; arrays are indexed by night (`digits`, `memorizeMs[]`, `count[]`, `size`, `scrambles[]`) |

### Assets
- `assets/rooms/*.jpg`: procedural equirect room plates (`scripts/make_rooms.py`, numpy/Pillow) - placeholders until Phase C Blender plates.
- `assets/art/art.png`: cut-out of Art made by `scripts/make_art.py` **from the user-supplied reference image (not original art)**. The title art derives from the same reference.
- Audio: `assets/audio/*.wav` are original, generated by `python3 scripts/make_audio.py` (numpy/scipy, no samples). They are listed in `manifest.audio` (`hum`, `stinger`, `breathing`, `creak`, `static`); a missing or undecodable file falls back to the oscillator synth in `assets/ui/audio-engine.js`. No Terrifier audio.
- Room plates: `assets/rooms/{attic,kitchen,mortuary,hallway,basement,frontdoor}.jpg` are 3072x1536 equirectangular renders from `scripts/blender/room_*.py` (Blender 4.3, Cycles CPU, one hard tungsten bulb). Rebuild: `BLENDER=/path/to/blender scripts/blender/render_all.sh [samples=48] [w=3072] [h=1536] [jpgQuality=82]` (set `OUT=dir` to render elsewhere). Needs a Blender build with OpenImageDenoise (the official portable build has it). `scripts/pano_view.py plate.jpg out.png yawDeg pitchDeg vfov w h` previews a perspective view of a plate.

- Art's voice (`assets/voice/*.mp3` + `lines.json`, 14 lines, ~370 KB): rendered offline by `scripts/make_voice.py` with **Piper (piper-tts 1.8.0, GPL-3.0-or-later, build tool only)** and the **`en_US-joe-medium` voice (CC0 dataset)**, then deepened (pitch x0.78 / tempo x0.88 with formants, sub-octave layer, EQ, saturation, compressor, stone-room tail). No runtime TTS, no network, nothing from the film. Rebuild: see the header of `scripts/make_voice.py` (venv + two curl downloads). Credit: Piper (OHF-Voice/piper1-gpl), voice `rhasspy/piper-voices` en_US/joe/medium (CC0). Rules: no voice on the title; no mute/speaker/subtitle UI; text only on the diegetic lore screens, faded in word-by-word from `lines.json` timings (works with no audio). Taunts: only in a scare payoff, after the 500 ms silence, from night 2, ~18-32 % per scare, at most one per 75 s.

### Tests
`TEST.md` has the full checklist. Headless: `python3 -m http.server 8077`, then `node tests/run-all.js http://localhost:8077/game.html /tmp/shots` (needs `npm i puppeteer-core` and Chrome; set `CHROME=` if not at `/usr/bin/google-chrome`).
