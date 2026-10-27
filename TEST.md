# TEST.md - Terrorific

## 1. Headless self-tests (run on every push)
```
python3 -m http.server 8077            # in the repo root
npm i puppeteer-core                   # once; set CHROME=/path/to/chrome if not /usr/bin/google-chrome
node tests/run-all.js http://localhost:8077/game.html /tmp/shots
```
Runs headless Chrome at 390x844 @2x with touch emulation and prints PASS / FAIL per check plus a final `RESULT:` line (exit code 1 on any failure). Point the URL at the live site to test production.

| suite | what it proves |
|---|---|
| `tests/logic.js` (23) | night 1 starts from the tap; Art frozen while observed, moves when not; camera drains power faster than idle; night 3 appears in the room just checked; locked door holds; 10% forced light-out scare (3-beat) and the game continues; open door -> jumpscare -> game over; retry; power 0 -> dead -> Art attacks; nights 1-5 -> lore -> next night -> win; 10-min cap -> bad ending; no console errors |
| `tests/ui.js` (38) | all 7 modules loaded; manifest values reach gameplay (hotspot yaw, amount, puzzle type, night length are patched in flight and observed); **no help / hint / tip / mute / quit / subtitle elements, keys or strings anywhere**; first-run auto-pan plays once and marks itself seen; door button on screen and >= 44 px, locks / unlocks; monitor lip opens by tap and by swipe-up and closes by tap; dragging right turns the view left; fuse box and door bolt panels appear when you turn to them; keypad, wires and tiles solved through the real DOM; power +25%; cooldown refuses; wrong code does not solve; close works; dead house rescued by the fuse box; bolted door holds an attack; hotspots inert while the monitor is up; puzzle registry accepts new types; no console errors |
| `tests/audio.js` (12) | the five manifest WAVs are fetched and decoded in the tap-unlocked AudioContext; every sample-backed sound (stinger, breath, creak, static, phone, scream, lock) plays without throwing; no console errors; with every WAV forced to 404 the oscillator fallback plays, the game stays in `play`, and only the expected 404s are logged |
| `tests/video.js` (30) | video manifest slots + files served 200 and < 1.6 MB; cold-open intro plays, first play can't be skipped, then night 1 starts under a black cover; after it is seen a tap skips; the jump-scare video variant at yaw left/right/centre: 3 beats, full-screen, released after; never the same clip twice, cooldown, per-night cap, night-1 exclusion; with every mp4 404ing the intro and the scare fall back cleanly |
| `tests/voice.js` (40) | lines.json contract (14 lines, 5-15 words, monotonic word timings), all files fetched + decoded in the tap-unlocked context with durations matching; intro first-run only, night 1-5 openings, win / bad lines; a new night cancels a pending line; ambient ducks while he speaks; taunts only in the payoff after the 500 ms silence, none on night 1, ~18 % on a peek, 75 s gap; lore receipt / diary / call text fades in word-by-word and Continue appears; with every voice file 404 the lore text still fades in (proportional timing) and nothing throws; no mute/speaker/subtitle UI |
| `tests/camlock.js` (114) | camera-locked jump scares: with the view hard left / hard right every payoff eases the yaw to centre, puts Art screen-space in front of the player, keeps trigger -> 500 ms silence -> payoff; also with the run sheet blocked |
| `tests/hardpuz.js` (26) | ledger (unique deduction, misleading scraps), music box, multi-stage hotspots, burning-fuse time pressure, strikes + power drain, per-night scaling, no hand-holding text |
| `tests/feedscare.js` (20) | camera-feed scare: 3 beats (tear, 500 ms silence, pop), monitor stays open and locked, never the same variant twice, night gates |
| `tests/peek.js` (20) | corner peek: manifest per-night config, none on night 1, anchored to the plate (hidden facing away, edge pans ~6 px/deg), edge mask + size, sways, no sting/overlay (no jump), leads into the 3-beat peek scare (>= 495 ms silence), unwatched timeout, deferred while the monitor is open, chance 0 = old behaviour |
| `tests/grab.js` (18) | door grab: none on night 1, press/lift, win and lose both resolve with 500 ms silence, lose uses the face pop, state resets per night |
| `tests/taunts.js` (13) | whisper / low laugh / mocking creak: never on night 1, never during a scare or grab, gap and no-repeat rules |
| `tests/eggs.js` (16) | easter-egg JSON contract, disabled examples, `?eggs=1` preview, once-only seen flag, plain-text rendering |
| `tests/dog.js` (21) | dog mocking egg: asset <= 250 KB, config schema, hooks (puzzleWrong/puzzleFail/doorFail/grabLose/caught), rare odds + never twice in a row, cooldown and per-night cap, off in test mode, 3 beats with >= 495 ms silence, small corner pop (not full screen), ~1.2 s stay then leaves, cleanup, no lunge/fail-scare, empty `video.dogAttack` slot, 404 falls back to nothing |

