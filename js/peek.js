/* Terrorific - peek.js (MIT). HALLWAY / CORNER PEEK: Art standing half-hidden behind a corner edge, one side of his face and part of his body showing, swaying a
   little and leaning toward the player. He is part of the room scene: his position is projected from a plate yaw/elevation (same maths as the door button), so he
   pans with the sky plate when you turn, and an edge mask hides the part of him that is "behind the corner". No jump here - this is the visual tell that LEADS INTO
   the existing 3-beat peek scare: once the player has looked at him for a few seconds (or has not looked for a long time) he is cut and ART.art.scare('peek') runs
   (beat 1 bulb flicker, beat 2 500 ms silence, beat 3 payoff, picked by the director).
   Everything (spots, odds, timings, look) is manifest game.peek. Uses assets/art/art-peek.png (real head, hands and shoulders from the supplied clip, falling into shadow). */
(function (ART) {
  'use strict';
  var $ = ART.$, el = null, img = null, st = null, ratio = 220 / 440, PI = Math.PI;
  function cfg() { return ART.CFG.peek || null; }
  function pick(a, n) { return Array.isArray(a) ? a[Math.min(Math.max(0, n - 1), a.length - 1)] : a; }
  function range(a, n) { var r = pick(a, n); return Array.isArray(r) ? r[0] + Math.random() * (r[1] - r[0]) : (r == null ? 0 : r); }
  function wrap(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  function ensure() {
    if (el) return; el = $('peek'); if (!el) return; img = el.querySelector('img');
    var c = cfg(); if (c && c.src) { img.src = c.src; img.onload = function () { if (img.naturalWidth) ratio = img.naturalWidth / img.naturalHeight; }; }
    if (c && c.filter) img.style.filter = c.filter;
  }
  function view() {
    var V = ART.V, W = innerWidth, H = innerHeight, vf = ART.ui.fov() * PI / 180, tv = Math.tan(vf / 2), th = tv * (W / H), pitch = V.d ? Math.asin(Math.max(-1, Math.min(1, -V.d.y))) : 0;
    return { V: V, W: W, H: H, tv: tv, th: th, pitch: pitch, hf: 2 * Math.atan(th) };
  }
  function yOf(v, deg) { return v.H / 2 - (v.H / 2) * Math.tan(deg * PI / 180 - v.pitch) / v.tv; }
  var P = ART.peek = {
    active: function () { return !!st; },
    state: function () { return st ? { spot: st.spot.id, phase: st.phase, seen: +st.seen.toFixed(2), vis: st.vis, edgeX: st.edgeX, el: st.cur } : null; },
    /* spots usable this night, nearest-to-the-view first (most of the time) so the player has a fair chance to see him */
    spots: function (n) { var c = cfg(); if (!c) return []; var ids = pick(c.nights, n) || []; return (c.spots || []).filter(function (s) { return ids.indexOf(s.id) >= 0; }); },
    /* begin a peek that ends in done(). false = not this time (night 1, odds, no spots) -> the caller runs the plain scare */
    start: function (done, opt) {
      opt = opt || {}; var c = cfg(), S = ART.S; if (!c || !c.enabled || st || !ART.V) return false; ensure(); if (!el) return false;
      var n = S.night, odds = opt.force ? 1 : (pick(c.chance, n) || 0); if (Math.random() >= odds) return false;
      var sp = P.spots(n); if (!sp.length) return false;
      var cur = ART.V.yaw, best = null, bd = 9; sp.forEach(function (s) { var d = Math.abs(wrap(cur - s.yawDeg * PI / 180)); if (d < bd) { bd = d; best = s; } });
      var spot = opt.spot ? (sp.filter(function (s) { return s.id === opt.spot; })[0] || best) : (Math.random() < (c.nearestP == null ? 0.7 : c.nearestP) ? best : sp[Math.floor(Math.random() * sp.length)]);
      st = { spot: spot, gen: S.gen, done: done, t0: performance.now(), seen: 0, phase: 'emerge', cur: 0, vis: false, edgeX: 0, holdSec: range(c.holdSec, n), waitSec: range(c.waitSec, n), fired: false, last: performance.now() };
      el.classList.add('on'); if (ART.A && ART.A.creak && c.cue !== false) ART.A.creak(0.35);
      ART.log('peek start ' + spot.id + ' hold ' + st.holdSec.toFixed(1) + 's wait ' + st.waitSec.toFixed(1) + 's'); return true;
    },
    /* Art goes away (night change, game over): no scare */
    reset: function () { st = null; if (el) { el.classList.remove('on'); el.style.visibility = 'hidden'; } },
    /* the lead is over -> hand to the scare (only when the monitor is down, like every other peek) */
    fire: function () {
      if (!st || st.fired) return; var s = st, S = ART.S; s.fired = true; s.phase = 'cut'; ART.log('peek -> scare (seen ' + s.seen.toFixed(1) + 's)');
      var go = function () {
        if (s.gen !== S.gen) return; if (S.cam || S.scareBusy || S.puzzle) { setTimeout(go, 300); return; }
        if (st === s) P.reset(); if (s.done) s.done();
      }; go();
    },
    /* every frame (main loop) */
    update: function () {
      if (!st) return; var S = ART.S, now = performance.now(), dt = Math.min(0.1, (now - st.last) / 1000) * ART.FAST; st.last = now;
      if (st.gen !== S.gen || (S.phase !== 'play')) { P.reset(); return; }
      if (st.phase === 'cut') { if (S.scareBusy) P.reset(); else el.style.visibility = 'hidden'; return; }
      var c = cfg(), sp = st.spot, v = view(), rel = wrap(v.V.yaw - sp.yawDeg * PI / 180), t = now / 1000, el0 = (now - st.t0) * ART.FAST / (c.emergeMs || 900);
      st.cur = Math.min(1, el0); var e = st.cur * st.cur * (3 - 2 * st.cur);
      var notice = st.seen > (c.noticeSec || 1.2) ? (c.leanOut == null ? 0.07 : c.leanOut) : 0;
      st.edgeX = v.W / 2 + (v.W / 2) * Math.tan(rel) / v.th; var inView = Math.abs(rel) < v.hf / 2 + 0.2 && Math.abs(rel) < PI / 2;
      if (!inView || S.cam || S.puzzle) { el.style.visibility = 'hidden'; st.vis = false; }
      else {
        var yT = yOf(v, sp.headDeg), yB = yOf(v, sp.floorDeg), h = yB - yT, w = h * ratio, sgn = sp.side === 'left' ? -1 : 1, show = ((sp.show == null ? 0.42 : sp.show) + notice) * e;
        show += Math.sin(t * (c.swayHz || 0.8)) * (c.swayFrac == null ? 0.02 : c.swayFrac) * e;
        var cx = st.edgeX + sgn * (show - 0.5) * w, lean = Math.max(-1, Math.min(1, (v.W / 2 - st.edgeX) / v.W)) * (c.leanDeg == null ? 5 : c.leanDeg);   // tilts toward the player's centre of view
        el.style.visibility = 'visible'; el.style.clipPath = sgn > 0 ? 'inset(0 0 0 ' + Math.max(0, st.edgeX).toFixed(1) + 'px)' : 'inset(0 ' + Math.max(0, v.W - st.edgeX).toFixed(1) + 'px 0 0)';
        img.style.width = w.toFixed(1) + 'px'; img.style.height = h.toFixed(1) + 'px'; img.style.transform = 'translate3d(' + (cx - w / 2).toFixed(1) + 'px,' + yT.toFixed(1) + 'px,0) rotate(' + lean.toFixed(2) + 'deg) scaleX(' + (sgn > 0 ? 1 : -1) + ')';
        img.style.transformOrigin = '50% 100%'; img.style.setProperty('--lean', lean.toFixed(2) + 'deg');
        /* the corner's shadow falls over him: darken the part of the sprite next to the edge (mask in the sprite's own space, so it flips with him) */
        var S0 = (sp.show == null ? 0.42 : sp.show) * 100, sa = c.shadeAlpha == null ? 0.7 : c.shadeAlpha, sf = (c.shadeFrac == null ? 0.35 : c.shadeFrac) * 100;
        var mk = 'linear-gradient(90deg,rgba(0,0,0,' + (1 - sa).toFixed(2) + ') ' + S0.toFixed(1) + '%,#000 ' + (S0 + sf).toFixed(1) + '%)'; img.style.webkitMaskImage = mk; img.style.maskImage = mk;
        /* "seen": his head is on screen (not just the edge) */
        var hx = cx, onScreen = hx > v.W * 0.04 && hx < v.W * 0.96 && e > 0.8; st.vis = onScreen; if (onScreen) st.seen += dt;
      }
      if (st.seen >= st.holdSec || (now - st.t0) / 1000 * ART.FAST >= st.waitSec) P.fire();
    }
  };
})(window.ART);
