/* Door grab: none on night 1, needs door shut, win by mashing, lose by idling (500 ms silence then door wrenched open + face), no stacking, cooldown/cap, night-restart abort.  node tests/grab.js <url> <shotDir> */
const fs = require('fs'), { open, arm, sl } = require('./_h'); const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const fast = () => { const c = ART.CFG.grab; c.chance = [1, 1, 1, 1, 1]; c.cooldownSec = [0, 0, 0, 0, 0]; c.perNightMax = [9, 9, 9, 9, 9]; c.checkSec = 1; c.minT = 1; c.limitSec = [0, 4, 4, 4, 4]; c.pullPerSec = [0, 0.35, 0.35, 0.35, 0.35]; };
const hook = () => { const A = ART.A, d = A.duckTo, sl_ = A.grabSlam, now = () => performance.now(); window.__tl = []; A.duckTo = function (v) { if (v === 0) window.__tl.push(['silence', now()]); return d.apply(A, arguments); }; A.grabSlam = function (w) { window.__tl.push([w ? 'win' : 'lose', now()]); return sl_.apply(A, arguments); }; };
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const { b, pg, errs } = await open(URL0); await pg.evaluate('window.__fast = ' + fast.toString());
  T('manifest: game.grab present + per-night arrays', await pg.evaluate(() => { const c = ART.CFG.grab; return !!c && c.enabled && Array.isArray(c.chance) && c.chance[0] === 0 && c.cooldownSec.length >= 5; }));
  await arm(pg, 1, true);
  const n1 = await pg.evaluate(fast).then(() => pg.evaluate(() => { let f = 0; for (let i = 0; i < 80; i++) { ART.grab.tick(1); if (ART.grab.active()) f++; } return { f, forced: ART.grab.start(true) }; }));
  T('night 1: no door grab (ticks + forced start)', n1.f === 0 && n1.forced === false, JSON.stringify(n1));
  await arm(pg, 2, false);
  T('door open: grab never starts', await pg.evaluate(() => { for (let i = 0; i < 60; i++) ART.grab.tick(1); return !ART.grab.active() && ART.grab.start() === false; }));
  await arm(pg, 2, true); await pg.evaluate(() => { ART.ui.openMonitor(); for (let i = 0; i < 60; i++) ART.grab.tick(1); });
  T('monitor open: odds never roll', await pg.evaluate(() => !ART.grab.active()));
  /* WIN */
  await arm(pg, 2, true); await pg.evaluate(hook); await pg.evaluate(() => { window.__fast(); ART.CFG.grab.startProgress = 0.6; ART.CFG.grab.pullPerSec = [0, 0.12, 0.12, 0.12, 0.12]; });
  const w = await pg.evaluate(async () => { const S = ART.S, rec = { ok: ART.grab.start(), on: S.grabOn, busy: S.scareBusy };
    rec.stack = [ART.art.scare('peek'), ART.art.feedScare(), (ART.nights.toggleDoor && (ART.nights.toggleDoor(), S.door))];
    await new Promise(r => setTimeout(r, 700)); rec.jitter = document.body.classList.contains('grabbing'); rec.led = document.getElementById('btnDoor').classList.contains('grab');
    const t0 = performance.now(); while (ART.grab.active() && performance.now() - t0 < 6000) { ART.grab.press(); ART.grab.lift(); await new Promise(r => setTimeout(r, 90)); }
    rec.took = performance.now() - t0; await new Promise(r => setTimeout(r, 1300));
    rec.after = { on: S.grabOn, busy: S.scareBusy, door: S.door, grabbing: document.body.classList.contains('grabbing'), led: document.getElementById('btnDoor').classList.contains('grab'), res: S.grabResult }; rec.tl = window.__tl; return rec; });
  const tv = (r, k) => (r.tl.find(x => x[0] === k) || [])[1];
  T('grab started on night 2 with door shut', w.ok === true && w.on === true && w.busy === true);
  T('BEAT 1: door jitter class + LED pulse while grabbed', w.jitter && w.led);
  T('no stacking: peek scare, feed scare and door toggle all refused during a grab', w.stack[0] == null && w.stack[1] === false && w.stack[2] === true, JSON.stringify(w.stack));
  T('mashing wins before the timeout', w.after.res === 'win' && w.took < 4000, JSON.stringify([w.after.res, Math.round(w.took)]));
  T('BEAT 2/3: >= 495 ms silence before the win slam', tv(w, 'silence') && tv(w, 'win') && tv(w, 'win') - tv(w, 'silence') >= 495, String(tv(w, 'win') - tv(w, 'silence')));
  T('win: door still held, released (not busy, classes cleared)', w.after.door === true && !w.after.on && !w.after.busy && !w.after.grabbing && !w.after.led, JSON.stringify(w.after));
  /* real touch mashing */
  await arm(pg, 3, true); await pg.evaluate(() => { ART.CFG.grab.pullPerSec = [0, 0, 0.05, 0.05, 0.05]; ART.CFG.grab.startProgress = 0.2; ART.grab.start(); });
  for (let i = 0; i < 6; i++) { await pg.touchscreen.tap(195, 420); await sl(70); }
  T('real touch taps register as pushes', await pg.evaluate(() => { const s = ART.grab.state(); return s && s.taps >= 5; }));
  /* LOSE */
  await arm(pg, 2, true); await pg.evaluate(hook); await pg.evaluate(() => { ART.CFG.grab.losePowerPct = 4; ART.CFG.grab.startProgress = 0.2; ART.CFG.grab.pullPerSec = [0, 0.4, 0.4, 0.4, 0.4]; });
  const lp = pg.evaluate(async () => { const S = ART.S, rec = { pw0: S.power }; ART.grab.start(); const t0 = performance.now(); while (ART.grab.active() && performance.now() - t0 < 9000) await new Promise(r => setTimeout(r, 80)); rec.took = performance.now() - t0;
    await new Promise(r => setTimeout(r, 650)); const e = document.getElementById('feedPop'), r = e.getBoundingClientRect(); rec.pop = { cls: e.className, w: r.width, h: r.height }; rec.door = S.door; rec.tl = window.__tl; await new Promise(r => setTimeout(r, 1500));
    rec.after = { on: S.grabOn, busy: S.scareBusy, res: S.grabResult, cls: e.className, pw: S.power }; return rec; });
  await sl(5800); await pg.screenshot({ path: SHOTS + '/grab-lose-face.png' }); const l = await lp;
  T('idle: grab lost', l.after.res === 'lose', JSON.stringify([l.after.res, Math.round(l.took)]));
  T('BEAT 2/3: >= 495 ms silence before the wrench-open', tv(l, 'silence') && tv(l, 'lose') && tv(l, 'lose') - tv(l, 'silence') >= 495, String(tv(l, 'lose') - tv(l, 'silence')));
  T('lose: door wrenched open + face fills the screen', l.door === false && l.pop.cls === 'show' && l.pop.w >= 385 && l.pop.h >= 840, JSON.stringify(l.pop));
  T('lose: released afterwards (not busy, pop hidden)', !l.after.on && !l.after.busy && l.after.cls === '', JSON.stringify(l.after));
  /* cooldown + cap through ticks */
  await arm(pg, 2, true); const cc = await pg.evaluate(async () => { window.__fast(); const c = ART.CFG.grab; c.cooldownSec = [0, 40, 0, 0, 0]; c.perNightMax = [9, 1, 9, 9, 9]; const S = ART.S; let st = 0;
    for (let i = 0; i < 12; i++) { ART.grab.tick(1.2); if (ART.grab.active() && !st) { st = 1; } if (ART.grab.active()) { const t0 = performance.now(); while (ART.grab.active() && performance.now() - t0 < 7000) { ART.grab.press(); await new Promise(r => setTimeout(r, 40)); } await new Promise(r => setTimeout(r, 1500)); S.door = true; } }
    return { n: S.grabN }; });
  T('cooldown / cap: exactly 1 grab in 12 rolls at chance 1 (cap 1)', cc.n === 1, JSON.stringify(cc));
  /* restart abort */
  await arm(pg, 2, true); const ab = await pg.evaluate(async () => { ART.grab.start(); await new Promise(r => setTimeout(r, 500)); ART.nights.start(2); await new Promise(r => setTimeout(r, 600)); const S = ART.S; return { act: ART.grab.active(), on: S.grabOn, busy: S.scareBusy, g: document.body.classList.contains('grabbing') }; });
  T('night restart mid-grab aborts cleanly', !ab.act && !ab.on && !ab.busy && !ab.g, JSON.stringify(ab));
  T('grab: no page errors', errs.length === 0, errs.join('|')); await b.close();
  console.log(R.join('\n')); const f = R.filter(x => x.startsWith('FAIL')).length; console.log(`grab: ${R.length - f}/${R.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
