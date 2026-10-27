/* Terrorific - nights.js (MIT). Game state, night flow, power, attack resolution, endings, save.
   Phases: login -> play (night 1..5) -> lore -> ... -> win | over (retry) | bad (session cap). */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, rnd = ART.rnd, CFG = ART.CFG;
  var S = ART.S = {
    phase: 'login', night: 1, gen: 0, t: 0, len: 60, power: 100, cam: false, feed: 'hallway', door: false, bolt: false, cool: { fusebox: 0, doorbolt: 0 }, puzzle: null,
    artRoom: 'basement', moveT: 0, attackT: -1, knockT: 0, powerDead: false, deadT: -1, lo10: false, scareBusy: false, peeks: [],
    session: 0, hasGyro: false, started: false, nightCfg: CFG.nights[0], deaths: 0, log: []
  };
  ART.log = function (s) { S.log.push(S.t.toFixed(1) + ' ' + s); if (S.log.length > 30) S.log.shift(); };
  var callTimer;

  var N = ART.nights = {
    save: function () { try { localStorage.setItem(ART.SAVE_KEY, JSON.stringify({ night: S.night })); } catch (e) {} },
    loadSave: function () { try { var j = JSON.parse(localStorage.getItem(ART.SAVE_KEY)); return j && j.night >= 1 && j.night <= 5 ? j.night : 1; } catch (e) { return 1; } },
    clearSave: function () { try { localStorage.removeItem(ART.SAVE_KEY); } catch (e) {} },

    start: function (n) {
      ART.ui.unlockView();
      S.gen++; if (ART.video) { ART.video.stop(); } if (ART.grab) ART.grab.reset(); if (ART.taunts) ART.taunts.reset(); if (ART.dogEgg) ART.dogEgg.reset(); if (ART.peek) ART.peek.reset(); S.night = n; S.nightCfg = CFG.nights[n - 1] || CFG.nights[CFG.nights.length - 1]; var c = S.nightCfg;
      S.t = 0; S.len = c.len; S.power = CFG.powerStartPct; S.cam = false; S.door = false; S.bolt = false; S.cool = { fusebox: 0, doorbolt: 0 }; S.powerDead = false; S.deadT = -1; S.lo10 = false;
      S.artRoom = c.start; S.attackT = -1; S.knockT = 0; S.phase = 'play'; S.moveT = rnd(c.moveMin, c.moveMax);
      ART.puzzles.close(true); ART.art.busy(false);
      S.peeks = []; for (var i = 0; i < c.peeks; i++) S.peeks.push(S.len * rnd(0.2 + i * 0.2, 0.34 + i * 0.22));
      document.body.classList.remove('lightsout', 'dim'); $('bulb').classList.remove('off'); ART.art.reset();
      $('btnDoor').classList.remove('on'); $('btnCam').classList.remove('on'); $('monitor').classList.remove('open');
      A.duckTo(1, 0.3); A.setLevel(n); N.save(); ART.rooms.setSky('attic'); ART.ui.resetHudBucket();
      ART.ui.show('game'); ART.puzzles.refresh(); ART.ui.center('NIGHT ' + n + '\n12 AM', 2600); ART.ui.updateHud(); ART.ui.peekHud(3200);
      if (n === 1) ART.ui.scheduleAutoPan();
      if (ART.voice) {                                                   // Art's voice: first-ever run says hello, every other start gets that night's line
        ART.voice.stop(); var first = false; try { first = n === 1 && !localStorage.getItem(ART.voice.VOICE_KEY); if (first) localStorage.setItem(ART.voice.VOICE_KEY, '1'); } catch (e) {}
        ART.voice.say(first ? 'intro' : 'night' + Math.min(n, 5), { delay: first ? 2800 : 1400 });
      }
      ART.log('night ' + n + ' start, art in ' + S.artRoom); if (ART.eggs) ART.eggs.emit('nightStart', { night: n });
    },
    toggleDoor: function () {
      if (S.phase === 'play' && S.powerDead && !S.scareBusy && !S.puzzle && ART.dogEgg) ART.dogEgg.mistake('doorFail');
      if (S.phase !== 'play' || S.powerDead || S.scareBusy || S.puzzle) return;
      S.door = !S.door; $('btnDoor').classList.toggle('on', S.door); A.lock(); A.creak(); ART.ui.peekHud(2200); ART.ui.updateHud(); ART.log('door ' + S.door);
    },
    finish: function () {
      S.phase = 'lore'; ART.ui.closeMonitor(true); ART.puzzles.close(true); A.chime(); A.setLevel(0); if (ART.grab) ART.grab.reset(); if (ART.eggs) ART.eggs.emit(S.night >= 5 ? 'win' : 'nightEnd', { night: S.night });
      if (S.night >= 5) { S.phase = 'win'; N.clearSave(); $('winText').textContent = CFG.text.win; setTimeout(function () { ART.ui.show('win'); if (ART.voice) ART.voice.say('win', { delay: 900 }); }, 900); return; }
      var L = CFG.lore[S.night - 1]; S.night++; N.save();
      setTimeout(function () { ART.ui.showLore(L, ART.FAST, function (t) { callTimer = t; }); }, 900);
    },
    skipLore: function () { clearTimeout(callTimer); if (ART.voice) ART.voice.stop(); $('loreDoc').classList.remove('hidden'); N.start(S.night); },
    gameOver: function (reason) {
      if (S.phase === 'over') return; S.phase = 'over'; S.deaths++; ART.ui.unlockView(); ART.ui.closeMonitor(true); ART.puzzles.close(true); A.stopMusic();
      $('goReason').textContent = reason; ART.ui.show('gameover'); ART.art.lightsBack(false); ART.art.busy(false); if (ART.grab) ART.grab.reset(); if (ART.eggs) ART.eggs.emit('gameOver', { night: S.night }); ART.log('GAME OVER ' + reason); if (ART.dogEgg) setTimeout(function () { ART.dogEgg.mistake('caught'); }, 900);
    },
    capBad: function () {
      if (S.phase === 'bad') return; S.phase = 'bad'; ART.ui.closeMonitor(true); ART.puzzles.close(true); A.stopMusic(); A.powerDown(); N.clearSave();
      $('badText').textContent = CFG.text.bad; ART.ui.show('bad'); if (ART.voice) ART.voice.say('bad', { delay: 900 }); ART.log('BAD END (session cap)');
    },

    /* Art reached the hallway and the timer ran out: a locked door (or a slid bolt) holds; otherwise he's in */
    resolveAttack: function () {
      S.attackT = -1;
      var locked = S.door && !S.powerDead;
      if (locked || S.bolt) {
        A.knock(4); ART.ui.flash(0.25, 80);
        if (!locked) { S.bolt = false; ART.puzzles.refresh(); }
        S.power = Math.max(0, S.power - CFG.drain.doorHitPenaltyPct); ART.art.move(Math.random() < 0.5 ? 'kitchen' : 'frontdoor'); ART.log(locked ? 'door held' : 'bolt held');
      } else N.attack(S.powerDead ? CFG.text.overPower : CFG.text.overDoor);
    },
    attack: function (reason) {
      if (S.scareBusy || S.phase !== 'play') return; S.phase = 'dying';
      ART.art.scare('attack', function () { N.gameOver(reason); });
    },

    /* one game-time step (dt already scaled by ?fast) */
    tick: function (dt) {
      S.t += dt; var c = S.nightCfg;
      var dr = (CFG.drain.idle + (S.cam ? CFG.drain.camera : 0) + (S.door ? CFG.drain.door : 0)) * c.drainMul * dt;
      if (!S.powerDead) S.power = Math.max(0, S.power - dr);
      ART.puzzles.cooldownTick(dt);
      if (!S.lo10 && S.power <= CFG.lightsOutAtPct && !S.powerDead) { S.lo10 = true; ART.art.scare('lightsout'); }
      if (S.power <= 0 && !S.powerDead) {
        S.powerDead = true; S.door = false; $('btnDoor').classList.remove('on'); ART.ui.closeMonitor(true); A.powerDown();
        document.body.classList.add('lightsout'); $('bulb').classList.add('off');
        S.deadT = rnd(CFG.deadAttackDelaySec[0], CFG.deadAttackDelaySec[1]); ART.log('POWER DEAD'); ART.puzzles.refresh();
      }
      if (S.powerDead) {
        S.deadT -= dt; if (S.deadT > 0 && Math.random() < dt * 0.6) A.step();
        if (S.deadT <= 0 && !S.scareBusy) N.attack(CFG.text.overDead);
        return;
      }
      if (S.scareBusy) return;
      ART.art.tick(dt);
      if (S.t >= S.len) N.finish();
    }
  };
})(window.ART);
