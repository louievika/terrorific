/* Terrorific - director.js (MIT). Scare VARIETY director: picks which variant of a scare plays, so no two in a row are alike.
   Pools live in manifest game.scares.variants[kind]; weights fall with recency (never the same id twice in a row when another is eligible).
   Also owns timing jitter, the occasional rapid double-beat and the fake-out follow-up. All numbers are config, none are hard-wired. */
(function (ART) {
  'use strict';
  var hist = [], lastId = {}, counter = 0;
  function cfg() { return (ART.CFG && ART.CFG.scares) || {}; }
  var D = ART.director = {
    history: function () { return hist.slice(); },
    reset: function () { hist = []; lastId = {}; counter = 0; },
    pool: function (kind) {
      var all = ((cfg().variants || {})[kind]) || [], n = ART.S ? ART.S.night : 1;
      return all.filter(function (v) { return (v.minNight || 1) <= n && (v.maxNight || 99) >= n; });
    },
    /* weight: base * recency (variants not used for a while come back up); the previous pick is excluded outright */
    pick: function (kind, forceId) {
      var all = ((cfg().variants || {})[kind]) || [], p = D.pool(kind), v = null;
      if (forceId) v = all.filter(function (x) { return x.id === forceId; })[0];
      if (!v && p.length) {
        var cand = p.filter(function (x) { return x.id !== lastId[kind]; }); if (!cand.length) cand = p;
        var rec = cfg().recency == null ? 0.3 : cfg().recency, tot = 0, ws = cand.map(function (x) {
          var age = 0; for (var i = hist.length - 1; i >= 0; i--) { if (hist[i].id === x.id) break; age++; }
          if (i < 0) age = 99;
          var w = (x.w == null ? 1 : x.w) * Math.min(1, rec + age * 0.2); tot += w; return w; });
        var r = Math.random() * tot, i2 = 0; while (i2 < ws.length - 1 && r > ws[i2]) { r -= ws[i2]; i2++; } v = cand[i2];
      }
      if (!v) v = { id: 'basic-' + kind, type: 'run', from: 0.06, to: kind === 'peek' ? 0.55 : 1.6, ms: 1000, side: 0, stop: kind === 'peek', stab: 'synth' };
      lastId[kind] = v.id; hist.push({ n: ++counter, kind: kind, id: v.id, type: v.type }); if (hist.length > 60) hist.shift();
      return v;
    },
    /* multiplier for flicker/gap timings (the 500 ms silence is NEVER jittered) */
    jitter: function () { var j = cfg().jitter || [0.8, 1.3]; return j[0] + Math.random() * (j[1] - j[0]); },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    /* after a non-lethal scare resolved: maybe a fake-out follow-up or a rapid double-beat (each a full 3-beat scare of its own) */
    after: function (kind, v) {
      var S = ART.S, c = cfg(), n = S.night;
      if (kind === 'attack' || S.phase !== 'play') return;
      if (v.type === 'fakeout') { var f = c.fakeoutFollowSec || [5, 10]; S.peeks.unshift(S.t + D.rand(f[0], f[1])); ART.log('fake-out -> real scare soon'); return; }
      var dbl = (c.doubleBeatP || [])[n - 1] || 0;
      if (kind === 'peek' && Math.random() < dbl) { S.peeks.unshift(S.t + D.rand(1.8, 3.2)); ART.log('double-beat queued'); }
    }
  };
})(window.ART);
