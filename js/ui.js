/* Terrorific - ui.js (MIT). Screens, view control (gyro + natural drag), diegetic controls, camera monitor, transient HUD.
   No help text, no tips, no mute button: affordances are drawn in the scene (door button, side-wall panels, monitor lip). */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A;
  var V = ART.V = { yawCorr: 0, calibrated: false, dragYaw: 0, dragPitch: 0, autoYaw: 0, gotEvt: false, ori: { a: 0, b: 90, g: 0 }, yaw: 0, auto: null };
  var cam = null, THREE = null, spots = [], hudTimer, cmTimer, hudBucket = -1;

  var ui = ART.ui = {
    show: function (id) {
      ['login', 'game', 'lore', 'gameover', 'win', 'bad'].forEach(function (k) { $(k).classList.toggle('active', k === id); });
      $('game').classList.remove('prep');
      if (id === 'game') setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
    },
    center: function (txt, ms) { var el = $('centerMsg'); el.textContent = txt; el.classList.add('on'); clearTimeout(cmTimer); cmTimer = setTimeout(function () { el.classList.remove('on'); }, ms || 2400); },
    flash: function (op, ms) { var f = $('flash'); f.style.opacity = op; f.classList.add('on'); setTimeout(function () { f.classList.remove('on'); f.style.opacity = ''; }, ms || 120); },
    /* the HUD is never always-on: it blinks in for a moment at night start, on door/fuse changes, and each 10% of power */
    peekHud: function (ms) { var h = $('hud'); h.classList.add('on'); clearTimeout(hudTimer); hudTimer = setTimeout(function () { h.classList.remove('on'); }, ms || 2200); },
    updateHud: function () {
      var S = ART.S, CFG = ART.CFG, hr = Math.min(5, Math.floor(S.t / S.len * 6)), p = Math.max(0, S.power);
      $('hudNight').textContent = S.night; $('hudClock').textContent = CFG.clock[hr];
      $('powerFill').style.width = p + '%'; $('powerFill').style.background = p <= 20 ? '#d33' : p <= 45 ? '#d9a441' : '#46c46a';
      $('powerPct').textContent = Math.ceil(p) + '%';
      var rem = Math.max(0, CFG.sessionCapSec - S.session), m = Math.floor(rem / 60), s = Math.floor(rem % 60);
      $('hudSession').textContent = m + ':' + ('0' + s).slice(-2);
      var warn = rem < 60 && S.phase === 'play'; $('hudSession').parentNode.style.display = warn ? '' : 'none'; $('hudSession').style.color = '#ff5a5a';
      if (warn) $('hud').classList.add('on');
      var b = Math.floor(p / 10); if (hudBucket !== -1 && b !== hudBucket && S.phase === 'play') ui.peekHud(1800); hudBucket = b;
      var ms = $('monStat'); if (ms) ms.textContent = 'PWR ' + Math.ceil(p) + '% \u00b7 ' + CFG.clock[hr];
      if (ART.DEBUG) $('debugState').textContent = 'N' + S.night + ' ' + S.phase + ' t=' + S.t.toFixed(0) + '/' + S.len + ' pwr=' + S.power.toFixed(1) + ' art=' + S.artRoom + ' cam=' + S.cam + ':' + S.feed + ' door=' + S.door + ' bolt=' + S.bolt + ' atk=' + S.attackT.toFixed(1) + ' gyro=' + V.gotEvt;
    },
    resetHudBucket: function () { hudBucket = -1; },

    /* ---------- camera monitor: flips up from the bottom-edge lip ---------- */
    openMonitor: function () {
      var S = ART.S; if (S.phase !== 'play' || S.powerDead || S.scareBusy || S.puzzle) return;
      S.cam = true; $('monitor').classList.add('open'); $('btnCam').classList.add('on'); A.blip(); ui.setFeed(S.feed, true); ui.updateHud();
    },
    closeMonitor: function (silent) {
      var S = ART.S; if (S.scareBusy && S.feedScareOn && !silent) return;   // locked open during a camera-feed scare
      if (!S.cam) { $('monitor').classList.remove('open'); $('btnCam').classList.remove('on'); return; }
      var prev = S.feed; S.cam = false; $('monitor').classList.remove('open'); $('btnCam').classList.remove('on');
      if (!silent) { A.blip(); ART.art.feedLeft(prev); } ui.updateHud();
    },
    setFeed: function (name, initial) {
      var S = ART.S, prev = S.feed; if (S.feedScareOn && !initial) return; if (!initial && prev !== name) ART.art.feedLeft(prev); S.feed = name;
      document.querySelectorAll('.mon-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.feed === name); });
      $('feedName').textContent = ART.CFG.feeds[name].n; if (!initial) A.blip(); ART.rooms.staticBurst(260);
      if (S.artRoom === name) A.staticBurst(0.18);
      ART.log('feed ' + name + (ART.art.observed() ? ' (ART VISIBLE)' : ''));
    },

    /* ---------- world-anchored hotspots (door button, fuse box, bolt) ---------- */
    addSpot: function (o) {   // {id, el, yawDeg, topPct}
      o.el.classList.add('spot'); $('spots').appendChild(o.el); o.yaw = o.yawDeg * Math.PI / 180; spots.push(o); return o;
    },
    spots: function () { return spots; },
    updateSpots: function () {
      var W = innerWidth, H = innerHeight, hf = 2 * Math.atan(Math.tan(40 * Math.PI / 180) * (W / H)), th = Math.tan(hf / 2);
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i], rel = V.yaw - s.yaw, vis = !s.hidden && Math.abs(rel) < hf / 2 + 0.25;
        if (!vis) { if (s.shown !== false) { s.el.style.visibility = 'hidden'; s.shown = false; } continue; }
        var x = W / 2 + (W / 2) * Math.tan(rel) / th;
        s.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (H * s.topPct / 100).toFixed(1) + 'px,0) translate(-50%,-50%)';
        if (s.shown !== true) { s.el.style.visibility = 'visible'; s.shown = true; }
      }
    },

    /* ---------- view control: gyro + natural drag (content follows the finger) ---------- */
    initView: function () {
      THREE = window.AFRAME.THREE; cam = $('cam').object3D;
      V.q = new THREE.Quaternion(); V.q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); V.qs = new THREE.Quaternion(); V.e = new THREE.Euler();
      V.zee = new THREE.Vector3(0, 0, 1); V.qy = new THREE.Quaternion(); V.up = new THREE.Vector3(0, 1, 0); V.d = new THREE.Vector3();
      var down = null, g = $('game');
      g.addEventListener('pointerdown', function (e) {
        if (V.auto && V.auto.on) { V.auto.on = false; V.dragYaw += V.autoYaw; V.autoYaw = 0; }   // the player took over: keep where they are
        if (e.target.closest('button,#monitor,#puzzle')) return; down = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return; V.dragYaw += (e.clientX - down.x) * 0.0055; V.dragPitch += (e.clientY - down.y) * 0.0045;
        V.dragPitch = Math.max(-1.0, Math.min(1.0, V.dragPitch)); down = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener('pointerup', function () { down = null; }); window.addEventListener('pointercancel', function () { down = null; });
    },
    onOri: function (ev) { if (ev.alpha == null && ev.beta == null) return; V.gotEvt = true; V.ori.a = ev.alpha || 0; V.ori.b = ev.beta || 0; V.ori.g = ev.gamma || 0; },
    enableGyro: function () {
      window.addEventListener('deviceorientation', ui.onOri, true);
      setTimeout(function () { ART.S.hasGyro = V.gotEvt; ART.log('gyro ' + (ART.S.hasGyro ? 'on' : 'no events -> drag only')); }, 1500);
    },
    /* camera lock for jump-scare payoffs: yaw (and drag pitch) ease to the door within ms, then hold until unlockView() */
    lockView: function (ms) { V.lock = { t0: performance.now(), ms: ms || 260 }; },
    unlockView: function () { V.lock = null; },
    updateView: function () {
      if (!cam) return;
      var sc = (screen.orientation && screen.orientation.angle) || window.orientation || 0, rad = sc * Math.PI / 180, yawAll = V.dragYaw + V.autoYaw;
      if (V.gotEvt) {
        var d = Math.PI / 180;
        V.e.set(V.ori.b * d, V.ori.a * d, -V.ori.g * d, 'YXZ'); V.q.setFromEuler(V.e); V.q.multiply(V.q1); V.q.multiply(V.qs.setFromAxisAngle(V.zee, -rad));
        if (!V.calibrated) { V.e.setFromQuaternion(V.q, 'YXZ'); V.yawCorr = -V.e.y; V.calibrated = true; }
        V.qy.setFromAxisAngle(V.up, V.yawCorr + yawAll); cam.quaternion.copy(V.qy).multiply(V.q);
      } else {
        V.e.set(V.dragPitch, yawAll, 0, 'YXZ'); cam.quaternion.setFromEuler(V.e);   // drag right -> view turns left (content follows finger)
      }
      cam.getWorldDirection(V.d); V.yaw = Math.atan2(V.d.x, V.d.z);
      if (V.lock && !V.inLock) {   // camera lock: ease (then hold) the view on the door so a jump scare always lands in front of the player
        var kf = performance.now() - V.lock.t0 < V.lock.ms ? 0.45 : 1; V.dragYaw -= V.yaw * kf; V.dragPitch *= (1 - kf);
        if (V.auto && V.auto.on) { V.autoYaw -= V.autoYaw * kf; }
        V.inLock = true; ui.updateView(); V.inLock = false; return;
      }   // d = object +z = -(view dir); 0 = facing the door (-z); >0 = turned left
    },
    /* gentle first-run auto-pan: the room sways left then right so the side-wall panels are discovered by sight, not by text */
    scheduleAutoPan: function () {
      var seen = false; try { seen = !!localStorage.getItem(ART.SEEN_KEY); } catch (e) {}
      if (seen) return; var ap = ART.CFG.autoPan;
      V.auto = { on: false, t: 0, pending: setTimeout(function () {
        if (ART.S.phase !== 'play') return; V.auto.on = true; V.auto.t = 0; try { localStorage.setItem(ART.SEEN_KEY, '1'); } catch (e) {}
      }, ap.startSec * 1000) };
    },
    autoTick: function (raw) {
      var a = V.auto; if (!a || !a.on) return; var ap = ART.CFG.autoPan; a.t += raw; var u = a.t / ap.durSec;
      if (u >= 1 || ART.S.phase !== 'play') { a.on = false; V.autoYaw = 0; return; }
      V.autoYaw = ap.ampDeg * Math.PI / 180 * Math.sin(u * 2 * Math.PI) * Math.sin(u * Math.PI);
    },

    /* ---------- lore ---------- */
    showLore: function (L, FAST, onTimer) {
      $('loreTitle').textContent = L.title; var doc = $('loreDoc'); doc.className = 'doc ' + L.cls; doc.textContent = L.doc;
      var call = $('loreCall'); call.className = 'call'; call.innerHTML = ''; var nb = $('loreNext'); nb.classList.remove('show'); nb.style.opacity = 0.2; nb.style.pointerEvents = 'none';
      var VO = ART.voice, f = Math.min(FAST, 6), art = $('loreArt'), narr = !!(VO && L.voice && L.art), isCall = narr && L.voiceMode === 'call', docMs = 1600 / f;
      art.className = 'artline' + (isCall ? ' term' : ''); art.innerHTML = '';
      /* receipt / diary: Art's line fades in word-by-word under the document, voiced; the document stays up until he has finished */
      if (narr && !isCall) {
        var tl = VO.timeline(L.voice, L.art), lead = 500 / f; docMs = lead + (tl.speech + 1.0) * 1000 / f;
        onTimer(setTimeout(function () { VO.say(L.voice, {}); VO.words(art, L.voice, L.art, f); }, lead));
      }
      ui.show('lore'); A.duckTo(0.6, 0.5);
      function showNext() { nb.classList.add('show'); nb.style.opacity = 1; nb.style.pointerEvents = 'auto'; }
      setTimeout(function () {
        doc.classList.add('hidden'); call.classList.add('on'); A.phoneRing();
        var txt = L.call, i = 0, out = '';
        (function type() {
          if (i >= txt.length) {
            if (isCall) {                                                   // phone-call style: the line is Art cutting in on the caretaker's call
              onTimer(setTimeout(function () { VO.say(L.voice, {}); VO.words(art, L.voice, L.art, f, showNext); }, 700 / f));
            } else showNext();
            return;
          }
          if (txt.substr(i, 10) === '[[GLITCH]]') { out += '<span class="g">&#9608;&#9608;&#9608;&#9608;</span>'; i += 10; } else { var ch = txt[i++]; out += ch === '<' ? '&lt;' : ch; }
          call.innerHTML = out; onTimer(setTimeout(type, 22 / f));
        })();
      }, docMs);
    },

    /* ---------- login terminal typing ---------- */
    typeBoot: function (save) {
      var el = $('termText'), lines = ART.CFG.boot.slice(); if (save > 1) lines.splice(8, 0, 'SAVE FOUND: NIGHT ' + save);
      var li = 0, ci = 0, out = ''; clearTimeout(ui._tt);
      (function t() {
        if (li >= lines.length) return; var ln = lines[li];
        if (ci < ln.length) { out += ln[ci++]; el.textContent = out + '_'; ui._tt = setTimeout(t, 16); } else { out += '\n'; li++; ci = 0; el.textContent = out + '_'; ui._tt = setTimeout(t, 120); }
      })();
    },

    /* ---------- wiring (called once by main) ---------- */
    wire: function () {
      var cb = $('btnCam'), y0 = null, swiped = false;
      cb.addEventListener('pointerdown', function (e) { y0 = e.clientY; swiped = false; });
      cb.addEventListener('pointerup', function (e) {          // swipe up opens, swipe down closes, tap toggles
        if (y0 == null) return; var dy = e.clientY - y0; y0 = null;
        if (dy < -18 && !ART.S.cam) { swiped = true; ui.openMonitor(); } else if (dy > 18 && ART.S.cam) { swiped = true; ui.closeMonitor(); }
      });
      cb.addEventListener('click', function () { if (swiped) { swiped = false; return; } if (ART.S.cam) ui.closeMonitor(); else ui.openMonitor(); });
      document.querySelectorAll('.mon-tabs button').forEach(function (b) { b.addEventListener('click', function () { ui.setFeed(b.dataset.feed); }); });
      ui.addSpot({ id: 'door', el: $('btnDoor'), yawDeg: ART.CFG.doorButton.yawDeg, topPct: ART.CFG.doorButton.topPct });
      $('btnDoor').addEventListener('click', function () { ART.nights.toggleDoor(); });
      // iOS: audio interruption recovery when the page returns
      document.addEventListener('visibilitychange', function () { if (!document.hidden) ART.audio.resume(); });
      if (ART.DEBUG) {
        var S = ART.S; $('debug').hidden = false;
        $('dbgPrev').onclick = function () { ART.nights.start(Math.max(1, S.night - 1)); }; $('dbgNext').onclick = function () { ART.nights.start(Math.min(5, S.night + 1)); };
        $('dbgPower').onclick = function () { S.power = 9; }; $('dbgScare').onclick = function () { ART.art.scare('peek'); }; $('dbgMove').onclick = function () { ART.art.move(); };
        $('dbgEnd').onclick = function () { S.t = S.len; }; $('dbgCap').onclick = function () { S.session = ART.CFG.sessionCapSec; };
      }
    }
  };
})(window.ART);
