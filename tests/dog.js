/* Dog EASTER EGG (user-supplied photo cut-out): a rare MOCKING pop after a mistake, not a fail scare. Asset budget; config in easter-eggs.json; no dog in the failScare/attack pool;
   empty video.dogAttack slot; off in test mode; ~1/12 odds + never twice in a row + cooldown + per-night cap; hooks (wrong input, puzzle fail, dead-power door, grab lose, caught);
   3 beats (cue, >= 495 ms silence, small corner pop + bob + snicker, ~1.2 s, leaves); never full-screen; image 404 -> no pop, no errors.   node tests/dog.js <url> <shotDir> */
const fs = require('fs'), { open, arm, sl } = require('./_h'); const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const ROOT = __dirname + '/../';
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const png = fs.readFileSync(ROOT + 'assets/art/dog.png'); const w = png.readUInt32BE(16), h = png.readUInt32BE(20), ct = png[25];
  T('asset: dog.png is a PNG <= 250 KB, ~640 px wide, with alpha', png.slice(1, 4).toString() === 'PNG' && png.length <= 250 * 1024 && w >= 600 && w <= 680 && (ct === 6 || png.includes('tRNS')), `${png.length}B ${w}x${h} ct${ct}`);
  const eg = JSON.parse(fs.readFileSync(ROOT + 'assets/easter-eggs.json', 'utf8')), mf = JSON.parse(fs.readFileSync(ROOT + 'assets/manifest.json', 'utf8'));
  const d = eg.dogEgg || {};
  T('easter-eggs.json dogEgg: enabled, chance ~1/12, cooldown, per-night cap, triggers, holdMs ~1200, silence 500, documented in _schema', d.enabled === true && Math.abs(d.chance - 1 / 12) < 0.01 && d.cooldownSec > 0 && d.maxPerNight >= 1 && d.triggers && d.triggers.puzzleWrong && d.triggers.caught && d.holdMs >= 1000 && d.holdMs <= 1500 && d.silenceMs === 500 && !!eg._schema['dogEgg.chance'] && !!eg._schema['dogEgg.triggers']);
  const atk = mf.game.scares.variants.attack;
  T('picture is NOT a fail scare: no failScare block, no dog variant in any pool', !mf.game.failScare && !JSON.stringify(mf.game.scares).includes('"dog"') && atk.length > 0);
  const slot = (mf.game.video || mf.video).dogAttack;
  T('empty video.dogAttack slot: disabled, and no file shipped yet', slot && slot.enabled === false && /dog-attack/.test(slot.src) && !fs.existsSync(ROOT + slot.src));
  const app = fs.readFileSync(ROOT + 'js/art.js', 'utf8') + fs.readFileSync(ROOT + 'js/director.js', 'utf8');
  T('no lunge wired from the picture (no dog payoff in art.js / director.js)', !/dogLunge|PAYOFF\.dog|dog: function/.test(app) && !/lunge/i.test(fs.readFileSync(ROOT + 'js/dogegg.js', 'utf8').replace(/never lunges/, '')));
  /* default test mode: off */
  { const { b, pg, errs } = await open(URL0);
    T('?fast / ?novideo test mode keeps the dog off (suites stay deterministic)', await pg.evaluate(() => { ART.eggs.dogCfg().chance = 1; ART.eggs.dogCfg().cooldownSec = 0; let n = 0; for (let i = 0; i < 20; i++) if (ART.dogEgg.mistake('puzzleWrong')) n++; return !ART.dogEgg.enabled() && n === 0; })); await b.close(); }
  /* enabled */
  { const { b, pg, errs } = await open(URL0, '&dog=1');
    await pg.waitForFunction(() => ART.dogEgg.ready(), { timeout: 10000 }).catch(() => {});
    T('dog image preloaded in the background, #dogPop has the src', await pg.evaluate(() => ART.dogEgg.ready() && /dog\.png/.test(document.getElementById('dogPop').src)));
    /* odds + never twice in a row + cooldown + cap (play stubbed) */
    const od = await pg.evaluate(() => {
      const D = ART.dogEgg, c = ART.eggs.dogCfg(), S = ART.S; S.phase = 'play'; S.scareBusy = false; S.night = 2; c.cooldownSec = 0; c.maxPerNight = 99999; const seq = []; let plays = 0; const orig = D.play; D.play = function () { plays++; seq.push(1); return true; };
      for (let i = 0; i < 1500; i++) { const before = plays; D.mistake('puzzleWrong'); if (plays === before) seq.push(0); }
      let adj = 0; for (let i = 1; i < seq.length; i++) if (seq[i] && seq[i - 1]) adj++;
      D.play = orig; return { plays, adj, chance: c.chance };
    });
    T('rare: ~1 in 12 eligible mistakes (50-140 of 1500) and never two pops back to back', od.plays >= 50 && od.plays <= 140 && od.adj === 0, JSON.stringify(od));
    const cg = await pg.evaluate(() => {
      const D = ART.dogEgg, c = ART.eggs.dogCfg(), S = ART.S; D.resetSession(); c.chance = 1; const orig = D.play; let n = 0; D.play = function () { n++; return true; };
      c.cooldownSec = 0; c.maxPerNight = 2; S.night = 3; const a = [D.mistake('caught') /*not over*/, D.mistake('puzzleWrong'), D.mistake('puzzleWrong'), D.mistake('puzzleWrong'), D.mistake('puzzleWrong')]; // 1st plays, 2nd skipped (twice-in-a-row), 3rd plays, 4th skipped, 5th capped
      const cap = n; D.play = orig; D.resetSession(); c.cooldownSec = 600; c.maxPerNight = 9; D.play = function () { D.lastDummy = 1; return true; }; const t0 = performance.now(); const b = [D.mistake('puzzleWrong')]; // state only changes in the real play(); emulate by marking lastAt
      D.play = orig; return { a, cap, b };
    });
    T('per-night cap honoured and every other eligible mistake skipped after a pop', cg.cap === 2 && cg.a[1] === true && cg.a[2] === false && cg.a[3] === true && cg.a[4] === false, JSON.stringify(cg));
    /* triggers: disabled kinds never play; other phases never play */
    const tr = await pg.evaluate(() => { const D = ART.dogEgg, c = ART.eggs.dogCfg(), S = ART.S; D.resetSession(); c.chance = 1; c.cooldownSec = 0; c.maxPerNight = 99; S.night = 2; S.phase = 'play'; S.scareBusy = false; let n = 0; const o = D.play; D.play = () => { n++; return true; };
      const off = D.mistake('notATrigger'); c.triggers.doorFail = false; const dis = D.mistake('doorFail'); c.triggers.doorFail = true; S.scareBusy = true; const busy = D.mistake('puzzleWrong'); S.scareBusy = false; S.phase = 'lore'; const lore = D.mistake('puzzleWrong'); S.phase = 'play'; S.night = 1; c.minNight = 2; const early = D.mistake('puzzleWrong'); c.minNight = 1; D.play = o; return { off, dis, busy, lore, early, n }; });
    T('no pop for unknown / disabled triggers, during a scare, outside play, or before minNight', !tr.off && !tr.dis && !tr.busy && !tr.lore && !tr.early && tr.n === 0, JSON.stringify(tr));
    /* the 3 beats, real play() */
    await arm(pg, 2, false);
    const run = pg.evaluate(async () => {
      const S = ART.S, A = ART.A, D = ART.dogEgg, c = ART.eggs.dogCfg(), rec = { tl: [], samples: [] }, now = () => performance.now(), L = document.getElementById('dogPop'), dk = A.duckTo, sn = A.dogSnicker;
      D.resetSession(); c.chance = 1; c.cooldownSec = 0; c.maxPerNight = 9; c.pos = 'bottom-right';
      A.duckTo = function (v) { if (v === 0) rec.tl.push(['silence', now()]); return dk.apply(A, arguments); }; A.dogSnicker = function () { rec.tl.push(['snicker', now()]); return sn.apply(A, arguments); };
      const t0 = now(); rec.t0 = t0; rec.fired = D.mistake('puzzleWrong'); const iv = setInterval(() => { const cs = getComputedStyle(L); if (L.classList.contains('go')) { const r = L.getBoundingClientRect(); rec.samples.push({ t: now(), w: r.width, h: r.height, l: r.left, r: r.right, b: r.bottom, rot: cs.rotate, op: cs.opacity, pos: cs.position }); } }, 40);
      await new Promise(r => setTimeout(r, 3200)); clearInterval(iv); rec.after = { cls: L.className, vis: getComputedStyle(L).visibility, busy: D.state().busy }; A.duckTo = dk; A.dogSnicker = sn; return rec; });
    await sl(1500); await pg.screenshot({ path: SHOTS + '/dog-egg-payoff.png' });
    const r = await run, t = k => (r.tl.find(x => x[0] === k) || [])[1], s = r.samples, big = s.reduce((m, x) => Math.max(m, x.h), 0), dur = s.length ? s[s.length - 1].t - s[0].t : 0;
    T('trigger fired the real play()', r.fired === true);
    T('BEAT 2: >= 495 ms silence before the pop / snicker (and cue before it)', t('silence') && t('snicker') && t('snicker') - t('silence') >= 495 && t('silence') - r.t0 >= 100, JSON.stringify([t('silence') && Math.round(t('silence') - r.t0), t('snicker') && Math.round(t('snicker') - t('silence'))]));
    T('BEAT 3: small cheeky pop in the bottom-right corner (<= 55% width, <= 40% height incl. tilt, not full screen)', s.length > 3 && s.every(x => x.w <= 390 * 0.55 && x.h <= 844 * 0.4 && x.pos === 'fixed') && s[s.length - 1].r > 390 * 0.5 && s[s.length - 1].b > 844 * 0.8, JSON.stringify([big, s.length && Math.round(s[s.length - 1].w)]));
    T('stays ~1.2 s then leaves (visible 1.0-1.9 s), head bobs / tilts', dur >= 1000 && dur <= 1900 && new Set(s.map(x => x.rot)).size > 3, JSON.stringify([Math.round(dur), new Set(s.map(x => x.rot)).size]));
    T('synthesized snicker fired once; layer cleaned up afterwards', r.tl.filter(x => x[0] === 'snicker').length === 1 && r.after.cls === '' && r.after.vis === 'hidden' && r.after.busy === false, JSON.stringify(r.after));
    /* hooks (record the kind each real game path reports) */
    const hk = await pg.evaluate(async () => {
      const D = ART.dogEgg, S = ART.S, rec = []; const o = D.mistake; D.mistake = k => { rec.push(k); return false; };
      await new Promise(r => setTimeout(r, 300)); ART.nights.start(2); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; S.power = 60; S.cool = {};
      __game.CFG.puzzles.hotspots.fusebox.types = ['keypad', 'keypad', 'keypad', 'keypad', 'keypad']; ART.puzzles.refresh(); ART.puzzles.open('fusebox'); await new Promise(r => setTimeout(r, 300));
      const code = S.puzzle.ctl.solution(), bad = code.split('').map(c => String((+c + 1) % 10)); for (const c of bad) document.querySelector('.pz-key[data-k="' + c + '"]').click(); await new Promise(r => setTimeout(r, 800));
      const wrong = rec.slice(); ART.puzzles.close(true); S.puzzle = null; ART.puzzles.fail('fusebox', 'time'); const pf = rec.slice(wrong.length);
      S.phase = 'play'; S.powerDead = true; S.scareBusy = false; S.puzzle = null; ART.nights.toggleDoor(); const df = rec.slice(wrong.length + pf.length); S.powerDead = false;
      ART.nights.gameOver('test'); await new Promise(r => setTimeout(r, 1100)); const cg = rec.slice(wrong.length + pf.length + df.length); D.mistake = o; return { wrong, pf, df, cg }; });
    T('hooks: wrong input -> puzzleWrong, puzzle fail -> puzzleFail, dead-power door press -> doorFail, game over -> caught', hk.wrong.includes('puzzleWrong') && hk.pf.includes('puzzleFail') && hk.df.includes('doorFail') && hk.cg.includes('caught'), JSON.stringify(hk));
    /* grab lose reports grabLose */
    await pg.evaluate(() => { const c = ART.CFG.grab; c.chance = [1, 1, 1, 1, 1]; c.cooldownSec = [0, 0, 0, 0, 0]; c.perNightMax = [9, 9, 9, 9, 9]; c.checkSec = 1; c.minT = 1; c.limitSec = [0, 4, 4, 4, 4]; c.startProgress = 0.2; c.pullPerSec = [0, 0.4, 0.4, 0.4, 0.4]; });
    await arm(pg, 2, true);
    const gl = await pg.evaluate(async () => { const D = ART.dogEgg, rec = []; D.mistake = k => { rec.push(k); return false; }; ART.grab.start(); const t0 = performance.now(); while (ART.grab.active() && performance.now() - t0 < 9000) await new Promise(r => setTimeout(r, 80)); await new Promise(r => setTimeout(r, 3200)); return rec; });
    T('hooks: losing the door grab -> grabLose', gl.includes('grabLose'), JSON.stringify(gl));
    /* mistake after a night restart: nothing stuck on screen */
    T('new night clears any pop in flight', await pg.evaluate(async () => { const D = ART.dogEgg; D.resetSession(); ART.eggs.dogCfg().chance = 1; D.mistake = ART.dogEgg.__m || D.mistake; ART.nights.start(3); await new Promise(r => setTimeout(r, 300)); const L = document.getElementById('dogPop'); return L.className === '' && !D.state().busy; }));
    T('dog egg: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  /* image missing -> no pop, no crash */
  { const { b, pg, errs } = await open(URL0, '&dog=1', /assets\/art\/dog\.png/);
    await sl(1200); await arm(pg, 2, false);
    const fb = await pg.evaluate(() => { const D = ART.dogEgg; ART.eggs.dogCfg().chance = 1; ART.eggs.dogCfg().cooldownSec = 0; let n = 0; for (let i = 0; i < 20; i++) if (D.mistake('puzzleWrong')) n++; return { ready: D.ready(), n, cls: document.getElementById('dogPop').className }; });
    T('image 404: egg silently skipped, nothing on screen, game continues', !fb.ready && fb.n === 0 && fb.cls === '', JSON.stringify(fb));
    T('image 404: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  console.log(R.join('\n')); const f = R.filter(x => x.startsWith('FAIL')).length; console.log(`dog: ${R.length - f}/${R.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
