# TEST.md - ART // LOGIN

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
| `tests/audio.js` (10) | the five manifest WAVs are fetched and decoded in the tap-unlocked AudioContext; every sample-backed sound (stinger, breath, creak, static, phone, scream, lock) plays without throwing; no console errors; with every WAV forced to 404 the oscillator fallback plays, the game stays in `play`, and only the expected 404s are logged |

Latest result: see `status/phase-C.md`. Screenshots and renders: `docs/phase-C/` (earlier: `docs/phase-B/`).

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
- [ ] First-ever play: the room sways once by itself; second visit it does not (clear site data to see it again).

## 3. Manual smoke (30 s)
Title -> ENTER -> AUTHENTICATE -> night 1 -> lock the door -> flip the monitor -> flip it down -> turn to the left wall -> solve the fuse box -> let power die -> rescue it.
