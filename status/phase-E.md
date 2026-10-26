# Phase E progress notes (newest at the bottom)

## 1. Quieter breathing - done
`manifest.audio.mix.breathing = 0.15` (was hard-coded 0.8) read via `ART.MIX.breathing` (js/config.js defaults, merged from the manifest) in js/audio.js; the oscillator fallback bus is scaled to the same level. Title screen breathing loop: `manifest.title.breathGain = 0.15`, applied to the title's breath bus (assets/ui/title.js). Tests: tests/audio.js now 13 checks (mix level, title gain on the real title page).
