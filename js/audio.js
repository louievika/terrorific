/* ART // LOGIN - audio.js (MIT). Thin game layer on top of assets/ui/audio-engine.js (window.ArtAudio, all synthesized).
   iOS rules: AudioContext is created/unlocked inside a tap (ART.audio.unlockInTap), resumed on every pointerdown,
   engine suspends/resumes on visibilitychange. No autoplay. No mute/quit UI (system volume + silent switch only). */
(function (ART) {
  'use strict';
  var A = ART.A = window.ArtAudio;
  /* puzzle sfx (original synthesis, built on engine primitives) */
  A.pzTap = function () { A.noiseHit(1800, 6, 0.12, 0.04); };
  A.pzOk = function () { A.noiseHit(1200, 8, 0.2, 0.09); setTimeout(function () { A.noiseHit(1700, 8, 0.2, 0.14); }, 110); };
  A.pzBad = function () { A.noiseHit(140, 2, 0.5, 0.28); A.noiseHit(2400, 0.6, 0.12, 0.18); };

  /* ---------- sample layer (Phase C) ----------
     manifest.audio = { hum, stinger, breathing, creak, static } -> WAV files made by scripts/make_audio.py.
     Files are fetched as raw bytes (no context needed) and decoded with the AudioContext that unlockInTap() created inside the tap.
     If a file is missing / fails to decode, the original oscillator version keeps playing: every override below checks its buffer first. */
  var raw = {}, buf = {}, started = false, humSrc = null;
  var orig = { sting: A.sting, breathOnce: A.breathOnce, staticBurst: A.staticBurst, phoneRing: A.phoneRing };
  function decode(name, ab) {
    var ok = function (b) { buf[name] = b; ART.log && ART.log('audio sample ready: ' + name); if (name === 'hum') startHum(); };
    var bad = function (e) { console.warn('audio sample failed: ' + name, e); };
    try { var p = A.ctx.decodeAudioData(ab, ok, bad); if (p && p.catch) p.catch(bad); } catch (e) { bad(e); }
  }
  function prefetch() {
    var paths = (ART.manifest && ART.manifest.audio) || {};
    Object.keys(paths).forEach(function (k) {
      if (raw[k] || typeof paths[k] !== 'string') return;      // 'mix' is a levels object, not a file
      raw[k] = fetch(paths[k]).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).catch(function (e) { console.warn('audio sample missing: ' + k, e); return null; });
    });
  }
  function decodeAll() {
    Object.keys(raw).forEach(function (k) { if (buf[k] || !A.ctx) return; raw[k].then(function (ab) { if (ab && !buf[k]) decode(k, ab); }); });
  }
  function play(name, bus, gain, when, rate, offset, dur) {
    var b = buf[name]; if (!b || !A.ready) return null;
    var c = A.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = b; g.gain.value = gain;
    if (rate) s.playbackRate.value = rate; s.connect(g); g.connect(bus || A.sfx);
    var t = when || c.currentTime; if (dur) { s.start(t, offset || 0, dur); } else s.start(t, offset || 0); return s;
  }
  function startHum() {
    if (started || !buf.hum || !A.ready) return; started = true; var c = A.ctx;
    humSrc = c.createBufferSource(); humSrc.buffer = buf.hum; humSrc.loop = true;
    var g = c.createGain(); g.gain.value = 0.55; humSrc.connect(g); g.connect(A.music); humSrc.start();
    /* keep the oscillator drone as a thin layer under the hum rather than the main bed */
    try { A.droneLp.disconnect(); var dg = c.createGain(); dg.gain.value = 0.07; A.droneLp.connect(dg); dg.connect(A.music); } catch (e) { /* drone stays as-is */ }
  }
  A.sting = function (big) {
    if (!buf.stinger || !A.ready) return orig.sting.apply(A, arguments);
    play('stinger', A.sfx, big ? 1.0 : 0.7, 0, big ? 1 : 1.06);
  };
  A.breathOnce = function (t0, dur) {
    if (!buf.breathing || !A.ready) { if (A.ready) A.breath.gain.value = ART.MIX.breathing / 0.8; return orig.breathOnce.apply(A, arguments); }
    var b = buf.breathing, r = Math.max(0.75, Math.min(1.25, b.duration / dur));
    A.breath.gain.value = 1; var s = play('breathing', A.breath, ART.MIX.breathing, t0, r); if (s) s.stop(t0 + dur + 0.1);   /* level = manifest audio.mix.breathing (was 0.8) */
  };
  A.staticBurst = function (d) {
    if (!buf.static || !A.ready) return orig.staticBurst.apply(A, arguments);
    d = Math.min(1.2, d || 0.25); play('static', A.duck, 0.5, 0, 1, Math.random() * 0.9, d);   /* only the live part of the file (first 1.5 s), never the gap */
  };
  A.phoneStatic = function () { play('static', A.duck, 0.45, 0, 1); };
  A.phoneRing = function () { orig.phoneRing.apply(A, arguments); setTimeout(A.phoneStatic, 650); };
  A.creak = function (vol) {
    if (!A.ready) return;
    if (buf.creak) { play('creak', A.duck, vol || 0.55, 0, 0.92 + Math.random() * 0.2); return; }
    var c = A.ctx, t = c.currentTime, o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(330, t + 0.8); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * (vol || 0.55) * 2, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(bp); bp.connect(g); g.connect(A.duck); o.start(t); o.stop(t + 1);
  };
  ART.audio = {
    unlockInTap: function () { A.unlock(); A.start(); prefetch(); decodeAll(); if (ART.voice) ART.voice.unlock(); },
    samples: function () { return Object.keys(buf); },
    resume: function () { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); },
    duck: function (v, tc) { A.duckTo(v, tc); },
    level: function (n) { A.setLevel(n); }
  };
  document.addEventListener('pointerdown', ART.audio.resume, true);
})(window.ART);
