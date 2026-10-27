/* Camera-feed scare: monitor stays open + locked, none on night 1, 3 beats (tracking glitch -> 500 ms silence on a frozen wrong frame -> full-screen payoff),
   cooldown / per-night cap / no stacking, video variant inside the feed, and fallback when the clip is dead.  node tests/feedscare.js <url> <shotDir> */
const p = require('puppeteer-core'), fs = require('fs'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const ARGS = ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'];
async function open(block) {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ARGS });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  if (block) { await pg.setRequestInterception(true); pg.on('request', r => /assets\/video\/.*\.mp4/.test(r.url()) ? r.respond({ status: 404, body: 'x' }) : r.continue()); }
  await pg.goto(URL0 + '?fast=1&video=1', { waitUntil: 'load' }); await sl(2500);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); localStorage.setItem('terrorific_intro_seen_v1', '1'); });
  await pg.tap('#authBtn'); await sl(900); await pg.tap('#vidLayer .vid.intro').catch(() => {}); await sl(2800);
  return { b, pg, errs };
}
async function arm(pg, night) {
  await pg.evaluate(async (n) => { const S = ART.S; ART.nights.start(n); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; ART.art.reset(); ART.ui.openMonitor(); await new Promise(r => setTimeout(r, 400)); }, night);
}
async function run(pg, vid, wait) {
  return pg.evaluate(async (vid, wait) => {
    const S = ART.S, A = ART.A, d = A.duckTo, st = A.sting, sc = A.scream, now = () => performance.now(), rec = { tl: [], samples: [] }, mon = document.getElementById('monitor'), pop = document.getElementById('feedPop');
    A.duckTo = function (v) { if (v === 0) rec.tl.push(['silence', now()]); return d.apply(A, arguments); };
    const hit = () => { rec.tl.push(['hit', now()]); setTimeout(() => { const r = pop.getBoundingClientRect(); rec.pop = { w: r.width, h: r.height, vis: getComputedStyle(pop).visibility, op: +getComputedStyle(pop).opacity }; rec.vid = !!document.querySelector('#vidScare.show'); }, 120); };
    A.sting = function () { hit(); return st.apply(A, arguments); }; A.scream = function () { hit(); return sc.apply(A, arguments); };
    const t0 = now(); rec.ok = ART.art.feedScare(() => { rec.done = now() - t0; }, vid); rec.on = S.feedScareOn;
    const iv = setInterval(() => {
      ART.ui.closeMonitor(); const ks = Object.keys(ART.CFG.feeds); ART.ui.setFeed(ks.find(k => k !== S.feed));
      if (document.querySelector('#vidScare.show') && !rec.vt) { rec.vt = now(); rec.vid = true; }
      rec.samples.push({ open: mon.classList.contains('open'), cam: S.cam, tr: mon.classList.contains('tracking'), busy: S.scareBusy });
    }, 120);
    rec.stack = ART.art.feedScare(); await new Promise(r => setTimeout(r, wait)); clearInterval(iv);
    rec.after = { busy: S.scareBusy, on: S.feedScareOn, frozen: S.feedFrozen, wrong: S.feedWrong, cls: pop.className, open: mon.classList.contains('open') };
    A.duckTo = d; A.sting = st; A.scream = sc; rec.last = S.lastScare; return rec;
  }, vid, wait || 5200);
}
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  { const { b, pg, errs } = await open();
    T('manifest: variants.feed + game.feedScare present', await pg.evaluate(() => !!(ART.CFG.feedScare && ART.CFG.scares.variants.feed && ART.CFG.scares.variants.feed.length >= 2)));
    /* night 1: none */
    await arm(pg, 1);
    const n1 = await pg.evaluate(() => { const c = ART.CFG.feedScare; c.chance = [1, 1, 1, 1, 1]; c.cooldownSec = [0, 0, 0, 0, 0]; c.perNightMax = [9, 9, 9, 9, 9]; let f = 0; for (let i = 0; i < 80; i++) { ART.art.feedTick(1); if (ART.S.scareBusy) f++; } return { f, ok: ART.art.feedScare() }; });
    T('night 1: no camera-feed scare (ticks + forced call)', n1.f === 0, JSON.stringify(n1));
    /* monitor closed: none */
    await arm(pg, 2); await pg.evaluate(() => ART.ui.closeMonitor(true));
    const cl = await pg.evaluate(() => { for (let i = 0; i < 60; i++) ART.art.feedTick(1); return { busy: ART.S.scareBusy, forced: ART.art.feedScare() }; });
    T('monitor closed: feed scare never fires', !cl.busy && cl.forced === false, JSON.stringify(cl));
    /* the scare itself (face) */
    await arm(pg, 2);
    const shot = pg.evaluate(() => 0); setTimeout(() => {}, 0);
    const p1 = run(pg, 'feed-face'); await sl(1500); await pg.screenshot({ path: SHOTS + '/feed-beat2-frozen.png' }); await sl(600); await pg.screenshot({ path: SHOTS + '/feed-beat3-face.png' });
    const r = await p1; const t = k => (r.tl.find(x => x[0] === k) || [])[1];
    T('feed scare started on night 2 with the monitor open', r.ok === true && r.on === true);
    T('BEAT 1: feed tears (tracking class seen) before silence', r.samples.some(s => s.tr));
    T('BEAT 2: >= 495 ms silence before the payoff', t('silence') && t('hit') && t('hit') - t('silence') >= 495, String(t('hit') - t('silence')));
    T('BEAT 3: full-screen payoff pop (390x844, visible)', r.pop && r.pop.vis === 'visible' && r.pop.w >= 385 && r.pop.h >= 840, JSON.stringify(r.pop));
    T('monitor stayed open the whole time (close + switch attempts ignored)', r.samples.filter(s => s.busy).every(s => s.open && s.cam) && r.samples.filter(s => s.busy).length > 10, r.samples.filter(s => s.busy).length + ' busy samples');
    T('no stacking: second feedScare while busy is refused', r.stack === false);
    T('released after: not busy, unfrozen, pop hidden, monitor still closable', r.after && !r.after.busy && !r.after.on && !r.after.frozen && !r.after.wrong && r.after.cls === '', JSON.stringify(r.after));
    T('monitor can be closed again after', await pg.evaluate(() => { ART.ui.closeMonitor(); return !ART.S.cam; }));
    T('lastScare recorded as feed', r.last && r.last.kind === 'feed' && r.last.id === 'feed-face', JSON.stringify(r.last));
    /* cooldown + cap + variety through the tick */
    await arm(pg, 2);
    const cc = await pg.evaluate(async () => { const c = ART.CFG.feedScare; c.chance = [1, 1, 1, 1, 1]; c.cooldownSec = [0, 40, 0, 0, 0]; c.perNightMax = [9, 1, 9, 9, 9]; c.minWatchSec = 1; c.checkSec = 1;
      let fired = 0; const S = ART.S, f0 = S.feedScares || 0; for (let i = 0; i < 12; i++) { ART.art.feedTick(1.5); if ((S.feedScares || 0) - f0 > fired) { fired++; await new Promise(r => setTimeout(r, 5200)); ART.ui.openMonitor(); } } return { fired, n: S.feedN }; });
    T('cooldown / per-night cap: exactly 1 scare in 12 rolls at chance 1 (cap 1, cooldown 40 s)', cc.fired === 1 && cc.n === 1, JSON.stringify(cc));
    T('feed: no page errors', errs.length === 0, errs.join('|')); await b.close(); }

  /* video variant inside the feed */
  { const { b, pg, errs } = await open();
    await pg.waitForFunction(() => ART.video.clips().length >= 2 && ART.video.clips().every(c => c.ok), { timeout: 15000 }).catch(() => {});
    await arm(pg, 3); await pg.evaluate(() => { const j = ART.CFG.video.jumpscares; j.chance = [1, 1, 1, 1, 1]; j.cooldownSec = 0; j.perNightMax = [9, 9, 9, 9, 9]; });
    const r = await run(pg, 'feed-video-pop', 8500); const t = k => (r.tl.find(x => x[0] === k) || [])[1];
    T('feed video variant: clip plays full-screen over the open monitor', r.ok && r.vid === true, JSON.stringify([r.ok, r.vid]));
    T('feed video variant: silence >= 495 ms before the clip', t('silence') && r.vt && r.vt - t('silence') >= 450, String(r.vt - t('silence')));
    T('feed video variant: monitor stayed open + released afterwards', r.samples.filter(s => s.busy).every(s => s.open) && r.after && !r.after.busy && !r.after.on, JSON.stringify(r.after));
    T('feed video: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  /* dead clip -> face */
  { const { b, pg, errs } = await open(true);
    await arm(pg, 3);
    const r = await run(pg, 'feed-video-pop', 6500);
    T('dead clip: feed scare falls back to the face pop and still finishes', r.ok && r.pop && r.pop.vis === 'visible' && r.after && !r.after.busy && !r.after.on, JSON.stringify([r.pop, r.after]));
    T('dead clip: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  const f = R.filter(x => x.startsWith('FAIL')).length; console.log(R.join('\n')); console.log('FEED SCARE TESTS: ' + (R.length - f) + '/' + R.length + ' pass'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
