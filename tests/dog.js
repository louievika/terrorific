/* Dog fail-scare (user-supplied photo cutout): asset budget + alpha, manifest weights, director no-repeat, 3 beats (silence >= 495 ms, then a ~0.4 s lunge small -> full screen + snarl/bark), screen-locked, fallback to Art when the image is missing, off in default test mode.  node tests/dog.js <url> <shotDir> */
const fs = require('fs'), { open, arm, sl } = require('./_h'); const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const png = fs.readFileSync(__dirname + '/../assets/art/dog.png'); const w = png.readUInt32BE(16), h = png.readUInt32BE(20), ct = png[25];
  T('asset: dog.png is a PNG <= 250 KB, ~640 px wide, with alpha', png.slice(1, 4).toString() === 'PNG' && png.length <= 250 * 1024 && w >= 600 && w <= 680 && (ct === 6 || png.includes('tRNS')), `${png.length}B ${w}x${h} ct${ct}`);
  /* default test mode: dog off */
  { const { b, pg, errs } = await open(URL0);
    T('manifest: at-dog variant + game.failScare weights/dog block', await pg.evaluate(() => { const f = ART.CFG.failScare; return !!f && f.weights.art > 0 && f.weights.dog > 0 && f.dog.asset === 'assets/art/dog.png' && ART.CFG.scares.variants.attack.some(v => v.id === 'at-dog' && v.type === 'dog'); }));
    T('?fast / ?novideo test mode keeps the dog off (suites stay deterministic)', await pg.evaluate(() => { let d = 0; for (let i = 0; i < 80; i++) if (ART.director.pick('attack').type === 'dog') d++; return !ART.art.dogEnabled() && d === 0; })); await b.close(); }
  /* enabled */
  { const { b, pg, errs } = await open(URL0, '&dog=1');
    await pg.waitForFunction(() => ART.art.dogReady(), { timeout: 10000 }).catch(() => {});
    T('dog image preloaded in the background', await pg.evaluate(() => ART.art.dogReady()));
    const dir = await pg.evaluate(() => { ART.director.reset(); const ids = []; for (let i = 0; i < 80; i++) ids.push(ART.director.pick('attack').id); const f = ART.CFG.failScare; f.weights.dog = 0; ART.director.reset(); let d0 = 0; for (let i = 0; i < 60; i++) if (ART.director.pick('attack').type === 'dog') d0++; f.weights.dog = 0.9; return { dogs: ids.filter(x => x === 'at-dog').length, rep: ids.some((x, i) => i && x === 'at-dog' && ids[i - 1] === 'at-dog'), d0, rep2: ids.some((x, i) => i && x === ids[i - 1]) }; });
    T('failScare weights: dog appears in the attack mix, never twice in a row, weight 0 removes it', dir.dogs >= 5 && !dir.rep && !dir.rep2 && dir.d0 === 0, JSON.stringify(dir));
    await arm(pg, 1, false);
    const run = pg.evaluate(async () => {
      const S = ART.S, A = ART.A, rec = { tl: [], samples: [] }, now = () => performance.now(), L = document.getElementById('dogLayer'), I = document.getElementById('dogImg'), d = A.duckTo, sn = A.dogSnarl, bk = A.dogBark;
      A.duckTo = function (v) { if (v === 0) rec.tl.push(['silence', now()]); return d.apply(A, arguments); }; A.dogSnarl = function () { rec.tl.push(['snarl', now()]); return sn.apply(A, arguments); }; A.dogBark = function () { rec.tl.push(['bark', now()]); return bk.apply(A, arguments); };
      const t0 = now(); let done = null; ART.art.scare('attack', () => { done = now() - t0; }, 'at-dog'); rec.fixed = getComputedStyle(L).position;
      const iv = setInterval(() => { if (L.classList.contains('go')) { const r = I.getBoundingClientRect(); rec.samples.push({ t: now(), h: r.height, w: r.width, l: r.left, b: r.bottom, sc: parseFloat(getComputedStyle(I).scale) || 1, op: +getComputedStyle(I).opacity }); } }, 30);
      while (done === null && now() - t0 < 9000) await new Promise(r => setTimeout(r, 50)); clearInterval(iv); rec.done = done; rec.last = S.lastScare; rec.busy = S.scareBusy;
      await new Promise(r => setTimeout(r, 400)); rec.after = { cls: L.className, vis: getComputedStyle(L).visibility }; A.duckTo = d; A.dogSnarl = sn; A.dogBark = bk; return rec; });
    await sl(1900); await pg.screenshot({ path: SHOTS + '/dog-lunge-mid.png' }); await sl(500); await pg.screenshot({ path: SHOTS + '/dog-payoff.png' });
    const r = await run, t = k => (r.tl.find(x => x[0] === k) || [])[1];
    T('variant chosen = at-dog, scare finished', r.last && r.last.id === 'at-dog' && r.done > 1500, JSON.stringify([r.last, Math.round(r.done)]));
    T('BEAT 2: >= 495 ms silence before the snarl / lunge', t('silence') && t('snarl') && t('snarl') - t('silence') >= 495, String(t('snarl') - t('silence')));
    const s = r.samples; const first = s[0], full = s.find(x => x.h >= 844 * 0.95);
    T('BEAT 3: lunges from small to full screen in ~0.4 s', first && first.sc <= 0.5 && full && (full.t - first.t) >= 250 && (full.t - first.t) <= 700, JSON.stringify([first && first.sc, full && Math.round(full.t - first.t)]));
    T('payoff fills the screen (height >= 844, covers left edge + bottom)', s.some(x => x.h >= 844 && x.l <= 1 && x.b >= 844 && x.op === 1));
    T('snarl + barks synthesized and fired', !!t('snarl') && r.tl.filter(x => x[0] === 'bark').length >= 2, JSON.stringify(r.tl.map(x => x[0])));
    T('screen-locked: dog layer is position:fixed', r.fixed === 'fixed');
    T('cleaned up after: layer hidden', r.after.cls === '' && r.after.vis === 'hidden', JSON.stringify([r.after, r.busy]));
    /* real lethal flow: attack -> dog -> game over */
    await arm(pg, 2, false); const fl = await pg.evaluate(async () => { ART.CFG.scares.variants.attack = ART.CFG.scares.variants.attack.filter(v => v.type === 'dog'); ART.director.reset(); ART.nights.attack('test'); const S = ART.S; const t0 = performance.now(); while (S.phase !== 'over' && performance.now() - t0 < 9000) await new Promise(r => setTimeout(r, 100)); return { phase: S.phase, id: S.lastScare && S.lastScare.id }; });
    T('lethal attack -> dog payoff -> fail screen reached', fl.phase === 'over' && fl.id === 'at-dog', JSON.stringify(fl));
    T('dog: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  /* image missing -> Art fail scare */
  { const { b, pg, errs } = await open(URL0, '&dog=1', /assets\/art\/dog\.png/);
    await sl(1200); await arm(pg, 2, false);
    const fb = await pg.evaluate(async () => { const S = ART.S; const pool = ART.director.pool('attack').some(v => v.type === 'dog'); let done = null; ART.art.scare('attack', () => { done = 1; }, 'at-dog'); const t0 = performance.now(); let artShown = false; while (done === null && performance.now() - t0 < 9000) { if (document.getElementById('artRun').style.opacity === '1' || document.getElementById('art').classList.contains('show')) artShown = true; await new Promise(r => setTimeout(r, 40)); } return { pool, done, artShown, dogLayer: document.getElementById('dogLayer').className }; });
    T('image 404: dog excluded from the pool; forced dog payoff falls back to Art run', !fb.pool && fb.done === 1 && fb.artShown && fb.dogLayer === '', JSON.stringify(fb));
    T('image 404: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  console.log(R.join('\n')); const f = R.filter(x => x.startsWith('FAIL')).length; console.log(`dog: ${R.length - f}/${R.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
