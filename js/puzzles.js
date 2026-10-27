/* Terrorific - puzzles.js (MIT). Swappable puzzle functions + the two in-world hotspots that use them.
   A puzzle is a function  fn(root, opts, api) -> ctl  registered with ART.puzzles.register(name, fn).
     root : DOM element to build into          opts : {night, ...manifest options for that type}
     api  : { solved(), failed(), tap() }       ctl  : { destroy(), solution() }   (solution() is for the self-tests)
   Every puzzle is solvable by construction. The manifest picks the type per night and per hotspot (null = disabled). */
(function (ART) {
  'use strict';
  var $ = ART.$, A = ART.A, reg = {}, spotDefs = {}, mk;
  mk = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  var P = ART.puzzles = {
    register: function (name, fn) { reg[name] = fn; },
    types: function () { return Object.keys(reg); },
    create: function (type, root, opts, api) { return reg[type](root, opts, api); },
    /* options for `type` at night n (1-based): arrays in the manifest are indexed by night, clamped */
    opts: function (type, night) {
      var src = (ART.CFG.puzzles && ART.CFG.puzzles[type]) || {}, o = { night: night }, i = Math.max(0, night - 1);
      Object.keys(src).forEach(function (k) { var v = src[k]; o[k] = Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v; });
      return o;
    },
    /* a night's entry in hotspots[id].types is a type name, null (disabled) or an ARRAY of types = a multi-stage puzzle (solve them in order) */
    stagesFor: function (id, night) { var h = ART.CFG.puzzles.hotspots[id], t = h && h.types ? h.types[Math.min(night - 1, h.types.length - 1)] : null; return t == null ? [] : (Array.isArray(t) ? t : [t]); },
    typeFor: function (id, night) { return P.stagesFor(id, night)[0] || null; },
    /* per-night numbers from the manifest hotspot: timeSec (0 = untimed), strikes (wrong answers allowed, 0 = unlimited), wrongPowerPct */
    limit: function (id, night, key) { var v = (ART.CFG.puzzles.hotspots[id] || {})[key]; return Array.isArray(v) ? v[Math.min(night - 1, v.length - 1)] : (v || 0); },
    /* the panel bites back: Art is coming. Lockout cooldown, power drain, a stab, and a real scare shortly after (never on night 1) */
    fail: function (id, why) {
      var S = ART.S, h = ART.CFG.puzzles.hotspots[id] || {}; if (S.phase !== 'play') return;
      P.close(true); A.pzFail(); ART.ui.flash(0.45, 120); S.cool[id] = Math.max(S.cool[id] || 0, (h.cooldownSec || 30) * 0.6); S.puzzleFails = (S.puzzleFails || 0) + 1;
      S.power = Math.max(0.5, S.power - (P.limit(id, S.night, 'wrongPowerPct') || 0) * 2); ART.log('puzzle FAILED ' + id + ' (' + why + ')');
      if (S.night >= 2 && P.limit(id, S.night, 'failScare')) S.peeks.unshift(S.t + 1.8 + Math.random() * 1.6);
      ART.ui.updateHud(); P.refresh();
    },

    /* ---------- hotspots: build the two panels, place them on the side walls ---------- */
    init: function () {
      var H = ART.CFG.puzzles.hotspots;
      Object.keys(H).forEach(function (id) {
        var el = mk('button', 'spot-btn ' + id); el.type = 'button'; el.setAttribute('aria-label', id);
        el.appendChild(mk('i', 'led')); el.appendChild(mk('i', 'plate'));
        var s = ART.ui.addSpot({ id: id, el: el, yawDeg: H[id].yawDeg, topPct: H[id].topPct }); spotDefs[id] = s;
        el.addEventListener('click', function () { P.open(id); });
      });
    },
    /* per-night refresh + per-frame LED state */
    refresh: function () {
      var S = ART.S;
      Object.keys(spotDefs).forEach(function (id) {
        var s = spotDefs[id], type = P.typeFor(id, S.night), cool = S.cool[id] > 0;
        s.hidden = !type;
        s.el.classList.toggle('cool', cool && !(id === 'doorbolt' && S.bolt)); s.el.classList.toggle('armed', id === 'doorbolt' && S.bolt);
        s.el.classList.toggle('dead', id === 'fusebox' && S.powerDead);
      });
    },
    cooldownTick: function (dt) { var S = ART.S; Object.keys(S.cool).forEach(function (k) { if (S.cool[k] > 0) S.cool[k] = Math.max(0, S.cool[k] - dt); }); },

    open: function (id) {
      var S = ART.S;
      if (S.phase !== 'play' || S.scareBusy || S.puzzle || S.cam) return false;
      var type = P.typeFor(id, S.night); if (!type || !reg[type]) return false;
      if (S.cool[id] > 0 || (id === 'doorbolt' && S.bolt)) { A.pzBad(); return false; }
      var root = $('puzzleBody'), stages = P.stagesFor(id, S.night), card = $('puzzleCard'), lim = P.limit(id, S.night, 'timeSec'), maxStrikes = P.limit(id, S.night, 'strikes'), wp = P.limit(id, S.night, 'wrongPowerPct');
      var done = false, si = 0, rec = { id: id, type: type, ctl: null, strikes: 0, stage: 0, stages: stages.length, t0: performance.now(), limit: lim * 1000, iv: 0, fuse: null };
      var api = {
        tap: function () { A.pzTap(); },
        failed: function () {
          A.pzBad(); $('puzzle').classList.add('bad'); setTimeout(function () { $('puzzle').classList.remove('bad'); }, 450); rec.strikes++;
          if (wp) { S.power = Math.max(0.5, S.power - wp); ART.ui.updateHud(); }
          if (maxStrikes && rec.strikes >= maxStrikes) setTimeout(function () { if (S.puzzle === rec) P.fail(id, 'strikes'); }, 380);
        },
        solved: function () {
          if (done) return; A.pzOk(); $('puzzle').classList.add('good');
          if (si + 1 < stages.length) { si++; setTimeout(function () { if (S.puzzle !== rec) return; $('puzzle').classList.remove('good'); stage(); }, 520); return; }
          done = true; clearInterval(rec.iv); setTimeout(function () { P.close(true); P.apply(id); }, 520);
        }
      };
      function stage() {
        try { if (rec.ctl) rec.ctl.destroy(); } catch (e) {}
        root.innerHTML = ''; root.className = 'pz-' + stages[si]; rec.type = stages[si]; rec.stage = si;
        var o = P.opts(stages[si], S.night); o.stage = si; o.stages = stages.length; rec.ctl = P.create(stages[si], root, o, api);
      }
      S.puzzle = rec; stage();
      if (lim > 0) {   // time pressure: a burning fuse, no numbers; footsteps close in over the last third; running out = Art arrives
        rec.fuse = mk('i', 'pz-fuse'); card.appendChild(rec.fuse); var lastStep = 0;
        rec.iv = setInterval(function () {
          if (S.puzzle !== rec) { clearInterval(rec.iv); return; }
          var f = Math.min(1, (performance.now() - rec.t0) / rec.limit); rec.fuse.style.setProperty('--burn', (100 - f * 100).toFixed(1) + '%'); rec.fuse.classList.toggle('hot', f > 0.66);
          if (f > 0.62 && performance.now() - lastStep > 1500 - 900 * f) { lastStep = performance.now(); A.footfall(0.18 + 0.5 * f); }
          if (f >= 1) { clearInterval(rec.iv); P.fail(id, 'time'); }
        }, 100);
      }
      $('puzzle').classList.add('open'); ART.log('puzzle open ' + id + ':' + stages.join('>') + (lim ? ' ' + lim + 's' : '')); return true;
    },
    close: function (silent) {
      var S = ART.S; if (!S.puzzle) { $('puzzle').classList.remove('open', 'good', 'bad'); return; }
      try { S.puzzle.ctl.destroy(); } catch (e) {} clearInterval(S.puzzle.iv); if (S.puzzle.fuse && S.puzzle.fuse.parentNode) S.puzzle.fuse.parentNode.removeChild(S.puzzle.fuse);
      S.puzzle = null; $('puzzle').classList.remove('open', 'good', 'bad'); $('puzzleBody').innerHTML = ''; if (!silent) A.pzTap();
    },
    /* the gameplay effect of a solved hotspot */
    apply: function (id) {
      var S = ART.S, h = ART.CFG.puzzles.hotspots[id]; if (!h || S.phase !== 'play') return;
      if (h.effect === 'power') {
        if (S.powerDead) {   // bring the house back from the dead
          S.powerDead = false; S.deadT = -1; S.power = h.restoreDeadPct; ART.art.lightsBack(false); A.duckTo(1, 0.4); A.lock(); A.buzz(0.4); ART.log('power restored by fuse box');
        } else { S.power = Math.min(100, S.power + h.amountPct); A.buzz(0.3); ART.log('fuse box +' + h.amountPct); }
      } else if (h.effect === 'bolt') { S.bolt = true; A.lock(); ART.log('door bolt armed'); }
      S.cool[id] = h.cooldownSec; ART.ui.peekHud(2600); ART.ui.updateHud(); P.refresh();
    }
  };

  /* ================= KEYPAD: memorise the code on the note, then key it in ================= */
  P.register('keypad', function (root, o, api) {
    var n = o.digits || 4, code = '', i, entered = '', hideT, note, disp;
    for (i = 0; i < n; i++) code += Math.floor(Math.random() * 10);
    note = mk('button', 'pz-note'); note.type = 'button'; disp = mk('div', 'pz-disp');
    var pad = mk('div', 'pz-pad');
    function showNote(ms) { note.textContent = code.split('').join(' '); note.classList.remove('hid'); clearTimeout(hideT); if (ms > 0) hideT = setTimeout(function () { note.textContent = '\u2022 '.repeat(n).trim(); note.classList.add('hid'); }, ms); }
    function paint() { disp.textContent = (entered + '_'.repeat(n - entered.length)).split('').join(' '); }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', ''].forEach(function (k) {
      if (k === '') { pad.appendChild(mk('span')); return; }
      var b = mk('button', 'pz-key', k === 'C' ? '\u00d7' : k); b.type = 'button'; b.dataset.k = k;
      b.addEventListener('click', function () {
        api.tap(); if (k === 'C') { entered = ''; paint(); return; }
        if (entered.length >= n) return; entered += k; paint();
        if (entered.length === n) { if (entered === code) { api.solved(); } else { api.failed(); disp.classList.add('bad'); setTimeout(function () { entered = ''; paint(); disp.classList.remove('bad'); }, 480); } }
      });
      pad.appendChild(b);
    });
    note.addEventListener('click', function () { showNote(1100); });
    root.appendChild(note); root.appendChild(disp); root.appendChild(pad); paint(); showNote(o.memorizeMs || 0);
    return { destroy: function () { clearTimeout(hideT); }, solution: function () { return code; } };
  });

  /* ================= WIRES: join matching colours, left to right ================= */
  P.register('wires', function (root, o, api) {
    var pal = ['#d62a2a', '#2a7bd6', '#e8c42a', '#2bb04a', '#eeeeee'], n = Math.min(o.count || 3, pal.length), L = [], R = [], i;
    for (i = 0; i < n; i++) { L.push(i); R.push(i); }
    for (i = n - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = R[i]; R[i] = R[j]; R[j] = t; }
    if (n > 1 && R.every(function (c, k) { return c === k; })) { var t0 = R[0]; R[0] = R[1]; R[1] = t0; }
    var wrap = mk('div', 'pz-wbox'), cl = mk('div', 'pz-col'), cr = mk('div', 'pz-col'), svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'pz-svg'); var sel = null, done = {}, lb = [], rb = [];
    function mkEnd(side, color, idx) {
      var b = mk('button', 'pz-wire ' + side); b.type = 'button'; b.style.setProperty('--c', pal[color]); b.dataset.c = color; b.dataset.i = idx; return b;
    }
    L.forEach(function (c, idx) { var b = mkEnd('l', c, idx); lb.push(b); cl.appendChild(b); });
    R.forEach(function (c, idx) { var b = mkEnd('r', c, idx); rb.push(b); cr.appendChild(b); });
    function line(a, b, col) {
      var w = wrap.getBoundingClientRect(), ra = a.getBoundingClientRect(), rr = b.getBoundingClientRect(), l = document.createElementNS(svgNS, 'line');
      l.setAttribute('x1', ra.left + ra.width / 2 - w.left); l.setAttribute('y1', ra.top + ra.height / 2 - w.top);
      l.setAttribute('x2', rr.left + rr.width / 2 - w.left); l.setAttribute('y2', rr.top + rr.height / 2 - w.top); l.setAttribute('stroke', col); l.setAttribute('stroke-width', 8); l.setAttribute('stroke-linecap', 'round'); svg.appendChild(l);
    }
    function reset() { done = {}; sel = null; while (svg.firstChild) svg.removeChild(svg.firstChild); lb.concat(rb).forEach(function (b) { b.classList.remove('done', 'sel'); }); }
    lb.forEach(function (b) { b.addEventListener('click', function () { if (done['l' + b.dataset.i]) return; api.tap(); sel = b; lb.forEach(function (x) { x.classList.toggle('sel', x === b); }); }); });
    rb.forEach(function (b) {
      b.addEventListener('click', function () {
        if (!sel || done['r' + b.dataset.i]) return;
        if (sel.dataset.c === b.dataset.c) {
          api.tap(); done['l' + sel.dataset.i] = done['r' + b.dataset.i] = true; sel.classList.add('done'); b.classList.add('done'); sel.classList.remove('sel'); line(sel, b, pal[+b.dataset.c]); sel = null;
          if (Object.keys(done).length === n * 2) api.solved();
        } else { api.failed(); reset(); }
      });
    });
    wrap.appendChild(svg); wrap.appendChild(cl); wrap.appendChild(cr); root.appendChild(wrap);
    return { destroy: function () {}, solution: function () { return L.map(function (c, li) { return [li, R.indexOf(c)]; }); } };
  });

  /* ================= TILES (breaker): tap a tile to flip it and its neighbours; turn all OFF ================= */
  P.register('tiles', function (root, o, api) {
    var n = o.size || 3, N = n * n, st = [], scr = [], i, k;
    function flip(c) { var r = Math.floor(c / n), q = c % n; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var rr = r + d[0], qq = q + d[1]; if (rr >= 0 && rr < n && qq >= 0 && qq < n) st[rr * n + qq] ^= 1; }); }
    do {   // scramble from the solved board with real presses => always solvable; never start solved
      st = []; for (i = 0; i < N; i++) st.push(0); scr = [];
      var want = Math.min(o.scrambles || 3, N), pool = []; for (i = 0; i < N; i++) pool.push(i);
      for (k = 0; k < want; k++) { var pi = Math.floor(Math.random() * pool.length), c = pool.splice(pi, 1)[0]; scr.push(c); flip(c); }
    } while (st.every(function (v) { return !v; }));
    var user = {}, grid = mk('div', 'pz-grid'), cells = [];
    grid.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    function paint() { cells.forEach(function (b, c) { b.classList.toggle('lit', !!st[c]); }); }
    for (i = 0; i < N; i++) (function (c) {
      var b = mk('button', 'pz-tile'); b.type = 'button'; b.dataset.i = c;
      b.addEventListener('click', function () { api.tap(); flip(c); user[c] = (user[c] || 0) ^ 1; paint(); if (st.every(function (v) { return !v; })) api.solved(); });
      cells.push(b); grid.appendChild(b);
    })(i);
    root.appendChild(grid); paint();
    return {
      destroy: function () {},
      solution: function () { var need = {}; scr.forEach(function (c) { need[c] = 1; }); Object.keys(user).forEach(function (c) { if (user[c]) need[c] = (need[c] || 0) ^ 1; }); return Object.keys(need).filter(function (c) { return need[c]; }).map(Number); }
    };
  });

  /* ================= LEDGER: deduce the code from torn lore fragments =================
     The true fragments are generated from the secret and brute-force-checked so that they pin down exactly one code.
     Misleading fragments (the distorted caretaker call) contradict the secret; some true ones are redundant noise.
     Nothing tells the player which scrap lies. Wording lives in manifest puzzles.ledgerText (original text), with built-in defaults. */
  var LEDGER_DEF = {
    ord: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'],
    sources: {
      diary:   { head: "VICKY'S DIARY \u2014 OCT 30", wrap: "He kept whispering that {c}. I wrote it down so I wouldn't forget." },
      invoice: { head: 'FUNERAL HOME RECEIPT #0831', wrap: 'Scribbled in the margin: {c}. Paid in cash. Nobody asked why.' },
      flyer:   { head: 'TRICK-OR-TREAT FLYER (TORN)', wrap: 'Over the candy, in marker: {c}!' },
      tally:   { head: 'PUMPKIN TALLY CARD', wrap: 'Chalked small: {c}.' },
      call:    { head: 'CARETAKER ON THE LINE (BAD CONNECTION)', wrap: '...kssh... listen close, {c}... kssh... don\'t let him...' }
    },
    reliable: ['diary', 'invoice', 'flyer', 'tally'], liar: 'call'
  };
  P.register('ledger', function (root, o, api) {
    var T = ART.CFG.puzzles.ledgerText || {}, ORD = T.ord || LEDGER_DEF.ord, SRC = T.sources || LEDGER_DEF.sources, REL = T.reliable || LEDGER_DEF.reliable, LIAR = T.liar || LEDGER_DEF.liar;
    var n = Math.max(3, Math.min(5, o.digits || 4)), liars = o.liars || 0, extra = o.extra || 0, minClues = o.minClues || 3, kinds = o.kinds || ['is', 'notis', 'sum', 'diff', 'parity', 'greater'];
    function rnd(k) { return Math.floor(Math.random() * k); }
    function pickPos(not) { var i; do { i = rnd(n); } while (i === not); return i; }
    var digs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], secret = [], i;
    for (i = 0; i < n; i++) secret.push(digs.splice(rnd(digs.length), 1)[0]);
    var codes = [];   // every distinct-digit code of length n
    (function build(pre, used) { if (pre.length === n) { codes.push(pre.slice()); return; } for (var d = 0; d < 10; d++) if (!used[d]) { used[d] = 1; pre.push(d); build(pre, used); pre.pop(); used[d] = 0; } })([], {});
    function core(c) {
      var a = ORD[c.i], b = ORD[c.j];
      return { is: 'the ' + a + ' number was ' + c.v, notis: 'the ' + a + ' number was never ' + c.v, sum: 'the ' + a + ' and the ' + b + ' add up to ' + c.v,
        diff: 'the ' + a + ' is ' + c.v + ' more than the ' + b, parity: 'the ' + a + ' number is ' + (c.v ? 'odd' : 'even'), greater: 'the ' + a + ' number is bigger than the ' + b }[c.k];
    }
    function mkClue(k, s) {   // a clue of kind k with random params, evaluated against the secret-like code s (true if s given and satisfies)
      var c = { k: k, i: rnd(n) }; c.j = pickPos(c.i);
      if (k === 'is') c.v = s ? s[c.i] : rnd(10);
      else if (k === 'notis') { c.v = s ? s[c.i] : rnd(10); if (s) { do { c.v = rnd(10); } while (c.v === s[c.i]); } }
      else if (k === 'sum') c.v = s ? s[c.i] + s[c.j] : rnd(19);
      else if (k === 'diff') { if (s && s[c.i] < s[c.j]) { var t = c.i; c.i = c.j; c.j = t; } c.v = s ? s[c.i] - s[c.j] : rnd(9) + 1; }
      else if (k === 'parity') c.v = s ? s[c.i] % 2 : rnd(2);
      c.ok = function (code) {
        switch (c.k) { case 'is': return code[c.i] === c.v; case 'notis': return code[c.i] !== c.v; case 'sum': return code[c.i] + code[c.j] === c.v;
          case 'diff': return code[c.i] - code[c.j] === c.v; case 'parity': return code[c.i] % 2 === c.v; default: return code[c.i] > code[c.j]; }
      };
      return c;
    }
    var clues = [], pool = codes, tries = 0;
    while (pool.length > 1 && tries++ < 200) {
      var c = mkClue(kinds[rnd(kinds.length)], secret); if (!c.ok(secret)) continue;
      var np = pool.filter(c.ok); if (np.length < pool.length && np.length >= 1) { clues.push(c); pool = np; }
    }
    while (pool.length > 1) { var cx = mkClue('is', secret); pool = pool.filter(cx.ok); clues.push(cx); }
    for (var pass = 0; pass < 2; pass++) clues.slice().sort(function () { return Math.random() - 0.5; }).forEach(function (c) {   // prune clues the others already imply
      if (clues.length <= minClues) return; var rest = clues.filter(function (x) { return x !== c; });
      if (codes.filter(function (cd) { return rest.every(function (x) { return x.ok(cd); }); }).length === 1) clues = rest;
    });
    clues.forEach(function (c) { c.src = REL[rnd(REL.length)]; c.lie = false; });
    var all = clues.slice(), guard = 0, redundant = 0, tk;
    while (redundant < extra && guard++ < 80) { tk = mkClue(kinds[rnd(kinds.length)], secret); if (tk.ok(secret)) { tk.src = REL[rnd(REL.length)]; tk.lie = false; all.push(tk); redundant++; } }
    var lied = 0; guard = 0;
    while (lied < liars && guard++ < 400) { tk = mkClue(kinds[rnd(kinds.length)], null); if (!tk.ok(secret)) { tk.src = LIAR; tk.lie = true; all.push(tk); lied++; } }
    if (liars > 0) { guard = 0; while (guard++ < 80) { tk = mkClue(kinds[rnd(kinds.length)], secret); if (tk.ok(secret)) { tk.src = LIAR; tk.lie = false; all.push(tk); break; } } }   // the liar also tells one truth
    all.sort(function () { return Math.random() - 0.5; });
    var wrap = mk('div', 'pz-ledger'), desk = mk('div', 'pz-scraps'), disp = mk('div', 'pz-disp'), pad = mk('div', 'pz-pad pz-pad-s'), entered = '';
    all.forEach(function (c, ix) {
      var d = SRC[c.src] || LEDGER_DEF.sources.diary, sc = mk('div', 'pz-scrap s-' + c.src); sc.style.setProperty('--r', ((ix * 37) % 7 - 3) * 0.55 + 'deg'); sc.dataset.src = c.src;
      sc.appendChild(mk('b', null, d.head)); sc.appendChild(mk('p', null, d.wrap.replace('{c}', core(c)).replace(/^./, function (m) { return m.toUpperCase(); }))); desk.appendChild(sc);
    });
    function paint() { disp.textContent = (entered + '_'.repeat(n - entered.length)).split('').join(' '); }
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', ''].forEach(function (k) {
      if (k === '') { pad.appendChild(mk('span')); return; }
      var b = mk('button', 'pz-key', k === 'C' ? '\u00d7' : k); b.type = 'button'; b.dataset.k = k;
      b.addEventListener('click', function () {
        api.tap(); if (k === 'C') { entered = ''; paint(); return; } if (entered.length >= n) return; entered += k; paint();
        if (entered.length === n) { if (entered === secret.join('')) api.solved(); else { api.failed(); disp.classList.add('bad'); setTimeout(function () { entered = ''; paint(); disp.classList.remove('bad'); }, 480); } }
      });
      pad.appendChild(b);
    });
    wrap.appendChild(desk); wrap.appendChild(disp); wrap.appendChild(pad); root.appendChild(wrap); paint();
    var truth = all.filter(function (c) { return !c.lie; });
    return {
      destroy: function () {}, solution: function () { return secret.join(''); },
      info: function () { return { scraps: all.length, liars: all.filter(function (c) { return c.lie; }).length, consistent: codes.filter(function (cd) { return truth.every(function (c) { return c.ok(cd); }); }).length, secret: secret.join('') }; }
    };
  });

  /* ================= MUSIC BOX: repeat the growing tune; pads reshuffle every round, later nights play in the dark ================= */
  P.register('musicbox', function (root, o, api) {
    var hz = [293.7, 349.2, 415.3, 466.2, 554.4, 622.3], col = ['#6fbf4a', '#d6307f', '#e0962a', '#3fa6b8', '#8a5fd0', '#d8d0b8'];
    var np = Math.max(3, Math.min(6, o.pads || 4)), len = Math.max(3, o.length || 5), step = o.stepMs || 560, silent = !!o.silent, seq = [], i, round = 1, pos = 0, tm = [], alive = true;
    for (i = 0; i < len; i++) { var v; do { v = Math.floor(Math.random() * np); } while (i && v === seq[i - 1] && Math.random() < 0.7); seq.push(v); }
    var grid = mk('div', 'pz-mbgrid'), btn = [], order = []; for (i = 0; i < np; i++) order.push(i);
    function layout() { if (o.shuffle !== false) for (var a = np - 1; a > 0; a--) { var b = Math.floor(Math.random() * (a + 1)), t = order[a]; order[a] = order[b]; order[b] = t; } order.forEach(function (n, slot) { btn[n].style.order = slot; }); }
    function lit(n, ms) { btn[n].classList.add('on'); A.note(hz[n], { vol: 0.42, dur: 0.8, pan: (n / (np - 1) - 0.5) * 0.7 }); setTimeout(function () { btn[n].classList.remove('on'); }, ms || 260); }
    function later(fn, ms) { var t = setTimeout(fn, ms); tm.push(t); }
    function play() {
      grid.classList.remove('in'); pos = 0;
      for (var k = 0; k < round; k++) (function (k) { later(function () { if (!alive) return; if (silent) A.note(hz[seq[k]], { vol: 0.42, dur: 0.8, pan: (seq[k] / (np - 1) - 0.5) * 0.7 }); else lit(seq[k], step * 0.6); }, 700 + k * step); })(k);
      later(function () { if (alive) grid.classList.add('in'); }, 700 + round * step);
    }
    for (i = 0; i < np; i++) (function (n) {
      var b = mk('button', 'pz-mb'); b.type = 'button'; b.dataset.n = n; b.style.setProperty('--c', col[n]); btn.push(b);
      b.addEventListener('click', function () {
        if (!grid.classList.contains('in')) return; lit(n, 220);
        if (n !== seq[pos]) { grid.classList.remove('in'); api.failed(); later(play, 900); return; }
        pos++; if (pos === round) {
          grid.classList.remove('in');
          if (round === len) { later(api.solved, 250); return; }
          round++; later(function () { layout(); play(); }, 600);
        }
      });
      grid.appendChild(b);
    })(i);
    root.appendChild(grid); layout(); play();
    return { destroy: function () { alive = false; tm.forEach(clearTimeout); }, solution: function () { return seq.slice(); }, state: function () { return { round: round, pos: pos, len: len, ready: grid.classList.contains('in') }; } };
  });

  document.addEventListener('DOMContentLoaded', function () { var c = $('puzzleClose'); if (c) c.addEventListener('click', function () { P.close(); }); });
})(window.ART);
