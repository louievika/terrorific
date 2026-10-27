/* Terrorific - main.js (MIT). Boot: manifest -> login terminal -> preload -> tap-to-authenticate (audio + motion unlock) -> loop. */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, S, last = performance.now(), hudAcc = 0, feedAcc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    var raw = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; var dt = raw * ART.FAST;
    ART.ui.autoTick(raw); ART.ui.updateView();
    if (S.phase === 'play' || S.phase === 'dying') { ART.art.recenter(); ART.ui.updateSpots(); if (ART.peek) ART.peek.update(); }
    if (S.cam) { feedAcc += raw; if (feedAcc > 0.05) { feedAcc = 0; ART.rooms.drawFeed(now); } }
    if (S.phase === 'play') { ART.nights.tick(dt); ART.grab.tick(dt); ART.taunts.tick(dt); ART.eggs.tick(dt); }
    if (S.phase !== 'login' && S.phase !== 'over' && S.phase !== 'win' && S.phase !== 'bad') { S.session += dt; if (S.session >= ART.CFG.sessionCapSec) ART.nights.capBad(); }
    hudAcc += raw; if (hudAcc > 0.15) { hudAcc = 0; ART.ui.updateHud(); }
  }

  /* runs INSIDE the tap: audio unlock + motion permission must happen synchronously here (iOS) */
  function authenticate() {
    var btn = $('authBtn'); btn.classList.remove('ready'); btn.style.pointerEvents = 'none';
    ART.audio.unlockInTap();
    var DOE = window.DeviceOrientationEvent, perm = null;
    if (DOE && typeof DOE.requestPermission === 'function') { try { perm = DOE.requestPermission(); } catch (e) { perm = null; } }
    if (perm && perm.then) perm.then(function (r) { if (r === 'granted') ART.ui.enableGyro(); else ART.log('motion denied'); }).catch(function () { ART.log('motion perm error'); });
    else if (DOE) ART.ui.enableGyro();
    S.session = 0; S.started = true; S.deaths = 0; $('termText').textContent += '\nACCESS GRANTED\n';
    var go = function () { ART.nights.start(S.night); };
    if (ART.video) { try { ART.video.prepare(); } catch (e) { console.warn('video prepare', e); } }   // create + unlock the clips inside this tap
    var introOn = false; try { introOn = ART.video && ART.video.playIntro(go); } catch (e) { console.warn('intro', e); introOn = false; }
    if (!introOn) setTimeout(go, 700);
  }

  function wire() {
    ART.ui.wire(); ART.puzzles.init();
    $('authBtn').addEventListener('click', authenticate);
    $('loreNext').addEventListener('click', function () { ART.nights.skipLore(); });
    $('goRetry').addEventListener('click', function () { A.start(); A.duckTo(1, 0.3); ART.nights.start(S.night); });
    $('winAgain').addEventListener('click', function () { S.night = 1; S.session = 0; A.start(); ART.nights.start(1); });
    $('badAgain').addEventListener('click', function () { S.night = 1; S.session = 0; A.start(); ART.nights.start(1); });
  }

  function init() {
    S = ART.S;
    ART.eggs.load();
    ART.config.load().then(function () {
      wire(); S.night = ART.nights.loadSave(); ART.ui.typeBoot(S.night);
      var sceneReady = false, assetsReady = false, check = function () { if (sceneReady && assetsReady) { $('authBtn').classList.add('ready'); } };
      var sc = $('scene'), total = ART.rooms.urls().length + 1, n = 0;
      ART.rooms.setSky('attic');
      var onScene = function () { try { ART.ui.applyFov(); ART.ui.initView(); } catch (e) { console.error(e); } sceneReady = true; check(); };
      if (sc.hasLoaded) onScene(); else sc.addEventListener('loaded', onScene);
      var prog = function () { n++; $('loadBar').style.width = Math.round(n / total * 100) + '%'; }, left = 2, fin = function () { if (--left === 0) { assetsReady = true; check(); } };
      ART.rooms.preload(prog, fin); ART.art.preload(prog, fin);
      requestAnimationFrame(function (t) { last = t; frame(t); });
    });
    var N = ART.nights;   // debug / self-test hook
    window.__game = { S: S, CFG: ART.CFG, V: ART.V, ART: ART, startNight: N.start, moveArt: ART.art.move, threeBeat: ART.art.scare, attack: N.attack, tick: N.tick,
      openMonitor: ART.ui.openMonitor, closeMonitor: ART.ui.closeMonitor, setFeed: ART.ui.setFeed, finishNight: N.finish, capBad: N.capBad, observed: ART.art.observed };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.ART);
