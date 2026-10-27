/* Terrorific - feedmedia.js (MIT). The supplied clips (Louie's clip-A/B/C + art-clip-1) as ACTUAL camera-monitor content.
   Muted, looping, playsinline <video> elements (re-encoded small copies in assets/video/feed-*.mp4|webm, each with a poster still) surface on the right cameras
   with a CRT / static / tracking-glitch treatment. Which clips on which camera, how often and for how long: manifest game.feedMedia, all per night.
   Never while Art himself is on that feed (then rooms.js draws the full-body silhouette instead), never during a feed scare.
   Fallback: no video (?novideo=1, the ?fast=1 test runs, low-power mode, decode error) -> the clip's poster still gets the same treatment. */
(function (ART) {
  'use strict';
  var $ = ART.$, recs = {}, host, prepared = false, st = { clip: null, until: 0, nextAt: 0, last: null, lastCam: null, lastNow: 0, clk: 0, count: 0, nightFor: -1, bands: [], bandAt: 0, mode: 'none' };
  function cfg() { return (ART.CFG && ART.CFG.feedMedia) || null; }
  function pick(a, n) { return Array.isArray(a) ? a[Math.min(Math.max(0, n - 1), a.length - 1)] : a; }
  function rnd(r) { return Array.isArray(r) ? ART.rnd(r[0], r[1]) : (r == null ? 0 : r); }
  var q = location.search;
  function videoOn() { var c = cfg(); if (!c || c.video === false) return false; if (/[?&]novideo=1/.test(q)) return false; if (/[?&]fast=/.test(q) && !/[?&]video=1/.test(q)) return false; return true; }
  var M = ART.feedmedia = {
    state: function () { return { clip: st.clip && st.clip.id, mode: st.mode, count: st.count, until: st.until }; },
    ids: function () { return Object.keys(recs); },
    /* create the hidden elements (called lazily from the first drawFeed, i.e. inside the tap that opened the monitor, and from the authenticate tap) */
    prepare: function () {
      var c = cfg(); if (prepared || !c) return; prepared = true;
      host = document.createElement('div'); host.id = 'feedMediaHost'; host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1'; document.body.appendChild(host);
      Object.keys(c.clips || {}).forEach(function (id) {
        var d = c.clips[id], r = recs[id] = { id: id, d: d, el: null, img: new Image(), ok: false, failed: false };
        r.img.src = d.poster || ''; r.img.onerror = function () { r.imgBad = true; };
        if (!videoOn() || !d.src) return;
        var v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
        ['muted', 'loop', 'playsinline', 'webkit-playsinline', 'disable-picture-in-picture'].forEach(function (a) { v.setAttribute(a, ''); });
        if (d.poster) v.poster = d.poster;
        [['video/mp4', d.src], ['video/webm', d.webm]].forEach(function (p) { if (!p[1]) return; var s = document.createElement('source'); s.src = p[1]; s.type = p[0]; v.appendChild(s); });
        v.addEventListener('canplay', function () { r.ok = true; }); v.addEventListener('error', function () { r.failed = true; r.ok = false; ART.log('feed clip failed ' + id); }, true);
        host.appendChild(v); r.el = v; try { v.load(); } catch (e) {}
      });
      document.addEventListener('pointerdown', function () { var r = st.clip; if (r && r.el && r.el.paused) { var p = r.el.play(); if (p && p.catch) p.catch(function () {}); } }, true);   // low-power mode: a tap lets it start
    },
    /* force a surfacing now (tests / dev). id optional. */
    surface: function (id, sec) {
      var c = cfg(), S = ART.S; if (!c) return false; M.prepare(); var cam = S.feed, list = (c.cams && c.cams[cam]) || Object.keys(recs); id = id || list[0]; var r = recs[id]; if (!r) return false;
      M.start(r, sec || 4); return true;
    },
    start: function (r, sec) {
      st.clip = r; st.until = st.clk + sec * 1000; st.last = r.id; st.count++; st.bandAt = 0;
      if (r.el) { try { var dur = r.el.duration; if (dur && isFinite(dur) && dur > sec + 0.5) r.el.currentTime = Math.random() * (dur - sec); var p = r.el.play(); if (p && p.catch) p.catch(function () { r.playFail = true; }); } catch (e) {} }
      ART.rooms.staticBurst(220); if (ART.A.blip) ART.A.blip(); ART.log('feed clip ' + r.id);
    },
    stop: function () { var r = st.clip; if (r && r.el) { try { r.el.pause(); } catch (e) {} } st.clip = null; st.mode = 'none'; },
    active: function () { return !!st.clip; },
    /* per-frame scheduling. artHere = Art himself is on this feed (or the scare is holding a wrong frame). */
    update: function (now, artHere) {
      var c = cfg(), S = ART.S; if (!c || c.enabled === false) return; if (!prepared) M.prepare();
      st.clk += Math.min(250, now - (st.lastNow || now)) * (ART.FAST || 1); st.lastNow = now; var T = st.clk;     // scaled game-ish clock, so ?fast=N tests see clips too
      if (st.nightFor !== S.gen) { st.nightFor = S.gen; st.count = 0; M.stop(); st.nextAt = T + rnd(pick(c.surface.firstAfterSec, S.night)) * 1000; st.lastCam = null; }
      if (st.lastCam !== S.feed) { var had = st.lastCam; st.lastCam = S.feed; M.stop(); if (had != null) st.nextAt = T + rnd(c.surface.afterSwitchSec || [2, 4]) * 1000; }
      if (artHere || S.feedScareOn || S.feedFrozen || S.powerDead) { if (st.clip) M.stop(); st.nextAt = Math.max(st.nextAt, T + 1500); return; }
      if (st.clip) { if (T >= st.until) { M.stop(); st.nextAt = T + rnd(pick(c.surface.everySec, S.night)) * 1000; ART.rooms.staticBurst(160); } return; }
      if (T < st.nextAt) return;
      var list = ((c.cams && c.cams[S.feed]) || []).filter(function (id) { return recs[id]; }), pool = list.filter(function (id) { return id !== st.last; }); if (!pool.length) pool = list;
      if (!pool.length) { st.nextAt = T + 5000; return; }
      M.start(recs[pool[Math.floor(Math.random() * pool.length)]], rnd(pick(c.surface.showSec, S.night)));
    },
    /* paint the active clip (or its poster) into the feed canvas, cover-fit, with the glitch treatment. Returns true when something was drawn. */
    draw: function (ctx, W, H, now) {
      var r = st.clip, c = cfg(); if (!r || !c) return false;
      var tr = c.treatment || {}, d = r.d, el = r.el, src = null, vw, vh;
      if (el && r.ok && !r.failed && !r.playFail && el.readyState >= 2 && el.videoWidth && !el.paused) { src = el; vw = el.videoWidth; vh = el.videoHeight; st.mode = 'video'; }
      else if (r.img && r.img.complete && r.img.naturalWidth && !r.imgBad) { src = r.img; vw = r.img.naturalWidth; vh = r.img.naturalHeight; st.mode = 'still'; }
      else return false;
      var k = Math.max(W / vw, H / vh), dw = vw * k, dh = vh * k, fx = d.focusX == null ? 0.5 : d.focusX, fy = d.focusY == null ? 0.5 : d.focusY, ox = (W - dw) * fx, oy = (H - dh) * fy;
      var roll = Math.random() < (tr.rollP || 0.02) ? Math.random() * H : 0;
      ctx.globalAlpha = 1; ctx.drawImage(src, ox, oy + roll, dw, dh); if (roll) ctx.drawImage(src, ox, oy + roll - H, dw, dh);
      if (now - st.bandAt > (tr.bandMs || 140)) {                                                  // tracking glitch: a few horizontal slices pushed sideways
        st.bandAt = now; st.bands = []; var nb = Math.round(ART.rnd(tr.bands ? tr.bands[0] : 1, tr.bands ? tr.bands[1] : 4));
        for (var i = 0; i < nb; i++) st.bands.push({ y: Math.random() * H, h: ART.rnd(4, 22), dx: (Math.random() - 0.5) * (tr.shiftPx || 26) });
      }
      for (var b = 0; b < st.bands.length; b++) { var s = st.bands[b], y0 = Math.max(0, s.y), hh = Math.min(s.h, H - y0); if (hh > 0) ctx.drawImage(ctx.canvas, 0, y0, W, hh, s.dx, y0, W, hh); }
      var cs = tr.chroma == null ? 2 : tr.chroma;                                                  // cheap colour fringe: a faint red/cyan ghost, offset
      if (cs) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.16; ctx.drawImage(src, ox + cs, oy + roll, dw, dh); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      var by = (now / (tr.barSec ? tr.barSec * 1000 : 5000) * H) % (H * 1.3) - H * 0.15; ctx.fillStyle = 'rgba(210,255,225,' + (tr.barAlpha == null ? 0.14 : tr.barAlpha) + ')'; ctx.fillRect(0, by, W, H * 0.045);   // tracking bar rolling down
      if (Math.random() < 0.3) { ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.08) + ')'; ctx.fillRect(0, 0, W, H); }
      return true;
    }
  };
})(window.ART);
