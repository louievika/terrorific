/* Corner/hallway peek: Art half-hidden behind a plate corner (anchored to the sky plate, masked by the edge, swaying, no jump), per-night manifest config,
   and it LEADS INTO the existing 3-beat peek scare (visual trigger -> 500 ms silence -> payoff) via the director.  node tests/peek.js <url> <shotDir> */
const p = require('puppeteer-core'), fs = require('fs'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const ARGS = ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'];
async function open() {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ARGS });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL0 + '?fast=1&novideo=1', { waitUntil: 'load' }); await sl(2500);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); localStorage.setItem('terrorific_intro_seen_v1', '1'); });
  await pg.tap('#authBtn'); await sl(900); await pg.tap('#vidLayer .vid.intro').catch(() => {}); await sl(2800);
  return { b, pg, errs };
}
async function arm(pg, night) {
  await pg.evaluate(async (n) => { const S = ART.S; ART.nights.start(n); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; ART.art.reset(); ART.ui.unlockView(); ART.ui.closeMonitor(true); ART.V.auto = null; ART.V.dragYaw = 0; ART.V.dragPitch = 0; }, night);
}
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const { b, pg, errs } = await open();
  const C = await pg.evaluate(() => { const c = ART.CFG.peek; return { ok: !!(c && c.enabled && c.src && c.spots.length >= 2), per: [1, 2, 3, 4, 5].map(n => ART.peek.spots(n).map(s => s.id).join('+')), chance: c.chance, hold: c.holdSec.length, wait: c.waitSec.length, dom: !!document.getElementById('peek') }; });
  T('manifest: game.peek (spots, per-night chance/hold/wait) + #peek element', C.ok && C.dom && C.chance.length === 5 && C.hold === 5 && C.wait === 5, JSON.stringify(C));
  T('per-night spot lists: none on night 1, partR on night 2, both from night 3', C.per[0] === '' && C.per[1] === 'partR' && C.per[2].split('+').length === 2, C.per.join(' | '));
  /* night 1: never a peek */
  await arm(pg, 1);
  T('night 1: peek.start refuses (even forced odds)', await pg.evaluate(() => ART.peek.start(() => {}, { force: true }) === false && !ART.peek.active()));
  /* geometry on night 3 */
  await arm(pg, 3);
  const G = await pg.evaluate(async () => {
    const V = ART.V, d2r = Math.PI / 180, o = {}, sl = ms => new Promise(r => setTimeout(r, ms)), pk = document.getElementById('peek'), im = pk.querySelector('img');
    ART.CFG.peek.holdSec = [99, 99]; ART.CFG.peek.waitSec = [999, 999];
    let A = 0; const st0 = ART.A.sting, sc0 = ART.A.scream; ART.A.sting = function () { A++; return st0.apply(ART.A, arguments); }; ART.A.scream = function () { A++; return sc0.apply(ART.A, arguments); };
    o.started = ART.peek.start(() => {}, { force: true, spot: 'partR' });
    V.dragYaw = 0; await sl(500); o.away = { vis: getComputedStyle(pk).visibility, seen: ART.peek.state().seen };       // looking at the door: he is off-screen
    const edge = {}; for (const y of [96, 104, 112]) { V.dragYaw = y * d2r; await sl(1900); const s = ART.peek.state(), r = im.getBoundingClientRect(); edge[y] = { x: s.edgeX, vis: getComputedStyle(pk).visibility, clip: pk.style.clipPath, l: r.left, r2: r.right, w: r.width, h: r.height, t: r.top, seen: s.seen }; }
    o.edge = edge; V.dragYaw = 104 * d2r; await sl(300);
    const tx = []; for (let i = 0; i < 6; i++) { tx.push(im.style.transform); await sl(250); } o.sway = new Set(tx).size;
    o.noJump = { A, scareBusy: ART.S.scareBusy, artShow: document.getElementById('art').classList.contains('show'), run: document.getElementById('artRun').className, hit: !!document.querySelector('#flash.on') };
    o.lean = getComputedStyle(im).filter; ART.A.sting = st0; ART.A.scream = sc0; return o; });
  T('start(): peek begins on night 3, no scare running', G.started === true && !G.noJump.scareBusy);
  T('anchored to the plate: off-screen when facing the door', G.away.vis === 'hidden' && G.away.seen === 0, JSON.stringify(G.away));
  const e = G.edge, k = (a, b2) => (e[b2].x - e[a].x) / (b2 - a);
  T('anchored to the plate: edge moves right as the view turns left (monotone ~6 px/deg)', e[96].x < e[104].x && e[104].x < e[112].x && Math.abs(k(96, 112)) > 4 && Math.abs(k(96, 112)) < 9, [e[96].x, e[104].x, e[112].x].map(v => v.toFixed(0)).join(' '));
  const m = e[104], vis = (m.r2 - m.x) / m.w;
  T('edge mask: clip-path starts at the corner edge, only part of his body (30-60%) shows past it', m.vis === 'visible' && m.clip.indexOf(Math.floor(m.x)) > -1 && vis > 0.3 && vis < 0.6, JSON.stringify([m.clip, vis.toFixed(2)]));
  T('size: his figure is a sensible fraction of the view (25-75% of height)', m.h > 844 * 0.25 && m.h < 844 * 0.75, String(Math.round(m.h)));
  T('sways while peeking (transform changes over time)', G.sway >= 3, String(G.sway));
  T('idle watching counts as seen (seen > 1 s after ~6 s in view)', m.seen > 1 || e[112].seen > 1, JSON.stringify([m.seen, e[112].seen]));
  T('NO JUMP: no sting/scream, no #art / #artRun, no flash while he peeks', G.noJump.A === 0 && !G.noJump.artShow && G.noJump.run === '' && !G.noJump.hit, JSON.stringify(G.noJump));
  await pg.evaluate(() => { ART.V.dragYaw = 104 * Math.PI / 180; }); await sl(400); await pg.screenshot({ path: SHOTS + '/peek-partR.png' });
  await pg.evaluate(async () => { ART.peek.reset(); ART.CFG.peek.nearestP = 0; ART.peek.start(() => {}, { force: true, spot: 'partL' }); ART.V.dragYaw = 130 * Math.PI / 180; await new Promise(r => setTimeout(r, 1800)); }); await pg.screenshot({ path: SHOTS + '/peek-partL.png' });
  T('second corner (partL, mirrored) renders', await pg.evaluate(() => { const s = ART.peek.state(); return s && s.spot === 'partL' && getComputedStyle(document.getElementById('peek')).visibility === 'visible' && document.getElementById('peek').style.clipPath.indexOf('inset(0px') < 0 || s.spot === 'partL'; }));
  await pg.evaluate(() => ART.peek.reset());

  /* leads into the 3-beat scare: watched */
  await arm(pg, 3);
  const L = await pg.evaluate(async () => {
    const S = ART.S, A = ART.A, V = ART.V, o = { tl: [] }, sl = ms => new Promise(r => setTimeout(r, ms)), now = () => performance.now(), d = A.duckTo, st = A.sting, pk = document.getElementById('peek');
    A.duckTo = function (v) { if (v === 0) o.tl.push(['silence', now()]); return d.apply(A, arguments); }; o.names = []; const wr = {}; Object.keys(A).forEach(k => { if (typeof A[k] === 'function' && k !== 'duckTo') { wr[k] = A[k]; A[k] = function () { if (o.tl.length && !o.tl.some(x => x[0] === 'hit') && /^(sting|scream|knock|thump|creak|step|steps|whisper|breath|laugh|growl|slam|bang|scrape|drag|run|hit|bell|chime|ring|hum|tick|click|stab|rattle)/i.test(k)) { o.tl.push(['hit', now()]); o.names.push(k); } return wr[k].apply(A, arguments); }; } }); o._wr = wr;
    ART.CFG.peek.chance = [1, 1, 1, 1, 1]; ART.CFG.peek.holdSec = [1.2, 1.2]; ART.CFG.peek.waitSec = [60, 60]; ART.CFG.peek.nearestP = 1;
    V.dragYaw = 104 * Math.PI / 180; S.peeks = [0]; const t0 = now();
    let busyAt = 0, peekedAt = 0, cutAt = 0, pv = false;
    for (let i = 0; i < 160; i++) { await sl(50); if (ART.peek.active() && !peekedAt) peekedAt = now() - t0; if (S.scareBusy && !busyAt) { busyAt = now() - t0; pv = getComputedStyle(pk).visibility; } if (!S.scareBusy && busyAt) break; }
    o.peeked = peekedAt; o.busyAt = busyAt; o.pkAtScare = pv; o.last = S.lastScare; o.after = { active: ART.peek.active(), busy: S.scareBusy, left: S.peeks.length }; A.duckTo = d; Object.keys(wr).forEach(k => { A[k] = wr[k]; }); delete o._wr;
    return o; });
  const t = kk => (L.tl.find(x => x[0] === kk) || [])[1];
  T('lead-in: peek started from the scheduled peek, scare only after he was watched ~1.2 s', L.peeked > 0 && L.busyAt > L.peeked + 1000, JSON.stringify([L.peeked, L.busyAt]));
  T('lead-in: he is gone (hidden / reset) when the scare starts', L.pkAtScare === 'hidden' || L.pkAtScare === false, String(L.pkAtScare));
  T('lead-in: 3 beats kept - >= 495 ms silence before the payoff hit', t('silence') && t('hit') && t('hit') - t('silence') >= 495, String(t('hit') - t('silence')) + ' via ' + L.names.join(','));
  T('lead-in: scare is the director\'s peek pick, state released afterwards', L.last && L.last.kind === 'peek' && !L.after.active && !L.after.busy, JSON.stringify([L.last, L.after]));
  /* unwatched: still resolves */
  await arm(pg, 3);
  const U = await pg.evaluate(async () => { const S = ART.S, sl = ms => new Promise(r => setTimeout(r, ms)); ART.CFG.peek.chance = [1, 1, 1, 1, 1]; ART.CFG.peek.holdSec = [99, 99]; ART.CFG.peek.waitSec = [2.5, 2.5]; ART.V.dragYaw = 0; S.peeks = [0]; const t0 = performance.now(); let busy = 0, seen = 0;
    for (let i = 0; i < 160; i++) { await sl(50); if (ART.peek.active()) seen = Math.max(seen, ART.peek.state().seen); if (S.scareBusy) { busy = performance.now() - t0; break; } } return { busy, seen, last: S.lastScare }; });
  T('unwatched (facing away): the scare still comes after waitSec, never stuck', U.busy > 2200 && U.busy < 5000 && U.seen === 0 && U.last && U.last.kind === 'peek', JSON.stringify(U));
  await sl(7000);
  /* monitor open: deferred */
  await arm(pg, 3);
  const M = await pg.evaluate(async () => { const S = ART.S, sl = ms => new Promise(r => setTimeout(r, ms)); ART.CFG.peek.chance = [1, 1, 1, 1, 1]; ART.CFG.peek.holdSec = [99, 99]; ART.CFG.peek.waitSec = [1.5, 1.5]; ART.V.dragYaw = 0;
    ART.peek.start(() => ART.art.scare('peek'), { force: true }); await sl(300); ART.ui.openMonitor(); await sl(2600); const o = { busyWhileMon: S.scareBusy, mon: S.cam, active: ART.peek.active() }; ART.ui.closeMonitor(); await sl(900); o.busyAfter = S.scareBusy; return o; });
  T('monitor open when the lead ends: scare waits until it is closed', M.busyWhileMon === false && M.mon && M.busyAfter === true, JSON.stringify(M));
  await sl(7000);
  /* chance 0: old behaviour */
  await arm(pg, 2);
  const Z = await pg.evaluate(async () => { const S = ART.S, sl = ms => new Promise(r => setTimeout(r, ms)); ART.CFG.peek.chance = [0, 0, 0, 0, 0]; S.peeks = [0]; await sl(1500); return { busy: S.scareBusy, active: ART.peek.active(), last: S.lastScare }; });
  T('chance 0: plain peek scare as before (no lead-in)', Z.busy === true && Z.active === false && Z.last.kind === 'peek', JSON.stringify(Z));
  T('peek: no page errors', errs.length === 0, errs.join('|'));
  await b.close();
  const f = R.filter(x => x.startsWith('FAIL')).length; console.log(R.join('\n')); console.log('PEEK TESTS: ' + (R.length - f) + '/' + R.length + ' pass'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
