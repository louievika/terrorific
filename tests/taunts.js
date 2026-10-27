/* Taunt sounds (whisper / low laugh / mocking creak): synthesize without errors, none on night 1, gaps/caps/no-repeat, silent during scares and grabs, manifest-driven.  node tests/taunts.js <url> */
const { open, arm, sl } = require('./_h'); const URL0 = process.argv[2] || 'http://localhost:8077/game.html';
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const { b, pg, errs } = await open(URL0);
  T('manifest: game.taunts present with 3 kinds', await pg.evaluate(() => { const c = ART.CFG.taunts; return !!c && c.enabled && c.kinds.map(k => k.id).sort().join() === 'lowLaugh,mockCreak,whisper'; }));
  await arm(pg, 2, false);
  const syn = await pg.evaluate(async () => { const A = ART.A; if (!A.ready) { try { A.init && A.init(); } catch (e) {} } const out = {}; for (const k of A.TAUNT_KINDS || []) { try { out[k] = ART.taunts.play(k, { vol: 0.8 }); } catch (e) { out[k] = 'ERR ' + e.message; } } out.grab = (() => { try { const g = A.grabStart(); g.set(0.8); g.stop(); A.grabSlam(true); A.grabSlam(false); return true; } catch (e) { return 'ERR ' + e.message; } })(); out.ready = A.ready; return out; });
  T('whisper / lowLaugh / mockCreak / grab sounds synthesize without throwing', ['whisper', 'lowLaugh', 'mockCreak'].every(k => syn[k] === true) && syn.grab === true, JSON.stringify(syn));
  const setup = () => { const c = ART.CFG.taunts; c.chance = [1, 1, 1, 1, 1]; c.gapSec = [[0, 0], [1, 1], [1, 1], [1, 1], [1, 1]]; c.perNightMax = [9, 3, 9, 9, 9]; c.quietAfterScareSec = 8; window.__pl = []; const p = ART.taunts.play; ART.taunts.play = function (id) { window.__pl.push(id); ART.taunts.last = id; return true; }; window.__orig = p; };
  await pg.evaluate(setup);
  await arm(pg, 1, false); T('night 1: no taunts in 120 ticks', await pg.evaluate(() => { window.__pl = []; for (let i = 0; i < 120; i++) ART.taunts.tick(1); return window.__pl.length === 0; }));
  await arm(pg, 2, false);
  const cap = await pg.evaluate(() => { window.__pl = []; ART.S.lastScareT = -999; for (let i = 0; i < 120; i++) ART.taunts.tick(1); return window.__pl.slice(); });
  T('per-night cap respected (cap 3 on night 2)', cap.length === 3, JSON.stringify(cap));
  T('never the same kind twice in a row', cap.every((k, i) => !i || k !== cap[i - 1]));
  await arm(pg, 3, false); await pg.evaluate(() => { ART.CFG.taunts.perNightMax = [9, 9, 99, 9, 9]; });
  const var3 = await pg.evaluate(() => { window.__pl = []; for (let i = 0; i < 300; i++) ART.taunts.tick(1); return window.__pl.slice(); });
  T('variety over 300 s: all 3 kinds heard, no immediate repeat', ['whisper', 'lowLaugh', 'mockCreak'].every(k => var3.includes(k)) && var3.every((k, i) => !i || k !== var3[i - 1]), var3.length + ' played');
  for (const [name, f] of [['scare', () => { ART.S.scareBusy = true; }], ['puzzle', () => { ART.S.puzzle = true; }], ['grab', () => { ART.S.grabOn = true; }], ['feed scare', () => { ART.S.feedScareOn = true; }]]) {
    await arm(pg, 3, false); const q = await pg.evaluate((fs) => { (new Function('return ' + fs))()(); window.__pl = []; for (let i = 0; i < 100; i++) ART.taunts.tick(1); const n = window.__pl.length; ART.S.scareBusy = false; ART.S.puzzle = false; ART.S.grabOn = false; ART.S.feedScareOn = false; return n; }, f.toString());
    T('silent during ' + name, q === 0, String(q));
  }
  await arm(pg, 3, false); T('quiet window: nothing within quietAfterScareSec of a scare', await pg.evaluate(() => { const S = ART.S; S.scareBusy = true; ART.taunts.tick(1); S.scareBusy = false; window.__pl = []; for (let i = 0; i < 6; i++) { ART.taunts.tick(1); } return window.__pl.length === 0; }));
  T('enabled:false switches taunts off', await pg.evaluate(() => { ART.CFG.taunts.enabled = false; window.__pl = []; for (let i = 0; i < 100; i++) ART.taunts.tick(1); ART.CFG.taunts.enabled = true; return window.__pl.length === 0; }));
  T('taunts: no page errors', errs.length === 0, errs.join('|')); await b.close();
  console.log(R.join('\n')); const f = R.filter(x => x.startsWith('FAIL')).length; console.log(`taunts: ${R.length - f}/${R.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
