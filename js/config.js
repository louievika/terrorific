/* ART // LOGIN - config.js (MIT). Shared namespace, URL flags, defaults, manifest loader.
   Everything tunable lives in assets/manifest.json; these are only fallbacks. Load order:
   config, audio, rooms, art, ui, puzzles, nights, main. */
window.ART = window.ART || {};
(function (ART) {
  'use strict';
  var Q = new URLSearchParams(location.search);
  ART.$ = function (id) { return document.getElementById(id); };
  ART.rnd = function (a, b) { return a + Math.random() * (b - a); };
  ART.FAST = Math.max(1, parseFloat(Q.get('fast')) || 1);          // ?fast=N scales game time
  ART.DEBUG = Q.get('debug') === '1';                              // ?debug=1 shows the dev panel
  ART.SAVE_KEY = 'art_login_save_v1';
  ART.SEEN_KEY = 'art_login_seen_v1';                              // first-run auto-pan shown
  ART.VERSION = 2;

  /* fallbacks - assets/manifest.json "game" block replaces any key it defines (in place) */
  var CFG = ART.CFG = {
    sessionCapSec: 600, powerStartPct: 100, lightsOutAtPct: 10, deadAttackDelaySec: [10, 14],
    drain: { idle: 0.28, camera: 0.85, door: 0.55, doorHitPenaltyPct: 6 },
    graph: { basement: ['kitchen', 'frontdoor'], kitchen: ['hallway', 'basement'], frontdoor: ['hallway', 'basement'], hallway: [] },
    nights: [{ len: 60, start: 'basement', moveMin: 6, moveMax: 10, aggro: 0.7, attackSec: 10, drainMul: 1, appearP: 0, peeks: 0 }],
    clock: ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM'],
    feeds: { hallway: { n: 'CAM 1', yaw: 0, h: 110, bot: 205 } },
    lore: [], boot: ['> terminal ready'], text: {},
    doorButton: { yawDeg: -17, topPct: 55 },
    autoPan: { startSec: 3.4, durSec: 7, ampDeg: 78 },
    puzzles: { hotspots: {}, keypad: { digits: 4, memorizeMs: [0] }, wires: { count: [3] }, tiles: { size: 3, scrambles: [3] } }
  };
  ART.ROOMS = { attic: 'assets/rooms/attic.jpg' };
  ART.ART_SRC = 'assets/art/art.png';

  ART.config = {
    ready: false,
    /* fetch manifest, merge into CFG / ROOMS / ART_SRC. Resolves even when the manifest is missing. */
    load: function () {
      return fetch('assets/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (m) {
        if (m.game) Object.keys(m.game).forEach(function (k) { if (k.charAt(0) !== '_') CFG[k] = m.game[k]; });
        if (m.rooms) Object.keys(m.rooms).forEach(function (k) { ART.ROOMS[k] = m.rooms[k]; });
        if (m.art) ART.ART_SRC = m.art;
        ART.config.ready = true; ART.manifest = m;
      }).catch(function (e) { console.warn('manifest missing - using defaults', e); });
    }
  };
})(window.ART);
