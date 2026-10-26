/* ART // LOGIN - shared synthesized audio engine (original, no samples). MIT.
   Same engine as the title screen (copied so the title page stays untouched; Phase B de-duplicates).
   iOS: call ArtAudio.unlock() inside a tap. */
(function () {
  'use strict';
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  /* ================= AUDIO (Web Audio, iOS-safe) ================= */
  var A = { ctx: null, ready: false, level: 0, silent: false };
  var AC = window.AudioContext || window.webkitAudioContext;

  A.unlock = function () {
    // must be called inside a user gesture (tap)
    try {
      if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) {} } // feature-detected: bypass iOS mute switch where supported
      if (!A.ctx && AC) A.build();
      if (A.ctx && A.ctx.state !== 'running') A.ctx.resume();
      if (A.ctx && !A.unlocked) { // silent buffer inside gesture
        var b = A.ctx.createBuffer(1, 1, 22050), s = A.ctx.createBufferSource();
        s.buffer = b; s.connect(A.ctx.destination); s.start(0); A.unlocked = true;
      }
    } catch (e) { console.warn('audio unlock failed', e); }
  };

  function noiseBuf(ctx, seconds, type) {
    var n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  A.build = function () {
    var ctx = A.ctx = new AC();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    A.master = ctx.createGain(); A.master.gain.value = 0.9;
    A.master.connect(comp); comp.connect(ctx.destination);
    A.duck = ctx.createGain(); A.duck.connect(A.master);        // ambient bus (music + breathing) - ducked to 0 for silence beat
    A.music = ctx.createGain(); A.music.gain.value = 0.0001; A.music.connect(A.duck);
    A.breath = ctx.createGain(); A.breath.gain.value = 1; A.breath.connect(A.duck);
    A.sfx = ctx.createGain(); A.sfx.gain.value = 1; A.sfx.connect(A.master); // stings (not ducked)
    A.brown = noiseBuf(ctx, 3, 'brown'); A.white = noiseBuf(ctx, 2, 'white');
    A.buildDrone();
    A.nextBreath = ctx.currentTime + 0.3; A.nextBeat = ctx.currentTime + 1; A.nextScreech = ctx.currentTime + rnd(5, 8);
    A.timer = setInterval(A.tick, 400);
    ctx.addEventListener('statechange', function () { /* iOS may set 'interrupted'; next tap resumes */ });
    document.addEventListener('visibilitychange', function () {
      if (!A.ctx) return;
      if (document.hidden) A.ctx.suspend(); else A.ctx.resume();
    });
    A.ready = true;
  };

  A.buildDrone = function () {
    var ctx = A.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 3; A.droneLp = lp;
    var g = ctx.createGain(); g.gain.value = 0.2; lp.connect(g); g.connect(A.music);
    [[55, 'sawtooth'], [55.8, 'sawtooth'], [58.27, 'sawtooth'], [27.5, 'sine']].forEach(function (p, i) {
      var o = ctx.createOscillator(); o.type = p[1]; o.frequency.value = p[0]; o.detune.value = (i - 1.5) * 4;
      var og = ctx.createGain(); og.gain.value = i === 3 ? 1.4 : 0.55; o.connect(og); og.connect(lp); o.start();
    });
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 70; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // high dissonant shimmer (E6 + F6)
    A.shimmerG = ctx.createGain(); A.shimmerG.gain.value = 0.0; A.shimmerG.connect(A.music);
    [1318.5, 1396.9].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var tg = ctx.createGain(); tg.gain.value = 0.5; var l = ctx.createOscillator(), lgg = ctx.createGain();
      l.frequency.value = 0.09 + i * 0.05; lgg.gain.value = 0.45; l.connect(lgg); lgg.connect(tg.gain); l.start();
      o.connect(tg); tg.connect(A.shimmerG); o.start();
    });
  };

  A.start = function () {
    if (!A.ready) return;
    var t = A.ctx.currentTime;
    A.music.gain.cancelScheduledValues(t); A.music.gain.setValueAtTime(0.0001, t); A.music.gain.linearRampToValueAtTime(0.55, t + 6);
  };

  A.setLevel = function (lv) {
    if (!A.ready) return; A.level = lv; var t = A.ctx.currentTime;
    A.droneLp.frequency.setTargetAtTime(180 + lv * 90, t, 1.5);
    A.shimmerG.gain.setTargetAtTime(Math.min(0.06, lv * 0.014), t, 1.5);
  };

  A.breathOnce = function (t0, dur) {
    var ctx = A.ctx, inh = dur * 0.42, gap = dur * 0.07, exh = dur - inh - gap;
    var src = ctx.createBufferSource(); src.buffer = A.brown; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    var g = ctx.createGain();
    bp.frequency.setValueAtTime(240, t0); bp.frequency.linearRampToValueAtTime(900, t0 + inh);
    bp.frequency.setValueAtTime(700, t0 + inh + gap); bp.frequency.linearRampToValueAtTime(200, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.9, t0 + inh);
    g.gain.linearRampToValueAtTime(0.2, t0 + inh + gap);
    g.gain.linearRampToValueAtTime(1.0, t0 + inh + gap + exh * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(A.breath); src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.1);
    // airy rasp layer (white noise, high band) - gives it a throat
    var s2 = ctx.createBufferSource(); s2.buffer = A.white; s2.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.7;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0); g2.gain.linearRampToValueAtTime(0.05, t0 + inh);
    g2.gain.linearRampToValueAtTime(0.012, t0 + inh + gap); g2.gain.linearRampToValueAtTime(0.06, t0 + inh + gap + exh * 0.2);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s2.connect(hp); hp.connect(g2); g2.connect(A.breath); s2.start(t0, Math.random()); s2.stop(t0 + dur + 0.1);
    // chest: sub swell + 2nd harmonic so phone speakers can reproduce it
    [[46, 0.30], [92, 0.12]].forEach(function (p) {
      var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(p[0], t0); o.frequency.linearRampToValueAtTime(p[0] * 1.15, t0 + inh); o.frequency.linearRampToValueAtTime(p[0] * 0.85, t0 + dur);
      og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(p[1], t0 + inh); og.gain.linearRampToValueAtTime(p[1] * 0.4, t0 + inh + gap + exh * 0.3);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(og); og.connect(A.breath); o.start(t0); o.stop(t0 + dur + 0.1);
    });
  };

  A.thud = function (t, vol) {
    var ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(A.music); o.start(t); o.stop(t + 0.3);
  };

  A.screech = function (t, f0, dur, vol) { // violin-ish: saw + vibrato + band-pass formant, minor-second glide
    var ctx = A.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    o.type = o2.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 0.9439, t + dur);
    o2.frequency.setValueAtTime(f0 * 1.0595, t); o2.frequency.linearRampToValueAtTime(f0 * 1.0, t + dur); o2.detune.value = 9;
    var v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 5.6; vg.gain.value = f0 * 0.012; v.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency); v.start(t); v.stop(t + dur + 0.2);
    bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 1.1; lp.type = 'lowpass'; lp.frequency.value = 5200;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); o2.connect(bp); bp.connect(lp); lp.connect(g); g.connect(A.music);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  };

  A.tick = function () { // look-ahead scheduler for ambient layers
    if (!A.ready || A.ctx.state !== 'running') return;
    var ctx = A.ctx, now = ctx.currentTime;
    while (A.nextBreath < now + 6) { var d = rnd(4, 6); A.breathOnce(A.nextBreath, d); A.nextBreath += d - 0.2; }
    var bpm = 52 + A.level * 7, per = 60 / bpm;
    while (A.nextBeat < now + 3) { A.thud(A.nextBeat, 0.8); A.thud(A.nextBeat + 0.24, 0.5); A.nextBeat += per; }
    if (A.nextScreech < now + 2) {
      var notes = [1318.5, 1396.9, 1568, 1760, 2093];
      A.screech(A.nextScreech, notes[Math.floor(Math.random() * notes.length)], rnd(1.8, 3.2), 0.05 + A.level * 0.012);
      A.nextScreech += rnd(7, 13) - A.level * 0.8;
    }
  };

  A.duckTo = function (v, tc) { if (!A.ready) return; var t = A.ctx.currentTime; A.duck.gain.cancelScheduledValues(t); A.duck.gain.setTargetAtTime(v, t, tc); };

  A.buzz = function (dur) {
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'square'; o.frequency.value = 100; lp.type = 'lowpass'; lp.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.01); g.gain.setValueAtTime(0.07, t + dur - 0.02); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + dur + 0.05);
  };

  A.sting = function (big) { // payoff: low impact + noise crash + dissonant violin cluster
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime, k = big ? 1 : 0.55;
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(26, t + (big ? 1.1 : 0.7));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * k, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.4 : 0.9));
    o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 1.5);
    var n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = A.white; nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.5;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.5 * k, t + 0.006); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(nf); nf.connect(ng); ng.connect(A.sfx); n.start(t); n.stop(t + 0.6);
    [1760, 1864.7, 2217.5, 3322].forEach(function (f, i) {
      var s = ctx.createOscillator(), sg = ctx.createGain(), sb = ctx.createBiquadFilter(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.frequency.linearRampToValueAtTime(f * 0.97, t + 0.9);
      sb.type = 'bandpass'; sb.frequency.value = 2600; sb.Q.value = 0.8;
      sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.11 * k, t + 0.012); sg.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.5 : 0.8));
      s.connect(sb); sb.connect(sg); sg.connect(A.sfx); s.start(t); s.stop(t + 1.6);
    });
  };

  A.clack = function () {
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = A.white; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2;
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(f); f.connect(g); g.connect(A.sfx); n.start(t); n.stop(t + 0.12);
  };
  /* ---- game-only sfx ---- */
  A.mute = false;
  A.setMute = function (m) { A.mute = !!m; if (A.master) A.master.gain.setTargetAtTime(m ? 0.0001 : 0.9, A.ctx.currentTime, 0.05); };
  A.noiseHit = function (freq, q, vol, dur, bus) {
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = A.white; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(bus || A.sfx); n.start(t); n.stop(t + dur + 0.05);
  };
  A.knock = function (n) { // door knocks (Art at the attic door)
    if (!A.ready) return; var ctx = A.ctx;
    for (var i = 0; i < n; i++) (function (i) {
      var t = ctx.currentTime + i * 0.28, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 0.25);
    })(i);
    A.noiseHit(500, 1.2, 0.35, 0.12);
  };
  A.step = function () { A.noiseHit(260, 1.4, 0.22, 0.14); };           // distant footstep
  A.blip = function () { if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.04);
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 0.1); };
  A.staticBurst = function (d) { A.noiseHit(3000, 0.4, 0.18, d || 0.25); };
  A.lock = function () { A.noiseHit(900, 3, 0.35, 0.07); setTimeout(function () { A.noiseHit(500, 3, 0.4, 0.09); }, 90); };
  A.powerDown = function () { // power-out: descending whine + thunk
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.6);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7); o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 1.8);
  };
  A.scream = function () { // jumpscare: noise crash + stacked sweeping saws (original synthesis)
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime; A.sting(true); A.noiseHit(1800, 0.3, 0.9, 1.1);
    [420, 633, 951, 1210].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (i % 2 ? 2.2 : 0.4), t + 1.2);
      bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(bp); bp.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 1.4);
    });
  };
  A.chime = function () { // 6 AM bell (soft, consonant - relief)
    if (!A.ready) return; var ctx = A.ctx, t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; var s = t + i * 0.35;
      g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.16, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 2.2);
      o.connect(g); g.connect(A.sfx); o.start(s); o.stop(s + 2.3);
    });
  };
  A.phoneRing = function () { A.noiseHit(1300, 8, 0.2, 0.18); setTimeout(function () { A.noiseHit(1300, 8, 0.2, 0.18); }, 260); };
  A.stopMusic = function () { if (A.ready) { var t = A.ctx.currentTime; A.music.gain.cancelScheduledValues(t); A.music.gain.setTargetAtTime(0.0001, t, 0.4); } };

  window.ArtAudio = A;
})();
