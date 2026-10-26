# Phase D status - Art's voice (done)

## Engine / voice
- **Piper `piper-tts` 1.8.0** (PyPI 2026-09-04; GPL-3.0-or-later, https://github.com/OHF-Voice/piper1-gpl). Offline, build-time only: the game ships MP3s, not the engine. Kokoro-82M (Apache-2.0) was the alternative but needs PyTorch.
- **Voice `en_US-joe-medium`** (rhasspy/piper-voices, 22.05 kHz, single speaker). MODEL_CARD licence: **CC0**. Chosen as the lowest-pitched clean-licence male voice (median F0 ~89 Hz; john 103, norman 105, bryce 127). Rejected: ryan, hfc_male (CC BY-NC-SA, non-commercial), northern_english_male (CC-BY-SA), alan/danny/kusal (licence unclear).
- Install (verified): `python3 -m venv tools-tts && tools-tts/bin/pip install "piper-tts[alignment]==1.8.0" scipy`, model via curl from `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx(.json)`. Run `tools-tts/bin/python scripts/make_voice.py <models_dir>`.
- Post-processing (ffmpeg rubberband + numpy/scipy): pitch x0.78 and tempo x0.88 (formants shift with pitch), a sub-octave layer, chest low-shelf, dark EQ, tanh saturation, compressor, cold stone-room tail, 40 ms lead-in; mono MP3 22.05 kHz 56 kbps (iOS Safari decodes it). Measured: spectral centroid ~800-1000 Hz, peak -1.4 dBFS.
- Word timings: Piper phoneme alignments (espeak merges clitics, so each sentence's phoneme timeline is split by per-word phoneme counts), scaled by the time-stretch; checked against the energy in each word window.

## Lines (`assets/voice/<id>.mp3`, `assets/voice/lines.json`: id, kind, text, file, duration, speech, words[{w,t0,t1}])
intro "Hello. I have been waiting in the dark for you." | night1 "Night one. Watch the doors. I only knock once." | night2 "Night two. You kept the lights on. How very kind." | night3 "Night three. I can hear you breathing from here." | night4 "Night four. Nobody is coming for you. Nobody ever did." | night5 "Last night. Let me show you how I smile." | taunt1 "Why are you hiding? I only want to play." | taunt2 "Look at me. Look at me while I smile." | taunt3 "Did you really think a door would stop me?" | lore_receipt "Black paint, white powder, one hat. Every costume needs an audience." | lore_diary "Little girl, you counted wrong. The thirteenth heart is waiting for you." | lore_call "You should not have answered. Now I know your voice." | win "You survived. Go home. I will remember your face." | bad "You stayed too long. Now the house keeps you."
14 files, 2.8-5.5 s, ~370 KB total.

## Wiring (`js/voice.js`, manifest `voice` block + `lore[i].voice/art/voiceMode`)
- Same Web Audio context and unlock path: `ART.audio.unlockInTap()` -> `ART.voice.unlock()` (fetch lines.json + files, decode in the tap-created context). Own bus -> master; the ambient duck bus is re-routed through `A.vduck` so the voice ducks ambient (to 0.45) without fighting the scare's silence duck. A missing lines.json / file / failed decode degrades silently.
- Intro: first-ever run only (localStorage `art_login_voice_v1`), 2.8 s into night 1. Night 1-5 openings 1.4 s after `N.start`; a new night cancels any pending line.
- Taunts: `ART.art.scare()` payoff beat only (after the 500 ms silence). From night 2; odds peek 18 % / lights-out 32 % / attack 30 %; at most one per 75 s; never the same line twice; 450-950 ms after the stinger (1.1-1.5 s after an attack), random hard pan, slightly slow.
- Lore: night 2 receipt and night 3 diary: Art's line fades in word-by-word under the document (document held until he finishes); night 4: he cuts in on the caretaker's call (green terminal, red text), Continue after. Timing is wall-clock from lines.json so text-only works when audio fails (proportional timing if lines.json is gone). Win and bad lines are audio only. Title screen: no voice.
- No new persistent UI, no mute/speaker icon, no helpers.

## Tests
logic 23/23, ui 38/38, audio 10/10, new `tests/voice.js` 40/40 (see TEST.md). Screenshots: `docs/phase-D/voice-lore-{1,2,3}-{mid,end}.png`.
