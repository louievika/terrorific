# ART // LOGIN

A Terrifier 2-themed, FNAF-style horror game for iPhone Safari (touch + gyroscope), built with plain HTML/JS and [A-Frame](https://aframe.io) 1.8.0. MIT licensed.

**Status:** Phase 1 in progress. The **title screen is live** (`index.html`); the game shell (`shell.html`) is a work in progress.

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
