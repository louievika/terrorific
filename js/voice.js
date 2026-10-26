/* ART // LOGIN - voice.js (MIT). Art's voice (Phase D). Lines are pre-rendered offline (scripts/make_voice.py: Piper en_US-joe-medium, CC0 voice,
   post-processed deep) -> assets/voice/*.mp3 + lines.json (text, file, duration, per-word timings). No runtime TTS.
   Same Web Audio context + unlock path as everything else: ART.audio.unlockInTap() -> ART.voice.unlock() (fetch + decode inside/after the tap).
   Voice bus -> A.master directly (it is NOT on the ambient duck bus, so the 500 ms silence beat never mutes it); while a line plays, the ambient bus is
   ducked through its own gain (A.vduck) so it never fights the scare duck. Text is only ever shown on the diegetic lore screens
   (ART.voice.words fades each word in from the lines.json timings on a wall-clock timeline, independent of audio) -> if audio fails, text-only still works.
   No UI of any kind lives here. The title screen never calls this module. */
(function (ART) {
  'use strict';
  var A = ART.A, V, lines = {}, raw = {}, buf = {}, jsonP = null, bus = null, timers = [], cur = null, lastTaunt = -1e9, lastId = '', tauntN = 0, session = { said: [] };
  function cfg() { return (ART.manifest && ART.manifest.voice) || {}; }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function ensure() {
    if (!A.ready || !A.ctx) return false;
    if (!bus) {
      bus = A.ctx.createGain(); bus.gain.value = cfg().gain || 0.95; bus.connect(A.master);
      try { A.vduck = A.ctx.createGain(); A.duck.disconnect(); A.duck.connect(A.vduck); A.vduck.connect(A.master); } catch (e) { A.vduck = null; }
    }
    return true;
  }
  function decode(id, ab) {
    var ok = function (b) { buf[id] = b; ART.log && ART.log('voice ready: ' + id); }, bad = function (e) { console.warn('voice failed: ' + id, e); };
    try { var p = A.ctx.decodeAudioData(ab, ok, bad); if (p && p.catch) p.catch(bad); } catch (e) { bad(e); }
  }
  function getJson() {
    var path = cfg().lines; if (!path) return Promise.resolve(null);
    if (!jsonP) jsonP = fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { (j.lines || []).forEach(function (l) { lines[l.id] = l; }); return j; })
      .catch(function (e) { console.warn('voice lines missing', e); return null; });
    return jsonP;
  }
  function decodeAll() { Object.keys(raw).forEach(function (k) { if (buf[k] || !A.ctx) return; raw[k].then(function (ab) { if (ab && !buf[k]) decode(k, ab); }); }); }

  V = ART.voice = {
    /* called from ART.audio.unlockInTap(): the context is created in the tap; fetching/decoding continues after it */
    unlock: function () {
      ensure(); getJson().then(function () {
        Object.keys(lines).forEach(function (id) {
          if (raw[id]) return;
          raw[id] = fetch(lines[id].file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).catch(function (e) { console.warn('voice file missing: ' + id, e); return null; });
        });
        decodeAll();
      });
    },
    ready: function () { return Object.keys(buf).sort(); },
    ids: function () { return Object.keys(lines).sort(); },
    line: function (id) { return lines[id] || null; },
    playing: function () { return cur && cur.id; },
    duration: function (id) { return buf[id] ? buf[id].duration : 0; },
    said: function () { return session.said.slice(); },
    /* play a line (audio only). o: { delay ms, pan -1..1, rate, duck 0..1 (ambient level while speaking), onend }. Returns true if a source started (or is scheduled). */
    say: function (id, o) {
      o = o || {}; V.stop(true);
      var d = o.delay || 0, tok = {};
      cur = { id: id, tok: tok };
      later(function () {
        if (!cur || cur.tok !== tok) return;
        if (!ensure() || !buf[id] || A.ctx.state !== 'running') { ART.log && ART.log('voice skipped (no audio): ' + id); cur = null; return; }
        var c = A.ctx, s = c.createBufferSource(), rate = o.rate || 1; s.buffer = buf[id]; s.playbackRate.value = rate;
        var out = s;
        if (o.pan && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); s.connect(p); out = p; }
        out.connect(bus); cur.src = s; s.start(c.currentTime + 0.02); session.said.push(id);
        var dk = o.duck != null ? o.duck : (cfg().duck != null ? cfg().duck : 0.45);
        if (A.vduck) { var t = c.currentTime; A.vduck.gain.cancelScheduledValues(t); A.vduck.gain.setTargetAtTime(dk, t, 0.12); }
        ART.log && ART.log('voice: ' + id);
        s.onended = function () {
          if (!cur || cur.src !== s) return; cur = null; V.unduck(); if (o.onend) o.onend();
        };
      }, d);
      return true;
    },
    unduck: function () { if (A.vduck && A.ctx) { var t = A.ctx.currentTime; A.vduck.gain.cancelScheduledValues(t); A.vduck.gain.setTargetAtTime(1, t, 0.4); } },
    /* stop the current/scheduled line and every pending timer (night restart, skip, new line). keepTimers: only supersede the line */
    stop: function (supersede) {
      if (!supersede) { timers.forEach(clearTimeout); timers = []; }
      if (cur && cur.src) { try { cur.src.onended = null; cur.src.stop(); } catch (e) {} }
      if (cur && cur.src || !supersede) V.unduck();
      cur = null;
    },
    /* wall-clock timeline for a line: lines.json word timings, or proportional timing from the given text when lines.json is unavailable */
    timeline: function (id, text) {
      var l = lines[id];
      if (l) return { words: l.words, speech: l.speech || l.duration, dur: l.duration };
      var ws = (text || '').split(/\s+/).filter(Boolean), t = 0.1, out = [];
      ws.forEach(function (w) { var d = 0.16 + 0.045 * w.length; out.push({ w: w, t0: +t.toFixed(3), t1: +(t + d).toFixed(3) }); t += d + 0.04; });
      return { words: out, speech: t, dur: t };
    },
    /* fade each word of a line into `el` at its timing (scale = game FAST factor). Diegetic lore text only. onDone fires ~0.5 s after the last word. */
    words: function (el, id, text, scale, onDone) {
      var tl = V.timeline(id, text), sc = Math.max(1, scale || 1); el.innerHTML = '';
      tl.words.forEach(function (w) {
        var sp = document.createElement('span'); sp.className = 'aw'; sp.textContent = w.w; el.appendChild(sp); el.appendChild(document.createTextNode(' '));
        later(function () { sp.classList.add('on'); }, w.t0 * 1000 / sc);
      });
      later(function () { if (onDone) onDone(); }, (tl.speech + 0.55) * 1000 / sc);
      return tl;
    },
    /* ---- Art taunts: scare payoff only (after the 500 ms silence), rare and wrong ---- */
    taunt: function (kind, force) {
      var tc = cfg().taunt || {}, S = ART.S, now = performance.now();
      if (!force) {
        if (!S || S.night < (tc.startNight || 2)) return false;
        if (Math.random() > ((tc.chance || {})[kind] || 0)) return false;
        if (now - lastTaunt < (tc.minGapSec || 75) * 1000) return false;
      }
      var ids = V.ids().filter(function (i) { return /^taunt/.test(i); }); if (!ids.length) return false;
      var pick = ids.filter(function (i) { return i !== lastId; }), id = pick[Math.floor(Math.random() * pick.length)];
      lastTaunt = now; lastId = id; tauntN++;
      var dl = tc.delayMs || [450, 950], delay = kind === 'attack' ? 1100 + Math.random() * 400 : dl[0] + Math.random() * (dl[1] - dl[0]);
      var side = Math.random() < 0.5 ? -1 : 1;                          // from the wrong side, a little too slow
      return V.say(id, { delay: delay, pan: side * (0.55 + Math.random() * 0.4), rate: 0.93 + Math.random() * 0.05, duck: 0.35 });
    },
    stats: function () { return { taunts: tauntN, lastTauntAt: lastTaunt }; },
    resetTaunts: function () { lastTaunt = -1e9; lastId = ''; tauntN = 0; },
    VOICE_KEY: 'art_login_voice_v1'
  };
})(window.ART);
