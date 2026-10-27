# Phase E progress notes (newest at the bottom)

## 1. Quieter breathing - done
`manifest.audio.mix.breathing = 0.15` (was hard-coded 0.8) read via `ART.MIX.breathing` (js/config.js defaults, merged from the manifest) in js/audio.js; the oscillator fallback bus is scaled to the same level. Title screen breathing loop: `manifest.title.breathGain = 0.15`, applied to the title's breath bus (assets/ui/title.js). Tests: tests/audio.js now 13 checks (mix level, title gain on the real title page).

## 2. Running art sprite - done (2D rig, not Blender)
`assets/art/art-run.webp` (12-frame 2D sheet, 348 KB) built by `scripts/make_art_run.py` from the clean Art matte (`scripts/make_art.py --rembg`, open-source ISNet + pymatting, premultiplied-alpha resize, original hat, torso fade): bob/sway/roll/shear, sub-sample motion blur, grain, room grade. Played from CSS/rAF (`#artRun`), synced with synthesized footfalls (`A.footfall`) and a varied stab (`A.stab`); static scale-up fallback when the sheet 404s. Manifest `art.run`. The scare VARIETY director (`js/director.js`, manifest `game.scares.variants`) picks the variant per kind (no immediate repeats, recency weighted, jitter, fake-outs only on beats 1-2). Every scare still has 3 beats (trigger, 500 ms silence, payoff).

## Camera-lock fix (Louie 6:51 PM) - done
Payoff overlays are screen-space; `ART.ui.lockView()` eases `ART.V.yaw` to centre on the payoff beat (drag and gyro). Test `tests/camlock.js`: view hard left and hard right x 7 scare variants x (sheet / static fallback) = 114 checks. Screenshot: docs/phase-E/camlock-turned-left-payoff.png.

## Hard puzzles (Louie 6:53 PM) - done
- Types: `keypad`, `wires`, `tiles` (kept) + `ledger` (deduction) + `musicbox` (growing, reshuffling tune; silent from night 4). All swappable via `ART.puzzles.register` and driven by `assets/manifest.json` `game.puzzles`.
- `ledger`: torn lore scraps (Vicky's diary, funeral-home receipt, flyer, tally card, caretaker's bad phone line). The true fragments are brute-force checked to pin down exactly one code; the caretaker line is allowed to lie (and also tells one truth); redundant fragments add noise. Nothing says which scrap lies. Wording: `puzzles.ledgerText`.
- Multi-stage: a night's `types` entry may be an array (e.g. `["musicbox","tiles","ledger"]`), solved in order; the effect only fires at the end.
- Time pressure: `timeSec[night]` shows as a burning fuse (no numbers); footsteps close in over the last third; running out = panel slams shut, lockout, power drain, and Art arrives within ~2-4 s. `strikes[night]`, `wrongPowerPct[night]`, `failScare[night]` likewise.
- Night 1 stays gentle (untimed, no strikes, single stage). Night 5: 5-digit ledger with 2 misleading scraps, 4 stages, 185 s, 3 strikes.
- Horror theme: stained-paper UI, rust/blood glow, garbled caretaker scrap, wet-crunch failure (`A.pzFail`), music-box notes (`A.note`). Screenshots: docs/phase-E/f-puzzle-*.png.
- Tests: `tests/hardpuz.js` (26 checks). Rename note: user-facing name is now "Terrorific".

## Supplied video clips (Louie 7:14 PM) - done
- `assets/video/{intro,scare-b,scare-c}.mp4` + posters: ffmpeg re-encode of Louie's three clips (H.264 main + AAC, 480x804, 24 fps, faststart, 1.16-1.49 MB each). User-supplied, labelled in README; sources stay out of the repo.
- `js/video.js` (new) + `game.video` in the manifest: `intro` (cold-open, `when: night1|always|never`, fade from black, grade/grain overlay, first play unskippable, tap-to-skip afterwards via localStorage, 4.5 s watchdog), `perNight` (optional short replay of the intro at the start of later nights, off by default), `jumpscares` (clips, per-night `chance` and `perNightMax`, `cooldownSec`, `minNight`, `kinds`, volume, duck level).
- iOS: elements are created and unlocked (one muted play/pause) inside the AUTHENTICATE tap, audio routed through the tap-unlocked AudioContext, `playsinline`, `preload=auto`, intro `play()` called synchronously in the tap.
- Director: `video-pop` / `lo-video-pop` / `at-video-pop` variants (type `video`) only enter the pool when a clip is ready, off cooldown and the night's odds roll true; clip choice never repeats back-to-back. `PAYOFF.video` in `js/art.js`: beat 1 flicker, beat 2 500 ms silence, beat 3 full-screen clip + audio (screen-locked), falls back to the sprite run if it can't start in 900 ms.
- `?fast=` (headless suites) disables video unless `&video=1`; `?novideo=1` always disables.
- Tests: `tests/video.js` (30 checks). Screenshots: docs/phase-E/video-*.png.

## Camera-feed scare, door grab, taunts, easter eggs, dog mocking egg - done
- Feed scare (`game.feedScare`), door grab (`js/grab.js`, `game.grab`), taunt sounds (`js/taunts.js`, `game.taunts`), config-driven personal easter eggs (`assets/easter-eggs.json`, `js/eggs.js`), dog mocking Easter egg (`js/dogegg.js`, `assets/art/dog.png` from the user-supplied dog.jpg; config `dogEgg` in `assets/easter-eggs.json`; pops small bottom-right after a mistake with a synthesized snicker, ~1.2 s, 3 beats, never twice in a row; no lunge). Empty disabled `video.dogAttack` slot reserved for Louie's later dog video.
- Tests: feedscare 20, grab 18, taunts 13, eggs 16, dog 21, all in `tests/run-all.js`.
- Audit (Oct 26, 8:30 PM CT): live site serves every manifest/HTML-referenced asset with 200 (47 paths), mp4s answer Range with 206 + Accept-Ranges, no console errors or failed requests on index.html / game.html, index 293 KB / game.html 4.5 MB transferred (load 0.7 s / 1.1 s headless on the box network), no visible "ART // LOGIN".
- Screenshots: docs/phase-E/dog-cutout-dark-and-room.png, docs/phase-E/dog-egg-payoff.png, feed-*.png.
