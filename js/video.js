/* Terrorific - video.js (MIT). Supplied portrait clips (user-supplied by Louie, swappable): a cold-open intro and full-screen jump-scare payoffs.
   Everything (files, volumes, odds, cooldowns, which scare kinds may use video) comes from manifest `video`. No clip = no feature: every path falls back to the sprite scares.
   iOS: elements are created + unlocked INSIDE the authenticate tap (play() once, then pause), audio is routed through the shared AudioContext (unlocked in the same tap). */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, els = {}, clips = [], layer, intro = { el: null, ok: false, box: null }, st = { lastAt: -1e9, nightCount: 0, nightFor: 0, lastId: null, ready: false, prepared: false, playing: null };
  function cfg() { return (ART.CFG && ART.CFG.video) || {}; }
  function pick(arr, n) { return Array.isArray(arr) ? arr[Math.min(Math.max(0, n - 1), arr.length - 1)] : arr; }
  function mkEl(src, poster) {
    var v = document.createElement('video'); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.playsInline = true; v.preload = 'auto';
    v.setAttribute('disable-picture-in-picture', ''); v.setAttribute('x-webkit-airplay', 'deny'); if (poster) v.poster = poster; v.src = src; return v;
  }
  function route(el, vol) {   // through the shared AudioContext: unlocked by the tap, follows the iOS mute-switch rules of Web Audio, level under our control
    if (el._routed || !A.ready) { if (!el._routed) el.volume = Math.min(1, vol); return; }
    try { var s = A.ctx.createMediaElementSource(el), g = A.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(A.master); el._routed = g; } catch (e) { el.volume = Math.min(1, vol); }
  }
  function setVol(el, vol) { if (el._routed) el._routed.gain.value = vol; else el.volume = Math.min(1, vol); }
  function unlock(el) {   // one muted play inside the gesture, then park: later programmatic play() is allowed on iOS
    try { el.muted = true; var p = el.play(); var park = function () { try { el.pause(); el.currentTime = 0; } catch (e) {} el.muted = false; }; if (p && p.then) p.then(park, function () { el.muted = false; }); else park(); } catch (e) { el.muted = false; }
  }

  var V = ART.video = {
    /* test/dev switch: ?fast=1 (the headless suites) turns video off unless ?video=1 is also given; ?novideo=1 always turns it off */
    enabled: function () { var c = cfg(), q = location.search; if (/[?&]novideo=1/.test(q)) return false; if (/[?&]fast=/.test(q) && !/[?&]video=1/.test(q)) return false; return c.enabled !== false && !!(c.intro || c.jumpscares); },
    clips: function () { return clips.slice(); },
    /* create the layer + elements. Call inside the first tap (authenticate). Idempotent. */
    prepare: function () {
      var c = cfg(); if (st.prepared || !V.enabled()) return; st.prepared = true;
      layer = document.createElement('div'); layer.id = 'vidLayer'; document.body.appendChild(layer);
      var j = c.jumpscares || {}, cs = j.clips || [], box = document.createElement('div'); box.className = 'vid'; box.id = 'vidScare'; layer.appendChild(box);
      cs.forEach(function (cl) {
        if (!cl.src) return; var e = mkEl(cl.src, cl.poster), rec = { id: cl.id || cl.src, src: cl.src, el: e, ok: false, failed: false, dur: cl.durSec || 5, w: cl.weight == null ? 1 : cl.weight, minNight: cl.minNight || 1, vol: cl.volume };
        e.addEventListener('canplay', function () { rec.ok = true; }); e.addEventListener('error', function () { rec.failed = true; rec.ok = false; ART.log('video clip failed ' + rec.id); });
        e.style.display = 'none'; e.style.objectFit = j.fit || 'cover'; box.appendChild(e); clips.push(rec); route(e, (rec.vol == null ? (j.volume == null ? 1 : j.volume) : rec.vol)); unlock(e); e.load();
      });
      st.ready = true;
    },
    /* ---------- cold-open intro ---------- */
    introWanted: function () {
      var i = cfg().intro; if (!i || !i.src || !V.enabled()) return false; var w = i.when || 'night1';
      return w === 'always' || (w === 'night1' && ART.S.night === 1);
    },
    /* Call INSIDE the tap. done() fires exactly once when the intro is over/skipped/failed (the game then starts the night). Returns false when nothing will play. */
    playIntro: function (done) {
      var i = cfg().intro; if (!V.introWanted()) return false; V.prepare();
      var box = document.createElement('div'), e = mkEl(i.src, i.poster), grade = document.createElement('i'), finished = false, started = false, seen = false, t0 = performance.now(), fadeIn = i.fadeInMs == null ? 700 : i.fadeInMs, fadeOut = i.fadeOutMs == null ? 700 : i.fadeOutMs;
      box.className = 'vid intro'; grade.className = 'vid-grade'; grade.style.setProperty('--vig', (i.grade && i.grade.vignette != null) ? i.grade.vignette : 0.6); grade.style.setProperty('--grain', (i.grade && i.grade.grain != null) ? i.grade.grain : 0.12);
      e.style.objectFit = i.fit || 'contain'; e.style.opacity = 0; e.style.transition = 'opacity ' + fadeIn + 'ms ease'; box.appendChild(e); box.appendChild(grade); layer.appendChild(box); box.classList.add('show'); intro.el = e; intro.box = box;
      try { seen = localStorage.getItem(i.seenKey || 'terrorific_intro_seen_v1') === '1'; } catch (x) {}
      route(e, i.volume == null ? 0.9 : i.volume);
      function end(natural) {
        if (finished) return; finished = true; clearInterval(wd); try { e.pause(); } catch (x) {}
        if (natural && started) { try { localStorage.setItem(i.seenKey || 'terrorific_intro_seen_v1', '1'); } catch (x) {} }
        e.style.transition = 'opacity ' + (fadeOut * 0.5) + 'ms ease'; e.style.opacity = 0; ART.log('intro end ' + (natural ? 'natural' : started ? 'skipped' : 'fallback'));
        setTimeout(function () {
          try { done(); } catch (x) { console.error(x); }                                   // the night starts under the black cover ...
          setTimeout(function () { box.style.transition = 'opacity ' + fadeOut + 'ms ease'; box.classList.remove('show'); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, fadeOut + 80); }, i.holdBlackMs == null ? 450 : i.holdBlackMs);   // ... then we fade from black into it
        }, fadeOut * 0.5);
      }
      V.skip = function () { if (seen || (started && performance.now() - t0 > (i.skipAfterMs == null ? 99999 : i.skipAfterMs))) end(false); };
      box.addEventListener('click', function () { if (seen && i.skipAfterSeen !== false) end(false); });
      e.addEventListener('playing', function () { if (started) return; started = true; e.style.opacity = 1; ART.log('intro playing'); });
      e.addEventListener('ended', function () { end(true); }); e.addEventListener('error', function () { ART.log('intro error'); end(false); });
      var p; try { e.currentTime = 0; p = e.play(); } catch (x) { p = null; }
      if (p && p.catch) p.catch(function () { if (started || finished) return; e.muted = true; var q = e.play(); if (q && q.catch) q.catch(function () { end(false); }); });
      var wd = setInterval(function () { if (!started && performance.now() - t0 > (i.failMs || 4500)) end(false); }, 250);   // never stuck on black: fall back to the plain start
      return true;
    },
    /* optional: a short cropped segment of the intro at the start of later nights (config video.perNight) */
    nightSegment: function (n, done) {
      var c = cfg().perNight, i = cfg().intro; if (!c || !c.enabled || !i || !intro.el || (c.nights && c.nights.indexOf(n) < 0) || !V.enabled()) { if (done) done(); return false; }
      var e = intro.el, box = document.createElement('div'); box.className = 'vid seg show'; var e2 = mkEl(i.src, i.poster); box.appendChild(e2); layer.appendChild(box); route(e2, c.volume == null ? 0.5 : c.volume);
      var fin = false, end = function () { if (fin) return; fin = true; try { e2.pause(); } catch (x) {} box.classList.remove('show'); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 400); ART.S.scareBusy = false; if (done) done(); };
      e2.addEventListener('loadedmetadata', function () { e2.currentTime = c.startSec || 0; var p = e2.play(); if (p && p.catch) p.catch(end); });
      setTimeout(end, ((c.durSec || 2.5) * 1000) + 600); setTimeout(end, 3000 + (c.durSec || 2.5) * 1000); ART.S.scareBusy = true; return true;
    },
    /* ---------- jump scares ---------- */
    /* may a video payoff be offered for this scare kind right now? (gates the director's pool) */
    can: function (kind) {
      var j = cfg().jumpscares, S = ART.S; if (!j || !V.enabled() || !st.ready || !S) return false;
      if (j.kinds && j.kinds.indexOf(kind) < 0) return false; if (S.night < (j.minNight || 1)) return false;
      if (!clips.some(function (c) { return c.ok && !c.failed && S.night >= c.minNight; })) return false;
      if (performance.now() - st.lastAt < (j.cooldownSec == null ? 75 : j.cooldownSec) * 1000) return false;
      if (st.nightFor !== S.gen) { st.nightFor = S.gen; st.nightCount = 0; }
      var mx = pick(j.perNightMax, S.night); if (mx != null && mx > 0 && st.nightCount >= mx) return false; if (mx === 0) return false;
      var ch = pick(j.chance, S.night); return ch == null || Math.random() < ch;
    },
    /* choose a clip: never the same one twice in a row (when another is available), weighted */
    pickClip: function () {
      var S = ART.S, ok = clips.filter(function (c) { return c.ok && !c.failed && S.night >= c.minNight; }); if (!ok.length) return null;
      var c2 = ok.filter(function (c) { return c.id !== st.lastId; }); if (!c2.length) c2 = ok;
      var tot = c2.reduce(function (a, c) { return a + c.w; }, 0), r = Math.random() * tot, k = 0; while (k < c2.length - 1 && r > c2[k].w) { r -= c2[k].w; k++; } return c2[k];
    },
    /* PAYOFF: full-screen cover, starts instantly, its own audio. onEnd() after it finishes; onFail() if it cannot play (caller falls back to the sprite).
       Returns the clip record or null. Screen-space: not tied to view yaw. */
    playScare: function (onEnd, onFail, forceId) {
      var j = cfg().jumpscares || {}, S = ART.S, rec = forceId ? clips.filter(function (c) { return c.id === forceId; })[0] : V.pickClip();
      if (!rec || !rec.ok || rec.failed) { if (onFail) onFail(); return null; }
      var e = rec.el, box = $('vidScare') || layer.querySelector('#vidScare'), over = false, started = false, tm, tm2;
      clips.forEach(function (c) { c.el.style.display = c === rec ? 'block' : 'none'; });
      if (st.nightFor !== S.gen) { st.nightFor = S.gen; st.nightCount = 0; } st.lastId = rec.id; st.lastAt = performance.now(); st.nightCount++; st.playing = rec; ART.log('video scare ' + rec.id);
      function end(ok) {
        if (over) return; over = true; clearTimeout(tm); clearTimeout(tm2); try { e.pause(); } catch (x) {} box.classList.remove('show'); st.playing = null; e.removeEventListener('playing', onPlaying); e.removeEventListener('ended', onEnded);
        A.duckTo(1, 0.6); try { e.currentTime = 0; } catch (x) {} if (ok) { if (onEnd) onEnd(); } else { if (onFail) onFail(); }
      }
      function onPlaying() { started = true; clearTimeout(tm2); }
      function onEnded() { setTimeout(function () { end(true); }, j.holdAfterMs == null ? 200 : j.holdAfterMs); }
      e.addEventListener('playing', onPlaying); e.addEventListener('ended', onEnded);
      try { e.currentTime = 0; } catch (x) {}
      A.duckTo(j.duckTo == null ? 0.1 : j.duckTo, 0.02); box.classList.add('show'); ART.ui.flash(0.85, 110);
      var p; try { p = e.play(); } catch (x) { p = null; }
      if (p && p.catch) p.catch(function () { if (!started) end(false); });
      tm2 = setTimeout(function () { if (!started) end(false); }, j.startFailMs || 900);                    // must be visibly playing almost instantly
      tm = setTimeout(function () { end(true); }, (rec.dur * 1000) + 1500);
      return rec;
    },
    /* abort a playing scare (night restart / game over) */
    stop: function () { var r = st.playing; if (r) { try { r.el.pause(); } catch (x) {} var b = $('vidScare'); if (b) b.classList.remove('show'); st.playing = null; } },
    reset: function () { st.lastAt = -1e9; st.nightCount = 0; st.lastId = null; }
  };
})(window.ART);
