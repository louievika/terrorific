/* Terrorific - dogegg.js (MIT). The DOG easter egg: a rare, cheeky MOCKING pop-in after one of the player's mistakes.
   The picture is a user-supplied photo cut-out (assets/art/dog.png). It is NOT a fail scare and never lunges: it pops in small in a bottom corner, bobs, snickers (original synthesis), stays ~1.2 s and leaves.
   3 beats, always: (1) the mistake's own cue (buzz / slam / the game-over screen), (2) 500 ms silence (ambient ducked to 0), (3) payoff: the pop + snicker.
   Rare + config-driven: assets/easter-eggs.json "dogEgg" (chance, cooldownSec, maxPerNight, minNight, triggers, pos, widthPct, holdMs). Never twice in a row (the next eligible mistake after a pop is always skipped).
   Hooks: ART.dogEgg.mistake(kind) from puzzles (puzzleWrong / puzzleFail), nights (doorFail, caught), grab (grabLose). Off in the headless suites (?fast / ?novideo) unless ?dog=1; ?nodog=1 always off. */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, st = { ok: false, im: null, lastWasDog: false, lastAt: -1e9, night: 0, nightN: 0, total: 0, busy: false, tok: 0, timers: [], log: [] };
  function cfg() { return ART.eggs && ART.eggs.dogCfg ? ART.eggs.dogCfg() : null; }
  function later(f, ms) { var id = setTimeout(f, ms); st.timers.push(id); return id; }
  var D = ART.dogEgg = {
    enabled: function () { var c = cfg(), q = location.search; if (!c || c.enabled === false || /[?&]nodog=1/.test(q)) return false; if (/[?&]dog=1/.test(q)) return true; return !/[?&](fast|novideo)=/.test(q); },
    ready: function () { return D.enabled() && st.ok; },
    state: function () { return { ok: st.ok, busy: st.busy, lastWasDog: st.lastWasDog, nightN: st.nightN, total: st.total, log: st.log.slice() }; },
    load: function () {
      var c = cfg(); if (!c || !D.enabled() || st.im) return; var im = new Image(); st.im = im;
      im.onload = function () { st.ok = true; $('dogPop').src = c.asset || 'assets/art/dog.png'; ART.log('dog egg ready'); };
      im.onerror = function () { st.ok = false; console.warn('dog image failed - the egg is skipped'); };
      im.src = c.asset || 'assets/art/dog.png';
    },
    /* a mistake happened. Returns true when the dog will play. */
    mistake: function (kind) {
      var c = cfg(), S = ART.S; if (!c || !D.ready() || st.busy || !S) return false;
      if (!c.triggers || !c.triggers[kind]) return false;
      if (kind === 'caught') { if (S.phase !== 'over') return false; }
      else if (S.phase !== 'play' || S.scareBusy || S.feedScareOn || (S.grabOn && kind !== 'grabLose')) return false;
      if (S.night < (c.minNight || 1)) return false;
      var now = performance.now(); if (now - st.lastAt < (c.cooldownSec || 0) * 1000) return false;
      if (S.night !== st.night) { st.night = S.night; st.nightN = 0; }
      if (st.nightN >= (c.maxPerNight == null ? 1 : c.maxPerNight)) return false;
      if (st.lastWasDog) { st.lastWasDog = false; st.log.push('skip(' + kind + '): never twice in a row'); return false; }
      if (Math.random() >= (c.chance == null ? 1 / 12 : c.chance)) return false;
      st.lastAt = now; st.nightN++; st.total++; st.lastWasDog = true; st.log.push('play(' + kind + ')');
      D.play(kind); return true;
    },
    play: function (kind) {
      var c = cfg() || {}, S = ART.S, L = $('dogPop'), tok = ++st.tok, sil = c.silenceMs == null ? 500 : c.silenceMs, pop = c.popMs || 260, hold = c.holdMs || 1200;
      if (!st.ok) return false; st.busy = true;
      var alive = function () { return tok === st.tok; };
      L.style.setProperty('--dw', c.widthPct || 0.42); L.style.setProperty('--dp', pop + 'ms'); L.className = ''; void L.offsetWidth;
      // BEAT 1: the mistake's own cue just played; a short beat to let it land. BEAT 2: 500 ms of true silence.
      later(function () {
        if (!alive()) return; A.duckTo(0, 0.01); ART.log('dog egg: silence');
        later(function () {
          if (!alive()) return;                                           // BEAT 3: payoff
          L.className = (c.pos || 'bottom-right') + ' go'; ART.log('dog egg: pop');
          if (!c.sound || c.sound.snicker !== false) A.dogSnicker({ vol: (c.sound && c.sound.vol) == null ? 0.85 : c.sound.vol });
          later(function () { if (!alive()) return; L.className = (c.pos || 'bottom-right') + ' out'; if (S.phase === 'play') A.duckTo(1, 0.5); }, pop + hold);
          later(function () { if (!alive()) return; L.className = ''; st.busy = false; }, pop + hold + 230);
        }, sil);
      }, c.cueMs == null ? 220 : c.cueMs);
      return true;
    },
    reset: function () { st.tok++; st.timers.forEach(clearTimeout); st.timers = []; st.busy = false; var L = $('dogPop'); if (L) L.className = ''; },
    resetSession: function () { D.reset(); st.lastWasDog = false; st.lastAt = -1e9; st.nightN = 0; st.night = 0; }
  };
})(window.ART);
