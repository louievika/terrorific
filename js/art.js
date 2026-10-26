/* ART // LOGIN - art.js (MIT). Art himself: overlay sprite, AI (frozen while watched), and the 3-beat scares.
   3 beats, always: (1) visual trigger - bulb flickers + buzz, (2) 500 ms silence - ambient ducked to 0, (3) payoff - scale-up + sting. */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, rnd = ART.rnd, S, CFG;
  var artEl = null;
  var api = ART.art = {
    img: null,
    preload: function (progress, done) {
      var im = new Image(); api.img = im;
      im.onload = function () { progress(); done(true); }; im.onerror = function () { progress(); done(false); }; im.src = ART.ART_SRC;
      $('art').src = ART.ART_SRC;
    },
    reset: function () { var a = $('art'); a.className = ''; a.style.transition = 'none'; a.style.left = '50%'; void a.offsetWidth; a.style.transition = ''; },
    /* keep the overlay under Art's world position (door = yaw 0) */
    recenter: function () {
      var V = ART.V, W = innerWidth, H = innerHeight, vf = 80 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (W / H));
      var off = Math.abs(V.yaw) < 1.4 ? (W / 2) * Math.tan(V.yaw) / Math.tan(hf / 2) : 99999;
      $('art').style.left = (W / 2 + off) + 'px';
    },
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
    /* kind: 'peek' | 'lightsout' | 'attack'. done() runs after the payoff. A generation token drops stale callbacks across night restarts. */
    scare: function (kind, done) {
      S = ART.S; if (S.scareBusy) return; api.busy(true); var gen = S.gen; ART.log('scare ' + kind);
      ART.ui.closeMonitor(true); ART.puzzles.close(true);
      var seq = kind === 'attack' ? [50, 80, 40, 120, 60, 200] : [60, 90, 45, 130, 70, 220];
      api.bulbFlicker(seq, function () {                                  // BEAT 1
        if (gen !== S.gen) return;
        A.duckTo(0, 0.01);                                                // BEAT 2: silence
        setTimeout(function () {
          if (gen !== S.gen) return;
          var a = $('art'); api.reset(); api.recenter(); a.classList.add('show');   // BEAT 3: payoff
          if (kind === 'attack') { a.style.left = '50%'; a.classList.add('slam'); A.scream(); ART.ui.flash(0.9, 160); api.lightsBack(false); }
          else { a.classList.add('grow'); A.sting(kind === 'lightsout'); api.lightsBack(kind === 'lightsout'); if (kind === 'lightsout') ART.ui.flash(0.5, 140); }
          setTimeout(function () {
            if (gen !== S.gen) return;
            if (kind !== 'attack') { api.reset(); A.duckTo(1, 0.5); api.busy(false); if (done) done(); }
            else if (done) done();
          }, kind === 'attack' ? 1500 : 1000);
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
