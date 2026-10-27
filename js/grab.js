/* Terrorific - grab.js (MIT). DOOR GRAB: while the door is held closed, Art can take hold of it from the other side.
   Hold or mash to push back. No HUD meter: the only feedback is the door's jitter, a scraping loop, haptics (where the device has them) and the door LED pulsing.
   Win -> 500 ms silence -> the door slams home and Art backs off. Lose (or time runs out) -> 500 ms silence -> the door is wrenched open and his face fills the screen.
   Night-scaled odds / strength / cooldown / caps come from the manifest (game.grab); none on night 1. Uses scareBusy, so nothing stacks on top of it. */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, S, st = null, iv = 0, scrape = null, G;
  function cfg() { return ART.CFG.grab || null; }
  function pk(a, n) { return Array.isArray(a) ? a[Math.min(Math.max(0, n - 1), a.length - 1)] : a; }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function cleanup() {
    if (iv) { clearInterval(iv); iv = 0; } if (scrape) { scrape.stop(); scrape = null; }
    document.body.classList.remove('grabbing'); document.body.style.removeProperty('--gj'); $('btnDoor').classList.remove('grab'); buzz(0);
  }
  function release(gen) {
    S.grabOn = false; st = null; if (gen !== S.gen) return; ART.ui.unlockView(); A.duckTo(1, 0.5); ART.art.busy(false);
    var c = cfg(); S.grabCool = pk(c && c.cooldownSec, S.night) || 0;
  }
  function resolve(win) {
    var gen = st.gen; st.done = true; cleanup(); var c = cfg(); A.duckTo(0, 0.01); ART.log('grab ' + (win ? 'WIN' : 'LOSE') + ' prog=' + st.prog.toFixed(2));   // BEAT 2: silence (always 500 ms)
    S.grabResult = win ? 'win' : 'lose'; G.results.push(win ? 'win' : 'lose'); st.silenceAt = performance.now();
    setTimeout(function () {                                                                                              // BEAT 3: payoff
      if (gen !== S.gen) { S.grabOn = false; st = null; return; } A.duckTo(1, 0.3);
      if (win) {
        A.grabSlam(true); ART.ui.flash(0.3, 90); document.body.classList.remove('jolt', 'rattle', 'sway'); document.body.classList.add('camshake', 'jolt'); try { ART.art.move(Math.random() < 0.5 ? 'kitchen' : 'frontdoor'); } catch (e) {}
        setTimeout(function () { release(gen); if (ART.eggs) ART.eggs.emit('grabWin'); }, 700);
      } else {
        S.door = false; $('btnDoor').classList.remove('on'); A.grabSlam(false); ART.ui.updateHud(); S.power = Math.max(0, S.power - ((c && c.losePowerPct) || 0));
        ART.art.facePop({ stab: 'scrape' }, gen, function (hold) { setTimeout(function () { release(gen); if (ART.eggs) ART.eggs.emit('grabLose'); }, hold); });
      }
    }, 500);
  }
  function step() {
    if (!st || st.done) return; var now = performance.now(), dt = Math.min(0.2, (now - st.last) / 1000); st.last = now; st.t += dt;
    if (S.gen !== st.gen || S.phase !== 'play' && S.phase !== 'dying') { st.done = true; cleanup(); S.grabOn = false; st = null; return; }
    if (S.phase === 'dying') return;
    st.surge -= dt; if (st.surge <= 0) { st.surge = 0.9 + Math.random() * 1.1; st.surgeOn = 0.35 + Math.random() * 0.2; } st.surgeOn -= dt;
    var pull = st.pull * (st.surgeOn > 0 ? 1.7 : 0.85); st.prog += ((st.down > 0 ? st.hold : 0) - pull) * dt; if (st.prog > 1.2) st.prog = 1.2;
    var k = Math.max(0, Math.min(1, 1 - st.prog)); document.body.style.setProperty('--gj', (0.35 + 0.65 * k).toFixed(2)); if (scrape) scrape.set(0.25 + 0.75 * k + (st.surgeOn > 0 ? 0.25 : 0));
    if (st.surgeOn > 0 && now - st.buzzAt > 380) { st.buzzAt = now; buzz([40, 30, 40]); }
    if (st.prog >= 1) resolve(true); else if (st.prog <= 0 || st.t >= st.limit) resolve(false);
  }
  function press(e) { if (!st || st.done) return; st.down++; st.prog += st.gain; st.taps++; if (st.prog > 1.2) st.prog = 1.2; buzz(12); }
  function lift() { if (st && st.down > 0) st.down--; }
  document.addEventListener('pointerdown', press, true); document.addEventListener('pointerup', lift, true); document.addEventListener('pointercancel', lift, true);

  G = ART.grab = {
    results: [],
    active: function () { return !!st && !st.done; },
    press: press, lift: lift, state: function () { return st ? { prog: st.prog, taps: st.taps, t: st.t, done: st.done } : null; },
    /* begin a grab now. force=true skips the odds (tests / director), never the safety rules: door shut, power on, nothing else scaring, not night 1 unless forced. */
    start: function (force) {
      S = ART.S; var c = cfg(); if (!c || c.enabled === false) return false;
      if (S.phase !== 'play' || !S.door || S.powerDead || S.scareBusy || S.grabOn) return false; var n = S.night; if (n < (c.minNight || 2) && force !== 'any') return false;
      ART.art.busy(true); S.grabOn = true; S.grabN = (S.grabN || 0) + 1; var gen = S.gen;
      st = { gen: gen, prog: c.startProgress == null ? 0.32 : c.startProgress, t: 0, last: performance.now(), pull: pk(c.pullPerSec, n) || 0.25, gain: c.tapGain || 0.08, hold: c.holdPerSec || 0.1, limit: pk(c.limitSec, n) || 7, down: 0, taps: 0, surge: 0.5, surgeOn: 0, buzzAt: 0, done: false };
      ART.ui.lockView(260); if (ART.S.cam) ART.ui.closeMonitor(true);
      document.body.classList.add('grabbing'); $('btnDoor').classList.add('grab'); A.knock(1);
      setTimeout(function () { if (st && !st.done && st.gen === gen) { scrape = A.grabStart(); scrape.set(0.5); } }, 380);                // BEAT 1: the handle jerks, then the scraping starts and builds
      iv = setInterval(step, 50); ART.log('door grab start (night ' + n + ')'); return true;
    },
    /* per-night counters + odds, rolled while the door is shut */
    tick: function (dt) {
      S = ART.S; var c = cfg(); if (!c || c.enabled === false) return; var n = S.night;
      if (S._grabGen !== S.gen) { S._grabGen = S.gen; S.grabN = 0; S.grabChk = 0; S.grabCool = 0; S.grabOn = false; }
      if (n < (c.minNight || 2) || S.phase !== 'play' || !S.door || S.powerDead || S.cam || S.scareBusy || S.puzzle || S.t < (c.minT || 12)) { if (!S.door) S.grabChk = 0; return; }
      S.grabChk += dt; S.grabCool -= dt; if (S.grabCool > 0 || S.grabChk < (c.checkSec || 8)) return; S.grabChk = 0;
      var mx = pk(c.perNightMax, n); if (mx != null && (S.grabN || 0) >= mx) return; if (Math.random() < (pk(c.chance, n) || 0)) G.start();
    },
    reset: function () { if (st) st.done = true; cleanup(); st = null; S = ART.S; if (S) S.grabOn = false; }
  };
})(window.ART);
