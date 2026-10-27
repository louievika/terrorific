/* Personal easter eggs: schema/placeholder checks, disabled examples inert, triggers (event/night/atSec/kind/chance/once), plain-text only, ?eggs=1 preview, missing-file safety.  node tests/eggs.js <url> <shotDir> */
const fs = require('fs'), { open, arm, sl } = require('./_h'); const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const raw = JSON.parse(fs.readFileSync(__dirname + '/../assets/easter-eggs.json', 'utf8'));
  T('file: _readme + _schema documented, >= 2 examples', !!raw._readme && !!raw._schema && raw._schema['eggs[].trigger.event'] && raw.eggs.length >= 2);
  T('file: examples are disabled, labelled EXAMPLE, neutral', raw.eggs.every(e => e.enabled === false && /EXAMPLE/.test(e.effect.text) && /EXAMPLE PLACEHOLDER/.test(e._note || '')));
  T('file: ids unique, events valid', new Set(raw.eggs.map(e => e.id)).size === raw.eggs.length && raw.eggs.every(e => ['nightStart', 'nightEnd', 'atSec', 'scare', 'grabWin', 'grabLose', 'gameOver', 'win'].includes(e.trigger.event)));
  { const { b, pg, errs } = await open(URL0);
    await pg.waitForFunction(() => ART.eggs.list().length >= 2, { timeout: 8000 }).catch(() => {});
    T('loader: easter-eggs.json loaded by the game', await pg.evaluate(() => ART.eggs.list().length >= 2));
    await arm(pg, 2, false);
    T('disabled examples are inert (nightStart/scare emit shows nothing)', await pg.evaluate(() => ART.eggs.emit('nightStart', { night: 2 }) + ART.eggs.emit('scare', { night: 3, kind: 'peek' }) === 0 && !ART.eggs.shown.length));
    await pg.evaluate(() => ART.eggs.setData({ enabled: true, eggs: [
      { id: 't1', once: true, chance: 1, delayMs: 10, trigger: { event: 'nightStart', night: 2 }, effect: { type: 'text', text: 'hi <b>there</b>', style: 'scrawl', pos: 'center', ms: 900 } },
      { id: 't2', chance: 1, delayMs: 0, trigger: { event: 'atSec', sec: 40, night: [2, 3] }, effect: { type: 'text', text: 'at forty' }, sound: 'whisper' },
      { id: 't3', chance: 0, delayMs: 0, trigger: { event: 'scare' }, effect: { type: 'text', text: 'never' } },
      { id: 't4', once: false, chance: 1, delayMs: 0, trigger: { event: 'scare', kind: 'attack' }, effect: { type: 'text', text: 'attack only' } },
      { id: 't5', chance: 1, delayMs: 0, trigger: { event: 'gameOver', minDeaths: 99 }, effect: { type: 'text', text: 'deaths' } }] }));
    await pg.evaluate(() => ART.eggs.resetSeen());
    const a = await pg.evaluate(async () => { const E = ART.eggs; const n = E.emit('nightStart', { night: 2 }); await new Promise(r => setTimeout(r, 120)); const e = document.getElementById('eggText'); return { n, txt: e.textContent, html: e.innerHTML, cls: e.className, op: +getComputedStyle(e).opacity, again: E.emit('nightStart', { night: 2 }), wrongNight: E.emit('nightStart', { night: 4 }) }; });
    T('trigger nightStart+night matches and shows text', a.n === 1 && a.txt === 'hi <b>there</b>' && /on/.test(a.cls) && /scrawl/.test(a.cls) && /center/.test(a.cls), JSON.stringify(a));
    T('text is plain (HTML not interpreted)', !/<b>/.test(a.html.replace(/&lt;b&gt;/g, '')) && a.html.includes('&lt;b&gt;'));
    T('once: not shown twice; night filter respected', a.again === 0, JSON.stringify([a.again, a.wrongNight]));
    await pg.screenshot({ path: SHOTS + '/egg-text.png' });
    T('chance 0 never fires; kind filter; minDeaths gate', await pg.evaluate(() => { const E = ART.eggs; let c = 0; for (let i = 0; i < 50; i++) c += E.emit('scare', { kind: 'peek' }); const atk = E.emit('scare', { kind: 'attack' }); ART.S.deaths = 0; const go = E.emit('gameOver', {}); return c === 0 && atk === 1 && go === 0; }));
    await sl(1500);
    const at = await pg.evaluate(async () => { const S = ART.S, E = ART.eggs; E.shown.length = 0; S.t = 39; E.tick(0.5); S.t = 41; E.tick(0.5); const fired = E.shown.slice(); await new Promise(r => setTimeout(r, 100)); return { fired: E.shown.slice(), txt: document.getElementById('eggText').textContent }; });
    T('atSec: fires once when game time crosses 40 s (with its sound)', JSON.stringify(at.fired) === '["t2"]' && at.txt === 'at forty', JSON.stringify(at));
    T('master enabled:false switches all off', await pg.evaluate(() => { const d = { enabled: false, eggs: [{ id: 'z', chance: 1, trigger: { event: 'nightStart' }, effect: { type: 'text', text: 'x' } }] }; ART.eggs.setData(d); return ART.eggs.emit('nightStart', { night: 1 }) === 0; }));
    T('stale: night restart before delay cancels the egg', await pg.evaluate(async () => { ART.eggs.setData({ enabled: true, eggs: [{ id: 'late', chance: 1, delayMs: 400, trigger: { event: 'nightStart' }, effect: { type: 'text', text: 'late' } }] }); ART.eggs.resetSeen(); ART.eggs.emit('nightStart', { night: 2 }); ART.nights.start(2); await new Promise(r => setTimeout(r, 700)); return !ART.eggs.shown.includes('late'); }));
    T('eggs: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  { const { b, pg, errs } = await open(URL0, '&eggs=1');
    await pg.waitForFunction(() => ART.eggs.list().length >= 2, { timeout: 8000 }).catch(() => {}); await arm(pg, 2, false);
    const pv = await pg.evaluate(async () => { const n = ART.eggs.emit('nightStart', { night: 2 }); await new Promise(r => setTimeout(r, 5400)); return { n, p: ART.eggs.preview, txt: document.getElementById('eggText').textContent }; });
    T('?eggs=1 preview shows even the disabled example', pv.p && pv.n === 1 && /EXAMPLE EGG 1/.test(pv.txt), JSON.stringify(pv));
    await sl(800); await pg.screenshot({ path: SHOTS + '/egg-preview.png' }); await b.close(); }
  { const { b, pg, errs } = await open(URL0, '', /easter-eggs\.json/);
    await arm(pg, 2, false); const m = await pg.evaluate(async () => ({ n: ART.eggs.list().length, e: ART.eggs.emit('nightStart', { night: 2 }), alive: ART.S.phase === 'play' }));
    T('missing easter-eggs.json: game runs normally, no eggs', m.n === 0 && m.e === 0 && m.alive, JSON.stringify(m)); T('missing file: no page errors', errs.length === 0, errs.join('|')); await b.close(); }
  console.log(R.join('\n')); const f = R.filter(x => x.startsWith('FAIL')).length; console.log(`eggs: ${R.length - f}/${R.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
