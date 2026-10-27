/* Terrorific - audio.js (MIT). Thin game layer on top of assets/ui/audio-engine.js (window.ArtAudio, all synthesized).
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

  /* ---------- Phase E: stride + varied stabs (original synthesis; Terrifier-flavoured: carnival / squeaky toy / scrape / 80s synth stab) ---------- */
  function node(o) { var c = A.ctx, g = c.createGain(); var out = g; if (o && o.pan && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); out = p; } out.connect(A.sfx); return g; }
  A.footfall = function (v) {                          // heavy shoe on boards: sub thump + dull slap
    if (!A.ready) return; v = v == null ? 1 : v; var c = A.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 0.28); A.noiseHit(340, 1.2, 0.32 * v, 0.07);
  };
  var STABS = {
    synth: function (c, t, r, g) {                    // cheap 80s slasher synth stab: detuned saws, closing filter
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.55); f.connect(g);
      [196, 196 * 1.012, 233.1, 277.2 * 0.994].forEach(function (hz) { var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz * r; o.connect(f); o.start(t); o.stop(t + 0.7); });
      return 0.7; },
    horn: function (c, t, r, g) {                     // twisted squeaky-toy horn
      var o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), b = c.createBiquadFilter(); o.type = 'triangle';
      o.frequency.setValueAtTime(620 * r, t); o.frequency.exponentialRampToValueAtTime(1500 * r, t + 0.09); o.frequency.exponentialRampToValueAtTime(540 * r, t + 0.5);
      l.frequency.value = 23; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); b.type = 'bandpass'; b.frequency.value = 1500; b.Q.value = 1.4;
      o.connect(b); b.connect(g); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6); return 0.6; },
    scrape: function (c, t, r, g) {                   // saw-blade / metal scrape
      var n = c.createBufferSource(), b = c.createBiquadFilter(), tr = c.createGain(), l = c.createOscillator(), lg = c.createGain(); n.buffer = A.white;
      b.type = 'bandpass'; b.Q.value = 5; b.frequency.setValueAtTime(500 * r, t); b.frequency.exponentialRampToValueAtTime(2800 * r, t + 0.7);
      tr.gain.value = 0.5; l.type = 'square'; l.frequency.value = 38; lg.gain.value = 0.5; l.connect(lg); lg.connect(tr.gain); n.connect(b); b.connect(tr); tr.connect(g); n.start(t); n.stop(t + 0.8); l.start(t); l.stop(t + 0.8); return 0.8; },
    musicbox: function (c, t, r, g) {                 // detuned music-box plinks, a tritone off
      [784, 1108.7, 740, 1046.5].forEach(function (hz, i) { var o = c.createOscillator(), e = c.createGain(), s = t + i * 0.12; o.type = 'sine'; o.frequency.value = hz * r * (i % 2 ? 1.017 : 0.99);
        e.gain.setValueAtTime(0.0001, s); e.gain.linearRampToValueAtTime(0.5, s + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, s + 0.5); o.connect(e); e.connect(g); o.start(s); o.stop(s + 0.55); });
      return 0.95; },
    balloon: function (c, t, r, g) {                  // party-balloon squeal into a pop
      var o = c.createOscillator(), e = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1900 * r, t); o.frequency.linearRampToValueAtTime(3300 * r, t + 0.3);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.25, t + 0.05); e.gain.setValueAtTime(0.25, t + 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(e); e.connect(g); o.start(t); o.stop(t + 0.4);
      var n = c.createBufferSource(), ng = c.createGain(); n.buffer = A.white; ng.gain.setValueAtTime(0.0001, t + 0.3); ng.gain.linearRampToValueAtTime(0.8, t + 0.305); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); n.connect(ng); ng.connect(g); n.start(t + 0.3); n.stop(t + 0.5); return 0.5; }
  };
  /* ---------- Phase F: puzzle voices (original synthesis): detuned music-box note, wet squelch for failures ---------- */
  A.note = function (hz, o) {                          // one music-box plink, a hair out of tune; o: {vol, dur, pan}
    if (!A.ready) return; o = o || {}; var c = A.ctx, t = c.currentTime, g = node(o), e, a, b, d = o.dur || 0.7;
    g.gain.value = o.vol == null ? 0.4 : o.vol;
    [[1, 0.994], [2.01, 1.0]].forEach(function (m, i) { a = c.createOscillator(); e = c.createGain(); a.type = i ? 'triangle' : 'sine'; a.frequency.value = hz * m[0] * m[1];
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(i ? 0.12 : 0.6, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + d); a.connect(e); e.connect(g); a.start(t); a.stop(t + d + 0.05); });
  };
  A.pzFail = function () {                              // the panel bites back: wet crunch + low scrape
    A.pzBad(); if (A.stab) A.stab('scrape', { rate: 0.7, vol: 0.28 }); setTimeout(function () { A.noiseHit(220, 1.4, 0.4, 0.2); }, 140);
  };
  A.STAB_KINDS = Object.keys(STABS);
  /* A.stab(kind, {rate, vol, pan}): one synthesized payoff colour; rate/pan are randomised by the scare director */
  A.stab = function (kind, o) {
    if (!A.ready) return; o = o || {}; var fn = STABS[kind] || STABS.synth, c = A.ctx, t = c.currentTime, g = node(o), v = o.vol == null ? 0.5 : o.vol, d;
    g.gain.value = v; d = fn(c, t, o.rate || 1, g); g.gain.setValueAtTime(v, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
  };
  A.sting = function (big, o) {
    o = o || {};
    if (!buf.stinger || !A.ready) return orig.sting.apply(A, arguments);
    play('stinger', o.pan != null ? node(o) : A.sfx, big ? 1.0 : 0.7, 0, (big ? 1 : 1.06) * (o.rate || 1));
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
