/* Phase D voice test: lines.json contract, files fetched + decoded in the unlocked context, intro/night/win/bad wiring, taunts only in a scare payoff after the 500 ms silence
   and rare, lore text fades in word-by-word from the timings, text-only fallback when every voice file 404s, no new UI. Run via run-all.js or: node tests/voice.js <url> <shotDir> */
const p = require('puppeteer-core'), fs = require('fs'), path = require('path'); const sl = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.argv[2] || 'http://localhost:8077/game.html', SHOTS = process.argv[3] || '/tmp/art-shots'; fs.mkdirSync(SHOTS, { recursive: true });
async function open(block, fast) {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  const hits = {}; await pg.setRequestInterception(true);
  pg.on('request', r => { const u = r.url(); if (/assets\/voice\//.test(u)) { hits[u.split('/').pop()] = 1; if (block) return r.respond({ status: 404, body: 'nope' }); } r.continue(); });
  await pg.goto(URL0 + (fast ? '?fast=' + fast : ''), { waitUntil: 'load' }); await sl(3000);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); });
  return { b, pg, errs, hits };
}
(async () => {
  const R = []; const T = (n, ok, x) => R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : ''));
  const root = path.join(__dirname, '..');
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets/voice/lines.json'), 'utf8')), L = meta.lines, by = id => L.find(l => l.id === id);
  T('lines.json: 12+ lines', L.length >= 12, L.length);
  T('every line 5-15 words with word timings that match', L.every(l => { const n = l.text.split(/\s+/).length; return n >= 5 && n <= 15 && l.words.length === n && l.words.every((w, i) => w.t1 > w.t0 && (i === 0 || w.t0 >= l.words[i - 1].t0)) && l.words[l.words.length - 1].t1 <= l.duration + 0.05; }));
  const need = ['intro', 'night1', 'night2', 'night3', 'night4', 'night5', 'taunt1', 'taunt2', 'taunt3', 'lore_receipt', 'lore_diary', 'lore_call', 'win', 'bad'];
  T('required line ids exist (intro, 5 nights, 3 taunts, 3 lore, win, bad)', need.every(i => by(i)), need.filter(i => !by(i)).join());
  T('all voice files exist on disk and are < 60 KB', L.every(l => fs.existsSync(path.join(root, l.file)) && fs.statSync(path.join(root, l.file)).size < 60000));
  T('title.html has no voice', !/voice/i.test(fs.readFileSync(path.join(root, 'title.html'), 'utf8')));
  T('title screen never calls voice', !/title/i.test(fs.readFileSync(path.join(root, 'js/voice.js'), 'utf8').replace(/The title screen never calls this module\./, '')));

  /* ---- A: normal run ---- */
  let { b, pg, errs, hits } = await open(false, 6);
  await pg.tap('#authBtn'); await sl(1800);
  let o = await pg.evaluate(() => ({ ready: ART.voice.ready(), state: ART.A.ctx.state, ids: ART.voice.ids(), said: ART.voice.said(), vd: !!ART.A.vduck, durs: ART.voice.ready().map(i => [i, ART.voice.duration(i), ART.voice.line(i).duration]) }));
  T('all voice files fetched', Object.keys(hits).filter(k => k.endsWith('.mp3')).length === L.length, Object.keys(hits).length);
  T('all lines decoded in the unlocked context', o.ready.length === L.length && o.state === 'running', o.ready.length + ' ' + o.state);
  T('decoded durations match lines.json (+-0.15 s)', o.durs.every(d => Math.abs(d[1] - d[2]) < 0.15), JSON.stringify(o.durs.filter(d => Math.abs(d[1] - d[2]) >= 0.15)));
  T('ambient has its own voice duck gain', o.vd);
  T('title/login: nothing said before the tap and intro not yet at 1.8 s (waits for the room)', o.said.length === 0, o.said.join());
  await sl(2200);
  o = await pg.evaluate(() => ({ said: ART.voice.said(), ls: localStorage.getItem('art_login_voice_v1') }));
  T('first run: intro plays once night 1 is underway', o.said[0] === 'intro' && o.ls === '1', o.said.join());
  const vd = await pg.evaluate(async () => { await new Promise(r => setTimeout(r, 400)); return ART.A.vduck.gain.value; });
  T('ambient ducked while Art speaks', vd < 0.9, vd);
  await pg.evaluate(() => __game.N ? 0 : 0);
  // retry night 1 -> opening line, not intro
  await pg.evaluate(() => { ART.nights.start(1); }); await sl(1800);
  o = await pg.evaluate(() => ART.voice.said()); T('second start of night 1 says night1 (intro is first-run only)', o[o.length - 1] === 'night1', o.join());
  for (const n of [2, 3, 4, 5]) { await pg.evaluate(n => ART.nights.start(n), n); await sl(1800); o = await pg.evaluate(() => ART.voice.said()); T('night ' + n + ' opening plays', o[o.length - 1] === 'night' + n, o[o.length - 1]); }
  await pg.evaluate(() => ART.nights.start(2)); await sl(100);
  o = await pg.evaluate(() => ART.voice.said().length); await pg.evaluate(() => ART.nights.start(3)); await sl(300);
  T('a new night cancels a pending line', await pg.evaluate(n => ART.voice.said().length === n, o));

  /* taunts: only in the payoff, >=500 ms after the silence beat */
  await pg.evaluate(() => { ART.nights.start(3); ART.voice.stop(); ART.voice.resetTaunts(); const m = ART.manifest.voice.taunt; m.chance = { peek: 1, lightsout: 1, attack: 1 }; m.minGapSec = 0;
    window.__tl = []; const A = ART.A, d = A.duckTo; A.duckTo = function (v) { if (v === 0) __tl.push(['silence', performance.now()]); return d.apply(A, arguments); };
    const s = ART.voice.say; ART.voice.say = function (id) { if (/^taunt/.test(id)) __tl.push(['taunt', performance.now(), id]); return s.apply(this, arguments); };
    const st = A.sting; A.sting = function () { __tl.push(['payoff', performance.now()]); return st.apply(A, arguments); }; });
  await sl(2500);
  await pg.evaluate(() => { ART.art.scare('peek', () => {}); }); await sl(2600);
  let tl = await pg.evaluate(() => __tl); const t = k => (tl.find(x => x[0] === k) || [])[1];
  T('scare: silence -> 500 ms -> payoff order', t('silence') && t('payoff') - t('silence') >= 495, tl.map(x => x[0] + ':' + Math.round(x[1] - tl[0][1])).join(' '));
  T('taunt is requested in the payoff beat, after the silence', t('taunt') && t('taunt') >= t('payoff') - 5 && t('taunt') - t('silence') >= 500, JSON.stringify(tl.map(x => x[0])));
  o = await pg.evaluate(() => ART.voice.said()); T('a taunt actually played after the scare', /^taunt/.test(o[o.length - 1]), o[o.length - 1]);
  // never before night 2, rate-limited, and rare with the shipped numbers
  const rare = await pg.evaluate(() => {
    const m = ART.manifest.voice.taunt; m.chance = { peek: 0.18, lightsout: 0.32, attack: 0.3 }; m.minGapSec = 75; const V = ART.voice, S = ART.S, r = {};
    S.night = 1; V.resetTaunts(); r.n1 = V.taunt('lightsout'); S.night = 3; let hit = 0; for (let i = 0; i < 400; i++) { V.resetTaunts(); if (V.taunt('peek')) hit++; V.stop(); } r.peek = hit / 400;
    V.resetTaunts(); let tries = 0; while (!V.taunt('lightsout') && tries++ < 200); r.gapBlocks = tries < 200 && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(() => !V.taunt('lightsout')); V.stop(); return r; });
  T('no taunts on night 1', rare.n1 === false);
  T('taunt rate on a peek is rare (about 18%)', rare.peek > 0.08 && rare.peek < 0.3, rare.peek);
  T('taunts are rate-limited (75 s gap)', rare.gapBlocks === true);

  /* win / bad */
  await pg.evaluate(() => { ART.voice.stop(); ART.S.night = 5; ART.S.phase = 'play'; ART.nights.finish(); }); await sl(3000);
  o = await pg.evaluate(() => ({ said: ART.voice.said(), win: document.getElementById('win').classList.contains('active') })); T('win screen says the win line', o.win && o.said.pop() === 'win', JSON.stringify(o));
  await pg.evaluate(() => { ART.voice.stop(); ART.nights.capBad(); }); await sl(2000);
  o = await pg.evaluate(() => ART.voice.said()); T('bad ending says the bad line', o.pop() === 'bad');

  /* lore: word fade-in from timings (receipt/diary under the doc, call = hijacks the caretaker call) */
  const poll = async (shot, max) => {                                   // sample the lore screen until the Continue button shows
    const seen = { zero: false, partial: false, shot: false }; let st; const t0 = Date.now();
    while (Date.now() - t0 < max) {
      st = await pg.evaluate(() => ({ on: document.querySelectorAll('#loreArt .aw.on').length, tot: document.querySelectorAll('#loreArt .aw').length, next: document.getElementById('loreNext').classList.contains('show'), said: ART.voice.said().pop(), txtAlpha: getComputedStyle(document.getElementById('loreArt')).opacity }));
      if (st.tot && st.on === 0) seen.zero = true;
      if (st.on > 2 && st.on < st.tot) { seen.partial = true; if (!seen.shot && shot) { seen.shot = true; await pg.screenshot({ path: SHOTS + '/' + shot + '-mid.png' }); } }
      if (st.next) break; await sl(250);
    }
    if (shot) await pg.screenshot({ path: SHOTS + '/' + shot + '-end.png' }); return Object.assign(st, seen);
  };
  for (const idx of [1, 2, 3]) {
    await pg.evaluate(i => { ART.voice.stop(); ART.S.night = 1; ART.ui.showLore(ART.CFG.lore[i], 1, () => {}); }, idx);
    const e = await poll('voice-lore-' + idx, 30000);
    T('lore ' + idx + ': words fade in progressively (hidden -> partial -> all)', e.partial && e.on === e.tot && e.tot >= 9, JSON.stringify(e));
    T('lore ' + idx + ': Art speaks it and the screen continues', e.said === ['', 'lore_receipt', 'lore_diary', 'lore_call'][idx] && e.next, JSON.stringify(e));
  }
  const ui = await pg.evaluate(() => ({ inGame: !!document.querySelector('#game #loreArt'), badIds: ['voiceBtn', 'muteBtn', 'speaker', 'subtitle', 'captions', 'voiceToggle'].filter(i => document.getElementById(i)), art: [...document.querySelectorAll('.artline')].length }));
  T('no mute / speaker / subtitle elements, voice text lives only on the lore screen', !ui.inGame && ui.badIds.length === 0 && ui.art === 1, JSON.stringify(ui));
  const mfs = await pg.evaluate(() => ART.A.ctx.state); T('context still running', mfs === 'running');
  T('no console errors (voice on)', errs.length === 0, errs.join(' | ')); await b.close();

  /* ---- B: every voice file (and lines.json) 404 -> text-only ---- */
  ({ b, pg, errs, hits } = await open(true, 6));
  await pg.tap('#authBtn'); await sl(3500);
  o = await pg.evaluate(() => ({ ready: ART.voice.ready(), ids: ART.voice.ids(), phase: ART.S.phase }));
  T('fallback: nothing decoded, game still runs', o.ready.length === 0 && o.phase === 'play', JSON.stringify(o));
  await pg.evaluate(() => { try { ART.voice.say('intro'); ART.voice.taunt('peek', true); } catch (e) { window.__thr = String(e); } ART.ui.showLore(ART.CFG.lore[1], 1, () => {}); });
  await sl(300); const fb = await poll(null, 30000);
  o = await pg.evaluate(() => ({ thr: window.__thr || null, on: document.querySelectorAll('#loreArt .aw.on').length, tot: document.querySelectorAll('#loreArt .aw').length, txt: document.getElementById('loreArt').innerText, next: document.getElementById('loreNext').classList.contains('show') }));
  T('fallback: voice calls are harmless without audio', o.thr === null, o.thr);
  T('fallback: lore text still fades in (proportional timing) and continues', o.tot >= 9 && o.on === o.tot && o.next && /costume/.test(o.txt), JSON.stringify(o));
  const bad = errs.filter(e => !/404|Failed to load resource/.test(e)); T('fallback: no errors other than the expected 404s', bad.length === 0, bad.join(' | ')); await b.close();

  console.log(R.join('\n')); const n = R.filter(x => x.startsWith('PASS')).length; console.log('VOICE TESTS: ' + n + '/' + R.length + ' pass'); process.exit(n === R.length ? 0 : 1);
})();
