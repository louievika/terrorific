/* Camera-locked jump scares: with the view turned hard left / hard right, every scare payoff must (a) ease the view yaw to centre (ART.V.yaw ~ 0),
   (b) put the Art overlay in front of the player (screen-space centre), (c) keep trigger -> 500 ms silence -> payoff. Also with the run sheet blocked (static fallback).
   node tests/camlock.js <url> <shotDir> */
const p = require('puppeteer-core'), fs = require('fs'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
async function open(block) {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  if (block) { await pg.setRequestInterception(true); pg.on('request', r => /art-run\.webp/.test(r.url()) ? r.respond({ status: 404, body: 'x' }) : r.continue()); }
  await pg.goto(URL0 + '?fast=6', { waitUntil: 'load' }); await sl(3000);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); });
  await pg.tap('#authBtn'); await sl(1800);
  return { b, pg, errs };
}
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const cases = [['peek', 'run-far'], ['peek', 'run-mid-left'], ['peek', 'run-mid-right'], ['peek', 'silhouette'], ['peek', 'mime-hattilt'], ['lightsout', 'lo-run-left'], ['attack', 'at-run-center']];
  for (const fb of [false, true]) {
    const { b, pg, errs } = await open(fb);
    for (const yaw of [1.25, -1.25]) for (const [kind, vid] of cases) {
      const r = await pg.evaluate(async (kind, vid, yaw) => {
        const S = ART.S; ART.nights.start(2); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999;
        ART.art.reset(); ART.V.dragYaw = yaw; ART.V.dragPitch = 0.4; await new Promise(r => setTimeout(r, 150));
        const y0 = ART.V.yaw, rec = { y0, tl: [] }, A = ART.A, d = A.duckTo, lv = ART.ui.lockView, st = A.sting, sc = A.scream, now = () => performance.now();
        A.duckTo = function (v) { if (v === 0) rec.tl.push(['silence', now()]); return d.apply(A, arguments); };
        ART.ui.lockView = function () { rec.tl.push(['payoff', now()]); return lv.apply(ART.ui, arguments); };
        const hit = function () { rec.tl.push(['hit', now()]); setTimeout(() => {
          const el = [document.getElementById('artRun'), document.getElementById('art')].map(e => ({ r: e.getBoundingClientRect(), o: +getComputedStyle(e).opacity })).sort((a, b) => b.o - a.o)[0];
          rec.cx = el.r.left + el.r.width / 2; rec.op = el.o; rec.w = el.r.width; rec.busy = ART.S.scareBusy; }, 110); setTimeout(() => { rec.yaw = ART.V.yaw; }, 320); };
        A.sting = function () { hit(); return st.apply(A, arguments); }; A.scream = function () { hit(); return sc.apply(A, arguments); };
        ART.art.scare(kind, () => {}, vid);
        await new Promise(r => setTimeout(r, 4200));
        A.duckTo = d; ART.ui.lockView = lv; A.sting = st; A.scream = sc; ART.art.reset(); ART.V.dragYaw = 0; ART.V.dragPitch = 0; S.scareBusy = false;
        return rec;
      }, kind, vid, yaw);
      const tag = (fb ? 'fallback ' : '') + (yaw > 0 ? 'turned left ' : 'turned right ') + kind + '/' + vid;
      const t = k => (r.tl.find(x => x[0] === k) || [])[1];
      T(tag + ': view really was turned before the scare', Math.abs(r.y0) > 1, r.y0.toFixed(2));
      T(tag + ': yaw eased to centre on the payoff', Math.abs(r.yaw) < 0.06, String(r.yaw));
      T(tag + ': Art overlay in front of the player', r.cx > 390 * 0.2 && r.cx < 390 * 0.8 && r.op > 0.5, 'cx=' + Math.round(r.cx) + ' op=' + r.op);
      T(tag + ': 3 beats (silence >= 500 ms before payoff)', t('silence') && t('payoff') - t('silence') >= 495, r.tl.map(x => x[0] + ':' + Math.round(x[1] - r.tl[0][1])).join(' '));
    }
    T((fb ? 'fallback ' : '') + 'no page errors', errs.length === 0, errs.join('|'));
    if (!fb) { await pg.evaluate(() => { ART.V.dragYaw = 1.25; ART.art.scare('peek', () => {}, 'run-near-fast'); }); await sl(1900); await pg.screenshot({ path: SHOTS + '/camlock-turned-left-payoff.png' }); }
    await b.close();
  }
  R.forEach(l => console.log(l)); const f = R.filter(l => /^FAIL/.test(l)).length; console.log('CAMLOCK TESTS: ' + (R.length - f) + '/' + R.length + ' pass'); process.exit(f ? 1 : 0);
})();
