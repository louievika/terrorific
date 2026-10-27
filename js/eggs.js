/* Terrorific - eggs.js (MIT). Config-driven PERSONAL EASTER EGGS: short, rare, hand-written moments (a line of text, a whisper, a laugh) placed in
   assets/easter-eggs.json. No code changes needed to add one: edit the JSON, reload. Schema is documented inside that file ("_schema") and in README.md.
   Events: nightStart, nightEnd, atSec (seconds into a night), scare, grabWin, grabLose, gameOver, win.   ?eggs=1 previews every egg, including the disabled examples. */
(function (ART) {
  'use strict';
  var $ = ART.$, Q = new URLSearchParams(location.search), E, data = null, ready = false, fired = {}, nightSeen = {}, showTimer = 0, KEY = 'terrorific_eggs_seen_v1', seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { seen = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) {} }
  function el() { var e = $('eggText'); if (!e) { e = document.createElement('div'); e.id = 'eggText'; e.setAttribute('aria-live', 'polite'); document.body.appendChild(e); } return e; }
  function inList(v, a) { return a == null || (Array.isArray(a) ? a.indexOf(v) >= 0 : a === v); }
  E = ART.eggs = {
    shown: [], preview: Q.get('eggs') === '1',
    load: function () {
      return fetch('assets/easter-eggs.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { data = j; ready = true; if (ART.dogEgg) ART.dogEgg.load(); return j; }).catch(function (e) { data = null; ready = false; console.warn('easter-eggs.json missing/invalid - none active', e); });
    },
    setData: function (j) { data = j; ready = !!j; },
    dogCfg: function () { return (data && data.dogEgg) || null; },
    list: function () { return (data && data.eggs) || []; },
    resetSeen: function () { seen = {}; save(); fired = {}; nightSeen = {}; E.shown = []; },
    /* show the egg's effect now (no trigger checks) */
    show: function (egg) {
      var f = egg.effect || {}; E.shown.push(egg.id); ART.log('egg ' + egg.id);
      if (egg.sound && ART.taunts) ART.taunts.play(egg.sound, { vol: egg.soundVol == null ? 0.8 : egg.soundVol });
      if (f.type === 'text' && f.text) {
        var e = el(); clearTimeout(showTimer); e.textContent = String(f.text); e.className = 'on ' + (f.style || 'plain') + ' ' + (f.pos || 'bottom'); e.style.setProperty('--egg-ms', (f.ms || 3600) + 'ms');
        showTimer = setTimeout(function () { e.className = ''; }, (f.ms || 3600) + 400);
      }
    },
    /* an event happened: fire every matching, enabled, not-yet-seen egg (after its delay) */
    emit: function (event, info) {
      if (!ready || !data || data.enabled === false) return 0; info = info || {}; var S = ART.S, n = info.night || (S && S.night) || 1, count = 0, gen = S && S.gen;
      E.list().forEach(function (egg) {
        var t = egg.trigger || {}; if (t.event !== event) return; if (event === 'atSec' && +t.sec !== +info.sec) return;
        if (egg.enabled === false && !E.preview) return; if (!inList(n, t.night)) return;
        if (t.kind && info.kind && t.kind !== info.kind) return; if (t.minDeaths != null && S && (S.deaths || 0) < t.minDeaths) return;
        if (egg.once !== false && !E.preview && seen[egg.id]) return; if (fired[egg.id] && fired[egg.id].gen === gen && !E.preview) return;     // once per night at most
        if (!E.preview && egg.chance != null && Math.random() >= egg.chance) return;
        fired[egg.id] = { gen: gen }; if (egg.once !== false) { seen[egg.id] = 1; save(); } count++;
        setTimeout(function () { if (S && S.gen !== gen && event !== 'gameOver' && event !== 'win') return; E.show(egg); }, egg.delayMs == null ? 600 : egg.delayMs);
      });
      return count;
    },
    /* atSec triggers: called every game-time step while playing */
    tick: function (dt) {
      if (!ready) return; var S = ART.S; if (S._eggGen !== S.gen) { S._eggGen = S.gen; S._eggT0 = 0; }
      var before = S._eggT0, now = S.t; S._eggT0 = now;
      E.list().forEach(function (egg) { var t = egg.trigger || {}; if (t.event === 'atSec' && t.sec != null && before < t.sec && now >= t.sec) E.emit('atSec', { sec: t.sec }); });
    }
  };
})(window.ART);
