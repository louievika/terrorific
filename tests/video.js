/* Supplied video clips: manifest slots + files, cold-open intro (unskippable on first play, skippable after, starts night 1), video jump-scare variant
   (3 beats, screen-locked at any yaw, never the same clip twice, cooldown, night gating), and graceful fallback when the mp4s fail.
   node tests/video.js <url> <shotDir> */
const p = require('puppeteer-core'), fs = require('fs'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const ARGS = ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'];
async function open(opts = {}) {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ARGS });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  if (opts.block) { await pg.setRequestInterception(true); pg.on('request', r => /assets\/video\/.*\.mp4/.test(r.url()) ? r.respond({ status: 404, body: 'x' }) : r.continue()); }
  await pg.goto(URL0 + '?fast=1&video=1', { waitUntil: 'load' }); await sl(2500);
  await pg.evaluate((seen) => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); if (seen) localStorage.setItem('terrorific_intro_seen_v1', '1'); }, !!opts.seen);
  return { b, pg, errs };
}
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  /* ---- A. manifest + files ---- */
  { const { b, pg } = await open();
    const m = await pg.evaluate(async () => { const c = ART.CFG.video, o = { intro: !!(c && c.intro && c.intro.src), clips: (c.jumpscares.clips || []).length, files: [], variants: {} };
      const urls = [c.intro.src, c.intro.poster].concat(c.jumpscares.clips.reduce((a, x) => a.concat([x.src, x.poster]), []));
      for (const u of urls) { const r = await fetch(u, { method: 'HEAD' }); o.files.push([u, r.status, +r.headers.get('content-length')]); }
      const V = ART.CFG.scares.variants; ['peek', 'lightsout', 'attack'].forEach(k => o.variants[k] = V[k].some(v => v.type === 'video'));
      o.types = ART.CFG.video.jumpscares.kinds; o.canPlay = !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.4d401f, mp4a.40.2"'); return o; });
    T('manifest video.intro slot + >= 2 jump-scare clips', m.intro && m.clips >= 2, JSON.stringify([m.intro, m.clips]));
    T('every video + poster file served 200 and < 1.6 MB', m.files.every(f => f[1] === 200 && f[2] > 500 && f[2] < 1.6e6), JSON.stringify(m.files));
    T('director pools (peek/lightsout/attack) contain a video variant', m.variants.peek && m.variants.lightsout && m.variants.attack);
    T('browser can decode H.264/AAC mp4', m.canPlay);
    await b.close(); }

  /* ---- B. intro: first play is not skippable, ends -> night 1 starts under a black cover, then fades in ---- */
  { const { b, pg, errs } = await open();
    await pg.tap('#authBtn'); await sl(2500);
    const a = await pg.evaluate(() => { const e = document.querySelector('#vidLayer .vid.intro video'); return { has: !!e, t: e && e.currentTime, paused: e && e.paused, op: e && +getComputedStyle(e).opacity, started: ART.S.phase }; });
    T('intro video element is playing inside the tap flow (currentTime advancing, visible)', a.has && a.t > 0.5 && !a.paused && a.op > 0.9, JSON.stringify(a));
    await pg.screenshot({ path: SHOTS + '/video-intro.png' });
    await pg.tap('#vidLayer .vid.intro').catch(() => {}); await sl(600);
    const s1 = await pg.evaluate(() => { const e = document.querySelector('#vidLayer .vid.intro video'); return { still: !!e && !e.paused, t: e && e.currentTime }; });
    T('first play cannot be skipped by tapping', s1.still && s1.t > 2.5, JSON.stringify(s1));
    const early = await pg.evaluate(() => ART.S.phase); await sl(8200);
    const e1 = await pg.evaluate(() => ({ seen: localStorage.getItem('terrorific_intro_seen_v1'), phase: ART.S.phase, night: ART.S.night, box: !!document.querySelector('#vidLayer .vid.intro') }));
    T('intro finished naturally -> marked seen, night 1 running', e1.seen === '1' && e1.night === 1 && e1.phase !== undefined, JSON.stringify([early, e1]));
    await sl(1800);
    T('intro layer removed after the fade (nothing left on screen)', await pg.evaluate(() => !document.querySelector('#vidLayer .vid.intro')));
    T('intro: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  /* seen -> tap skips */
  { const { b, pg } = await open({ seen: true });
    await pg.tap('#authBtn'); await sl(1800); await pg.tap('#vidLayer .vid.intro').catch(() => {}); await sl(3000);
    const r = await pg.evaluate(() => ({ box: !!document.querySelector('#vidLayer .vid.intro'), night: ART.S.night, phase: ART.S.phase }));
    T('after first play the intro can be skipped with a tap, night starts', !r.box && r.night === 1, JSON.stringify(r)); await b.close(); }

  /* ---- C. jump-scare variant ---- */
  { const { b, pg, errs } = await open({ seen: true });
    await pg.tap('#authBtn'); await sl(900); await pg.tap('#vidLayer .vid.intro').catch(() => {}); await sl(2500);
    await pg.waitForFunction(() => ART.video.clips().length >= 2 && ART.video.clips().every(c => c.ok), { timeout: 15000 }).catch(() => {});
    T('both scare clips preloaded and decodable', await pg.evaluate(() => ART.video.clips().length === 2 && ART.video.clips().every(c => c.ok && !c.failed)));
    await pg.evaluate(() => { const j = ART.CFG.video.jumpscares; j.chance = [1, 1, 1, 1, 1]; j.cooldownSec = 0; j.perNightMax = [9, 9, 9, 9, 9]; ART.nights.start(1); });
    await sl(500);
    T('night 1: video scares are not offered', await pg.evaluate(() => !ART.video.can('peek') && !ART.director.pool('peek').some(v => v.type === 'video')));
    for (const yaw of [1.25, -1.25, 0]) {
      const r = await pg.evaluate(async (yaw) => {
        const S = ART.S, A = ART.A; ART.nights.start(2); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; ART.art.reset(); ART.video.reset();
        ART.V.dragYaw = yaw; await new Promise(r => setTimeout(r, 150));
        const rec = { tl: [], y0: ART.V.yaw }, d = A.duckTo, ps = ART.video.playScare, now = () => performance.now();
        A.duckTo = function (v) { if (v === 0) rec.tl.push(['silence', now()]); return d.apply(A, arguments); };
        ART.video.playScare = function () { rec.tl.push(['payoff', now()]); return ps.apply(ART.video, arguments); };
        let done = false; ART.art.scare('peek', () => { done = true; }, 'video-pop');
        await new Promise(r => setTimeout(r, 2300));
        const box = document.getElementById('vidScare'), v = ART.video.clips().filter(c => c.el.style.display === 'block')[0];
        rec.r = box.getBoundingClientRect().toJSON(); rec.show = box.classList.contains('show'); rec.playing = !!v && !v.el.paused && v.el.currentTime > 0.3; rec.id = v && v.id; rec.busy = S.scareBusy;
        rec.vr = v && v.el.getBoundingClientRect().toJSON(); rec.shot = true;
        if (yaw === 1.25) window.__shot = 1;
        await new Promise(r => setTimeout(r, 5200)); rec.done = done; rec.after = box.classList.contains('show'); rec.busyAfter = S.scareBusy;
        A.duckTo = d; ART.video.playScare = ps; ART.V.dragYaw = 0; S.scareBusy = false; return rec;
      }, yaw);
      const tag = 'video scare (yaw ' + yaw + '): ', t = k => (r.tl.find(x => x[0] === k) || [])[1];
      T(tag + '3 beats: silence >= 500 ms before the clip starts', t('silence') && t('payoff') - t('silence') >= 495, r.tl.map(x => x[0] + ':' + Math.round(x[1] - r.tl[0][1])).join(' '));
      T(tag + 'clip full-screen + playing (screen-locked, independent of yaw)', r.show && r.playing && Math.abs(r.r.width - 390) < 2 && Math.abs(r.r.height - 844) < 2 && Math.abs(r.vr.width - 390) < 2, JSON.stringify([r.id, r.r.width, r.r.height, r.playing]));
      T(tag + 'overlay gone + scare released after the clip ends', r.done && !r.after && !r.busyAfter, JSON.stringify([r.done, r.after, r.busyAfter]));
      if (yaw === 1.25) { /* screenshot is taken in a dedicated pass below */ }
    }
    /* screenshot mid-clip */
    await pg.evaluate(() => { ART.nights.start(2); }); await sl(400);
    await pg.evaluate(() => { ART.S.peeks = []; ART.S.nightCfg.aggro = 0; ART.S.attackT = 999; ART.V.dragYaw = 1.25; ART.video.reset(); ART.art.scare('peek', () => {}, 'video-pop'); }); await sl(1900);
    await pg.screenshot({ path: SHOTS + '/video-scare-turned-left.png' }); await sl(4600);
    /* never the same clip twice in a row + cooldown + per-night cap */
    const seq = await pg.evaluate(() => { const V = ART.video, ids = []; ART.nights.start(3); ART.video.reset(); ART.CFG.video.jumpscares.cooldownSec = 0;
      for (let i = 0; i < 12; i++) { const r = V.playScare(() => {}, () => {}); ids.push(r && r.id); V.stop(); } return ids; });
    T('never the same clip twice in a row (12 plays)', seq.every((x, i) => x && (i === 0 || x !== seq[i - 1])) && new Set(seq).size === 2, seq.join(','));
    const cd = await pg.evaluate(() => { const j = ART.CFG.video.jumpscares; ART.video.reset(); j.cooldownSec = 70; ART.video.playScare(() => {}, () => {}); ART.video.stop(); const a = ART.video.can('peek'); j.cooldownSec = 0; return a; });
    T('cooldown blocks a second video scare right after one', cd === false);
    const cap = await pg.evaluate(() => { const j = ART.CFG.video.jumpscares; ART.nights.start(2); ART.video.reset(); j.perNightMax = [9, 1, 9, 9, 9]; ART.video.playScare(() => {}, () => {}); ART.video.stop(); const a = ART.video.can('peek'); j.perNightMax = [9, 9, 9, 9, 9]; return a; });
    T('per-night cap respected', cap === false);
    const dir = await pg.evaluate(() => { ART.nights.start(3); ART.video.reset(); ART.director.reset(); const ids = []; for (let i = 0; i < 40; i++) ids.push(ART.director.pick('peek').id); return ids; });
    T('director never repeats a variant id back-to-back (40 picks, incl. video)', dir.every((x, i) => !i || x !== dir[i - 1]) && dir.includes('video-pop'), dir.slice(0, 12).join(','));
    T('video: no page errors', errs.length === 0, errs.join('|')); await b.close(); }

  /* ---- D. fallback: every mp4 404s ---- */
  { const { b, pg, errs } = await open({ block: true, seen: false });
    const t0 = Date.now(); await pg.tap('#authBtn'); await pg.waitForFunction(() => !document.querySelector('#vidLayer .vid.intro') , { timeout: 9000 }).catch(() => {}); const dt = Date.now() - t0;
    const n = await pg.evaluate(() => ({ night: ART.S.night, started: ART.S.started, phase: ART.S.phase, box: !!document.querySelector('#vidLayer .vid.intro') }));
    T('intro file 404 -> falls back to the normal start (no stuck black screen)', n.started && !n.box && dt < 4400, JSON.stringify([n, dt]));
    await sl(1500);
    const f = await pg.evaluate(async () => { const S = ART.S; ART.nights.start(2); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; ART.art.reset(); ART.video.reset();
      const j = ART.CFG.video.jumpscares; j.chance = [1, 1, 1, 1, 1];
      const can = ART.video.can('peek'), pool = ART.director.pool('peek').some(v => v.type === 'video');
      let done = false; ART.art.scare('peek', () => { done = true; }, 'video-pop'); await new Promise(r => setTimeout(r, 2300));
      const a = document.getElementById('artRun'), art = document.getElementById('art'); const vis = Math.max(+getComputedStyle(a).opacity, +getComputedStyle(art).opacity) > 0.3 || a.className.length > 0 || art.classList.contains('show');
      await new Promise(r => setTimeout(r, 3000)); return { can, pool, vis, done, last: S.lastScare, busy: S.scareBusy }; });
    T('clips failed -> video not offered by the director', !f.can && !f.pool, JSON.stringify([f.can, f.pool]));
    T('forced video scare with dead files falls back to the sprite scare and finishes', f.vis && f.done && !f.busy, JSON.stringify(f));
    T('fallback: no page errors', errs.length === 0, errs.join('|')); await b.close(); }

  R.forEach(l => console.log(l)); const f = R.filter(l => /^FAIL/.test(l)).length; console.log('VIDEO TESTS: ' + (R.length - f) + '/' + R.length + ' pass'); process.exit(f ? 1 : 0);
})();
