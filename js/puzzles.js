/* ART // LOGIN - puzzles.js (MIT). Swappable puzzle functions + the two in-world hotspots that use them.
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
    typeFor: function (id, night) { var h = ART.CFG.puzzles.hotspots[id]; return h && h.types ? (h.types[Math.min(night - 1, h.types.length - 1)] || null) : null; },

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
      var root = $('puzzleBody'); root.innerHTML = ''; root.className = 'pz-' + type;
      var ctl, done = false;
      var api = {
        tap: function () { A.pzTap(); },
        failed: function () { A.pzBad(); $('puzzle').classList.add('bad'); setTimeout(function () { $('puzzle').classList.remove('bad'); }, 450); },
        solved: function () {
          if (done) return; done = true; A.pzOk(); $('puzzle').classList.add('good');
          setTimeout(function () { P.close(true); P.apply(id); }, 520);
        }
      };
      ctl = P.create(type, root, P.opts(type, S.night), api);
      S.puzzle = { id: id, type: type, ctl: ctl }; $('puzzle').classList.add('open'); ART.log('puzzle open ' + id + ':' + type); return true;
    },
    close: function (silent) {
      var S = ART.S; if (!S.puzzle) { $('puzzle').classList.remove('open', 'good', 'bad'); return; }
      try { S.puzzle.ctl.destroy(); } catch (e) {}
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

  document.addEventListener('DOMContentLoaded', function () { var c = $('puzzleClose'); if (c) c.addEventListener('click', function () { P.close(); }); });
})(window.ART);
