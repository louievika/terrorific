/* ART // LOGIN - audio.js (MIT). Thin game layer on top of assets/ui/audio-engine.js (window.ArtAudio, all synthesized).
   iOS rules: AudioContext is created/unlocked inside a tap (ART.audio.unlockInTap), resumed on every pointerdown,
   engine suspends/resumes on visibilitychange. No autoplay. No mute/quit UI (system volume + silent switch only). */
(function (ART) {
  'use strict';
  var A = ART.A = window.ArtAudio;
  /* puzzle sfx (original synthesis, built on engine primitives) */
  A.pzTap = function () { A.noiseHit(1800, 6, 0.12, 0.04); };
  A.pzOk = function () { A.noiseHit(1200, 8, 0.2, 0.09); setTimeout(function () { A.noiseHit(1700, 8, 0.2, 0.14); }, 110); };
  A.pzBad = function () { A.noiseHit(140, 2, 0.5, 0.28); A.noiseHit(2400, 0.6, 0.12, 0.18); };
  ART.audio = {
    unlockInTap: function () { A.unlock(); A.start(); },
    resume: function () { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); },
    duck: function (v, tc) { A.duckTo(v, tc); },
    level: function (n) { A.setLevel(n); }
  };
  document.addEventListener('pointerdown', ART.audio.resume, true);
})(window.ART);
