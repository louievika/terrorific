/* ART // LOGIN - Phase A game logic (single file; Phase B splits it into modules). MIT.
   States: login -> play (night 1..5) -> lore -> ... -> win | over (retry) | bad (10-min cap). */
(function () {
  'use strict';
  var A = window.ArtAudio, $ = function (id) { return document.getElementById(id); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var Q = new URLSearchParams(location.search);
  var FAST = Math.max(1, parseFloat(Q.get('fast')) || 1);
  var DEBUG = Q.get('debug') === '1';
  var SAVE_KEY = 'art_login_save_v1';

  /* ---------- config (assets/manifest.json "game" block overrides these defaults) ---------- */
  var CFG = {
    sessionCapSec: 600, powerStartPct: 100, lightsOutAtPct: 10, deadAttackDelaySec: [6, 9],
    drain: { idle: 0.28, camera: 0.85, door: 0.55, doorHitPenaltyPct: 6 },
    graph: { mortuary: ['basement'], basement: ['kitchen', 'frontdoor'], kitchen: ['hallway', 'basement'], frontdoor: ['hallway', 'basement'], hallway: [] },
    nights: [{ len: 60, start: 'basement', moveMin: 6, moveMax: 10, aggro: 0.7, attackSec: 10, drainMul: 1, appearP: 0, peeks: 0 }]
  };
  var ROOMS = { attic: 'assets/rooms/attic.jpg', kitchen: 'assets/rooms/kitchen.jpg', mortuary: 'assets/rooms/mortuary.jpg', hallway: 'assets/rooms/hallway.jpg', basement: 'assets/rooms/basement.jpg', frontdoor: 'assets/rooms/frontdoor.jpg' };
  var ART_SRC = 'assets/art/art.png';
  var FEEDS = { hallway: { n: 'CAM 1 - HALLWAY', yaw: 0, h: 110, bot: 205 }, kitchen: { n: 'CAM 2 - KITCHEN', yaw: 18, h: 190, bot: 280 }, basement: { n: 'CAM 3 - BASEMENT', yaw: -16, h: 180, bot: 285 }, frontdoor: { n: 'CAM 4 - FRONT DOOR', yaw: 4, h: 170, bot: 275 } };
  var CLOCK = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM'];

  /* ---------- lore (original text) ---------- */
  var LORE = [
    { title: 'NIGHT 1 COMPLETE', cls: '', doc: 'MILES COUNTY - NOTICE OF CONDEMNATION\n\nThe structure at 31 Halloran Lane is hereby closed to the public. Utilities to remain connected "for inspection purposes only."\n\nRemote caretakers are reminded: do not enter the lower floors. Do not answer the door.\n\n- County Clerk', call: 'INCOMING...  [CARETAKER LINE]\n\n"You made it to six. Good. Most don\'t say that out loud.\nThe old lights buzz when HE is close. Listen for them.\nHe only moves when nobody is watching.\nSo watch."' },
    { title: 'NIGHT 2 COMPLETE', cls: 'receipt', doc: 'HALLORAN NOVELTY & PARTY SUPPLY\n--------------------------\n1x PIERROT HAT (BLACK)   $ 4.99\n1x WHITE GREASEPAINT     $ 3.49\n1x ROLL BUTCHER PAPER    $ 8.00\n1x MAGIC TRICK (BROKEN)  $ 2.00\n--------------------------\nCASH                    $18.48\nNO REFUNDS.\nTHANK YOU, MR. A.', call: 'INCOMING...  [CARETAKER LINE]\n\n"The camera in the kitchen keeps sticking.\nThat is not the camera.\nKeep the door locked when the hallway goes quiet.\nQuiet is the loud part."' },
    { title: 'NIGHT 3 COMPLETE', cls: 'diary', doc: 'dear diary,\n\ni saw him smile in the window again tonight.\nmom says the house has been empty for years.\nbut the cellar door was open and\nthere were little paper hearts on the stairs.\n\ni counted them. there are thirteen.\ni only found twelve.', call: 'INCOMING...  [CARETAKER LINE]\n\n"Did he turn up in a room you had just checked?\nThat is new. He is learning how you look.\nDon\'t be predictable. Don\'t be [[GLITCH]]."' },
    { title: 'NIGHT 4 COMPLETE', cls: '', doc: 'INCIDENT REPORT 0-4-1\n\nSubject observed using ordinary door hardware to create a "show" for no audience.\nWitness statements disagree. All witnesses agree on the sound: a small bell, once, then laughter.\n\nRecommendation: do not try to bargain.\nRecommendation: do not run.\nRecommendation: [REDACTED]', call: 'INCOMING...  [CARETAKER LINE]\n\n"One more night. The power is thin.\nWhen the lights fail, he will know first.\nIf it goes dark, do not look for him.\nHe will find YOU."' }
  ];

  /* ---------- state ---------- */
  var S = {
    phase: 'login', night: 1, t: 0, len: 60, power: 100, cam: false, feed: 'hallway', door: false,
    artRoom: 'basement', moveT: 0, attackT: -1, knockT: 0, powerDead: false, deadT: -1, lo10: false,
    scareBusy: false, peeks: [], session: 0, hasGyro: false, started: false, nightCfg: CFG.nights[0], deaths: 0, log: []
  };
  var plates = {}, artImg = null, feedPlates = {};
  function log(s) { S.log.push(S.t.toFixed(1) + ' ' + s); if (S.log.length > 30) S.log.shift(); }

  /* ---------- screens ---------- */
  function show(id) {
    ['login', 'game', 'lore', 'gameover', 'win', 'bad'].forEach(function (k) { $(k).classList.toggle('active', k === id); });
    $('game').classList.remove('prep');
    if (id === 'game') setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ night: S.night })); } catch (e) {} }
  function loadSave() { try { var j = JSON.parse(localStorage.getItem(SAVE_KEY)); return j && j.night >= 1 && j.night <= 5 ? j.night : 1; } catch (e) { return 1; } }

  /* ---------- helpers: subtitles / center message ---------- */
  var subTimer;
  function say(txt, ms) {
    var el = $('subtitle'); el.innerHTML = ''; var sp = document.createElement('span'); sp.textContent = txt; el.appendChild(sp);
    requestAnimationFrame(function () { sp.classList.add('in'); });
    clearTimeout(subTimer); subTimer = setTimeout(function () { sp.classList.remove('in'); }, ms || 3500);
  }
  var cmTimer;
  function center(txt, ms) { var el = $('centerMsg'); el.textContent = txt; el.classList.add('on'); clearTimeout(cmTimer); cmTimer = setTimeout(function () { el.classList.remove('on'); }, ms || 2400); }
  function flash(op, ms) { var f = $('flash'); f.style.opacity = op; f.classList.add('on'); setTimeout(function () { f.classList.remove('on'); f.style.opacity = ''; }, ms || 120); }

  /* ---------- view control: gyro + drag ---------- */
  var cam = null, THREE = null;
  var V = { yawCorr: 0, calibrated: false, dragYaw: 0, dragPitch: 0, q: null, qa: null, e: null, gotEvt: false, ori: { a: 0, b: 90, g: 0 }, yaw: 0 };
  function initView() {
    THREE = window.AFRAME.THREE; cam = $('cam').object3D;
    V.q = new THREE.Quaternion(); V.q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); V.qs = new THREE.Quaternion(); V.e = new THREE.Euler(); V.zee = new THREE.Vector3(0, 0, 1); V.qy = new THREE.Quaternion(); V.up = new THREE.Vector3(0, 1, 0); V.d = new THREE.Vector3();
    var down = null, g = $('game');
    g.addEventListener('pointerdown', function (e) { if (e.target.closest('button,#monitor')) return; down = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointermove', function (e) { if (!down) return; V.dragYaw += (e.clientX - down.x) * 0.0055; V.dragPitch += (e.clientY - down.y) * 0.0045; V.dragPitch = Math.max(-1.0, Math.min(1.0, V.dragPitch)); down = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointerup', function () { down = null; }); window.addEventListener('pointercancel', function () { down = null; });
  }
  function onOri(ev) {
    if (ev.alpha == null && ev.beta == null) return;
    V.gotEvt = true; V.ori.a = ev.alpha || 0; V.ori.b = ev.beta || 0; V.ori.g = ev.gamma || 0;
  }
  function enableGyro() {
    window.addEventListener('deviceorientation', onOri, true);
    setTimeout(function () { S.hasGyro = V.gotEvt; log('gyro ' + (S.hasGyro ? 'on' : 'no events -> drag only')); }, 1500);
  }
  function updateView() {
    if (!cam) return;
    var sc = (screen.orientation && screen.orientation.angle) || window.orientation || 0, rad = sc * Math.PI / 180;
    if (V.gotEvt) {
      var d = Math.PI / 180;
      V.e.set(V.ori.b * d, V.ori.a * d, -V.ori.g * d, 'YXZ'); V.q.setFromEuler(V.e); V.q.multiply(V.q1); V.q.multiply(V.qs.setFromAxisAngle(V.zee, -rad));
      if (!V.calibrated) { V.e.setFromQuaternion(V.q, 'YXZ'); V.yawCorr = -V.e.y; V.calibrated = true; }
      V.qy.setFromAxisAngle(V.up, V.yawCorr + V.dragYaw); cam.quaternion.copy(V.qy).multiply(V.q);
    } else {
      V.e.set(-V.dragPitch, -V.dragYaw, 0, 'YXZ'); cam.quaternion.setFromEuler(V.e);
    }
    cam.getWorldDirection(V.d); V.yaw = Math.atan2(-V.d.x, -V.d.z);   // 0 = facing the door (-z); >0 = turned left
  }
  function recenterArt(extraScale) {
    var W = innerWidth, H = innerHeight, vf = 80 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (W / H));
    var off = Math.abs(V.yaw) < 1.4 ? (W / 2) * Math.tan(V.yaw) / Math.tan(hf / 2) : 99999;
    $('art').style.left = (W / 2 + off) + 'px';
  }

  /* ---------- 3-beat scares ---------- */
  function artReset() { var a = $('art'); a.className = ''; a.style.transition = 'none'; a.style.left = '50%'; void a.offsetWidth; a.style.transition = ''; }
  function bulbFlicker(seq, done) {
    var b = $('bulb'), i = 0; A.buzz(0.9);
    (function f() { b.classList.toggle('off', i % 2 === 0); document.body.classList.toggle('lightsout', i % 2 === 0); if (i < seq.length) { setTimeout(f, seq[i++]); return; } b.classList.add('off'); document.body.classList.add('lightsout'); done(); })();
  }
  function lightsBack(dim) { $('bulb').classList.remove('off'); document.body.classList.remove('lightsout'); document.body.classList.toggle('dim', !!dim); }
  /* kind: 'peek' | 'lightsout' | 'attack' */
  function threeBeat(kind, done) {
    if (S.scareBusy) return; S.scareBusy = true; var gen = S.gen; log('scare ' + kind); closeMonitor(true);
    var seq = kind === 'attack' ? [50, 80, 40, 120, 60, 200] : [60, 90, 45, 130, 70, 220];
    // BEAT 1: visual trigger - bulb flickers, buzz
    bulbFlicker(seq, function () {
      if (gen !== S.gen) return;
      // BEAT 2: 500 ms silence - all ambient ducked to 0
      A.duckTo(0, 0.01); A.stopSfxQuiet && A.stopSfxQuiet();
      setTimeout(function () {
        if (gen !== S.gen) return;
        // BEAT 3: payoff - Art scale-up + sting
        var a = $('art'); artReset(); recenterArt(); a.classList.add('show');
        if (kind === 'attack') { a.style.left = '50%'; a.classList.add('slam'); A.scream(); flash(0.9, 160); lightsBack(false); }
        else { a.classList.add('grow'); A.sting(kind === 'lightsout'); lightsBack(kind === 'lightsout'); if (kind === 'lightsout') flash(0.5, 140); }
        setTimeout(function () {
          if (gen !== S.gen) return;
          if (kind !== 'attack') { artReset(); A.duckTo(1, 0.5); S.scareBusy = false; if (done) done(); }
          else if (done) done();
        }, kind === 'attack' ? 1500 : 1000);
      }, 500);
    });
  }

  /* ---------- night flow ---------- */
  function startNight(n) {
    S.gen = (S.gen || 0) + 1; S.night = n; S.nightCfg = CFG.nights[n - 1] || CFG.nights[CFG.nights.length - 1]; var c = S.nightCfg;
    S.t = 0; S.len = c.len; S.power = CFG.powerStartPct; S.cam = false; S.door = false; S.powerDead = false; S.deadT = -1; S.lo10 = false;
    S.artRoom = c.start; S.attackT = -1; S.knockT = 0; S.scareBusy = false; S.phase = 'play'; S.moveT = rnd(c.moveMin, c.moveMax);
    S.peeks = []; for (var i = 0; i < c.peeks; i++) S.peeks.push(S.len * rnd(0.2 + i * 0.2, 0.34 + i * 0.22));
    document.body.classList.remove('lightsout', 'dim'); $('bulb').classList.remove('off'); artReset();
    $('btnDoor').classList.remove('on'); $('btnCam').classList.remove('on'); $('monitor').classList.remove('open');
    A.duckTo(1, 0.3); A.setLevel(n); save();
    show('game'); $('hudNight').textContent = n; center('NIGHT ' + n + '\n12 AM', 2600);
    if (n === 1) setTimeout(function () { say('Drag / tilt to look. Open CAMERAS - Art only moves when you are NOT watching him.', 6000); }, 2800);
    if (n === 2) setTimeout(function () { say('Hear the knocking? Lock the door when he reaches the hallway.', 5000); }, 2800);
    log('night ' + n + ' start, art in ' + S.artRoom);
    updateHud();
  }
  function finishNight() {
    S.phase = 'lore'; closeMonitor(true); A.chime(); A.setLevel(0);
    if (S.night >= 5) { S.phase = 'win'; localStorage.removeItem(SAVE_KEY); $('winText').textContent = 'You survived five nights.\nThe lights hum. The house is quiet.\nFor now.'; setTimeout(function () { show('win'); }, 900); return; }
    var L = LORE[S.night - 1]; S.night++; save();
    setTimeout(function () { showLore(L); }, 900);
  }
  var callTimer;
  function showLore(L) {
    $('loreTitle').textContent = L.title; var doc = $('loreDoc'); doc.className = 'doc ' + L.cls; doc.textContent = L.doc;
    var call = $('loreCall'); call.className = 'call'; call.innerHTML = ''; var nb = $('loreNext'); nb.classList.remove('show'); nb.style.opacity = .2; nb.style.pointerEvents = 'none';
    show('lore'); A.duckTo(0.6, 0.5);
    setTimeout(function () {
      doc.classList.add('hidden'); call.classList.add('on'); A.phoneRing();
      var txt = L.call, i = 0, out = '';
      (function type() {
        if (i >= txt.length) { nb.classList.add('show'); nb.style.opacity = 1; nb.style.pointerEvents = 'auto'; return; }
        if (txt.substr(i, 10) === '[[GLITCH]]') { out += '<span class="g">&#9608;&#9608;&#9608;&#9608;</span>'; i += 10; } else { var ch = txt[i++]; out += ch === '<' ? '&lt;' : ch; }
        call.innerHTML = out; callTimer = setTimeout(type, 22 / Math.min(FAST, 6));
      })();
    }, 1600 / Math.min(FAST, 6));
  }
  function gameOver(reason) {
    if (S.phase === 'over') return; S.phase = 'over'; S.deaths++; closeMonitor(true); A.stopMusic(); $('goReason').textContent = reason; show('gameover'); lightsBack(false); log('GAME OVER ' + reason);
  }
  function capBad() {
    if (S.phase === 'bad') return; S.phase = 'bad'; closeMonitor(true); A.stopMusic(); A.powerDown(); localStorage.removeItem(SAVE_KEY);
    $('badText').textContent = 'SESSION LIMIT REACHED (10:00)\n\nYou lingered too long in the house.\nThe terminal logs you out.\nThe door does not.'; show('bad'); log('BAD END (session cap)');
  }

  /* ---------- Art AI ---------- */
  function observed() { return S.cam && S.feed === S.artRoom; }
  function moveArt(forceTo) {
    var from = S.artRoom, opts = CFG.graph[from] || [], to = forceTo;
    if (!to) { if (!opts.length) return; to = from === 'basement' ? opts[Math.floor(Math.random() * 2)] : (Math.random() < 0.8 ? opts[0] : opts[1] || opts[0]); }
    S.artRoom = to; S.moveT = rnd(S.nightCfg.moveMin, S.nightCfg.moveMax); log('art ' + from + ' -> ' + to);
    A.step(); if (to === 'hallway') { S.attackT = S.nightCfg.attackSec; S.knockT = 2.2; A.step(); setTimeout(A.step, 300); } else S.attackT = -1;
  }
  function resolveAttack() {
    S.attackT = -1;
    if (S.door && !S.powerDead) {
      A.knock(4); flash(0.25, 80); say('He pounds on the door... then goes quiet.', 3200);
      S.power = Math.max(0, S.power - CFG.drain.doorHitPenaltyPct); moveArt(Math.random() < 0.5 ? 'kitchen' : 'frontdoor'); log('door held');
    } else { attack(S.powerDead ? 'The power died. So did the lock.' : 'The door was open.'); }
  }
  function attack(reason) { if (S.scareBusy || S.phase !== 'play') return; S.phase = 'dying'; threeBeat('attack', function () { gameOver(reason); }); }
  function feedLeft(fromFeed) {   // night-3 rule: Art may pop up in the room you just stopped checking
    var p = S.nightCfg.appearP; if (!fromFeed || !p || S.artRoom === fromFeed || S.phase !== 'play') return;
    if (Math.random() < p) { log('APPEAR in ' + fromFeed + ' (just checked)'); S.artRoom = fromFeed; S.moveT = rnd(S.nightCfg.moveMin, S.nightCfg.moveMax); S.attackT = fromFeed === 'hallway' ? S.nightCfg.attackSec : -1; S.knockT = 2.2; setTimeout(function () { A.step(); }, 400); }
  }

  /* ---------- camera monitor ---------- */
  function openMonitor() {
    if (S.phase !== 'play' || S.powerDead || S.scareBusy) return; S.cam = true; $('monitor').classList.add('open'); $('btnCam').classList.add('on'); $('btnCam').textContent = 'CLOSE CAMERAS'; A.blip(); setFeed(S.feed, true); updateHud();
  }
  function closeMonitor(silent) {
    if (!S.cam) { $('monitor').classList.remove('open'); return; }
    var prev = S.feed; S.cam = false; $('monitor').classList.remove('open'); $('btnCam').classList.remove('on'); $('btnCam').textContent = 'CAMERAS'; if (!silent) { A.blip(); feedLeft(prev); } updateHud();
  }
  function setFeed(name, initial) {
    var prev = S.feed; if (!initial && prev !== name) feedLeft(prev); S.feed = name;
    document.querySelectorAll('.mon-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.feed === name); });
    $('feedName').textContent = FEEDS[name].n; if (!initial) { A.blip(); } staticBurst(260);
    if (S.artRoom === name) { A.staticBurst(0.18); }
    log('feed ' + name + (observed() ? ' (ART VISIBLE)' : ''));
  }
  var burstUntil = 0; function staticBurst(ms) { burstUntil = performance.now() + ms; A.staticBurst && A.staticBurst(ms / 1000 * 0.8); }

  var fcv, fctx, scv, sctx, noiseData;
  function drawFeed(now) {
    if (!fctx) { fcv = $('feedCanvas'); fctx = fcv.getContext('2d'); scv = $('staticCanvas'); sctx = scv.getContext('2d'); noiseData = sctx.createImageData(160, 120); }
    var f = FEEDS[S.feed], pl = plates[S.feed], W = 240, H = 320, t = now / 1000;
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
    var hh = Math.min(5, Math.floor(S.t / S.len * 6)); $('feedTime').textContent = (hh === 0 ? 12 : hh) + ':' + ('0' + Math.floor((S.t / S.len * 6 % 1) * 60)).slice(-2) + ' ' + 'AM';
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    var hr = Math.min(5, Math.floor(S.t / S.len * 6)); $('hudClock').textContent = CLOCK[hr];
    var p = Math.max(0, S.power); $('powerFill').style.width = p + '%'; $('powerFill').style.background = p <= 20 ? '#d33' : p <= 45 ? '#d9a441' : '#46c46a'; $('powerPct').textContent = Math.ceil(p) + '%';
    $('powerUse').textContent = new Array(1 + 1 + (S.cam ? 1 : 0) + (S.door ? 1 : 0)).join('|');
    var rem = Math.max(0, CFG.sessionCapSec - S.session), m = Math.floor(rem / 60), s = Math.floor(rem % 60); $('hudSession').textContent = m + ':' + ('0' + s).slice(-2);
    $('hudSession').style.color = rem < 60 ? '#ff5a5a' : '';
    if (DEBUG) $('debugState').textContent = 'N' + S.night + ' ' + S.phase + ' t=' + S.t.toFixed(0) + '/' + S.len + ' pwr=' + S.power.toFixed(1) + ' art=' + S.artRoom + ' cam=' + S.cam + ':' + S.feed + ' door=' + S.door + ' atk=' + S.attackT.toFixed(1) + ' gyro=' + V.gotEvt;
  }

  /* ---------- main loop ---------- */
  var last = performance.now(), hudAcc = 0, feedAcc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var raw = Math.min(0.1, (now - last) / 1000); last = now; var dt = raw * FAST;
    updateView(); if (S.phase === 'play' || S.phase === 'dying') recenterArt();
    if (S.cam) { feedAcc += raw; if (feedAcc > 0.05) { feedAcc = 0; drawFeed(now); } }
    if (S.phase === 'play') tick(dt);
    if (S.phase !== 'login' && S.phase !== 'over' && S.phase !== 'win' && S.phase !== 'bad') {
      S.session += dt; if (S.session >= CFG.sessionCapSec) capBad();
    }
    hudAcc += raw; if (hudAcc > 0.15) { hudAcc = 0; updateHud(); }
  }
  function tick(dt) {
    var c = S.nightCfg;
    S.t += dt;
    // power
    var dr = (CFG.drain.idle + (S.cam ? CFG.drain.camera : 0) + (S.door ? CFG.drain.door : 0)) * c.drainMul * dt;
    if (!S.powerDead) S.power = Math.max(0, S.power - dr);
    if (!S.lo10 && S.power <= CFG.lightsOutAtPct && !S.powerDead) { S.lo10 = true; threeBeat('lightsout', function () { say('Power is almost gone...', 3000); }); }
    if (S.power <= 0 && !S.powerDead) {
      S.powerDead = true; S.door = false; $('btnDoor').classList.remove('on'); closeMonitor(true); A.powerDown(); document.body.classList.add('lightsout'); $('bulb').classList.add('off');
      S.deadT = rnd(CFG.deadAttackDelaySec[0], CFG.deadAttackDelaySec[1]); log('POWER DEAD'); say('...', 2000);
    }
    if (S.powerDead) { S.deadT -= dt; if (S.deadT > 0 && Math.random() < dt * 0.6) A.step(); if (S.deadT <= 0 && !S.scareBusy) attack('Power failed. The lights died. He was already inside.'); return; }
    if (S.scareBusy) return;
    // Art AI: frozen while observed
    if (!observed()) {
      if (S.artRoom === 'hallway') {
        S.attackT -= dt; S.knockT -= dt;
        if (S.knockT <= 0 && S.attackT > 0) { S.knockT = 2.2; A.knock(S.door ? 2 : 1); }
        if (S.attackT <= 0) resolveAttack();
      } else {
        S.moveT -= dt; if (S.moveT <= 0) { if (Math.random() < c.aggro) moveArt(); else S.moveT = rnd(c.moveMin, c.moveMax) * 0.6; }
      }
    }
    // peeks
    if (S.peeks.length && S.t >= S.peeks[0] && !S.cam && S.phase === 'play') { S.peeks.shift(); threeBeat('peek'); }
    if (S.t >= S.len) finishNight();
  }

  /* ---------- boot / login ---------- */
  var BOOT = [
    '> MILES_HOUSE remote caretaker terminal', '> link .......... ok', '> cameras ........ 4 of 4', '> door lock ...... armed', '> power .......... 100%', '> checking caretaker credentials',
    'USER: caretaker', 'PASS: ********', '', 'WARNING: subject "ART" is not in custody.', 'Session limit: 10:00. Do not exceed it.'
  ];
  var termTimer;
  function typeBoot(save) {
    var el = $('termText'), lines = BOOT.slice(); if (save > 1) lines.splice(8, 0, 'SAVE FOUND: NIGHT ' + save); var li = 0, ci = 0, out = '';
    (function t() {
      if (li >= lines.length) return; var ln = lines[li];
      if (ci < ln.length) { out += ln[ci++]; el.textContent = out + '_'; termTimer = setTimeout(t, 16); } else { out += '\n'; li++; ci = 0; el.textContent = out + '_'; termTimer = setTimeout(t, 120); }
    })();
  }
  function preload(cb) {
    var urls = Object.keys(ROOMS).map(function (k) { return ROOMS[k]; }).concat([ART_SRC]), n = 0, ok = true;
    function done() { n++; var pct = Math.round(n / urls.length * 100); $('loadBar').style.width = pct + '%'; $('loadLabel').textContent = 'assets ' + pct + '%'; if (n === urls.length) cb(ok); }
    urls.forEach(function (u) {
      var im = new Image(); im.onload = done; im.onerror = function () { ok = false; log('missing ' + u); done(); }; im.src = u;
      var key = Object.keys(ROOMS).filter(function (k) { return ROOMS[k] === u; })[0]; if (key) plates[key] = im; else artImg = im;
    });
  }
  function authenticate() {
    // runs INSIDE the tap: audio unlock + motion permission must happen synchronously here (iOS)
    var btn = $('authBtn'); btn.classList.remove('ready'); btn.style.pointerEvents = 'none';
    A.unlock(); A.start();
    var DOE = window.DeviceOrientationEvent, perm = null;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try { perm = DOE.requestPermission(); } catch (e) { perm = null; }
    }
    if (perm && perm.then) perm.then(function (r) { if (r === 'granted') enableGyro(); else { $('authNote').textContent = 'Motion denied - drag to look.'; log('motion denied'); } }).catch(function () { log('motion perm error'); });
    else if (DOE) enableGyro();
    S.session = 0; S.started = true; S.deaths = 0;
    $('authNote').textContent = 'ACCESS GRANTED'; $('termText').textContent += '\nACCESS GRANTED\n';
    setTimeout(function () { startNight(S.night); }, 700);
  }
  function resumeAudio() { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); }
  document.addEventListener('pointerdown', resumeAudio, true);

  function wire() {
    $('authBtn').addEventListener('click', authenticate);
    $('resetBtn').addEventListener('click', function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} S.night = 1; $('termText').textContent = ''; clearTimeout(termTimer); typeBoot(1); });
    $('btnCam').addEventListener('click', function () { if (S.cam) closeMonitor(); else openMonitor(); });
    $('btnDoor').addEventListener('click', function () {
      if (S.phase !== 'play' || S.powerDead || S.scareBusy) return; S.door = !S.door; $('btnDoor').classList.toggle('on', S.door); $('btnDoor').textContent = S.door ? 'UNLOCK DOOR' : 'LOCK DOOR'; A.lock(); updateHud(); log('door ' + S.door);
    });
    document.querySelectorAll('.mon-tabs button').forEach(function (b) { b.addEventListener('click', function () { setFeed(b.dataset.feed); }); });
    $('voiceBtn').addEventListener('click', function () { var m = !A.mute; A.setMute(m); $('voiceIcon').innerHTML = m ? '&#128263;' : '&#128266;'; });
    $('loreNext').addEventListener('click', function () { clearTimeout(callTimer); $('loreDoc').classList.remove('hidden'); startNight(S.night); });
    $('goRetry').addEventListener('click', function () { A.start(); A.duckTo(1, 0.3); startNight(S.night); });
    $('winAgain').addEventListener('click', function () { S.night = 1; S.session = 0; A.start(); startNight(1); });
    $('badAgain').addEventListener('click', function () { S.night = 1; S.session = 0; A.start(); startNight(1); });
    if (DEBUG) {
      $('debug').hidden = false;
      $('dbgPrev').onclick = function () { startNight(Math.max(1, S.night - 1)); }; $('dbgNext').onclick = function () { startNight(Math.min(5, S.night + 1)); };
      $('dbgPower').onclick = function () { S.power = 9; }; $('dbgScare').onclick = function () { threeBeat('peek'); }; $('dbgMove').onclick = function () { moveArt(); };
      $('dbgEnd').onclick = function () { S.t = S.len; }; $('dbgCap').onclick = function () { S.session = CFG.sessionCapSec; };
    }
  }

  function init() {
    wire();
    var sv = loadSave(); S.night = sv; typeBoot(sv);
    fetch('assets/manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      if (m.game) { Object.keys(m.game).forEach(function (k) { CFG[k] = m.game[k]; }); }
      if (m.rooms) Object.keys(m.rooms).forEach(function (k) { ROOMS[k] = m.rooms[k]; }); if (m.art) ART_SRC = m.art;
    }).catch(function () { log('manifest missing - defaults'); }).then(function () {
      var sceneReady = false, assetsReady = false, check = function () {
        if (sceneReady && assetsReady) { $('loadLabel').textContent = 'assets 100% - ready'; $('authBtn').classList.add('ready'); }
      };
      var sc = $('scene'); var sk = $('sky'); sk.setAttribute('src', ROOMS.attic); $('art').src = ART_SRC;
      var onScene = function () { try { initView(); } catch (e) { console.error(e); } sceneReady = true; check(); };
      if (sc.hasLoaded) onScene(); else sc.addEventListener('loaded', onScene);
      preload(function () { assetsReady = true; check(); });
      requestAnimationFrame(function (t) { last = t; frame(t); });
    });
    // pause audio when the tab is hidden is handled by the engine; game clock also freezes (rAF stops)
    window.__game = { S: S, CFG: CFG, V: V, startNight: startNight, moveArt: moveArt, threeBeat: threeBeat, attack: attack, tick: tick, openMonitor: openMonitor, closeMonitor: closeMonitor, setFeed: setFeed, finishNight: finishNight, capBad: capBad, observed: observed, say: say };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
