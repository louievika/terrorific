/* Hard puzzles: ledger (deduction, unique solution from the true fragments, misleading fragments), music box (growing tune, reshuffle),
   multi-stage hotspots, time pressure (burning fuse -> Art arrives), strikes + power drain, per-night scaling, no hand-holding text.
   node tests/hardpuz.js <url> <shotDir> */
const p = require('puppeteer-core'), fs = require('fs'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL0 + '?fast=1', { waitUntil: 'load' }); await sl(3000);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); });
  await pg.tap('#authBtn'); await sl(1800);
  const ev = (f, ...a) => pg.evaluate(f, ...a);
  const night = async n => { await ev(n => { ART.nights.start(n); }, n); await sl(500); await ev(() => { const S = ART.S; S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; S.cool = {}; S.puzzleFails = 0; S.power = 60; ART.puzzles.close(true); }); };

  /* ---- A. ledger: generator invariants, every night, many seeds ---- */
  for (const n of [1, 2, 3, 4, 5]) {
    const r = await ev(n => { const out = { bad: 0, liars: 0, scraps: 0, digits: 0 }; const o = ART.puzzles.opts('ledger', n);
      for (let i = 0; i < 25; i++) { const root = document.createElement('div'); let f = 0; const c = ART.puzzles.create('ledger', root, o, { tap() {}, failed() { f++; }, solved() {} }); const inf = c.info();
        if (inf.consistent !== 1) out.bad++; out.liars = inf.liars; out.scraps = Math.max(out.scraps, inf.scraps); out.digits = inf.secret.length; if (c.solution() !== inf.secret) out.bad++; c.destroy(); }
      out.o = o; return out; }, n);
    T('ledger night ' + n + ': the true fragments pin down exactly ONE code (25 seeds)', r.bad === 0, JSON.stringify(r));
    T('ledger night ' + n + ': ' + r.digits + ' digits, ' + r.liars + ' misleading fragment(s)', r.digits === [3, 3, 4, 4, 5][n - 1] && r.liars === [0, 1, 1, 2, 2][n - 1]);
  }
  const sc = await ev(() => [1, 2, 3, 4, 5].map(n => { const o = ART.puzzles.opts('ledger', n), h = ART.CFG.puzzles.hotspots.fusebox; return [o.digits, o.liars, ART.puzzles.limit('fusebox', n, 'timeSec'), ART.puzzles.limit('fusebox', n, 'strikes')]; }));
  T('difficulty scales by night (digits and liars never drop; strikes shrink; time set from night 3)', sc.every((r, i) => !i || (r[0] >= sc[i - 1][0] && r[1] >= sc[i - 1][1])) && sc[2][2] > 0 && sc[4][3] < sc[2][3], JSON.stringify(sc));

  /* ---- B. ledger through the real panel: wrong code = strike (power cost), right code solves ---- */
  await night(3); await ev(() => { const h = ART.CFG.puzzles.hotspots.fusebox; h.types = ['ledger', 'ledger', 'ledger', 'ledger', 'ledger']; h.timeSec = [0, 0, 0, 0, 0]; ART.puzzles.refresh(); });
  await ev(() => ART.puzzles.open('fusebox')); await sl(300);
  await pg.screenshot({ path: SHOTS + '/f-puzzle-ledger.png' });
  const dom = await ev(() => ({ scraps: document.querySelectorAll('.pz-scrap').length, txt: document.getElementById('puzzleCard').innerText, srcs: [...document.querySelectorAll('.pz-scrap')].map(e => e.dataset.src) }));
  T('ledger shows torn lore scraps from several sources', dom.scraps >= 4 && new Set(dom.srcs).size >= 3, dom.scraps + ' ' + [...new Set(dom.srcs)]);
  T('no hand-holding: panel text has no hint/help/tip/tutorial wording', !/hint|help|tip\b|tutorial|how to|click/i.test(dom.txt));
  const p0 = await ev(() => ART.S.power);
  const wrong = await ev(async () => { const sol = ART.S.puzzle.ctl.solution(), bad = sol.split('').map((c, i) => i ? c : String((+c + 1) % 10)).join(''); for (const c of bad) document.querySelector('.pz-key[data-k="' + c + '"]').click(); await new Promise(r => setTimeout(r, 200)); return { p: ART.S.power, st: ART.S.puzzle && ART.S.puzzle.strikes, open: !!ART.S.puzzle }; });
  T('wrong ledger code: strike counted, power drained (night 3), panel stays', wrong.open && wrong.st === 1 && wrong.p < p0 - 1, JSON.stringify(wrong) + ' p0=' + p0);
  await sl(600);
  const right = await ev(async () => { const sol = ART.S.puzzle.ctl.solution(); for (const c of sol) document.querySelector('.pz-key[data-k="' + c + '"]').click(); await new Promise(r => setTimeout(r, 1000)); return { open: !!ART.S.puzzle, cool: ART.S.cool.fusebox }; });
  T('right ledger code solves it (panel closes, cooldown)', !right.open && right.cool > 0, JSON.stringify(right));

  /* ---- C. music box: tune grows, only works after playback, wrong pad restarts the round, reshuffles ---- */
  await night(3); await ev(() => { const h = ART.CFG.puzzles.hotspots.fusebox; h.types = ['musicbox', 'musicbox', 'musicbox', 'musicbox', 'musicbox']; h.timeSec = [0, 0, 0, 0, 0]; h.strikes = [0, 0, 0, 0, 0]; ART.CFG.puzzles.musicbox.length = [3, 3, 3, 3, 3]; ART.CFG.puzzles.musicbox.stepMs = [200, 200, 200, 200, 200]; ART.puzzles.refresh(); });
  await ev(() => ART.puzzles.open('fusebox')); await sl(250);
  const early = await ev(() => { const b = document.querySelector('.pz-mb'); b.click(); return { in: document.querySelector('.pz-mbgrid').classList.contains('in'), st: ART.S.puzzle.ctl.state() }; });
  T('music box ignores taps while the tune is playing', !early.in && early.st.pos === 0, JSON.stringify(early));
  await pg.screenshot({ path: SHOTS + '/f-puzzle-musicbox.png' });
  const mb = await ev(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms)), ctl = ART.S.puzzle.ctl, seq = ctl.solution(), rounds = [], orders = [];
    const ready = async () => { for (let i = 0; i < 80 && !ctl.state().ready; i++) await w(100); return ctl.state().ready; };
    await ready(); const wrongN = (seq[0] + 1) % 4; document.querySelector('.pz-mb[data-n="' + wrongN + '"]').click(); await w(300);
    const afterWrong = { in: document.querySelector('.pz-mbgrid').classList.contains('in'), strikes: ART.S.puzzle.strikes, round: ctl.state().round };
    for (let r = 1; r <= seq.length; r++) { if (!(await ready())) return { err: 'not ready round ' + r, rounds }; orders.push([...document.querySelectorAll('.pz-mb')].map(e => e.style.order + ':' + e.dataset.n).join(','));
      for (let k = 0; k < r; k++) document.querySelector('.pz-mb[data-n="' + seq[k] + '"]').click(); rounds.push(r); await w(80); }
    await w(900); return { afterWrong, rounds, open: !!ART.S.puzzle, orders, seq };
  });
  T('music box: wrong pad is a strike and replays (round stays 1)', mb.afterWrong && !mb.afterWrong.in && mb.afterWrong.strikes === 1 && mb.afterWrong.round === 1, JSON.stringify(mb.afterWrong));
  T('music box: solved by repeating the growing tune round by round', mb.rounds && mb.rounds.length === 3 && mb.open === false, JSON.stringify(mb.rounds) + ' open=' + mb.open);
  T('music box: pads re-order between rounds', mb.orders && new Set(mb.orders).size > 1, JSON.stringify(mb.orders));

  /* ---- D. multi-stage hotspot: every stage in order, effect only at the end ---- */
  await night(4); await ev(() => { const h = ART.CFG.puzzles.hotspots.fusebox; h.types = [['keypad', 'tiles'], ['keypad', 'tiles'], ['keypad', 'tiles'], ['keypad', 'tiles'], ['keypad', 'tiles']]; h.timeSec = [0, 0, 0, 0, 0]; ART.puzzles.refresh(); ART.S.power = 40; });
  await ev(() => ART.puzzles.open('fusebox')); await sl(200);
  const st1 = await ev(async () => { const S = ART.S, pz = S.puzzle, a = { stages: pz.stages, type: pz.type }; for (const c of pz.ctl.solution()) document.querySelector('.pz-key[data-k="' + c + '"]').click(); await new Promise(r => setTimeout(r, 900)); a.after = { type: S.puzzle && S.puzzle.type, stage: S.puzzle && S.puzzle.stage, power: S.power }; return a; });
  T('multi-stage: stage 1 (keypad) advances to stage 2 (tiles), no reward yet', st1.stages === 2 && st1.type === 'keypad' && st1.after.type === 'tiles' && st1.after.stage === 1 && st1.after.power <= 41, JSON.stringify(st1));
  const st2 = await ev(async () => { const S = ART.S, sol = S.puzzle.ctl.solution(); sol.forEach(c => document.querySelector('.pz-tile[data-i="' + c + '"]').click()); await new Promise(r => setTimeout(r, 1000)); return { open: !!S.puzzle, power: S.power }; });
  T('multi-stage: final stage grants the effect (+25% power)', !st2.open && st2.power >= 64, JSON.stringify(st2));

  /* ---- E. strikes: too many wrong answers = the panel bites back ---- */
  await night(4); await ev(() => { const h = ART.CFG.puzzles.hotspots.fusebox; h.types = ['keypad', 'keypad', 'keypad', 'keypad', 'keypad']; h.timeSec = [0, 0, 0, 0, 0]; h.strikes = [2, 2, 2, 2, 2]; h.wrongPowerPct = [3, 3, 3, 3, 3]; h.failScare = [1, 1, 1, 1, 1]; ART.puzzles.refresh(); ART.S.power = 50; ART.S.peeks = []; });
  await ev(() => ART.puzzles.open('fusebox')); await sl(200);
  await ev(async () => { for (let r = 0; r < 2; r++) { const sol = ART.S.puzzle && ART.S.puzzle.ctl.solution(); if (!sol) break; for (const c of sol.split('').map(d => String((+d + 1) % 10))) document.querySelector('.pz-key[data-k="' + c + '"]').click(); await new Promise(r => setTimeout(r, 700)); } });
  await sl(500);
  const sf = await ev(() => ({ open: !!ART.S.puzzle, fails: ART.S.puzzleFails, cool: ART.S.cool.fusebox, power: ART.S.power, peek: ART.S.peeks[0] != null ? ART.S.peeks[0] - ART.S.t : null }));
  T('2 strikes: panel slams shut, lockout cooldown, power drained, Art scheduled to arrive soon', !sf.open && sf.fails === 1 && sf.cool > 0 && sf.power < 46 && sf.peek != null && sf.peek < 5, JSON.stringify(sf));

  /* ---- F. time pressure: the fuse burns, no numbers; run out => failure + Art ---- */
  await night(3); await ev(() => { const h = ART.CFG.puzzles.hotspots.fusebox; h.types = ['ledger', 'ledger', 'ledger', 'ledger', 'ledger']; h.timeSec = [3, 3, 3, 3, 3]; h.strikes = [0, 0, 0, 0, 0]; h.failScare = [1, 1, 1, 1, 1]; ART.puzzles.refresh(); ART.S.power = 50; ART.S.peeks = []; });
  await ev(() => ART.puzzles.open('fusebox')); await sl(1200);
  const fuse = await ev(() => { const f = document.querySelector('.pz-fuse'); return f ? { burn: f.style.getPropertyValue('--burn'), txt: f.textContent } : null; });
  await pg.screenshot({ path: SHOTS + '/f-puzzle-fuse.png' });
  T('a burning fuse shows the time (no digits/numbers on it)', fuse && parseFloat(fuse.burn) < 95 && fuse.txt === '', JSON.stringify(fuse));
  await sl(2600);
  const to = await ev(() => ({ open: !!ART.S.puzzle, fails: ART.S.puzzleFails, cool: ART.S.cool.fusebox, power: ART.S.power, peek: ART.S.peeks[0] != null ? ART.S.peeks[0] - ART.S.t : null }));
  T('time runs out: puzzle fails, lockout, Art scheduled', !to.open && to.fails === 1 && to.cool > 0 && to.peek != null && to.peek < 5, JSON.stringify(to));

  /* ---- G. night 1 stays gentle: no fuse, no strikes ---- */
  const g = await ev(async () => { const m = await (await fetch('assets/manifest.json')).json(), H = m.game.puzzles.hotspots, out = {};
    for (const id of ['fusebox', 'doorbolt']) out[id] = { t: H[id].timeSec[0], s: H[id].strikes[0], w: H[id].wrongPowerPct[0], f: H[id].failScare[0], ty: H[id].types[0], late: H[id].timeSec[4] }; return out; });
  T('shipped manifest: night 1 untimed, no strikes, no penalty, single-stage; night 5 timed', g.fusebox.t === 0 && g.fusebox.s === 0 && g.fusebox.w === 0 && g.fusebox.f === 0 && typeof g.fusebox.ty === 'string' && g.fusebox.late > 0 && g.doorbolt.t === 0, JSON.stringify(g));
  T('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(R.join('\n')); const f = R.filter(x => x.startsWith('FAIL')).length; console.log('HARD PUZZLE TESTS: ' + (R.length - f) + '/' + R.length + ' pass'); process.exit(f ? 1 : 0);
})();
