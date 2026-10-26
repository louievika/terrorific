/* Phase C audio test: (A) manifest samples fetch + decode and play with no console errors; (B) every sample 404s -> oscillator fallback, game still runs. */
const p = require('puppeteer-core'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL = process.argv[2] || 'http://localhost:8077/game.html';
async function run(block) {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  const hits = {}; await pg.setRequestInterception(true);
  pg.on('request', r => { if (/assets\/audio\//.test(r.url())) { hits[r.url().split('/').pop()] = 1; if (block) return r.respond({ status: 404, body: 'nope' }); } r.continue(); });
  await pg.goto(URL, { waitUntil: 'load' }); await sl(3500);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); });
  await pg.tap('#authBtn'); await sl(2500);
  const out = await pg.evaluate(() => {
    const A = ART.A, r = {}; r.samples = ART.audio.samples().sort(); r.state = A.ctx && A.ctx.state; r.manifestKeys = Object.keys(ART.manifest.audio).filter(k => typeof ART.manifest.audio[k] === 'string').sort(); r.mix = ART.MIX.breathing; r.titleGain = ART.manifest.title.breathGain;
    try { A.sting(true); A.sting(false); A.creak(); A.breathOnce(A.ctx.currentTime + 0.1, 5); A.staticBurst(0.3); A.phoneRing(); A.scream(); A.lock(); r.threw = null; } catch (e) { r.threw = String(e); }
    r.phase = __game.S.phase; return r;
  });
  await b.close(); return { out, errs, hits };
}
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const a = await run(false);
  T('manifest lists 5 audio slots', a.out.manifestKeys.join() === 'breathing,creak,hum,static,stinger', a.out.manifestKeys.join());
  T('all 5 wav files fetched', Object.keys(a.hits).length === 5, Object.keys(a.hits).join());
  T('all 5 decoded into the unlocked AudioContext', a.out.samples.join() === 'breathing,creak,hum,static,stinger', a.out.samples.join());
  T('breathing level comes from audio.mix.breathing and is way down (<=0.2)', a.out.mix > 0 && a.out.mix <= 0.2, a.out.mix);
  T('title breathing gain is a manifest key and way down (<=0.2)', a.out.titleGain > 0 && a.out.titleGain <= 0.2, a.out.titleGain);
  T('context running after the tap', a.out.state === 'running', a.out.state);
  T('every sample-backed sound plays without throwing', a.out.threw === null, a.out.threw);
  T('no console errors (samples on)', a.errs.length === 0, a.errs.join(' | '));
  const f = await run(true);
  T('fallback: 404 samples -> 0 decoded', f.out.samples.length === 0, f.out.samples.join());
  T('fallback: oscillator sounds still play without throwing', f.out.threw === null, f.out.threw);
  T('fallback: game still in play phase', f.out.phase === 'play', f.out.phase);
  const bad = f.errs.filter(e => !/404|Failed to load resource/.test(e)); T('fallback: no errors other than the expected 404s', bad.length === 0, bad.join(' | '));
  console.log(R.join('\n')); const n = R.filter(x => x.startsWith('PASS')).length; console.log('AUDIO TESTS: ' + n + '/' + R.length + ' pass'); process.exit(n === R.length ? 0 : 1);
})();
