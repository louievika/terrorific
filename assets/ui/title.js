/* ART // LOGIN - title screen. MIT. All audio is synthesized here (original, no samples). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);
  var DEFAULTS = {
    image: 'assets/art/art-title-m.jpg', blink: 'assets/art/art-title-blink.png', animated: 'assets/art/art-title.webp',
    enterDelayMs: 3500, nextUrl: null,
    studio: { label: 'ART // LOGIN', company: 'VIKA SYSTEMS', stage: 'SOUNDSTAGE 2', camera: 'CAM A', scene: '01', take: '01', roll: 'A001', fps: 24, tcStart: '01:00:00:00' },
    scare: { firstMs: 2800, minGapMs: 6500, maxGapMs: 11000, offMs: 1400, silenceMs: 500, closeStep: 0.035, slamAtLevel: 5 }
  };
  var cfg = JSON.parse(JSON.stringify(DEFAULTS));
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

  /* ================= VISUALS ================= */
  var stage = $('stage'), face = $('face'), artA = $('artA'), artB = $('artB');
  var body = document.body, bulb = $('bulb'), flashEl = $('flash'), enter = $('enter');
  var state = { started: false, canAdvance: false, advancing: false, level: 0, close: 1, closeTarget: 1, tau: 1.4 };

  function applyStudio() {
    var s = cfg.studio;
    $('hCam').textContent = s.camera; $('hFps').textContent = s.fps + ' fps'; $('hStage').textContent = s.stage; $('hCo').textContent = s.company;
    $('hSlate').textContent = 'SC' + s.scene + ' TK' + s.take + ' ' + s.roll;
    $('enterFields').textContent = 'SCENE ' + s.scene + ' \u00b7 TAKE ' + s.take;
    document.title = s.label;
  }

  function loadImg(url) {
    return new Promise(function (res) {
      if (!url) return res(null);
      var im = new Image(); im.onload = function () { res(url); }; im.onerror = function () { res(null); }; im.src = url;
    });
  }

  function loadArt() {
    return Promise.all([loadImg(cfg.animated), loadImg(cfg.image), loadImg(cfg.blink)]).then(function (r) {
      var anim = r[0], still = r[1], blink = r[2];
      if (anim) { artA.src = anim; state.mode = 'animated'; }
      else if (still) { artA.src = still; state.mode = 'static'; if (blink) { artB.src = blink; state.blinkOverlay = true; } }
      else { artA.src = 'assets/art/art-title.png'; state.mode = 'png'; } // master file fallback
      return new Promise(function (res) { artA.complete ? res() : (artA.onload = artA.onerror = res); });
    });
  }

  // Organic motion: breathing 1.0 -> 1.08 (~4s, wandering period), slow tilt, irregular micro-twitches, irregular blinks if overlay mode
  var anim = { phase: 0, last: 0, nextTwitch: 0, tw: null, nextBlink: 0, blinkUntil: 0 };
  function loop(ts) {
    var t = ts / 1000, dt = anim.last ? Math.min(0.1, t - anim.last) : 0.016; anim.last = t;
    var period = 4.2 + 0.5 * Math.sin(t * 0.13) + 0.25 * Math.sin(t * 0.41);
    anim.phase += dt * Math.PI * 2 / period;
    var b = (1 - Math.cos(anim.phase)) / 2; b = Math.pow(b, 1.25);
    var breath = 1 + 0.08 * b;
    var tilt = 1.1 * Math.sin(t * 0.31) + 0.5 * Math.sin(t * 0.73 + 1.0);
    var dx = 0, dy = 0, dr = 0;
    if (t > anim.nextTwitch) {
      anim.tw = { s: t, d: rnd(0.07, 0.15), x: rnd(-4, 4), y: rnd(-3, 3), r: rnd(-0.9, 0.9) };
      anim.nextTwitch = t + rnd(1.8, 6.5);
    }
    if (anim.tw) {
      var p = (t - anim.tw.s) / anim.tw.d;
      if (p >= 1) anim.tw = null; else { var k = Math.sin(p * Math.PI); dx = anim.tw.x * k; dy = anim.tw.y * k; dr = anim.tw.r * k; }
    }
    if (state.blinkOverlay) {
      if (t > anim.nextBlink) { anim.blinkUntil = t + rnd(0.16, 0.24); anim.nextBlink = t + rnd(2.6, 4.6) + (Math.random() < 0.25 ? -2 : 0); }
      artB.style.opacity = t < anim.blinkUntil ? 1 : 0;
    }
    state.close += (state.closeTarget - state.close) * (1 - Math.exp(-dt / state.tau));
    face.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) rotate(' + (tilt + dr).toFixed(3) + 'deg) scale(' + (breath * state.close).toFixed(4) + ')';
    // timecode
    var fps = cfg.studio.fps, parts = cfg.studio.tcStart.split(':').map(Number);
    var f = Math.floor(t * fps) + ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * fps + parts[3];
    var ff = f % fps, s = Math.floor(f / fps), ss = s % 60, mm = Math.floor(s / 60) % 60, hh = Math.floor(s / 3600);
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    $('hTc').textContent = z(hh) + ':' + z(mm) + ':' + z(ss) + ':' + z(ff);
    requestAnimationFrame(loop);
  }

  /* ---- light-flash scare: 3 beats (trigger -> 500ms silence -> payoff) ---- */
  var scareTimer = null;
  function setLight(on) { body.classList.toggle('off', !on); bulb.classList.toggle('off', !on); }
  function flashWhite(a, ms) { flashEl.style.transition = 'none'; flashEl.style.opacity = a; requestAnimationFrame(function () { flashEl.style.transition = 'opacity ' + ms + 'ms'; flashEl.style.opacity = 0; }); }

  function scheduleScare(ms) { clearTimeout(scareTimer); scareTimer = setTimeout(runScare, ms); }

  function runScare() {
    if (state.advancing) return;
    if (document.hidden) return scheduleScare(1500);
    var sc = cfg.scare, seq = [60, 90, 45, 130, 70, 220], i = 0;
    // BEAT 1: trigger - bulb flickers + electrical buzz
    A.buzz(0.9);
    (function flick() {
      setLight(i % 2 === 1);
      if (i < seq.length) { setTimeout(flick, seq[i++]); return; }
      // lights are OFF now
      setLight(false);
      // BEAT 2: silence - all ambient ducked to 0 for silenceMs
      A.duckTo(0, 0.01);
      setTimeout(function () {
        // BEAT 3: payoff - Art slowly closes in + sting
        state.level++;
        var slam = state.level >= sc.slamAtLevel;
        if (slam) { state.tau = 0.22; state.closeTarget = 1 + sc.closeStep * 4 + 0.32; }
        else { state.tau = 1.2; state.closeTarget = 1 + sc.closeStep * state.level; }
        A.setLevel(Math.min(state.level, 5)); A.sting(slam);
        setTimeout(function () {
          setLight(true); flashWhite(0.55, 220); A.duckTo(1, 0.6);
          if (slam) { state.level = 0; setTimeout(function () { state.tau = 3.2; state.closeTarget = 1; A.setLevel(0); }, 1800); }
          scheduleScare(rnd(sc.minGapMs, sc.maxGapMs));
        }, sc.offMs);
      }, sc.silenceMs);
    })();
  }

  /* ---- flow ---- */
  function begin() {
    if (state.started) return; state.started = true;
    A.start();
    $('gate').classList.add('gone');
    stage.classList.add('live');
    setTimeout(function () { enter.classList.add('show'); state.canAdvance = true; }, cfg.enterDelayMs);
    scheduleScare(cfg.scare.firstMs + 2400);
  }

  function advance() {
    if (state.advancing) return; state.advancing = true; clearTimeout(scareTimer);
    enter.classList.add('clack'); A.clack();
    A.duckTo(0, 0.5);
    stage.style.transition = 'opacity 1.2s'; stage.style.opacity = 0;
    setTimeout(function () {
      if (cfg.nextUrl) { location.href = cfg.nextUrl; return; }
      $('next').classList.add('on');
    }, 1300);
  }

  function resetToTitle() { location.reload(); }

  function onTap(e) {
    A.unlock();
    if (!state.started) { begin(); return; }
    if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); // iOS interruption recovery
    if (state.canAdvance && !state.advancing) advance();
  }

  // pointerdown works for touch + mouse; used inside the gesture for unlock
  $('gate').addEventListener('pointerdown', onTap);
  stage.addEventListener('pointerdown', onTap);
  $('next').addEventListener('pointerdown', resetToTitle);
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  window.__title = { state: state, cfg: cfg, A: A, runScare: runScare }; // debug hook

  fetch('assets/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (m) {
    if (m && m.title) { var t = m.title; Object.keys(t).forEach(function (k) { if (t[k] && typeof t[k] === 'object') Object.assign(cfg[k], t[k]); else cfg[k] = t[k]; }); }
    if (qs.get('fast')) { cfg.enterDelayMs = 800; cfg.scare.firstMs = 300; cfg.scare.minGapMs = cfg.scare.maxGapMs = 2500; }
    applyStudio();
    return loadArt();
  }).then(function () { requestAnimationFrame(loop); });
})();
