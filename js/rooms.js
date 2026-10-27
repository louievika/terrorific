/* Terrorific - rooms.js (MIT). Room plates (equirect JPGs from the manifest), camera feeds, room graph. */
(function (ART) {
  'use strict';
  var $ = ART.$, plates = {}, burstUntil = 0;
  var fcv, fctx, scv, sctx, noiseData, bodyIm;
  function bodyImg(c) { if (!c || !c.src) return null; if (!bodyIm) { bodyIm = new Image(); bodyIm.src = c.src; } return bodyIm.complete && bodyIm.naturalWidth ? bodyIm : null; }
  ART.rooms = {
    plates: plates,
    names: function () { return Object.keys(ART.ROOMS); },
    graph: function (from) { return ART.CFG.graph[from] || []; },
    feed: function (name) { return ART.CFG.feeds[name]; },
    urls: function () { return Object.keys(ART.ROOMS).map(function (k) { return ART.ROOMS[k]; }); },
    /* load every plate; progress() per file; done(ok) at the end */
    preload: function (progress, done) {
      var keys = Object.keys(ART.ROOMS), n = 0, ok = true;
      if (!keys.length) return done(true);
      keys.forEach(function (k) {
        var im = new Image(); plates[k] = im;
        var fin = function (good) { if (!good) ok = false; progress(); if (++n === keys.length) done(ok); };
        im.onload = function () { fin(true); }; im.onerror = function () { fin(false); }; im.src = ART.ROOMS[k];
      });
    },
    setSky: function (room) { $('sky').setAttribute('src', ART.ROOMS[room] || ART.ROOMS.attic); },
    /* camera-feed scare: hold one slightly wrong frame (Art standing where he should not be), or release it */
    freeze: function (on) { var S = ART.S; if (on) { S.feedWrong = true; S.feedFrozen = false; ART.rooms.drawFeed(performance.now()); S.feedFrozen = true; } else { S.feedWrong = false; S.feedFrozen = false; } },
    staticBurst: function (ms) { burstUntil = performance.now() + ms; if (ART.A.staticBurst) ART.A.staticBurst(ms / 1000 * 0.8); },
    /* paint the current feed. Three looks: (1) Art on this camera -> NO room plate: deep shadow, his FULL BODY (head to feet, art-body.png) as a rim-lit silhouette with the
       small real face at the top; (2) one of Louie's supplied clips surfacing (feedmedia.js) with the CRT/tracking-glitch treatment; (3) otherwise the room plate crop. */
    drawFeed: function (now) {
      var S = ART.S; if (S.feedFrozen) return;
      if (!fctx) { fcv = $('feedCanvas'); fctx = fcv.getContext('2d'); scv = $('staticCanvas'); sctx = scv.getContext('2d'); noiseData = sctx.createImageData(160, 120); }
      var f = ART.CFG.feeds[S.feed], pl = plates[S.feed], W = fcv.width, H = fcv.height, t = now / 1000, fm = ART.CFG.feedMedia || {}, body = bodyImg(fm.body), artHere = (S.artRoom === S.feed || S.feedWrong) && !S.powerDead && !!body;
      var pan = Math.sin(t * 0.4 + S.feed.length) * 20, FM = ART.feedmedia; if (FM) FM.update(now, artHere);
      fctx.globalCompositeOperation = 'source-over'; fctx.globalAlpha = 1; fctx.fillStyle = '#000'; fctx.fillRect(0, 0, W, H);
      var clip = false, tint = 'rgb(110,255,150)', desat = true;
      var hasPlate = pl && pl.complete && pl.naturalWidth;
      if (hasPlate) {
var pw = pl.naturalWidth, ph = pl.naturalHeight, sw = pw * 70 / 360, sh = sw * (H / W), cx = pw / 2 + pan * pw / 360, cy = ph / 2 + ph * 0.06;
        var sx = cx - sw / 2; if (sx < 0) sx += pw;
        if (sx + sw <= pw) fctx.drawImage(pl, sx, cy - sh / 2, sw, sh, 0, 0, W, H);
        else { var w1 = pw - sx; fctx.drawImage(pl, sx, cy - sh / 2, w1, sh, 0, 0, W * w1 / sw, H); fctx.drawImage(pl, 0, cy - sh / 2, sw - w1, sh, W * w1 / sw, 0, W * (sw - w1) / sw, H); }
      }
      if (artHere) {
        /* ART ON THE FEED: no clean plate. A very dark, low-contrast ghost of the room, a cold pool of light, and his real waist-up cutout (supplied clip-A) at mid distance,
           falling into shadow below the ribs (no invented limbs). Then the CCTV treatment below (tint, scanlines via CSS, chroma bleed, tracking tear, vignette, noise, flicker). */
        var bg = fm.bg || {}, dk = fm.plateDark == null ? 0.86 : fm.plateDark;
        if (hasPlate) { fctx.fillStyle = 'rgba(2,8,10,' + dk + ')'; fctx.fillRect(0, 0, W, H); }
        else { var gr = fctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, bg.top || '#0a2228'); gr.addColorStop(0.6, bg.mid || '#041014'); gr.addColorStop(1, bg.bottom || '#010304'); fctx.fillStyle = gr; fctx.fillRect(0, 0, W, H); }
        var bh = H * (f.bodyH || 0.8), bw = bh * body.naturalWidth / body.naturalHeight, bx = W / 2 + (f.yaw * 0.6 - pan * 0.3) * (W / 140), bot = H * (f.bodyBot || 0.98), sway = Math.sin(t * 1.1) * (fm.swayPx == null ? 1.6 : fm.swayPx);
        var flick = 0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3) + (Math.random() < 0.04 ? -0.25 : 0);
        var glow = fctx.createRadialGradient(bx, bot - bh * 0.62, 4, bx, bot - bh * 0.55, bh * 0.75); glow.addColorStop(0, 'rgba(110,190,200,' + (fm.glow == null ? 0.2 : fm.glow) * flick + ')'); glow.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = glow; fctx.fillRect(0, 0, W, H);
        var jit = Math.random() < 0.08 ? (Math.random() - 0.5) * 6 : 0; fctx.imageSmoothingQuality = 'high'; fctx.globalAlpha = Math.max(0.55, (fm.bodyAlpha == null ? 0.96 : fm.bodyAlpha) * flick);
        fctx.drawImage(body, bx - bw / 2 + sway + jit, bot - bh, bw, bh); fctx.globalAlpha = 1; S.feedBody = true; tint = fm.artTint || 'rgb(150,255,205)'; desat = false;
      } else {
        S.feedBody = false;
        if (FM && FM.draw(fctx, W, H, now)) { clip = true; tint = (fm.treatment && fm.treatment.tint) || 'rgb(170,255,205)'; desat = false; }
      }
      S.feedClip = clip ? FM.state().clip : null;
      if (desat) { fctx.globalCompositeOperation = 'saturation'; fctx.fillStyle = '#808080'; fctx.fillRect(0, 0, W, H); }
      fctx.globalCompositeOperation = 'multiply'; fctx.fillStyle = tint; fctx.fillRect(0, 0, W, H);
      fctx.globalCompositeOperation = 'source-over';
      if (artHere) {
        var tr = fm.treatment || {}, gl = fctx.canvas;   // chroma bleed (a faint offset ghost), a rolling tracking tear, then the vignette
        fctx.globalCompositeOperation = 'screen'; fctx.globalAlpha = 0.16; fctx.drawImage(gl, 2, 0); fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
        if (Math.random() < (tr.tearP == null ? 0.05 : tr.tearP)) { var ty = Math.floor(Math.random() * H * 0.9), th2 = 4 + Math.floor(Math.random() * 14), sh = (Math.random() - 0.5) * 36; fctx.drawImage(gl, 0, ty, W, th2, sh, ty, W, th2); }
        var vg = fctx.createRadialGradient(W / 2, H * 0.48, H * 0.18, W / 2, H * 0.5, H * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (tr.vignette == null ? 0.78 : tr.vignette) + ')'); fctx.fillStyle = vg; fctx.fillRect(0, 0, W, H);
      }
      var bursting = performance.now() < burstUntil, d = noiseData.data, k = bursting ? 255 : 120;
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() * k; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      sctx.putImageData(noiseData, 0, 0); scv.style.opacity = bursting ? 0.85 : 0.1;
      var frac = S.t / S.len * 6, hh = Math.min(5, Math.floor(frac));
      $('feedTime').textContent = (hh === 0 ? 12 : hh) + ':' + ('0' + Math.floor((frac % 1) * 60)).slice(-2) + ' AM';
    }
  };
})(window.ART);
