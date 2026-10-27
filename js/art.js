/* Terrorific - art.js (MIT). Art himself: overlay sprite, AI (frozen while watched), and the 3-beat scares.
   3 beats, always: (1) visual trigger - bulb flickers + buzz, (2) 500 ms silence - ambient ducked to 0, (3) payoff - Art RUNS down the hall (2D sprite sheet) + stride-synced footfalls + sting.
   Which variant plays comes from ART.director (js/director.js); fakeout variants play beats 1-2 only. */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, rnd = ART.rnd, S, CFG;
  var artEl = null;

  /* ---------- payoffs (beat 3), one per variant type ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function flashSeq(seq) { var t = 0; (seq || [[0.5, 100]]).forEach(function (f) { setTimeout(function () { if (f[0] > 0) ART.ui.flash(f[0], f[1]); }, t); t += f[1] + 35; }); }
  function shake(kind) { if (!kind || kind === 'none') return; var b = document.body; b.classList.remove('jolt', 'rattle', 'sway'); b.classList.add('camshake', kind); }
  function impact(v, kind, p) {                                           // sting + synthesized stab, pitch/pan randomised so it never sounds the same twice
    var o = { rate: 0.86 + Math.random() * 0.34, pan: (v.side || 0) * 1.4 + (Math.random() - 0.5) * 0.4 };
    if (kind === 'attack') { A.scream(); } else A.sting(kind === 'lightsout' || (v.to || 0) > 0.8, o);
    if (A.stab) A.stab(v.stab || 'synth', { rate: o.rate, pan: o.pan, vol: kind === 'attack' ? 0.35 : 0.5 });
    if (ART.voice && (v.type === 'run' || v.type === 'silhouette')) ART.voice.taunt(kind);   // rare: Art speaks only after the hit, after the silence
  }
  var PAYOFF = {
    /* Art runs from the far end of the hall to the camera on the 2D sprite sheet (ease-in), footfalls on the stride, hit on the last frames */
    run: function (v, kind, gen, finish) {
      var S = ART.S, R = ART.ART_RUN, run = api.run, el = $('artRun'), W = innerWidth, H = innerHeight;
      if (!run.ok || !R) return runFallback(v, kind, gen, finish);
      var dur = v.ms || R.durationMs || 1000, t0 = performance.now(), flip = Math.random() < 0.5 ? -1 : 1, f0 = Math.floor(Math.random() * R.frames);
      var lastF = -1, hit = false, rows = Math.ceil(R.frames / R.cols), floorFar = H * 0.36, stingP = v.stop ? 0.9 : 0.78, ease = v.ease || 2.2;
      api.lightsBack(kind === 'lightsout'); el.classList.remove('fade', 'sil'); el.style.opacity = 1; ART.log('run ' + v.id);
      (function step(now) {
        if (gen !== S.gen) return;
        var p = Math.max(0, Math.min(1, (now - t0) / dur)), e = Math.pow(p, ease);
        var sc = lerp(v.from, v.to, e), x = W / 2 + Math.max(-W * 0.5, Math.min(W * 0.5, api.doorX() - W / 2)) * Math.pow(1 - p, 2) + (v.side || 0) * W * 0.5 * Math.pow(p, 1.25) * (1 - p), y = -floorFar * (1 - Math.pow(p, 1.5));
        el.style.left = x + 'px'; el.style.transform = 'translate3d(-50%,' + y.toFixed(1) + 'px,0) scale(' + (sc * flip).toFixed(3) + ',' + sc.toFixed(3) + ')';
        var fi = (f0 + Math.floor(Math.max(0, now - t0) * R.fps / 1000)) % R.frames;
        if (fi !== lastF) {
          lastF = fi; el.style.backgroundPosition = ((fi % R.cols) / (R.cols - 1) * 100) + '% ' + (Math.floor(fi / R.cols) / (rows - 1) * 100) + '%';
          if ((R.footfallFrames || [0, 6]).indexOf(fi) >= 0) A.footfall(0.2 + 0.8 * e);
        }
        if (!hit && p >= stingP) { hit = true; impact(v, kind, p); if (v.to > 0.7 || kind !== 'peek') { shake(v.shake); flashSeq(v.flash); } else ART.ui.flash(0.2, 70); }
        if (p < 1) { api.raf = requestAnimationFrame(step); return; }
        api.raf = 0; finish(kind === 'attack' ? 1300 : (v.stop ? 420 : 700));
        if (kind !== 'attack' && v.stop) { el.classList.add('fade'); setTimeout(function () { el.style.opacity = 0; }, 160); }
      })(t0);
    },
    /* a dark shape in the doorway: no motion, only a slow fade-in and a stab */
    silhouette: function (v, kind, gen, finish) {
      var el = $('artRun'), R = ART.ART_RUN; if (!api.run.ok || !R) return runFallback({ from: 0.5, to: 0.55, ms: 300, stab: v.stab, side: 0, stop: true }, kind, gen, finish);
      api.lightsBack(false); var x = innerWidth / 2; el.className = 'sil'; el.style.left = x + 'px'; el.style.backgroundPosition = '0% 0%';
      el.style.transition = 'opacity .6s ease-in'; el.style.transform = 'translate3d(-50%,' + (-innerHeight * 0.1) + 'px,0) scale(.62)'; void el.offsetWidth; el.style.opacity = 0.96;
      setTimeout(function () { if (gen !== ART.S.gen) return; impact({ stab: v.stab, side: 0, to: 0.6 }, kind); ART.ui.flash(0.12, 60); }, 650);
      setTimeout(function () { el.style.transition = 'opacity .12s'; el.style.opacity = 0; }, 1250); finish(1450); setTimeout(function () { el.style.transition = ''; }, 1500);
    },
    /* silent pantomime: Art tips his hat, waves, then lunges (mock-friendliness before violence) */
    mime: function (v, kind, gen, finish) {
      var el = $('artRun'), R = ART.ART_RUN; if (!api.run.ok || !R) return runFallback({ from: 0.05, to: 0.6, ms: 800, stab: v.stab, side: 0, stop: true }, kind, gen, finish);
      api.lightsBack(false); var S = ART.S, x = innerWidth / 2, base = 'translate3d(-50%,' + (-innerHeight * 0.08) + 'px,0) ';
      el.className = 'mime'; el.style.left = x + 'px'; el.style.backgroundPosition = '33.3% 0%'; el.style.transition = 'none'; el.style.transform = base + 'rotate(0deg) scale(.5)'; el.style.opacity = 1; void el.offsetWidth;
      el.style.transition = 'transform .45s ease-in-out';
      var steps = [[0, 'rotate(-9deg) scale(.5)'], [450, 'rotate(7deg) scale(.5)'], [900, 'rotate(-7deg) scale(.52)'], [1300, 'rotate(0deg) scale(.5)']];
      steps.forEach(function (st) { setTimeout(function () { if (gen === S.gen) { el.style.transform = base + st[1]; if (A.stab && st[0] === 0) A.stab('musicbox', { vol: 0.22, rate: 1, pan: -0.2 }); } }, st[0]); });
      setTimeout(function () { if (gen !== S.gen) return; el.style.transition = 'transform .16s ease-in'; el.style.transform = base + 'rotate(0deg) scale(.95)'; impact({ stab: 'horn', side: 0, to: 0.9 }, kind); ART.ui.flash(0.4, 80); shake('jolt'); }, 1700);
      setTimeout(function () { el.style.opacity = 0; }, 2000); finish(2100);
    },
    /* sound only: footsteps pass behind the wall and a stab, nothing to see */
    sound: function (v, kind, gen, finish) {
      var S = ART.S, pan = Math.random() < 0.5 ? -1 : 1; api.lightsBack(false);
      for (var i = 0; i < 5; i++) (function (i) { setTimeout(function () { if (gen === S.gen) A.footfall(0.3 + i * 0.12); }, i * 360); })(i);
      setTimeout(function () { if (gen === S.gen) { impact({ stab: v.stab, side: pan * 0.7, to: 0.5 }, kind); ART.ui.flash(0.15, 60); } }, 1900); finish(2200);
    },
    /* supplied video clip, full-screen and screen-locked (beat 3 = clip + its audio). No clip / won't play -> the sprite run instead. */
    video: function (v, kind, gen, finish) {
      var S = ART.S, fb = function () {
        if (gen !== S.gen) return; ART.log('video fallback -> sprite');
        PAYOFF.run({ id: v.id + '-fb', type: 'run', from: 0.05, to: kind === 'peek' ? 0.8 : 1.6, ms: 900, side: 0, stop: kind === 'peek', stab: 'synth' }, kind, gen, finish);
      };
      ART.video.playScare(function () { if (gen === S.gen) finish(120); }, fb);
    },
    /* knocking at the door, then nothing */
    knock: function (v, kind, gen, finish) { api.lightsBack(false); A.knock(3); setTimeout(function () { if (gen === ART.S.gen) A.creak(0.4); }, 1300); finish(1900); },
    /* FAKE-OUT: beats 1-2 only. Lights return, nothing came. The director queues a real scare soon after. */
    fakeout: function (v, kind, gen, finish) { api.lightsBack(false); A.duckTo(1, 1.2); A.creak(0.3); finish(900); }
  };
  /* sprite sheet missing: the old static scale-up (CSS transition) */
  function runFallback(v, kind, gen, finish) {
    var a = $('art'); api.reset(); ART.ui.lockView(260); a.style.left = '50%'; a.classList.add('show'); api.lightsBack(kind === 'lightsout');
    if (kind === 'attack') { a.style.left = '50%'; a.classList.add('slam'); ART.ui.flash(0.9, 160); } else { a.classList.add('grow'); if (kind === 'lightsout') ART.ui.flash(0.5, 140); }
    impact(v, kind); finish(kind === 'attack' ? 1500 : 1000);
  }
  var api = ART.art = {
    img: null,
    run: { ok: false, im: null },
    preload: function (progress, done) {
      var im = new Image(); api.img = im;
      im.onload = function () { progress(); done(true); }; im.onerror = function () { progress(); done(false); }; im.src = ART.ART_SRC;
      $('art').src = ART.ART_SRC;
      var R = ART.ART_RUN;                                           // run sheet loads in the background: never blocks the title/login, falls back to the static scale-up
      if (R && R.sheet) {
        var rm = new Image(); api.run.im = rm; rm.onload = function () { api.run.ok = true; var e = $('artRun'); e.style.backgroundImage = 'url(' + R.sheet + ')';
          e.style.backgroundSize = (R.cols * 100) + '% ' + (Math.ceil(R.frames / R.cols) * 100) + '%'; e.style.aspectRatio = R.frameW + '/' + R.frameH; ART.log('run sheet ready'); };
        rm.onerror = function () { api.run.ok = false; console.warn('run sheet failed - static scale-up fallback'); }; rm.src = R.sheet;
      }
    },
    cancelRun: function () { if (api.raf) cancelAnimationFrame(api.raf); api.raf = 0; },
    reset: function () { api.cancelRun(); if (ART.ui && ART.ui.unlockView) ART.ui.unlockView(); var r = $('artRun'); r.className = ''; r.style.transition = ''; r.style.opacity = 0; document.body.classList.remove('camshake', 'jolt', 'rattle', 'sway'); var a = $('art'); a.className = ''; a.style.transition = 'none'; a.style.left = '50%'; void a.offsetWidth; a.style.transition = ''; },
    /* keep the overlay under Art's world position (door = yaw 0) */
    doorX: function () {
      var V = ART.V, W = innerWidth, H = innerHeight, vf = 80 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (W / H));
      var off = Math.abs(V.yaw) < 1.4 ? (W / 2) * Math.tan(V.yaw) / Math.tan(hf / 2) : 99999;
      return W / 2 + off;
    },
    recenter: function () { $('art').style.left = api.doorX() + 'px'; },
    busy: function (b) { ART.S.scareBusy = b; document.body.classList.toggle('scaring', b); },
    bulbFlicker: function (seq, done) {
      var b = $('bulb'), i = 0; A.buzz(0.9);
      (function f() {
        b.classList.toggle('off', i % 2 === 0); document.body.classList.toggle('lightsout', i % 2 === 0);
        if (i < seq.length) { setTimeout(f, seq[i++]); return; }
        b.classList.add('off'); document.body.classList.add('lightsout'); done();
      })();
    },
    lightsBack: function (dim) { $('bulb').classList.remove('off'); document.body.classList.remove('lightsout'); document.body.classList.toggle('dim', !!dim); },
    /* kind: 'peek' | 'lightsout' | 'attack'. done() runs after the payoff. A generation token drops stale callbacks across night restarts.
       vid (optional) forces a variant id (tests). */
    scare: function (kind, done, vid) {
      S = ART.S; if (S.scareBusy) return; api.busy(true); var gen = S.gen, D = ART.director, v = D.pick(kind, vid); S.lastScare = { kind: kind, id: v.id, type: v.type };
      ART.log('scare ' + kind + ' ' + v.id);
      ART.ui.closeMonitor(true); ART.puzzles.close(true);
      var j = D.jitter(), seq = (kind === 'attack' ? [50, 80, 40, 120, 60, 200] : [60, 90, 45, 130, 70, 220]).map(function (x) { return Math.round(x * j); });
      var finish = function (hold) {
        setTimeout(function () {
          if (gen !== S.gen) return;
          if (kind !== 'attack') { api.reset(); A.duckTo(1, 0.5); api.busy(false); D.after(kind, v); if (done) done(); }
          else if (done) done();
        }, hold);
      };
      api.bulbFlicker(seq, function () {                                  // BEAT 1 done
        if (gen !== S.gen) return;
        A.duckTo(0, 0.01);                                                // BEAT 2: silence (always 500 ms, never jittered)
        setTimeout(function () {
          if (gen !== S.gen) return;
          api.reset();                                                    // BEAT 3: payoff (none for fakeout)
          if (v.type !== 'fakeout' && v.type !== 'sound' && v.type !== 'knock') ART.ui.lockView(260);   // camera-locked: view eases to centre so Art lands in front of the player at any yaw
          (PAYOFF[v.type] || PAYOFF.run)(v, kind, gen, finish);
        }, 500);
      });
    },
    /* ---- AI ---- */
    observed: function () { var S = ART.S; return S.cam && S.feed === S.artRoom; },
    move: function (forceTo) {
      S = ART.S; CFG = ART.CFG;
      var from = S.artRoom, opts = ART.rooms.graph(from), to = forceTo;
      if (!to) { if (!opts.length) return; to = from === 'basement' ? opts[Math.floor(Math.random() * 2)] : (Math.random() < 0.8 ? opts[0] : opts[1] || opts[0]); }
      S.artRoom = to; S.moveT = rnd(S.nightCfg.moveMin, S.nightCfg.moveMax); ART.log('art ' + from + ' -> ' + to);
      A.step();
      if (to === 'hallway') { S.attackT = S.nightCfg.attackSec; S.knockT = 2.2; A.step(); setTimeout(A.step, 300); setTimeout(function () { A.creak(0.5); }, 900); } else S.attackT = -1;
    },
    /* night-3 rule: Art may pop up in the room you just stopped checking */
    feedLeft: function (fromFeed) {
      S = ART.S; var p = S.nightCfg.appearP;
      if (!fromFeed || !p || S.artRoom === fromFeed || S.phase !== 'play') return;
      if (Math.random() < p) {
        ART.log('APPEAR in ' + fromFeed + ' (just checked)'); S.artRoom = fromFeed; S.moveT = rnd(S.nightCfg.moveMin, S.nightCfg.moveMax);
        S.attackT = fromFeed === 'hallway' ? S.nightCfg.attackSec : -1; S.knockT = 2.2; setTimeout(function () { A.step(); }, 400);
      }
    },
    /* per-tick AI: frozen while observed; hallway runs the attack countdown; peeks fire when the monitor is down */
    tick: function (dt) {
      S = ART.S; var c = S.nightCfg;
      if (!api.observed()) {
        if (S.artRoom === 'hallway') {
          S.attackT -= dt; S.knockT -= dt;
          if (S.knockT <= 0 && S.attackT > 0) { S.knockT = 2.2; A.knock(S.door ? 2 : 1); }
          if (S.attackT <= 0) ART.nights.resolveAttack();
        } else {
          S.moveT -= dt;
          if (S.moveT <= 0) { if (Math.random() < c.aggro) api.move(); else S.moveT = rnd(c.moveMin, c.moveMax) * 0.6; }
        }
      }
      if (S.peeks.length && S.t >= S.peeks[0] && !S.cam && S.phase === 'play') { S.peeks.shift(); api.scare('peek'); }
    }
  };
  ART.threeBeat = api.scare;   // kept for the debug/test hook
})(window.ART);