Latest result: see `status/phase-G.md` (earlier `status/phase-E.md`). Screenshots and renders: `docs/phase-E/` (earlier: `docs/phase-C/`, `docs/phase-B/`).

## 2. Real iPhone only (cannot be proven headless)
Test on an iPhone, Safari, over HTTPS (the Vercel URL).
- [ ] AUTHENTICATE shows the Motion & Orientation prompt; after Allow, turning the phone turns the view (no prompt = drag-only fallback still works).
- [ ] Gyro direction: turn right -> the view turns right. Dragging with a finger moves the room under the finger.
- [ ] Audio plays after the first tap (breathing, drone, stings). Check with the ring/silent switch ON and OFF; lock/unlock and app-switch the phone and confirm audio comes back.
- [ ] The 500 ms silence before each payoff is truly silent (no hum under it).
- [ ] Safe areas: the monitor lip clears the home indicator; nothing hides behind the notch / Dynamic Island in portrait or landscape.
- [ ] Door button, side-wall panels and monitor lip are comfortable to hit with a thumb (>= 44 px).
- [ ] The monitor lip swipe-up is not hijacked by Safari's bottom-edge gesture (fallback: tap).
- [ ] No pinch-zoom, double-tap zoom or rubber-band scroll anywhere.
- [ ] Rotating the phone keeps the view and hotspots aligned.
- [ ] 10+ minutes of play: frame rate stays smooth, phone does not overheat, no tab reload.
- [ ] Monitor clips and the peek: the feed clips play muted and inline on the cam feed (no fullscreen player); the corner peek sways smoothly and the scare after it still has its silent half-second.
- [ ] Video: the intro starts inside the AUTHENTICATE tap with sound (no extra tap, no 'play' glyph), plays inline (not the system fullscreen player), and with the silent switch ON still has sound (it is routed through Web Audio).
- [ ] Video: the jump-scare clips start instantly (no black frame / spinner) even on the first scare after a long quiet spell and after an app switch; they play inline, cover the whole screen including under the notch, and the view/monitor underneath is not touched.
- [ ] Video: after the intro, tapping it skips (first play is not skippable); no flash of the terminal screen between intro and night 1.
- [ ] Video memory/heat: 15 minutes of play with several video scares does not reload the tab or get noticeably hot (clips are ~1.2 MB each, three video elements kept alive).
- [ ] First-ever play: the room sways once by itself; second visit it does not (clear site data to see it again).

## 3. Manual smoke (30 s)
Title -> ENTER -> AUTHENTICATE -> night 1 -> lock the door -> flip the monitor -> flip it down -> turn to the left wall -> solve the fuse box -> let power die -> rescue it.
- [ ] Door grab: mashing / holding on the door feels fair; the door jitter and LED read clearly; haptics are a no-op on iPhone (Safari has no `navigator.vibrate`).
- [ ] Dog Easter egg: the photo cut-out looks clean at device scale in the bottom-right corner, the snicker is audible but not harsh, and it feels cheeky rather than startling (set `dogEgg.chance` to 1 to preview).
- [ ] Taunt whispers / low laugh / mocking creak: audible but not louder than the stingers.
- [ ] Camera-feed scare while the monitor is open: no gap between tear, silence and pop on a real GPU.
