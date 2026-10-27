/* Terrorific - rooms.js (MIT). Room plates (equirect JPGs from the manifest), camera feeds, room graph. */
(function (ART) {
  'use strict';
  var $ = ART.$, plates = {}, burstUntil = 0;
  var fcv, fctx, scv, sctx, noiseData;
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
    staticBurst: function (ms) { burstUntil = performance.now() + ms; if (ART.A.staticBurst) ART.A.staticBurst(ms / 1000 * 0.8); },
    /* paint the current feed: 70-degree crop of the plate, Art sprite if present, green CCTV grade, noise */
    drawFeed: function (now) {
      var S = ART.S;
      if (!fctx) { fcv = $('feedCanvas'); fctx = fcv.getContext('2d'); scv = $('staticCanvas'); sctx = scv.getContext('2d'); noiseData = sctx.createImageData(160, 120); }
      var f = ART.CFG.feeds[S.feed], pl = plates[S.feed], W = 240, H = 320, t = now / 1000, artImg = ART.art.img;
      fctx.globalCompositeOperation = 'source-over'; fctx.fillStyle = '#000'; fctx.fillRect(0, 0, W, H);
      var pan = Math.sin(t * 0.4 + S.feed.length) * 20;
      if (pl && pl.complete && pl.naturalWidth) {
        var pw = pl.naturalWidth, ph = pl.naturalHeight, sw = pw * 70 / 360, sh = sw * (H / W), cx = pw / 2 + pan * pw / 360, cy = ph / 2 + ph * 0.06;
        var sx = cx - sw / 2; if (sx < 0) sx += pw;
        if (sx + sw <= pw) fctx.drawImage(pl, sx, cy - sh / 2, sw, sh, 0, 0, W, H);
        else { var w1 = pw - sx; fctx.drawImage(pl, sx, cy - sh / 2, w1, sh, 0, 0, W * w1 / sw, H); fctx.drawImage(pl, 0, cy - sh / 2, sw - w1, sh, W * w1 / sw, 0, W * (sw - w1) / sw, H); }
      }
      if (S.artRoom === S.feed && artImg && artImg.complete && !S.powerDead) {
        var ah = f.h, aw = ah * artImg.naturalWidth / artImg.naturalHeight, ax = W / 2 + (f.yaw - pan) * (W / 70);
        var jit = Math.random() < 0.08 ? (Math.random() - 0.5) * 6 : 0;
        fctx.globalAlpha = 0.9; fctx.drawImage(artImg, ax - aw / 2 + jit, f.bot - ah, aw, ah); fctx.globalAlpha = 1;
      }
      fctx.globalCompositeOperation = 'saturation'; fctx.fillStyle = '#808080'; fctx.fillRect(0, 0, W, H);
      fctx.globalCompositeOperation = 'multiply'; fctx.fillStyle = 'rgb(110,255,150)'; fctx.fillRect(0, 0, W, H);
      fctx.globalCompositeOperation = 'source-over';
      var bursting = performance.now() < burstUntil, d = noiseData.data, k = bursting ? 255 : 120;
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() * k; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      sctx.putImageData(noiseData, 0, 0); scv.style.opacity = bursting ? 0.85 : 0.1;
      var frac = S.t / S.len * 6, hh = Math.min(5, Math.floor(frac));
      $('feedTime').textContent = (hh === 0 ? 12 : hh) + ':' + ('0' + Math.floor((frac % 1) * 60)).slice(-2) + ' AM';
    }
  };
})(window.ART);
