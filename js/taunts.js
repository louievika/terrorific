/* Terrorific - taunts.js (MIT). Original synthesized taunt sounds (no samples, no voice lines): whispers, a low laugh, a mocking creak,
   plus the door-grab sound set (scrape loop, slam, burst). Everything is built on Web Audio primitives in assets/ui/audio-engine.js.
   ART.taunts schedules them from the manifest (game.taunts): per-night odds/gaps/caps, never during a scare / grab / feed scare, never the same kind twice. */
(function (ART) {
  'use strict';
  var A = ART.A, S;
  function ok() { return A && A.ready && A.ctx; }
  function pan(c, g, p) { if (p && c.createStereoPanner) { var sp = c.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, p)); g.connect(sp); return sp; } return g; }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  /* breathy whisper: noise through two moving vowel formants, chopped into 4-6 syllables, panned off to one side */
  A.whisper = function (o) {
    if (!ok()) return 0; o = o || {}; var c = A.ctx, t = c.currentTime + 0.02, vol = (o.vol == null ? 1 : o.vol) * 0.34, n = 4 + Math.floor(Math.random() * 3), x = t, out = c.createGain(), dst = pan(c, out, o.pan == null ? (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.45) : o.pan);
    out.gain.value = 1; dst.connect(o.bus || A.duck);
    for (var i = 0; i < n; i++) {
      var d = 0.09 + Math.random() * 0.12, src = c.createBufferSource(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), hp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = A.white; src.loop = true; hp.type = 'highpass'; hp.frequency.value = 500;
      f1.type = 'bandpass'; f1.Q.value = 5; f2.type = 'bandpass'; f2.Q.value = 7;
      var b1 = 500 + Math.random() * 600, b2 = 1700 + Math.random() * 1500;
      f1.frequency.setValueAtTime(b1, x); f1.frequency.linearRampToValueAtTime(b1 * (0.8 + Math.random() * 0.5), x + d);
      f2.frequency.setValueAtTime(b2, x); f2.frequency.linearRampToValueAtTime(b2 * (0.75 + Math.random() * 0.6), x + d);
      env(g, x, d * 0.35, vol * (0.55 + Math.random() * 0.45), d * 0.9);
      src.connect(hp); hp.connect(f1); hp.connect(f2); f1.connect(g); f2.connect(g); g.connect(out); src.start(x, Math.random() * 1.5); src.stop(x + d * 1.4 + 0.05);
      x += d + 0.03 + Math.random() * 0.1 * (i % 2 ? 3 : 1);                                       // uneven gaps: a hushed, hurried sentence
    }
    return x - t;
  };
  /* low, slow laugh: "huh... huh... huh" as detuned saws under a falling vowel formant + breath */
  A.lowLaugh = function (o) {
    if (!ok()) return 0; o = o || {}; var c = A.ctx, t = c.currentTime + 0.02, vol = (o.vol == null ? 1 : o.vol) * 0.5, n = 3 + Math.floor(Math.random() * 2), gap = 0.36 + Math.random() * 0.1,
      out = c.createGain(), dst = pan(c, out, o.pan == null ? (Math.random() - 0.5) * 1.2 : o.pan); dst.connect(o.bus || A.duck);
    for (var i = 0; i < n; i++) {
      var x = t + i * gap, base = (62 - i * 3) * (0.92 + Math.random() * 0.16), g = c.createGain(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.setValueAtTime(760 - i * 40, x); bp.frequency.linearRampToValueAtTime(430, x + 0.22); lp.type = 'lowpass'; lp.frequency.value = 1400;
      [1, 1.012].forEach(function (dt) { var o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(base * dt * 1.18, x); o1.frequency.exponentialRampToValueAtTime(base * dt, x + 0.22); o1.connect(bp); o1.start(x); o1.stop(x + 0.3); });
      env(g, x, 0.025, vol * (1 - i * 0.14), 0.2); bp.connect(lp); lp.connect(g); g.connect(out);
      var nz = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain(); nz.buffer = A.white; nf.type = 'bandpass'; nf.frequency.value = 1900; nf.Q.value = 1.2; env(ng, x, 0.01, vol * 0.1, 0.12); nz.connect(nf); nf.connect(ng); ng.connect(out); nz.start(x); nz.stop(x + 0.2);
    }
    return n * gap + 0.3;
  };
  /* mocking creak: a long door-hinge groan, answered a beat later by a smaller, higher copy of itself */
  A.mockCreak = function (o) {
    if (!ok()) return 0; o = o || {}; var c = A.ctx, t = c.currentTime + 0.02, vol = (o.vol == null ? 1 : o.vol) * 0.22, out = c.createGain(), dst = pan(c, out, o.pan == null ? (Math.random() - 0.5) * 1.4 : o.pan); dst.connect(o.bus || A.duck);
    [[0, 1, 118, 1.5], [1.75, 0.55, 168, 0.8]].forEach(function (z) {
      var x = t + z[0], d = z[3], os = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), bp = c.createBiquadFilter(), g = c.createGain();
      os.type = 'sawtooth'; os.frequency.setValueAtTime(z[2], x); os.frequency.linearRampToValueAtTime(z[2] * 0.78, x + d * 0.6); os.frequency.linearRampToValueAtTime(z[2] * 0.9, x + d);
      lf.frequency.value = 5.5 + Math.random() * 3; lg.gain.value = z[2] * 0.05; lf.connect(lg); lg.connect(os.frequency);
      bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.setValueAtTime(820, x); bp.frequency.linearRampToValueAtTime(1500, x + d);
      env(g, x, d * 0.3, vol * z[1], d * 0.7); os.connect(bp); bp.connect(g); g.connect(out); os.start(x); lf.start(x); os.stop(x + d + 0.1); lf.stop(x + d + 0.1);
    });
    return 2.7;
  };
  A.TAUNT_KINDS = ['whisper', 'lowLaugh', 'mockCreak'];

  /* ---- door grab sound set (on the un-ducked sfx bus) ---- */
  A.grabStart = function () {                             // continuous scraping/pulling loop; returns a handle {set(0..1), stop()}
    if (!ok()) return { set: function () {}, stop: function () {} }; var c = A.ctx, t = c.currentTime, nz = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), os = c.createOscillator(), og = c.createGain(), lf = c.createOscillator(), lg = c.createGain();
    nz.buffer = A.brown; nz.loop = true; bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.value = 600; g.gain.value = 0.0001;
    os.type = 'sawtooth'; os.frequency.value = 58; og.gain.value = 0.0001; lf.frequency.value = 9; lg.gain.value = 0.5; lf.connect(lg); lg.connect(g.gain);
    nz.connect(bp); bp.connect(g); g.connect(A.sfx); os.connect(og); og.connect(A.sfx); nz.start(t); os.start(t); lf.start(t);
    return {
      set: function (k) { var x = c.currentTime; k = Math.max(0, Math.min(1, k)); g.gain.setTargetAtTime(0.1 + 0.5 * k, x, 0.05); og.gain.setTargetAtTime(0.02 + 0.06 * k, x, 0.05); bp.frequency.setTargetAtTime(500 + 1800 * k, x, 0.05); lf.frequency.setTargetAtTime(7 + 12 * k, x, 0.1); },
      stop: function () { var x = c.currentTime; g.gain.cancelScheduledValues(x); g.gain.setTargetAtTime(0.0001, x, 0.02); og.gain.setTargetAtTime(0.0001, x, 0.02); setTimeout(function () { try { nz.stop(); os.stop(); lf.stop(); } catch (e) {} }, 200); }
    };
  };
  A.grabSlam = function (win) {                           // win: the door slams shut and holds. lose: it is wrenched open.
    if (!ok()) return; A.noiseHit(win ? 110 : 160, 1.4, 0.7, win ? 0.3 : 0.4); A.footfall(1);
    if (win) { A.lock(); setTimeout(function () { A.knock(2); }, 160); } else { A.creak(1); A.noiseHit(2600, 0.7, 0.25, 0.25); }
  };

  /* ---- scheduler ---- */
  var T = ART.taunts = {
    cfg: function () { return ART.CFG.taunts || null; },
    last: '', n: 0, log: [],
    pickKind: function () {
      var c = T.cfg(), ks = (c && c.kinds || []).filter(function (k) { return k.id !== T.last && A[k.id]; }); if (!ks.length) ks = (c && c.kinds || []).filter(function (k) { return A[k.id]; }); if (!ks.length) return null;
      var tot = ks.reduce(function (a, k) { return a + (k.w == null ? 1 : k.w); }, 0), r = Math.random() * tot, i = 0;
      for (; i < ks.length; i++) { r -= (ks[i].w == null ? 1 : ks[i].w); if (r <= 0) break; } return ks[Math.min(i, ks.length - 1)];
    },
    play: function (id, o) { var k = (T.cfg() && T.cfg().kinds || []).filter(function (x) { return x.id === id; })[0] || { id: id, vol: 1 }; if (!A[id]) return false; o = o || {}; if (o.vol == null) o.vol = k.vol == null ? 1 : k.vol; A[id](o); T.last = id; T.n++; T.log.push(id); return true; },
    reset: function () { T.last = ''; T.n = 0; T.log = []; S = ART.S; if (S) { S.tauntN = 0; S.tauntIn = -1; } },
    /* one game-time step while playing. Gap, odds and cap come from the manifest, arrays are per night. */
    tick: function (dt) {
      S = ART.S; var c = T.cfg(); if (!c || c.enabled === false || !ok()) return; var n = S.night, pk = function (a) { return Array.isArray(a) ? a[Math.min(Math.max(0, n - 1), a.length - 1)] : a; };
      if (S._tauntGen !== S.gen) { S._tauntGen = S.gen; S.tauntN = 0; S.tauntIn = -1; S.tauntQuiet = 0; }
      if (n < (c.minNight || 2) || S.phase !== 'play') return;
      if (S.scareBusy || S.puzzle || S.grabOn || S.feedScareOn) { S.tauntQuiet = 0; return; }           // never on top of a scare; and a quiet beat afterwards
      S.tauntQuiet += dt; if (S.tauntQuiet < (c.quietAfterScareSec || 8)) return;
      if (S.tauntIn < 0) { var g = pk(c.gapSec) || [30, 50]; S.tauntIn = g[0] + Math.random() * (g[1] - g[0]); }
      S.tauntIn -= dt; if (S.tauntIn > 0) return; S.tauntIn = -1;
      var mx = pk(c.perNightMax); if (mx != null && S.tauntN >= mx) return;
      if (Math.random() >= (pk(c.chance) == null ? 1 : pk(c.chance))) return;
      var k = T.pickKind(); if (!k) return; S.tauntN++; T.play(k.id, { vol: k.vol });
    }
  };
})(window.ART);
