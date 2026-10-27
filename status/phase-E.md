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
